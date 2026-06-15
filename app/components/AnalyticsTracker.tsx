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

function sendMetric(eventType: string, path: string, durationMs = 0) {
  const body = JSON.stringify({
    eventType,
    sessionId: getSessionId(),
    path,
    referrer: document.referrer || null,
    durationMs,
    device: deviceType(),
  });

  const token = localStorage.getItem("token");
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
  const enteredAtRef = useRef(Date.now());
  const lastPathRef = useRef(pathname);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      sendMetric("page_view", pathname);
      return;
    }

    const previousPath = lastPathRef.current;
    const now = Date.now();
    sendMetric("session_end", previousPath, now - enteredAtRef.current);

    enteredAtRef.current = now;
    lastPathRef.current = pathname;
    sendMetric("page_view", pathname);
  }, [pathname]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      sendMetric("heartbeat", lastPathRef.current, Date.now() - enteredAtRef.current);
    }, 30000);

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        sendMetric("session_end", lastPathRef.current, Date.now() - enteredAtRef.current);
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
