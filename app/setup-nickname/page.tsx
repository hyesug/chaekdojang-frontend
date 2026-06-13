"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../lib/api";

export default function SetupNicknamePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError("닉네임을 입력해주세요.");
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 20) {
      setError("닉네임은 2~20자로 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/users/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nickname: trimmed }),
      });

      if (res.ok) {
        router.replace("/");
      } else if (res.status === 409) {
        setError("이미 사용 중인 닉네임이에요.");
      } else {
        setError("오류가 발생했어요. 다시 시도해주세요.");
      }
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-3xl mb-3">📚</p>
          <h1 className="text-xl font-bold text-brown-800">닉네임을 설정해주세요</h1>
          <p className="text-sm text-brown-400 mt-1">책인감에서 사용할 이름이에요</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임 (2~20자)"
              maxLength={20}
              className="w-full px-4 py-3 rounded-xl border border-cream-300 bg-white text-brown-800 placeholder-brown-300 focus:outline-none focus:border-brown-400 text-sm"
              autoFocus
            />
            {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brown-600 text-white rounded-xl text-sm font-medium hover:bg-brown-700 transition-colors disabled:opacity-50"
          >
            {loading ? "저장 중..." : "시작하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
