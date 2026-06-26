"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, isAuthenticated } from "../lib/auth";

type ReadingGoal = {
  year: number;
  targetCount: number | null;
  finishedCount: number;
  remainingCount: number;
  progressPercent: number;
  publicVisible: boolean;
};

const DEFAULT_GOAL = 30;

export default function ReadingGoalCard() {
  const router = useRouter();
  const [goal, setGoal] = useState<ReadingGoal | null>(null);
  const [targetCount, setTargetCount] = useState(String(DEFAULT_GOAL));
  const [publicVisible, setPublicVisible] = useState(true);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadGoal() {
      try {
        const loggedIn = await isAuthenticated();
        if (!loggedIn) return;
        const res = await authFetch("/api/users/me/reading-goal", { cache: "no-store" });
        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }
        if (!res.ok) return;
        const json = await res.json();
        const data = (json.data ?? json) as ReadingGoal;
        if (cancelled) return;
        setGoal(data);
        setTargetCount(String(data.targetCount ?? DEFAULT_GOAL));
        setPublicVisible(data.publicVisible);
        setEditing(data.targetCount == null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadGoal();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const progressWidth = useMemo(() => `${Math.min(goal?.progressPercent ?? 0, 100)}%`, [goal]);

  async function saveGoal(e: React.FormEvent) {
    e.preventDefault();
    const parsedTarget = Number(targetCount);
    if (!Number.isInteger(parsedTarget) || parsedTarget < 1 || parsedTarget > 999) {
      setMessage("목표 권수는 1권부터 999권 사이로 입력해 주세요.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const res = await authFetch("/api/users/me/reading-goal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetCount: parsedTarget, publicVisible }),
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
      const data = (json.data ?? json) as ReadingGoal;
      setGoal(data);
      setTargetCount(String(data.targetCount ?? parsedTarget));
      setPublicVisible(data.publicVisible);
      setEditing(false);
      setMessage("독서 목표를 저장했습니다.");
    } catch {
      setMessage("서버에 연결할 수 없습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !goal) return null;

  return (
    <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-brown-400">올해 독서 목표</p>
          <h2 className="mt-1 font-serif text-xl font-bold text-brown-800">
            {goal.year}년 {goal.targetCount ? `${goal.targetCount}권 목표` : "목표를 정해보세요"}
          </h2>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-brown-300 px-3 py-1.5 text-xs font-medium text-brown-600 hover:bg-cream-50"
          >
            수정
          </button>
        )}
      </div>

      {!editing ? (
        <div className="mt-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold text-brown-800">{goal.finishedCount}권</p>
              <p className="mt-1 text-xs text-brown-400">올해 완독</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-brown-700">{goal.progressPercent}%</p>
              <p className="mt-1 text-xs text-brown-400">
                {goal.remainingCount > 0 ? `${goal.remainingCount}권 남았어요` : "목표를 달성했어요"}
              </p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-cream-100">
            <div className="h-full rounded-full bg-brown-600 transition-all" style={{ width: progressWidth }} />
          </div>
          <p className="mt-3 text-xs text-brown-400">
            완독으로 표시한 책의 완료일을 기준으로 계산합니다.
          </p>
        </div>
      ) : (
        <form onSubmit={saveGoal} className="mt-4 space-y-3">
          <div>
            <label htmlFor="reading-goal-target" className="block text-sm font-medium text-brown-600">
              올해 목표 권수
            </label>
            <input
              id="reading-goal-target"
              type="number"
              min={1}
              max={999}
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-cream-300 bg-cream-50 px-4 py-2.5 text-sm text-brown-800 focus:border-brown-400 focus:outline-none focus:ring-2 focus:ring-brown-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-brown-500">
            <input
              type="checkbox"
              checked={publicVisible}
              onChange={(e) => setPublicVisible(e.target.checked)}
              className="h-4 w-4 rounded border-cream-300"
            />
            공유 프로필에 목표 진행률 공개
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-brown-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brown-700 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "목표 저장"}
            </button>
            {goal.targetCount && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 rounded-xl border border-brown-300 px-4 py-2.5 text-sm font-semibold text-brown-600 hover:bg-cream-50"
              >
                취소
              </button>
            )}
          </div>
        </form>
      )}

      {message && <p className="mt-3 text-xs text-brown-400">{message}</p>}
    </section>
  );
}
