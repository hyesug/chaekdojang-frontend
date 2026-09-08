"use client";

import { useState } from "react";
import { API_BASE } from "../../../../lib/api";
import { authFetch } from "../../../../lib/auth";
import type { CampaignDeliveryType, ManageCampaignDetail } from "../../../types";

type Props = {
  detail: ManageCampaignDetail;
  onSaved: () => Promise<void>;
  onCancel: () => void;
};

function datetimeLocal(value: string) {
  return value.slice(0, 16);
}

export default function CampaignEditForm({ detail, onSaved, onCancel }: Props) {
  const { campaign } = detail;
  const [title, setTitle] = useState(campaign.title);
  const [description, setDescription] = useState(detail.description ?? "");
  const [recruitCount, setRecruitCount] = useState(campaign.recruitCount);
  const [recruitStartAt, setRecruitStartAt] = useState(datetimeLocal(campaign.recruitStartAt));
  const [recruitEndAt, setRecruitEndAt] = useState(datetimeLocal(campaign.recruitEndAt));
  const [reviewDueAt, setReviewDueAt] = useState(datetimeLocal(campaign.reviewDueAt));
  const [priorityInviteHours, setPriorityInviteHours] = useState(campaign.priorityInviteHours);
  const [deliveryType, setDeliveryType] = useState<CampaignDeliveryType>(campaign.deliveryType);
  const [ebookAccessExtraDays, setEbookAccessExtraDays] = useState(
    campaign.ebookAccessExtraDays
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(
        `${API_BASE}/api/dojangdan/manage/campaigns/${campaign.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            recruitCount,
            recruitStartAt,
            recruitEndAt,
            reviewDueAt,
            priorityInviteHours,
            deliveryType,
            ebookAccessExtraDays,
          }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message ?? "캠페인을 수정하지 못했습니다.");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-brown-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-bold text-brown-900">캠페인 수정</h2>
          <p className="mt-1 text-xs text-brown-400">
            대상 도서는 변경할 수 없습니다: {campaign.bookTitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-semibold text-brown-500 underline"
        >
          취소
        </button>
      </div>

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

      <Field label="배본 방식">
        <div className="flex gap-2">
          {(
            [
              { value: "PHYSICAL", label: "실물 도서 배송" },
              { value: "PDF", label: "PDF 제공" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDeliveryType(option.value)}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                deliveryType === option.value
                  ? "border-brown-300 bg-cream-50 text-brown-800"
                  : "border-cream-200 text-brown-500"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Field>

      {deliveryType === "PDF" && (
        <Field label="독후감 마감 후 열람 가능 기간">
          <select
            value={ebookAccessExtraDays}
            onChange={(event) => setEbookAccessExtraDays(Number(event.target.value))}
            className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-800"
          >
            <option value={0}>마감일까지만</option>
            <option value={7}>마감 후 7일</option>
            <option value={14}>마감 후 14일</option>
            <option value={30}>마감 후 30일</option>
          </select>
        </Field>
      )}

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
      </Field>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-5 w-full rounded-full bg-brown-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-60"
      >
        {saving ? "저장 중…" : "수정 내용 저장"}
      </button>
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
