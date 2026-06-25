"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../lib/api";
import { authFetch, getValidToken } from "../lib/auth";

const BASE = API_BASE;

type NotificationType = "LIKE" | "COMMENT" | "FOLLOW" | "SAME_BOOK_REVIEW" | "GROUP_JOIN_REQUEST" | "GROUP_JOINED" | "GROUP_JOIN_APPROVED";

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

function typeIcon(type: NotificationType) {
  switch (type) {
    case "LIKE": return "♥";
    case "COMMENT": return "💬";
    case "FOLLOW": return "👤";
    case "SAME_BOOK_REVIEW": return "📚";
    case "GROUP_JOIN_REQUEST": return "👥";
    case "GROUP_JOINED": return "👥";
    case "GROUP_JOIN_APPROVED": return "✓";
  }
}

function notificationHref(notification: Notification) {
  if (
    notification.targetSlug &&
    ["GROUP_JOIN_REQUEST", "GROUP_JOINED", "GROUP_JOIN_APPROVED"].includes(notification.type)
  ) {
    return `/groups/${notification.targetSlug}`;
  }
  if (
    notification.targetId !== null &&
    ["LIKE", "COMMENT", "SAME_BOOK_REVIEW"].includes(notification.type)
  ) {
    return `/reviews/${notification.targetId}`;
  }
  return null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-brown-800">알림</h1>
          {unreadCount > 0 && (
            <p className="text-xs text-brown-400 mt-0.5">읽지 않은 알림 {unreadCount}개</p>
          )}
        </div>
        {notifications.length > 0 && (
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-brown-400 hover:text-brown-600 underline underline-offset-2 transition-colors"
              >
                모두 읽음
              </button>
            )}
            <button
              onClick={deleteAllNotifications}
              className="text-xs text-brown-300 hover:text-red-400 underline underline-offset-2 transition-colors"
            >
              전체 삭제
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-brown-400">불러오는 중...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 text-brown-400">
          <p className="text-5xl mb-4">🔔</p>
          <p>아직 알림이 없어요</p>
          <p className="text-sm mt-1">좋아요, 댓글, 팔로우 알림이 여기에 표시돼요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {notifications.map((n) => {
            const href = notificationHref(n);
            return (
              <div
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
                className={`group flex items-center gap-3 rounded-2xl border px-4 py-3.5 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brown-300 ${
                  href
                    ? "cursor-pointer hover:-translate-y-0.5 hover:border-brown-300 hover:bg-white hover:shadow-md active:translate-y-0"
                    : "cursor-pointer hover:bg-cream-50"
                } ${
                  n.isRead ? "border-cream-200 bg-white" : "border-cream-300 bg-cream-100"
                }`}
                aria-label={href ? `${n.message} 상세 페이지로 이동` : `${n.message} 읽음 처리`}
              >
              {/* 타입 아이콘 */}
              <div className="w-9 h-9 rounded-full bg-brown-100 flex-shrink-0 flex items-center justify-center text-base">
                {typeIcon(n.type)}
              </div>

              {/* 내용 */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${n.isRead ? "text-brown-600" : "text-brown-800 font-medium"}`}>
                  {n.message}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-brown-300">{n.createdAt.slice(0, 10)}</p>
                  {href && (
                    <span className="text-xs font-medium text-brown-400 transition-colors group-hover:text-brown-700">
                      상세 보기 →
                    </span>
                  )}
                </div>
              </div>

              {/* 읽지 않음 표시 */}
              {!n.isRead && (
                <div className="w-2 h-2 rounded-full bg-brown-500 flex-shrink-0" />
              )}

              {/* 삭제 */}
              <button
                onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                className="flex-shrink-0 text-xs text-brown-300 hover:text-red-400 transition-colors ml-1"
                aria-label="알림 삭제"
              >
                ✕
              </button>
              {href && (
                <span className="hidden text-lg text-brown-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brown-600 sm:block">
                  →
                </span>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
