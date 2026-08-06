"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "../lib/auth";

type Preference = {
  enabled: boolean;
  frequency: "WEEKLY" | "MONTHLY";
  includeFollowing: boolean;
  includeMemories: boolean;
  lastDeliveredAt: string | null;
};

type Issue = {
  id: number;
  periodStart: string;
  periodEnd: string;
  title: string;
  summary: string;
  ownReviewCount: number;
  followingReviewCount: number;
  savedReviewCount: number;
  continuedReviewCount: number;
  featuredReviewId: number | null;
  memoryReviewId: number | null;
  memoryBookTitle: string | null;
  read: boolean;
  createdAt: string;
};

export default function SubscriptionPage() {
  const router = useRouter();
  const [preference, setPreference] = useState<Preference | null>(null);
  const [frequency, setFrequency] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");
  const [includeFollowing, setIncludeFollowing] = useState(true);
  const [includeMemories, setIncludeMemories] = useState(true);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [preferenceResponse, issuesResponse] = await Promise.all([
      authFetch("/api/reading-recaps/preference", { cache: "no-store" }),
      authFetch("/api/reading-recaps/issues", { cache: "no-store" }),
    ]);
    if (preferenceResponse.status === 401 || issuesResponse.status === 401) {
      router.push("/auth/login");
      return;
    }
    const preferenceJson = preferenceResponse.ok ? await preferenceResponse.json() : null;
    const issueJson = issuesResponse.ok ? await issuesResponse.json() : null;
    const nextPreference = preferenceJson?.data ?? null;
    setPreference(nextPreference);
    if (nextPreference) {
      setFrequency(nextPreference.frequency);
      setIncludeFollowing(nextPreference.includeFollowing);
      setIncludeMemories(nextPreference.includeMemories);
    }
    setIssues(issueJson?.data ?? []);
  }, [router]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function savePreference() {
    setSaving(true);
    setMessage("");
    try {
      const response = await authFetch("/api/reading-recaps/preference", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequency, includeFollowing, includeMemories }),
      });
      if (!response.ok) throw new Error();
      const json = await response.json();
      setPreference(json.data);
      await authFetch("/api/reading-recaps/issues/current", { method: "POST" });
      await load();
      setMessage("기록 회고 구독을 저장했습니다. 내용이 있는 기간에만 발행합니다.");
    } catch {
      setMessage("설정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function unsubscribe() {
    const response = await authFetch("/api/reading-recaps/preference", { method: "DELETE" });
    if (response.ok) {
      setPreference((current) => current ? { ...current, enabled: false } : null);
      setMessage("새 회고 발행을 중지했습니다. 이미 발행된 회고는 그대로 볼 수 있습니다.");
    }
  }

  async function markRead(issue: Issue) {
    if (issue.read) return;
    await authFetch(`/api/reading-recaps/issues/${issue.id}/read`, { method: "PATCH" });
    setIssues((current) => current.map((item) => item.id === issue.id ? { ...item, read: true } : item));
  }

  if (loading) return <main className="mx-auto max-w-2xl px-4 py-16 text-center text-brown-400">회고 구독을 불러오는 중...</main>;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div>
        <p className="text-xs font-semibold text-sage-700">결제·마케팅 구독과 별개</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-brown-900">기록 회고 구독</h1>
        <p className="mt-2 text-sm leading-6 text-brown-500">
          책도장 안에 쌓인 내 기록을 정해진 주기로 다시 꺼내 드립니다. 이메일은 보내지 않으며 이 화면에만 발행됩니다.
        </p>
      </div>

      <section className="mt-6 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg font-bold text-brown-800">발행 설정</h2>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["WEEKLY", "MONTHLY"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setFrequency(value)} className={`rounded-xl border px-4 py-3 text-sm ${frequency === value ? "border-brown-600 bg-brown-700 text-white" : "border-cream-300 text-brown-500"}`}>
              {value === "WEEKLY" ? "매주" : "매월"}
            </button>
          ))}
        </div>
        <label className="mt-4 flex items-center justify-between rounded-xl bg-cream-50 px-4 py-3 text-sm text-brown-600">
          팔로우한 독자의 새 공개 독후감 포함
          <input type="checkbox" checked={includeFollowing} onChange={(event) => setIncludeFollowing(event.target.checked)} className="h-5 w-5" />
        </label>
        <label className="mt-2 flex items-center justify-between rounded-xl bg-cream-50 px-4 py-3 text-sm text-brown-600">
          1년 전 내 기록 포함
          <input type="checkbox" checked={includeMemories} onChange={(event) => setIncludeMemories(event.target.checked)} className="h-5 w-5" />
        </label>
        <p className="mt-3 text-xs leading-5 text-brown-400">새 기록·저장·이어쓰기·과거 기록이 하나도 없으면 빈 회고를 억지로 발행하지 않습니다.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={savePreference} disabled={saving} className="rounded-full bg-brown-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "저장 중..." : preference?.enabled ? "설정 저장" : "회고 구독 시작"}
          </button>
          {preference?.enabled && <button type="button" onClick={unsubscribe} className="rounded-full border border-cream-300 px-4 py-2.5 text-sm text-brown-500">발행 중지</button>}
        </div>
        {message && <p className="mt-3 text-xs leading-5 text-brown-500">{message}</p>}
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-xl font-bold text-brown-900">발행된 회고</h2>
          <Link href="/stats" className="text-xs font-medium text-brown-500 hover:underline">독서 인생 지도 →</Link>
        </div>
        {issues.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-cream-200 bg-white px-5 py-10 text-center text-sm text-brown-400">아직 발행할 내용이 없어요. 기록이 쌓인 뒤 다시 확인해 주세요.</div>
        ) : (
          <div className="mt-3 space-y-3">
            {issues.map((issue) => (
              <article key={issue.id} onClick={() => markRead(issue)} className={`rounded-2xl border p-5 ${issue.read ? "border-cream-200 bg-white" : "border-sage-300 bg-sage-50"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="font-serif text-lg font-bold text-brown-800">{issue.title}</h3><p className="mt-1 text-xs text-brown-400">{issue.periodStart} ~ {issue.periodEnd}</p></div>
                  {!issue.read && <span className="rounded-full bg-sage-600 px-2 py-1 text-[10px] font-bold text-white">새 회고</span>}
                </div>
                <p className="mt-3 text-sm leading-6 text-brown-600">{issue.summary}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-brown-400">
                  {issue.featuredReviewId && <Link href={`/reviews/${issue.featuredReviewId}`} className="font-medium text-brown-600 hover:underline">이번 기간 기록 보기 →</Link>}
                  {issue.memoryReviewId && <Link href={`/reviews/${issue.memoryReviewId}`} className="font-medium text-brown-600 hover:underline">1년 전 『{issue.memoryBookTitle ?? "기록"}』 다시 보기 →</Link>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
