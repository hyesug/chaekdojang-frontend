"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, isAuthenticated } from "../../lib/auth";

type Status = "unknown" | "guest" | "self" | "following" | "not-following";

export default function PublicProfileFollowButton({ userId }: { userId: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("unknown");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
          if (!cancelled) setStatus("guest");
          return;
        }

        const meRes = await authFetch("/api/users/me", { cache: "no-store" });
        if (!meRes.ok) {
          if (!cancelled) setStatus("guest");
          return;
        }
        const meJson = await meRes.json();
        const me = meJson.data ?? meJson;
        if (me.id === userId) {
          if (!cancelled) setStatus("self");
          return;
        }

        const statusRes = await authFetch(`/api/users/${userId}/follow/status`, { cache: "no-store" });
        if (!statusRes.ok) {
          if (!cancelled) setStatus("not-following");
          return;
        }
        const statusJson = await statusRes.json();
        const following = Boolean(statusJson.data ?? statusJson);
        if (!cancelled) setStatus(following ? "following" : "not-following");
      } catch {
        if (!cancelled) setStatus("guest");
      }
    }

    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function toggleFollow() {
    if (status === "guest") {
      router.push("/auth/login");
      return;
    }
    if (status === "self" || status === "unknown" || loading) return;

    const nextFollowing = status !== "following";
    setLoading(true);
    try {
      const res = await authFetch(`/api/users/${userId}/follow`, {
        method: nextFollowing ? "POST" : "DELETE",
      });
      if (res.ok || res.status === 204 || res.status === 201 || res.status === 409) {
        setStatus(nextFollowing ? "following" : "not-following");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  if (status === "self") return null;

  const label = status === "following" ? "팔로잉" : status === "guest" ? "로그인 후 팔로우" : "팔로우";
  const className = status === "following"
    ? "border-brown-300 bg-white text-brown-600 hover:bg-cream-50"
    : "border-brown-700 bg-brown-700 text-white hover:bg-brown-800";

  return (
    <button
      type="button"
      onClick={toggleFollow}
      disabled={loading || status === "unknown"}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {loading ? "처리 중..." : label}
    </button>
  );
}
