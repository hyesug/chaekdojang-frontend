"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { API_BASE } from "../lib/api";

function getSessionId() {
  const key = "chaekdojang_session_id";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(key, id);
  return id;
}

function deviceType() {
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

export function trackMetric(eventType: string, path?: string, durationMs = 0) {
  if (typeof window === "undefined") return;
  const currentPath = path ?? window.location.pathname;
  if (currentPath.startsWith("/admin")) return;

  const body = JSON.stringify({
    eventType,
    sessionId: getSessionId(),
    path: currentPath,
    referrer: document.referrer || null,
    durationMs,
    device: deviceType(),
  });

  const token: string | null = "cookie-session";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token && token !== "undefined" && token !== "null") {
    headers.Authorization = `Bearer ${token}`;
  }

  fetch(`${API_BASE}/api/metrics/events`, {
    method: "POST",
    headers,
    body,
    keepalive: true,
  }).catch(() => {});
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const enteredAtRef = useRef<number | null>(null);
  const lastPathRef = useRef(pathname);
  const mountedRef = useRef(false);

  useEffect(() => {
    const now = Date.now();
    if (!mountedRef.current) {
      mountedRef.current = true;
      enteredAtRef.current = now;
      lastPathRef.current = pathname;
      trackMetric("page_view", pathname);
      return;
    }

    const previousPath = lastPathRef.current;
    trackMetric("session_end", previousPath, now - (enteredAtRef.current ?? now));

    enteredAtRef.current = now;
    lastPathRef.current = pathname;
    trackMetric("page_view", pathname);
  }, [pathname]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      trackMetric("heartbeat", lastPathRef.current, now - (enteredAtRef.current ?? now));
    }, 30000);

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        const now = Date.now();
        trackMetric("session_end", lastPathRef.current, now - (enteredAtRef.current ?? now));
      }
    };

    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handleVisibility);
    };
  }, []);

  return null;
}
