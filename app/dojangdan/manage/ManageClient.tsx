"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../lib/api";
import { authFetch, getValidToken } from "../../lib/auth";
import {
  STATUS_LABEL,
  formatDate,
  type CampaignSummary,
  type ManagedProfile,
} from "../types";
import CampaignCreateForm from "./CampaignCreateForm";

export default function ManageClient() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<ManagedProfile[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [profilesRes, campaignsRes] = await Promise.all([
      authFetch(`${API_BASE}/api/dojangdan/manage/profiles`),
      authFetch(`${API_BASE}/api/dojangdan/manage/campaigns`),
    ]);

    if (profilesRes.status === 401) {
      router.push(`/auth/login?returnTo=${encodeURIComponent("/dojangdan/manage")}`);
      return;
    }

    const profilesJson = await profilesRes.json().catch(() => null);
    const campaignsJson = await campaignsRes.json().catch(() => null);
    setProfiles(profilesJson?.data ?? []);
    setCampaigns(campaignsJson?.data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (!getValidToken()) {
      router.push(`/auth/login?returnTo=${encodeURIComponent("/dojangdan/manage")}`);
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
      <h1 className="font-serif text-2xl font-bold text-brown-900">책도장단 운영실</h1>
      <p className="mt-2 text-sm text-brown-500">
        서평단을 모집하고, 신청자를 선정하고, 독후감이 모이는 과정을 한곳에서 관리합니다.
      </p>

      {profiles.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-cream-200 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-900">
            먼저 공식 프로필이 필요합니다
          </h2>
          <p className="mt-2 text-sm leading-6 text-brown-500">
            서평단은 출판사·작가 공식 프로필 단위로 운영됩니다. 공식 프로필을 신청하고 승인되면 이 화면에서 캠페인을 만들 수 있습니다.
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
              <div>
                <h2 className="font-serif text-lg font-bold text-brown-900">내 공식 프로필</h2>
                <p className="mt-1 text-sm text-brown-500">
                  {profiles.map((profile) => profile.displayName).join(" · ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreating((previous) => !previous)}
                className="flex-shrink-0 rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800"
              >
                {creating ? "취소" : "새 캠페인"}
              </button>
            </div>
          </section>

          {creating && (
            <CampaignCreateForm
              profiles={profiles}
              onCreated={async () => {
                setCreating(false);
                await load();
              }}
            />
          )}
        </>
      )}

      <section className="mt-8">
        <h2 className="font-serif text-lg font-bold text-brown-900">내 캠페인</h2>
        {campaigns.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-cream-200 bg-white p-6 text-center text-sm text-brown-500">
            아직 만든 캠페인이 없습니다.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/dojangdan/manage/campaigns/${campaign.id}`}
                className="block rounded-2xl border border-cream-200 bg-white p-4 shadow-sm hover:border-brown-200"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-semibold text-brown-600">
                    {STATUS_LABEL[campaign.status]}
                  </span>
                  <span className="truncate text-xs text-brown-400">{campaign.profileName}</span>
                </div>
                <p className="mt-1 truncate font-serif text-base font-bold text-brown-900">
                  {campaign.title}
                </p>
                <p className="truncate text-sm text-brown-500">{campaign.bookTitle}</p>
                <p className="mt-1 text-xs text-brown-400">
                  {campaign.applicantCount}명 신청 / {campaign.recruitCount}명 모집 · 모집 마감{" "}
                  {formatDate(campaign.recruitEndAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
