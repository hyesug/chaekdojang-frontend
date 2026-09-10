"use client";

import { useState } from "react";
import { API_BASE } from "../../lib/api";
import { authFetch } from "../../lib/auth";
import {
  ENTRY_TYPE_LABEL,
  HOST_TYPE_LABEL,
  type ContestBook,
  type ContestEntryType,
  type HostProfile,
  type ManageContestDetail,
} from "../types";

type BookResult = {
  id: number;
  title: string;
  author: string;
  publisher: string;
  thumbnail: string | null;
};

type Props = {
  /** 새로 만들 때 고를 주최 프로필. 수정할 때는 쓰지 않는다. */
  profiles?: HostProfile[];
  /** 값이 있으면 수정 모드 */
  detail?: ManageContestDetail;
  onSaved: () => Promise<void>;
  onCancel?: () => void;
};

/** datetime-local 입력은 "2026-01-01T09:00" 형태만 받는다. */
function toInputValue(value: string | undefined) {
  return value ? value.slice(0, 16) : "";
}

export default function ContestForm({ profiles = [], detail, onSaved, onCancel }: Props) {
  const editing = detail !== undefined;

  const [profileId, setProfileId] = useState(profiles[0]?.id ?? 0);
  const [title, setTitle] = useState(detail?.contest.title ?? "");
  const [description, setDescription] = useState(detail?.description ?? "");
  const [prizeDescription, setPrizeDescription] = useState(detail?.prizeDescription ?? "");
  const [entryType, setEntryType] = useState<ContestEntryType>(
    detail?.contest.entryType ?? "REVIEW"
  );
  const [selectedBooks, setSelectedBooks] = useState<ContestBook[]>(detail?.contest.books ?? []);
  const [submitStartAt, setSubmitStartAt] = useState(toInputValue(detail?.contest.submitStartAt));
  const [submitEndAt, setSubmitEndAt] = useState(toInputValue(detail?.contest.submitEndAt));
  const [announceAt, setAnnounceAt] = useState(toInputValue(detail?.contest.announceAt));

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookResult[]>([]);
  const [searching, setSearching] = useState(false);
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

  function addBook(book: BookResult) {
    setSelectedBooks((previous) =>
      previous.some((selected) => selected.bookId === book.id)
        ? previous
        : [
            ...previous,
            {
              bookId: book.id,
              title: book.title,
              author: book.author,
              thumbnail: book.thumbnail,
            },
          ]
    );
    setResults([]);
    setQuery("");
  }

  async function submit() {
    if (!submitStartAt || !submitEndAt || !announceAt) {
      setError("접수 시작·마감과 발표 시각을 모두 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = JSON.stringify({
        title,
        description,
        prizeDescription,
        entryType,
        bookIds: selectedBooks.map((book) => book.bookId),
        submitStartAt,
        submitEndAt,
        announceAt,
      });
      const res = editing
        ? await authFetch(`${API_BASE}/api/contests/manage/contests/${detail.contest.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body,
          })
        : await authFetch(`${API_BASE}/api/contests/manage/profiles/${profileId}/contests`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message ?? (editing ? "공모전을 수정하지 못했습니다." : "공모전을 만들지 못했습니다."));
        return;
      }
      await onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-brown-100 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-lg font-bold text-brown-900">
        {editing ? "공모전 수정" : "새 공모전"}
      </h2>

      {!editing && profiles.length > 1 && (
        <Field label="주최 프로필">
          <select
            value={profileId}
            onChange={(event) => setProfileId(Number(event.target.value))}
            className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800"
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName} ({HOST_TYPE_LABEL[profile.type]})
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="공모전 제목">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          placeholder="예: 제1회 시립도서관 독후감 공모전"
          className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800 outline-none focus:border-brown-300"
        />
      </Field>

      <Field label="응모 방식">
        <div className="flex gap-2">
          {(["REVIEW", "TEXT"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setEntryType(option)}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                entryType === option
                  ? "border-brown-300 bg-cream-50 text-brown-800"
                  : "border-cream-200 text-brown-500"
              }`}
            >
              {ENTRY_TYPE_LABEL[option]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-brown-400">
          {entryType === "REVIEW"
            ? "독자가 책도장에 이미 쓴 독후감 중 하나를 골라 응모합니다. 응모작이 그대로 피드에도 남습니다."
            : "독자가 공모전 안에서 제목과 본문을 새로 작성해 응모합니다. 수상작은 발표 후 공모전 페이지에 공개됩니다."}
        </p>
      </Field>

      <Field label="지정 도서 (비우면 자유주제)">
        {selectedBooks.length > 0 && (
          <ul className="mb-2 space-y-1">
            {selectedBooks.map((book) => (
              <li
                key={book.bookId}
                className="flex items-center justify-between rounded-xl bg-cream-50 px-3 py-2"
              >
                <span className="truncate text-sm text-brown-800">
                  {book.title} · {book.author}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedBooks((previous) =>
                      previous.filter((selected) => selected.bookId !== book.bookId)
                    )
                  }
                  className="ml-2 flex-shrink-0 text-xs font-semibold text-brown-500 underline"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
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
            placeholder="책 제목으로 검색해 추가"
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
                  onClick={() => addBook(result)}
                  className="w-full truncate rounded-lg px-3 py-2 text-left text-sm text-brown-700 hover:bg-cream-50"
                >
                  {result.title} · {result.author}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Field>

      <Field label="공모 요강">
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={6}
          maxLength={10000}
          placeholder="응모 자격, 분량, 심사 기준, 유의사항을 적어주세요."
          className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800 outline-none focus:border-brown-300"
        />
      </Field>

      <Field label="시상 내역">
        <textarea
          value={prizeDescription}
          onChange={(event) => setPrizeDescription(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="예: 대상 1명 30만원 도서상품권 / 우수상 3명 각 10만원"
          className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800 outline-none focus:border-brown-300"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="접수 시작">
          <input
            type="datetime-local"
            value={submitStartAt}
            onChange={(event) => setSubmitStartAt(event.target.value)}
            className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800"
          />
        </Field>
        <Field label="접수 마감">
          <input
            type="datetime-local"
            value={submitEndAt}
            onChange={(event) => setSubmitEndAt(event.target.value)}
            className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800"
          />
        </Field>
        <Field label="수상 발표">
          <input
            type="datetime-local"
            value={announceAt}
            onChange={(event) => setAnnounceAt(event.target.value)}
            className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800"
          />
        </Field>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-cream-200 px-5 py-3 text-sm font-semibold text-brown-700 hover:bg-cream-50"
          >
            닫기
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !title.trim()}
          className="flex-1 rounded-full bg-brown-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-60"
        >
          {submitting ? "저장 중…" : editing ? "수정 저장" : "공모전 만들기"}
        </button>
      </div>
      {!editing && (
        <p className="mt-2 text-center text-xs text-brown-400">
          만들면 &lsquo;작성 중&rsquo; 상태로 저장됩니다. 공모전 상세에서 접수를 시작하세요.
        </p>
      )}
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
