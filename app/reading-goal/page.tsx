"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReadingGoalProgress from "../components/ReadingGoalProgress";
import { authFetch, getValidToken } from "../lib/auth";

const CURRENT_YEAR = new Date().getFullYear();

type ReadingGoal = {
  year: number;
  targetCount: number;
  finishedCount: number;
  progressPercent: number;
  remainingCount: number;
  publicVisible?: boolean;
} | null;

type UserProfile = {
  id: number;
  nickname: string;
  readingGoal: ReadingGoal;
};

export default function ReadingGoalPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [targetCount, setTargetCount] = useState("30");
  const [publicVisible, setPublicVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!getValidToken()) {
      router.push("/auth/login");
      return;
    }
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await authFetch("/api/users/me", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        const data = (json.data ?? json) as UserProfile;
        setProfile(data);
        setYear(data.readingGoal?.year ?? CURRENT_YEAR);
        setTargetCount(String(data.readingGoal?.targetCount ?? 30));
        setPublicVisible(data.readingGoal?.publicVisible ?? true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveGoal(e: React.FormEvent) {
    e.preventDefault();
    const parsedTarget = Number(targetCount);
    if (!Number.isInteger(parsedTarget) || parsedTarget < 1 || parsedTarget > 999) {
      setMessage("목표 권수는 1권 이상 999권 이하로 입력해 주세요.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const res = await authFetch("/api/users/me/reading-goal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, targetCount: parsedTarget, publicVisible }),
      });
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      if (!res.ok) {
        setMessage("독서 목표를 저장하지 못했습니다.");
        return;
      }
      const json = await res.json();
      const data = (json.data ?? json) as UserProfile;
      setProfile(data);
      setPublicVisible(data.readingGoal?.publicVisible ?? publicVisible);
      setMessage("독서 목표를 저장했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function clearGoal() {
    setSaving(true);
    setMessage("");
    try {
      const res = await authFetch("/api/users/me/reading-goal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetCount: null }),
      });
      if (res.ok) {
        const json = await res.json();
        setProfile(json.data ?? json);
        setPublicVisible(true);
        setMessage("독서 목표를 삭제했습니다.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-brown-400">불러오는 중...</div>;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4">
        <Link href="/profile" className="text-sm text-brown-400 hover:text-brown-600">← 프로필로 돌아가기</Link>
      </div>

      <section className="rounded-2xl border border-cream-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-brown-400">독서 목표</p>
        <h1 className="mt-2 font-serif text-2xl font-bold text-brown-900">올해 몇 권 읽을까요?</h1>
        <p className="mt-3 text-sm leading-6 text-brown-500">
          완독으로 표시한 책 수를 기준으로 올해 목표 달성률을 계산합니다.
        </p>
      </section>

      <div className="mt-5">
        <ReadingGoalProgress goal={profile?.readingGoal ?? null} />
      </div>

      <form onSubmit={saveGoal} className="mt-5 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-brown-600" htmlFor="goal-year">연도</label>
            <input
              id="goal-year"
              type="number"
              min={2020}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-xl border border-cream-300 bg-cream-50 px-4 py-2.5 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-brown-600" htmlFor="goal-count">목표 권수</label>
            <input
              id="goal-count"
              type="number"
              min={1}
              max={999}
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
              className="w-full rounded-xl border border-cream-300 bg-cream-50 px-4 py-2.5 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
              placeholder="예: 30"
            />
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-brown-500">
          <input
            type="checkbox"
            checked={publicVisible}
            onChange={(e) => setPublicVisible(e.target.checked)}
            className="h-4 w-4 rounded border-cream-300 accent-brown-600"
          />
          공유 프로필에 목표 진행률 공개
        </label>

        {message && <p className="mt-3 rounded-xl bg-cream-50 px-4 py-2.5 text-sm text-brown-600">{message}</p>}

        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-brown-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brown-700 disabled:opacity-50">
            {saving ? "저장 중..." : "목표 저장"}
          </button>
          <button type="button" disabled={saving || !profile?.readingGoal} onClick={clearGoal} className="rounded-xl border border-brown-200 px-4 py-2.5 text-sm font-medium text-brown-500 transition-colors hover:bg-cream-50 disabled:opacity-40">
            삭제
          </button>
        </div>
      </form>
    </main>
  );
}
