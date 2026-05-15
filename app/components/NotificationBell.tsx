"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const BASE = "http://localhost:8080";

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchUnreadCount();

    // 30초마다 새 알림 확인
    const interval = setInterval(fetchUnreadCount, 30_000);
    window.addEventListener("auth-change", fetchUnreadCount);
    return () => {
      clearInterval(interval);
      window.removeEventListener("auth-change", fetchUnreadCount);
    };
  }, []);

  async function fetchUnreadCount() {
    const token = localStorage.getItem("token");
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

  if (!mounted) return null;

  return (
    <Link
      href="/notifications"
      className="relative p-2 text-brown-500 hover:text-brown-800 transition-colors"
      aria-label="알림"
    >
      <span className="text-xl leading-none">🔔</span>
      {unread > 0 && (
        <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
