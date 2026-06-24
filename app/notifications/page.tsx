"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE } from "../lib/api";

const BASE = API_BASE;

type NotificationType = "LIKE" | "COMMENT" | "FOLLOW" | "SAME_BOOK_REVIEW";

type Notification = {
  id: number;
  type: NotificationType;
  senderNickname: string;
  senderProfileImage: string | null;
  targetId: number | null;
  message: string;
  isRead: boolean;
  createdAt: string;
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return "cookie-session";
}

function typeIcon(type: NotificationType) {
  switch (type) {
    case "LIKE": return "♥";
    case "COMMENT": return "💬";
    case "FOLLOW": return "👤";
    case "SAME_BOOK_REVIEW": return "📚";
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }

    fetch(`${BASE}/api/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (json) setNotifications(json.data ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function notifyBell() {
    window.dispatchEvent(new Event("notification-read"));
  }

  async function deleteAllNotifications() {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/api/notifications`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
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
    await fetch(`${BASE}/api/notifications/read-all`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    notifyBell();
  }

  async function markAsRead(id: number) {
    const token = getToken();
    if (!token) return;
    await fetch(`${BASE}/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
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
      const res = await fetch(`${BASE}/api/notifications/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
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
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => markAsRead(n.id)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-colors cursor-pointer ${
                n.isRead ? "bg-white border border-cream-200" : "bg-cream-100 border border-cream-300"
              }`}
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
                <p className="text-xs text-brown-300 mt-0.5">{n.createdAt.slice(0, 10)}</p>
              </div>

              {/* 읽지 않음 표시 */}
              {!n.isRead && (
                <div className="w-2 h-2 rounded-full bg-brown-500 flex-shrink-0" />
              )}

              {/* 삭제 */}
              <button
                onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                className="flex-shrink-0 text-xs text-brown-300 hover:text-red-400 transition-colors ml-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
