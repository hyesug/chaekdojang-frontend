"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../lib/api";
import { authFetch } from "../../lib/auth";
import { formatDate, type ConsentDisplayNameType, type ReviewUsageConsent } from "../types";

/**
 * 독후감 활용 동의를 보고 바꾸는 패널.
 * 동의를 바꾸면 서버에 새 동의 이력이 쌓이고 이전 동의는 철회 처리된다.
 */
export default function ConsentPanel({ applicationId }: { applicationId: number }) {
  const [consent, setConsent] = useState<ReviewUsageConsent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authFetch(
      `${API_BASE}/api/dojangdan/applications/${applicationId}/consent`
    );
    const json = await res.json().catch(() => null);
    setConsent(json?.data ?? null);
    setLoading(false);
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(next: {
    consentPromotional: boolean;
    consentExcerpt: boolean;
    displayNameType: ConsentDisplayNameType;
  }) {
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(
        `${API_BASE}/api/dojangdan/applications/${applicationId}/consent`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message ?? "동의 설정을 바꾸지 못했습니다.");
        return;
      }
      setConsent(json.data);
    } finally {
      setSaving(false);
    }
  }

  async function revoke() {
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(
        `${API_BASE}/api/dojangdan/applications/${applicationId}/consent`,
        { method: "DELETE" }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message ?? "동의를 철회하지 못했습니다.");
        return;
      }
      setConsent(null);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-brown-400">동의 정보를 불러오는 중…</p>;
  }

  const promotional = consent?.consentPromotional ?? false;
  const excerpt = consent?.consentExcerpt ?? false;
  const displayNameType: ConsentDisplayNameType = consent?.displayNameType ?? "REAL_NICKNAME";

  return (
    <div className="rounded-xl bg-cream-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-brown-700">독후감 활용 동의</p>
        {consent && (
          <span className="text-xs text-brown-400">
            {formatDate(consent.consentedAt)} 기준 · 약관 {consent.termsVersion}
          </span>
        )}
      </div>

      <label className="mt-3 flex items-start gap-2.5 text-sm text-brown-700">
        <input
          type="checkbox"
          checked={promotional}
          disabled={saving}
          onChange={(event) =>
            save({
              consentPromotional: event.target.checked,
              consentExcerpt: event.target.checked ? excerpt : false,
              displayNameType,
            })
          }
          className="mt-0.5"
        />
        출판사·작가의 홍보 활용에 동의합니다
      </label>

      {promotional && (
        <div className="ml-6 mt-3 space-y-3 border-l-2 border-cream-200 pl-4">
          <div>
            <p className="text-xs font-semibold text-brown-600">표기 방식</p>
            <div className="mt-2 flex gap-4">
              {(["REAL_NICKNAME", "ANONYMOUS"] as const).map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm text-brown-700">
                  <input
                    type="radio"
                    name={`display-${applicationId}`}
                    checked={displayNameType === type}
                    disabled={saving}
                    onChange={() =>
                      save({
                        consentPromotional: true,
                        consentExcerpt: excerpt,
                        displayNameType: type,
                      })
                    }
                  />
                  {type === "REAL_NICKNAME" ? "닉네임 표기" : "익명 처리"}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-brown-700">
            <input
              type="checkbox"
              checked={excerpt}
              disabled={saving}
              onChange={(event) =>
                save({
                  consentPromotional: true,
                  consentExcerpt: event.target.checked,
                  displayNameType,
                })
              }
              className="mt-0.5"
            />
            일부 발췌·편집을 허용합니다
          </label>

          <button
            type="button"
            onClick={revoke}
            disabled={saving}
            className="text-xs font-semibold text-red-600 underline disabled:opacity-60"
          >
            활용 동의 철회하기
          </button>
        </div>
      )}

      <p className="mt-3 text-xs leading-5 text-brown-400">
        철회하면 이후 내보내기 대상에서 바로 빠집니다. 다만 출판사가 이미 내려받은 파일은 회수할 수 없습니다.
      </p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
