"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { API_BASE } from "../lib/api";
import { getDeviceId, getSessionId } from "../lib/activity";
import { groupInviteTracking } from "../lib/inviteTracking";

export { getSessionId } from "../lib/activity";

const METRIC_REFERRER_MAX_LENGTH = 500;

function deviceType() {
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function normalizeMetricReferrer(referrer: string) {
  if (!referrer) return null;

  try {
    const url = new URL(referrer);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return `${url.origin}${url.pathname}`.slice(0, METRIC_REFERRER_MAX_LENGTH);
    }
  } catch {
    // Keep non-URL referrers as-is within the storage limit.
  }

  return referrer.slice(0, METRIC_REFERRER_MAX_LENGTH);
}

export function trackMetric(eventType: string, path?: string, durationMs = 0, meta?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const currentPath = path ?? window.location.pathname;
  const inviteTracking = groupInviteTracking(window.location.pathname, window.location.search);

  const body = JSON.stringify({
    eventType,
    sessionId: getSessionId(),
    path: currentPath,
    referrer: normalizeMetricReferrer(inviteTracking?.referrer ?? document.referrer),
    durationMs,
    device: deviceType(),
    deviceId: getDeviceId(),
    meta: inviteTracking ? { ...meta, inviteSource: inviteTracking.source } : meta,
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
    credentials: "include",
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
