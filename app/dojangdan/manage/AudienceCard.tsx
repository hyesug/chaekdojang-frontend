"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "../../lib/api";
import { authFetch } from "../../lib/auth";
import type { ProfileAudience } from "../types";

/**
 * 관심 독자 집계.
 * 누가 관심을 표시했는지는 보여주지 않는다. 연락은 책도장이 대행한다.
 */
export default function AudienceCard({ profileId }: { profileId: number }) {
  const [audience, setAudience] = useState<ProfileAudience | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await authFetch(
        `${API_BASE}/api/dojangdan/manage/profiles/${profileId}/audience`
      );
      const json = await res.json().catch(() => null);
      if (!cancelled) setAudience(json?.data ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  if (!audience) return null;

  return (
    <section className="mt-4 rounded-2xl border border-brown-100 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-lg font-bold text-brown-900">관심 독자</h2>
        <span className="text-xs text-brown-400">{audience.profileName}</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-cream-50 px-3 py-2.5">
          <dt className="text-xs text-brown-400">다음 책 소식을 기다리는 독자</dt>
          <dd className="mt-0.5 text-2xl font-bold text-brown-800">
            {audience.interestedReaderCount}명
          </dd>
        </div>
        <div className="rounded-xl bg-cream-50 px-3 py-2.5">
          <dt className="text-xs text-brown-400">서평단 참여 이력이 있는 독자</dt>
          <dd className="mt-0.5 text-2xl font-bold text-brown-800">
            {audience.campaignExperiencedCount}명
          </dd>
        </div>
      </dl>

      {audience.topCategories.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-brown-600">주요 관심 장르</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {audience.topCategories.map((item) => (
              <span
                key={item.category}
                className="rounded-full bg-cream-100 px-3 py-1 text-xs text-brown-600"
              >
                {item.category} {item.count}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-brown-400">
        새 캠페인의 모집을 시작하면 이 독자들에게 공개 모집보다 먼저 알림이 갑니다. 이메일·연락처는
        제공되지 않으며, 같은 독자에게는 캠페인당 1회, 30일 안에 최대 2회만 발송됩니다.
      </p>
    </section>
  );
}
