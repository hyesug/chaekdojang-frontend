"use client";

import {
  Award, Bell, BookOpen, Check, ChevronRight, CornerUpRight, FileText, Heart, Mail, MessageCircle,
  UserPlus, Users, X, type LucideIcon,
} from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../lib/api";
import { authFetch, getValidToken } from "../lib/auth";

const BASE = API_BASE;

type NotificationType = "LIKE" | "COMMENT" | "FOLLOW" | "SAME_BOOK_REVIEW" | "GROUP_JOIN_REQUEST" | "GROUP_JOINED" | "GROUP_JOIN_APPROVED" | "REVIEW_CONTINUED" | "CAMPAIGN_SELECTED" | "CAMPAIGN_REJECTED" | "CAMPAIGN_INVITED" | "CONTEST_AWARDED" | "CONTEST_NOT_AWARDED";

type Notification = {
  id: number;
  type: NotificationType;
  senderNickname: string;
  senderProfileImage: string | null;
  targetId: number | null;
  targetSlug: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
};

function getToken(): string | null {
  return getValidToken();
}


function typeIcon(type: NotificationType): { Icon: LucideIcon; tone: string } {
  switch (type) {
    case "LIKE": return { Icon: Heart, tone: "bg-wine-50 text-wine-500" };
    case "COMMENT": return { Icon: MessageCircle, tone: "bg-brown-100 text-brown-700" };
    case "FOLLOW": return { Icon: UserPlus, tone: "bg-brown-100 text-brown-700" };
    case "SAME_BOOK_REVIEW": return { Icon: BookOpen, tone: "bg-cream-200 text-sage-700" };
    case "GROUP_JOIN_REQUEST": return { Icon: Users, tone: "bg-cream-200 text-sage-700" };
    case "GROUP_JOINED": return { Icon: Users, tone: "bg-cream-200 text-sage-700" };
    case "GROUP_JOIN_APPROVED": return { Icon: Check, tone: "bg-brown-100 text-brown-700" };
    case "REVIEW_CONTINUED": return { Icon: CornerUpRight, tone: "bg-brown-100 text-brown-700" };
    case "CAMPAIGN_SELECTED": return { Icon: Check, tone: "bg-brown-100 text-brown-700" };
    case "CAMPAIGN_REJECTED": return { Icon: BookOpen, tone: "bg-cream-200 text-sage-700" };
    case "CAMPAIGN_INVITED": return { Icon: Mail, tone: "bg-cream-200 text-sage-700" };
    case "CONTEST_AWARDED": return { Icon: Award, tone: "bg-amber-50 text-amber-600" };
    case "CONTEST_NOT_AWARDED": return { Icon: FileText, tone: "bg-cream-200 text-sage-700" };
  }
}

function notificationHref(notification: Notification) {
  if (notification.targetId !== null && notification.type === "CAMPAIGN_INVITED") {
    return `/dojangdan/campaigns/${notification.targetId}`;
  }
  if (notification.targetId !== null && ["CAMPAIGN_SELECTED", "CAMPAIGN_REJECTED"].includes(notification.type)) {
    return `/dojangdan/my#campaign-${notification.targetId}`;
  }
  if (notification.targetId !== null && ["CONTEST_AWARDED", "CONTEST_NOT_AWARDED"].includes(notification.type)) {
    return `/contests/${notification.targetId}`;
  }
  if (
    notification.targetSlug &&
    ["GROUP_JOIN_REQUEST", "GROUP_JOINED", "GROUP_JOIN_APPROVED"].includes(notification.type)
  ) {
    return `/groups/${notification.targetSlug}`;
  }
  if (
    notification.targetId !== null &&
    ["LIKE", "COMMENT", "SAME_BOOK_REVIEW", "REVIEW_CONTINUED"].includes(notification.type)
  ) {
    return `/reviews/${notification.targetId}`;
  }
  return null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unsubscribing, setUnsubscribing] = useState<number | null>(null);
  const [unsubscribed, setUnsubscribed] = useState<number[]>([]);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);

  async function unsubscribeInvitation(id: number) {
    setUnsubscribing(id);
    setSubscriptionError(null);
    try {
      const res = await authFetch(`${BASE}/api/notifications/${id}/campaign-subscription`, { method: "DELETE" });
      if (!res.ok) throw new Error("unsubscribe failed");
      setUnsubscribed((previous) => [...previous, id]);
    } catch {
      setSubscriptionError("소식 받기를 해제하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setUnsubscribing(null);
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }

    authFetch(`${BASE}/api/notifications`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (json) setNotifications(json.data ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  function notifyBell() {
    window.dispatchEvent(new Event("notification-read"));
  }

  async function deleteAllNotifications() {
    const token = getToken();
    if (!token) return;
    try {
      const res = await authFetch(`${BASE}/api/notifications`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setNotifications([]);
      notifyBell();
    } catch (e) {
      console.error("전체 삭제 오류:", e);
    }
  }

  async function markAllAsRead() {
    const token = getToken();
    if (!token) return;
    await authFetch(`${BASE}/api/notifications/read-all`, {
      method: "PATCH",
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    notifyBell();
  }

  async function markAsRead(id: number) {
    const token = getToken();
    if (!token) return;
    await authFetch(`${BASE}/api/notifications/${id}/read`, {
      method: "PATCH",
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    notifyBell();
  }

  async function deleteNotification(id: number) {
    const token = getToken();
    if (!token) return;
    try {
      const res = await authFetch(`${BASE}/api/notifications/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        console.error("알림 삭제 실패:", res.status);
        return;
      }
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      console.error("알림 삭제 오류:", e);
    }
  }

  async function openNotification(notification: Notification) {
    await markAsRead(notification.id);
    const href = notificationHref(notification);
    if (href) {
      router.push(href);
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;


  return (
    <div className="cdj-page cdj-page--reading">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="cdj-title">알림</h1>
          {unreadCount > 0 && (
            <p className="cdj-lead mt-1.5">읽지 않은 알림 <span className="font-semibold text-brown-800 tabular">{unreadCount}</span>개</p>
          )}
        </div>
        {notifications.length > 0 && (
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="cdj-button cdj-button--ghost cdj-button--sm">
                모두 읽음
              </button>
            )}
            <button onClick={deleteAllNotifications} className="cdj-button cdj-button--ghost cdj-button--sm hover:!text-wine-500">
              전체 삭제
            </button>
          </div>
        )}
      </div>

      {subscriptionError && <p role="alert" className="cdj-alert cdj-alert--error mb-4">{subscriptionError}</p>}
      {loading ? (
        <LoadingState label="알림을 불러오는 중" />
      ) : notifications.length === 0 ? (
        <EmptyState title="아직 알림이 없어요" icon={<Bell size={22} aria-hidden="true" />}>
          좋아요, 댓글, 팔로우 알림이 여기에 표시돼요
        </EmptyState>
      ) : (
        <ul className="cdj-card divide-y divide-cream-200 overflow-hidden">
          {notifications.map((n) => {
            const href = notificationHref(n);
            const { Icon, tone } = typeIcon(n.type);
            return (
              <li
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => openNotification(n)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openNotification(n);
                  }
                }}
                className={`group relative flex cursor-pointer items-start gap-3 px-4 py-4 transition-colors hover:bg-cream-100 sm:px-5 ${
                  n.isRead ? "" : "bg-brown-100/40"
                }`}
                aria-label={href ? `${n.message} 상세 페이지로 이동` : `${n.message} 읽음 처리`}
              >
                {/* 읽지 않음 표시 */}
                {!n.isRead && (
                  <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brown-700 sm:left-2" aria-label="읽지 않음" />
                )}

                {/* 타입 아이콘 */}
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${tone}`}>
                  <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
                </div>

                {/* 내용 */}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-snug ${n.isRead ? "text-brown-900/80" : "font-semibold text-brown-800"}`}>
                    {n.message}
                  </p>
                  <p className="cdj-meta mt-1">{n.createdAt.slice(0, 10).replaceAll("-", ".")}</p>
                  {n.type === "CAMPAIGN_INVITED" && (
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); void unsubscribeInvitation(n.id); }}
                      onKeyDown={(event) => event.stopPropagation()}
                      disabled={unsubscribing !== null || unsubscribed.includes(n.id)}
                      className="mt-2 text-xs text-sage-600 underline underline-offset-2 hover:text-brown-800 disabled:opacity-60"
                    >
                      {unsubscribed.includes(n.id) ? "소식 받기를 해제했습니다" : "이 출판사·작가 소식 받지 않기"}
                    </button>
                  )}
                </div>

                <div className="flex flex-shrink-0 items-center">
                  {/* 삭제 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-sage-500 transition-colors hover:bg-cream-200 hover:text-wine-500 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    aria-label="알림 삭제"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                  {href && (
                    <ChevronRight size={18} className="hidden text-sage-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brown-700 sm:block" aria-hidden="true" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}