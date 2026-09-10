"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../../lib/api";
import { authFetch, getValidToken } from "../../../lib/auth";
import {
  CONTEST_STATUS_LABEL,
  ENTRY_STATUS_LABEL,
  ENTRY_TYPE_LABEL,
  formatDateTime,
  topicLabel,
  type ContestEntry,
  type ContestStatus,
  type ManageContestDetail,
} from "../../types";
import ContestForm from "../ContestForm";

const NEXT_STATUS: Partial<Record<ContestStatus, { status: ContestStatus; label: string }>> = {
  DRAFT: { status: "OPEN", label: "접수 시작" },
  OPEN: { status: "CLOSED", label: "접수 마감" },
  CLOSED: { status: "ANNOUNCED", label: "수상 발표" },
};

type AwardInput = { awardRank: string; awardName: string };

export default function ManageContestClient({ contestId }: { contestId: number }) {
  const router = useRouter();
  const [detail, setDetail] = useState<ManageContestDetail | null>(null);
  const [entries, setEntries] = useState<ContestEntry[]>([]);
  const [awards, setAwards] = useState<Record<number, AwardInput>>({});
  const [expanded, setExpanded] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [detailRes, entriesRes] = await Promise.all([
      authFetch(`${API_BASE}/api/contests/manage/contests/${contestId}`),
      authFetch(`${API_BASE}/api/contests/manage/contests/${contestId}/entries`),
    ]);

    if (detailRes.status === 401) {
      router.push("/auth/login");
      return;
    }
    if (detailRes.status === 403) {
      setError("이 공모전을 관리할 권한이 없습니다.");
      setLoading(false);
      return;
    }

    const detailJson = await detailRes.json().catch(() => null);
    const entriesJson = await entriesRes.json().catch(() => null);
    const loadedEntries: ContestEntry[] = entriesJson?.data ?? [];
    setDetail(detailJson?.data ?? null);
    setEntries(loadedEntries);
    // 이미 지정된 수상 내역을 입력값으로 되살려, 발표 전 재심사에서 그대로 고칠 수 있게 한다.
    setAwards(
      Object.fromEntries(
        loadedEntries
          .filter((entry) => entry.awardRank !== null)
          .map((entry) => [
            entry.entryId,
            { awardRank: String(entry.awardRank), awardName: entry.awardName ?? "" },
          ])
      )
    );
    setLoading(false);
  }, [contestId, router]);

  useEffect(() => {
    if (!getValidToken()) {
      router.push("/auth/login");
      return;
    }
    void load();
  }, [load, router]);

  async function changeStatus(status: ContestStatus) {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/contests/manage/contests/${contestId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message ?? "상태를 바꾸지 못했습니다.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveAwards() {
    const payload = Object.entries(awards)
      .filter(([, value]) => value.awardRank.trim() !== "" && value.awardName.trim() !== "")
      .map(([entryId, value]) => ({
        entryId: Number(entryId),
        awardRank: Number(value.awardRank),
        awardName: value.awardName.trim(),
      }));

    if (payload.length === 0) {
      setError("등수와 상 이름을 입력한 응모작이 없습니다.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/contests/manage/contests/${contestId}/awards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awards: payload }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message ?? "수상자를 저장하지 못했습니다.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-brown-400">
        불러오는 중…
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-brown-500">
        {error ?? "공모전을 찾을 수 없습니다."}
      </main>
    );
  }

  const { contest } = detail;
  const nextStatus = NEXT_STATUS[contest.status];
  const judging = contest.status === "CLOSED";
  const awardedInputCount = Object.values(awards).filter(
    (value) => value.awardRank.trim() !== "" && value.awardName.trim() !== ""
  ).length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/contests/manage" className="text-sm text-brown-400 hover:text-brown-600">
        ← 운영실
      </Link>

      <section className="mt-4 rounded-3xl border border-cream-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-cream-100 px-2.5 py-0.5 text-xs font-semibold text-brown-600">
            {CONTEST_STATUS_LABEL[contest.status]}
          </span>
          <span className="rounded-full bg-cream-100 px-2.5 py-0.5 text-xs font-semibold text-brown-600">
            {ENTRY_TYPE_LABEL[contest.entryType]}
          </span>
          <span className="text-xs text-brown-400">{contest.hostName}</span>
        </div>
        <h1 className="mt-3 font-serif text-2xl font-bold text-brown-900">{contest.title}</h1>
        <p className="mt-1 text-sm text-brown-500">{topicLabel(contest)}</p>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="응모" value={`${detail.entryCount}편`} />
          <Metric label="수상" value={`${detail.awardedCount}편`} />
          <Metric label="미수상" value={`${detail.notAwardedCount}편`} />
          <Metric label="취소" value={`${detail.withdrawnCount}편`} />
        </dl>

        <p className="mt-4 text-xs text-brown-400">
          접수 {formatDateTime(contest.submitStartAt)} ~ {formatDateTime(contest.submitEndAt)} · 발표{" "}
          {formatDateTime(contest.announceAt)}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {nextStatus && (
            <button
              type="button"
              onClick={() => changeStatus(nextStatus.status)}
              disabled={busy}
              className="rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-60"
            >
              {nextStatus.label}
            </button>
          )}
          {contest.status === "DRAFT" && (
            <button
              type="button"
              onClick={() => setEditing((previous) => !previous)}
              className="rounded-full border border-cream-200 px-4 py-2 text-sm font-semibold text-brown-700 hover:bg-cream-50"
            >
              {editing ? "수정 닫기" : "공모전 수정"}
            </button>
          )}
          <Link
            href={`/contests/${contest.id}${contest.status === "DRAFT" ? "?preview=1" : ""}`}
            className="rounded-full border border-cream-200 px-4 py-2 text-sm font-semibold text-brown-700 hover:bg-cream-50"
          >
            독자 화면으로 보기
          </Link>
        </div>

        {contest.status === "CLOSED" && (
          <p className="mt-3 text-xs leading-5 text-brown-400">
            수상자를 먼저 저장한 뒤 &lsquo;수상 발표&rsquo;를 누르세요. 발표하면 수상작이 공개되고,
            수상·미수상 알림이 응모자에게 전달됩니다.
          </p>
        )}
      </section>

      {editing && contest.status === "DRAFT" && (
        <ContestForm
          detail={detail}
          onCancel={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await load();
          }}
        />
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-brown-900">응모작</h2>
          <span className="text-xs text-brown-400">
            이메일·연락처는 제공되지 않습니다. 연락은 책도장이 대신합니다.
          </span>
        </div>

        {entries.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-cream-200 bg-white p-6 text-center text-sm text-brown-500">
            아직 응모작이 없습니다.
          </p>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              {entries.map((entry) => (
                <EntryCard
                  key={entry.entryId}
                  entry={entry}
                  judging={judging}
                  award={awards[entry.entryId]}
                  expanded={expanded.includes(entry.entryId)}
                  onToggleExpand={() =>
                    setExpanded((previous) =>
                      previous.includes(entry.entryId)
                        ? previous.filter((id) => id !== entry.entryId)
                        : [...previous, entry.entryId]
                    )
                  }
                  onAwardChange={(value) =>
                    setAwards((previous) => ({ ...previous, [entry.entryId]: value }))
                  }
                />
              ))}
            </div>

            {judging && (
              <div className="mt-5 rounded-2xl border border-brown-100 bg-white p-4 shadow-sm">
                <p className="text-sm text-brown-600">
                  등수와 상 이름을 입력한 응모작이 수상작이 됩니다. 지금 입력한{" "}
                  <strong className="text-brown-800">{awardedInputCount}편</strong>을 저장합니다.
                </p>
                <button
                  type="button"
                  onClick={saveAwards}
                  disabled={busy}
                  className="mt-3 w-full rounded-full bg-brown-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-60"
                >
                  수상자 저장
                </button>
              </div>
            )}
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-cream-50 px-3 py-2">
      <dt className="text-xs text-brown-400">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold text-brown-800">{value}</dd>
    </div>
  );
}

function EntryCard({
  entry,
  judging,
  award,
  expanded,
  onToggleExpand,
  onAwardChange,
}: {
  entry: ContestEntry;
  judging: boolean;
  award: AwardInput | undefined;
  expanded: boolean;
  onToggleExpand: () => void;
  onAwardChange: (value: AwardInput) => void;
}) {
  const current = award ?? { awardRank: "", awardName: "" };

  return (
    <article className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-brown-800">{entry.nickname}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            entry.status === "AWARDED" ? "bg-brown-700 text-white" : "bg-cream-100 text-brown-600"
          }`}
        >
          {ENTRY_STATUS_LABEL[entry.status]}
          {entry.awardName && ` · ${entry.awardName}`}
        </span>
        {entry.bookTitle && <span className="truncate text-xs text-brown-400">{entry.bookTitle}</span>}
      </div>

      {entry.entryTitle && (
        <p className="mt-2 font-serif text-base font-bold text-brown-900">{entry.entryTitle}</p>
      )}

      <p className="mt-1 text-xs text-brown-400">
        응모 {formatDateTime(entry.submittedAt)}
        {entry.contentLength > 0 && ` · ${entry.contentLength.toLocaleString()}자`}
      </p>

      {entry.reviewDeleted && (
        <p className="mt-2 text-xs text-red-600">응모자가 연결한 독후감을 삭제했습니다.</p>
      )}

      {entry.content && (
        <>
          <p
            className={`mt-2 whitespace-pre-wrap rounded-xl bg-cream-50 px-3 py-2 text-sm leading-7 text-brown-600 ${
              expanded ? "" : "line-clamp-4"
            }`}
          >
            {entry.content}
          </p>
          <button
            type="button"
            onClick={onToggleExpand}
            className="mt-1 text-xs font-semibold text-brown-500 underline"
          >
            {expanded ? "접기" : "전문 보기"}
          </button>
        </>
      )}

      {entry.reviewId && !entry.reviewDeleted && (
        <Link
          href={`/reviews/${entry.reviewId}`}
          className="ml-3 inline-flex text-xs font-semibold text-brown-600 underline"
        >
          독후감 페이지로 보기
        </Link>
      )}

      {judging && entry.status !== "WITHDRAWN" && (
        <div className="mt-3 flex gap-2 border-t border-cream-100 pt-3">
          <input
            type="number"
            min={1}
            value={current.awardRank}
            onChange={(event) => onAwardChange({ ...current, awardRank: event.target.value })}
            placeholder="등수"
            className="w-20 rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800"
          />
          <input
            value={current.awardName}
            onChange={(event) => onAwardChange({ ...current, awardName: event.target.value })}
            maxLength={50}
            placeholder="상 이름 (예: 대상)"
            className="flex-1 rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800"
          />
        </div>
      )}
    </article>
  );
}
