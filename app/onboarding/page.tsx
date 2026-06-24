"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../lib/api";
import { authFetch } from "../lib/auth";

type Recommendation = {
  id: number;
  nickname: string;
  profileImage: string | null;
  bio: string | null;
  score: number;
};

const GENRES = ["문학", "에세이", "인문", "사회", "과학", "경제", "역사", "철학", "시", "추리", "판타지", "자기계발"];

export default function OnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [following, setFollowing] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authFetch(`${API_BASE}/api/users/me/onboarding/recommendations`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setRecommendations(json?.data ?? []))
      .catch(() => setRecommendations([]));
  }, []);

  function toggleGenre(genre: string) {
    setSelected((prev) =>
      prev.includes(genre)
        ? prev.filter((item) => item !== genre)
        : prev.length >= 5
          ? prev
          : [...prev, genre]
    );
  }

  async function follow(userId: number) {
    const res = await authFetch(`${API_BASE}/api/users/${userId}/follow`, { method: "POST" });
    if (res.ok || res.status === 409) {
      setFollowing((prev) => new Set(prev).add(userId));
    }
  }

  async function finish() {
    setSaving(true);
    const res = await authFetch(`${API_BASE}/api/users/me/onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genres: selected }),
    });
    setSaving(false);
    if (res.ok) router.replace("/");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-7">
        <h1 className="font-serif text-2xl font-bold text-brown-800">취향을 알려주세요</h1>
        <p className="mt-1 text-sm text-brown-400">관심 장르와 이웃을 고르면 피드가 더 빨리 살아나요.</p>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-brown-700">관심 장르</h2>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => toggleGenre(genre)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                selected.includes(genre)
                  ? "border-brown-600 bg-brown-600 text-white"
                  : "border-cream-300 bg-white text-brown-500 hover:border-brown-300"
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-brown-700">팔로우 추천</h2>
        <div className="flex flex-col gap-2">
          {recommendations.map((user) => (
            <div key={user.id} className="flex items-center gap-3 rounded-lg border border-cream-200 bg-white px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-200 text-sm font-semibold text-brown-600">
                {user.profileImage ? <img src={user.profileImage} alt="" className="h-10 w-10 rounded-full object-cover" /> : user.nickname.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-brown-800">{user.nickname}</p>
                <p className="truncate text-xs text-brown-400">{user.bio || "책도장 독자"}</p>
              </div>
              <button
                type="button"
                onClick={() => follow(user.id)}
                disabled={following.has(user.id)}
                className="rounded-full border border-brown-300 px-3 py-1.5 text-xs text-brown-600 disabled:border-cream-300 disabled:text-brown-300"
              >
                {following.has(user.id) ? "팔로잉" : "팔로우"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={finish}
        disabled={saving}
        className="w-full rounded-xl bg-brown-600 py-3 text-sm font-medium text-white hover:bg-brown-700 disabled:opacity-50"
      >
        {saving ? "저장 중..." : "책도장 시작하기"}
      </button>
    </div>
  );
}
