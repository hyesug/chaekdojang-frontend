"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE } from "../lib/api";
import { authFetch } from "../lib/auth";

type VisibilityFilter = "ALL" | "PUBLIC" | "PRIVATE";

type ReadingGroupBook = {
  id: number;
  bookId: number;
  title: string;
  author: string;
  thumbnail: string | null;
  reviewCount: number;
};

export type ReadingGroupListItem = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  joinPolicy: "OPEN" | "APPROVAL";
  joinEnabled: boolean;
  ownerNickname: string | null;
  memberCount: number;
  member: boolean;
  manager: boolean;
  membershipStatus: "PENDING" | "APPROVED" | "REJECTED" | "BLOCKED" | null;
  books: ReadingGroupBook[];
  createdAt: string;
};

function sortGroups(groups: ReadingGroupListItem[]) {
  return [...groups].sort((a, b) => {
    const aMine = a.member || a.manager;
    const bMine = b.member || b.manager;
    if (aMine !== bMine) return aMine ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export default function GroupsClient({ initialGroups }: { initialGroups: ReadingGroupListItem[] }) {
  const [groups, setGroups] = useState(() => sortGroups(initialGroups));
  const [refreshing, setRefreshing] = useState(true);
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("ALL");

  useEffect(() => {
    authFetch(`${API_BASE}/api/groups`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!json) return;
        setGroups(sortGroups((json.data ?? json) as ReadingGroupListItem[]));
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  const filteredGroups = groups.filter((group) => visibilityFilter === "ALL" || group.visibility === visibilityFilter);

  return (
    <section className="mt-8 space-y-4">
      <fieldset className="rounded-2xl border border-cream-200 bg-white p-3 shadow-sm">
        <legend className="sr-only">독서모임 공개 여부 필터</legend>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: "ALL", label: "전체" },
            { value: "PUBLIC", label: "공개" },
            { value: "PRIVATE", label: "비공개" },
          ].map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                visibilityFilter === option.value
                  ? "border-brown-500 bg-brown-700 text-white"
                  : "border-cream-300 bg-cream-50 text-brown-600 hover:bg-white"
              }`}
            >
              <input
                type="radio"
                name="group-visibility-filter"
                value={option.value}
                checked={visibilityFilter === option.value}
                onChange={() => setVisibilityFilter(option.value as VisibilityFilter)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {refreshing && (
        <div className="rounded-2xl border border-cream-200 bg-white px-4 py-3 text-sm text-brown-400 shadow-sm">
          최신 독서모임을 불러오는 중...
        </div>
      )}
      {filteredGroups.map((group) => {
        const isMine = group.member || group.manager;
        const privateContentLocked = group.visibility === "PRIVATE" && !isMine;
        return (
          <Link key={group.id} href={`/groups/${group.slug}`} className="block rounded-2xl border border-cream-200 bg-white p-5 shadow-sm hover:bg-cream-50">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-serif text-xl font-bold text-brown-900">{group.name}</h2>
                  {isMine && (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">
                      내 모임
                    </span>
                  )}
                  {group.visibility === "PRIVATE" && (
                    <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-brown-500">
                      비공개
                    </span>
                  )}
                  {!group.joinEnabled && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-500">
                      가입 중지
                    </span>
                  )}
                </div>
                {privateContentLocked ? (
                  <p className="mt-1 text-sm text-brown-400">비공개 모임 · 승인 후 내용 공개</p>
                ) : (
                  <p className="mt-1 text-sm text-brown-400">
                    {group.ownerNickname ? `모임장 ${group.ownerNickname} · ` : ""}멤버 {group.memberCount ?? 0}명 · 책 {group.books.length}권
                  </p>
                )}
                {group.description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-brown-600">{group.description}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-cream-100 px-3 py-1 text-xs text-brown-500">
                {group.joinPolicy === "OPEN" ? "바로 가입" : "승인제"}
              </span>
            </div>
          </Link>
        );
      })}
      {groups.length === 0 && (
        <div className="rounded-2xl border border-cream-200 bg-white py-16 text-center text-brown-400">
          <p>아직 독서모임이 없어요.</p>
          <p className="mt-1 text-sm">첫 번째 모임을 만들어보세요.</p>
        </div>
      )}
      {groups.length > 0 && filteredGroups.length === 0 && (
        <div className="rounded-2xl border border-cream-200 bg-white py-16 text-center text-brown-400">
          <p>해당 조건의 독서모임이 없어요.</p>
        </div>
      )}
    </section>
  );
}
