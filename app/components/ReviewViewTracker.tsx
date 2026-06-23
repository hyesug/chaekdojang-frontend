"use client";

import { useEffect } from "react";
import { API_BASE } from "../lib/api";

const VIEWED_KEY = "chaekdojang:viewed-reviews";

export default function ReviewViewTracker({ reviewId }: { reviewId: number }) {
  useEffect(() => {
    const raw = sessionStorage.getItem(VIEWED_KEY);
    const viewed = raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set<string>();
    const id = String(reviewId);
    if (viewed.has(id)) return;

    viewed.add(id);
    sessionStorage.setItem(VIEWED_KEY, JSON.stringify(Array.from(viewed).slice(-200)));

    fetch(`${API_BASE}/api/reviews/${reviewId}/view`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, [reviewId]);

  return null;
}
