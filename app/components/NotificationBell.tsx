"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { API_BASE } from "../lib/api";

const BASE = API_BASE;

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchUnreadCount();

    // 30초마다 새 알림 확인
    const interval = setInterval(fetchUnreadCount, 30_000);
    window.addEventListener("auth-change", fetchUnreadCount);
    window.addEventListener("notification-read", fetchUnreadCount);
    return () => {
      clearInterval(interval);
      window.removeEventListener("auth-change", fetchUnreadCount);
      window.removeEventListener("notification-read", fetchUnreadCount);
    };
  }, []);

  async function fetchUnreadCount() {
    const token: string | null = "cookie-session";
    if (!token || token === "undefined" || token === "null") {
      setUnread(0);
      return;
    }
    try {
      const res = await fetch(`${BASE}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setUnread(Number(json.data ?? 0));
      } else if (res.status === 401) {
        setUnread(0);
      }
    } catch {
      /* 서버 미연결 시 무시 */
    }
  }

  // 마운트 전에도 자리를 차지해 헤더가 흔들리지 않게 한다
  if (!mounted) return <span className="inline-block h-10 w-10" aria-hidden="true" />;

  return (
    <Link
      href="/notifications"
      className="cdj-icon-button relative"
      aria-label={unread > 0 ? `알림 ${unread}개 안 읽음` : "알림"}
    >
      <Bell size={20} strokeWidth={1.75} aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-wine-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-cream-50 tabular">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
