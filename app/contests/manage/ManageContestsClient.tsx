"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../lib/api";
import { authFetch, getValidToken } from "../../lib/auth";
import {
  CONTEST_STATUS_LABEL,
  ENTRY_TYPE_LABEL,
  formatDateTime,
  hostLabel,
  topicLabel,
  type ContestSummary,
  type HostProfile,
} from "../types";
import ContestForm from "./ContestForm";

export default function ManageContestsClient() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<HostProfile[]>([]);
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [profilesRes, contestsRes] = await Promise.all([
      authFetch(`${API_BASE}/api/contests/manage/profiles`),
      authFetch(`${API_BASE}/api/contests/manage/contests`),
    ]);

    if (profilesRes.status === 401) {
      router.push(`/auth/login?returnTo=${encodeURIComponent("/contests/manage")}`);
      return;
    }

    const profilesJson = await profilesRes.json().catch(() => null);
    const contestsJson = await contestsRes.json().catch(() => null);
    setProfiles(profilesJson?.data ?? []);
    setContests(contestsJson?.data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (!getValidToken()) {
      router.push(`/auth/login?returnTo=${encodeURIComponent("/contests/manage")}`);
      return;
    }
    void load();
  }, [load, router]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-brown-400">
        불러오는 중…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-2xl font-bold text-brown-900">공모전 운영실</h1>
      <p className="mt-2 text-sm text-brown-500">
        공모전을 열고, 응모작을 심사하고, 수상작을 발표하는 과정을 한곳에서 관리합니다.
      </p>

      {profiles.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-cream-200 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-900">
            먼저 공식 프로필이 필요합니다
          </h2>
          <p className="mt-2 text-sm leading-6 text-brown-500">
            공모전은 도서관·출판사 등 공식 프로필 단위로 운영됩니다. 공식 프로필을 신청하고 승인되면 이
            화면에서 공모전을 만들 수 있습니다.
          </p>
          <Link
            href="/cs"
            className="mt-4 inline-flex rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800"
          >
            공식 프로필 문의하기
          </Link>
        </section>
      ) : (
        <>
          <section className="mt-6 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-serif text-lg font-bold text-brown-900">주최 프로필</h2>
                <p className="mt-1 text-sm text-brown-500">
                  {profiles
                    .map((profile) => hostLabel(profile.displayName, profile.type))
                    .join(", ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreating((previous) => !previous)}
                className="flex-shrink-0 rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800"
              >
                {creating ? "취소" : "새 공모전"}
              </button>
            </div>
          </section>

          {creating && (
            <ContestForm
              profiles={profiles}
              onSaved={async () => {
                setCreating(false);
                await load();
              }}
              onCancel={() => setCreating(false)}
            />
          )}
        </>
      )}

      <section className="mt-8">
        <h2 className="font-serif text-lg font-bold text-brown-900">내 공모전</h2>
        {contests.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-cream-200 bg-white p-6 text-center text-sm text-brown-500">
            아직 만든 공모전이 없습니다.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {contests.map((contest) => (
              <Link
                key={contest.id}
                href={`/contests/manage/${contest.id}`}
                className="block rounded-2xl border border-cream-200 bg-white p-4 shadow-sm hover:border-brown-200"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-semibold text-brown-600">
                    {CONTEST_STATUS_LABEL[contest.status]}
                  </span>
                  <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-semibold text-brown-600">
                    {ENTRY_TYPE_LABEL[contest.entryType]}
                  </span>
                  <span className="truncate text-xs text-brown-400">{contest.hostName}</span>
                </div>
                <p className="mt-1 truncate font-serif text-base font-bold text-brown-900">
                  {contest.title}
                </p>
                <p className="truncate text-sm text-brown-500">{topicLabel(contest)}</p>
                <p className="mt-1 text-xs text-brown-400">
                  {contest.entryCount}편 응모 · 접수 마감 {formatDateTime(contest.submitEndAt)} · 발표{" "}
                  {formatDateTime(contest.announceAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
