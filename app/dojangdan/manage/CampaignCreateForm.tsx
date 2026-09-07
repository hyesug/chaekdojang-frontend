"use client";

import { useState } from "react";
import { API_BASE } from "../../lib/api";
import { authFetch } from "../../lib/auth";
import type { ManagedProfile } from "../types";

type BookResult = {
  id: number;
  title: string;
  author: string;
  publisher: string;
  thumbnail: string | null;
};

type Props = {
  profiles: ManagedProfile[];
  onCreated: () => Promise<void>;
};

export default function CampaignCreateForm({ profiles, onCreated }: Props) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? 0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [book, setBook] = useState<BookResult | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [recruitCount, setRecruitCount] = useState(5);
  const [recruitStartAt, setRecruitStartAt] = useState("");
  const [recruitEndAt, setRecruitEndAt] = useState("");
  const [reviewDueAt, setReviewDueAt] = useState("");
  const [priorityInviteHours, setPriorityInviteHours] = useState(24);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchBooks() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`${API_BASE}/api/books/search?q=${encodeURIComponent(query.trim())}`);
      const json = await res.json().catch(() => null);
      setResults(json?.data ?? []);
    } finally {
      setSearching(false);
    }
  }

  async function submit() {
    if (!book) {
      setError("서평단 대상 도서를 선택해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(
        `${API_BASE}/api/dojangdan/manage/profiles/${profileId}/campaigns`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookId: book.id,
            title,
            description,
            recruitCount,
            recruitStartAt,
            recruitEndAt,
            reviewDueAt,
            priorityInviteHours,
          }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message ?? "캠페인을 만들지 못했습니다.");
        return;
      }
      await onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-brown-100 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-lg font-bold text-brown-900">새 서평단 캠페인</h2>

      {profiles.length > 1 && (
        <Field label="주최 프로필">
          <select
            value={profileId}
            onChange={(event) => setProfileId(Number(event.target.value))}
            className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800"
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="대상 도서">
        {book ? (
          <div className="flex items-center justify-between rounded-xl bg-cream-50 px-3 py-2">
            <span className="truncate text-sm text-brown-800">
              {book.title} · {book.author}
            </span>
            <button
              type="button"
              onClick={() => setBook(null)}
              className="ml-2 flex-shrink-0 text-xs font-semibold text-brown-500 underline"
            >
              변경
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void searchBooks();
                  }
                }}
                placeholder="책 제목으로 검색"
                className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800 outline-none focus:border-brown-300"
              />
              <button
                type="button"
                onClick={searchBooks}
                disabled={searching}
                className="flex-shrink-0 rounded-xl bg-brown-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                검색
              </button>
            </div>
            {results.length > 0 && (
              <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
                {results.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setBook(result);
                        setResults([]);
                        if (!title) setTitle(`${result.title} 서평단`);
                      }}
                      className="w-full truncate rounded-lg px-3 py-2 text-left text-sm text-brown-700 hover:bg-cream-50"
                    >
                      {result.title} · {result.author}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Field>

      <Field label="캠페인 제목">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={150}
          className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800 outline-none focus:border-brown-300"
        />
      </Field>

      <Field label="모집 안내">
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="어떤 독자를 찾는지, 어떤 독후감을 기대하는지 적어주세요."
          className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800 outline-none focus:border-brown-300"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="모집 인원">
          <input
            type="number"
            min={1}
            value={recruitCount}
            onChange={(event) => setRecruitCount(Number(event.target.value))}
            className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800"
          />
        </Field>
        <Field label="모집 시작">
          <input
            type="datetime-local"
            value={recruitStartAt}
            onChange={(event) => setRecruitStartAt(event.target.value)}
            className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800"
          />
        </Field>
        <Field label="모집 마감">
          <input
            type="datetime-local"
            value={recruitEndAt}
            onChange={(event) => setRecruitEndAt(event.target.value)}
            className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800"
          />
        </Field>
        <Field label="독후감 마감">
          <input
            type="datetime-local"
            value={reviewDueAt}
            onChange={(event) => setReviewDueAt(event.target.value)}
            className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800"
          />
        </Field>
      </div>

      <Field label="관심 독자 우선 신청">
        <select
          value={priorityInviteHours}
          onChange={(event) => setPriorityInviteHours(Number(event.target.value))}
          className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800"
        >
          <option value={0}>사용하지 않음 (바로 공개 모집)</option>
          <option value={24}>24시간 먼저 열기</option>
          <option value={48}>48시간 먼저 열기</option>
        </select>
        <p className="mt-2 text-xs leading-5 text-brown-400">
          모집을 시작하면 이 시간 동안 관심 독자에게만 신청을 열고 알림을 보냅니다. 이후 자동으로
          공개 모집으로 바뀝니다.
        </p>
      </Field>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="mt-4 w-full rounded-full bg-brown-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-60"
      >
        {submitting ? "만드는 중…" : "캠페인 만들기"}
      </button>
      <p className="mt-2 text-center text-xs text-brown-400">
        만들면 &lsquo;작성 중&rsquo; 상태로 저장됩니다. 캠페인 상세에서 모집을 시작하세요.
      </p>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-sm font-semibold text-brown-700">{label}</p>
      {children}
    </div>
  );
}
