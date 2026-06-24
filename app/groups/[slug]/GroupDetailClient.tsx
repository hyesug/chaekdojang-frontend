"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { API_BASE } from "../../lib/api";

export default function GroupDetailClient({ slug, member }: { slug: string; member: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function getToken() {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem("token");
    return !token || token === "undefined" || token === "null" ? null : token;
  }

  async function joinGroup() {
    const token = getToken();
    if (!token) {
      router.push("/auth/login");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/groups/${slug}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage("가입 요청이 처리됐어요.");
      router.refresh();
    } catch {
      setMessage("이미 가입했거나 가입 요청을 처리하지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  if (member) {
    return <p className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-600">참여 중</p>;
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={joinGroup}
        disabled={loading}
        className="rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-50"
      >
        {loading ? "처리 중..." : "모임 가입하기"}
      </button>
      {message && <p className="text-xs text-brown-400">{message}</p>}
    </div>
  );
}
