"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../../../lib/api";
import { authFetch } from "../../../../lib/auth";
import { formatDate, type CampaignReviewSummary } from "../../../types";

const FORMATS = [
  { key: "markdown", label: "Markdown", hint: "홍보 소재용 한 파일" },
  { key: "csv", label: "CSV", hint: "스프레드시트 관리용" },
  { key: "zip", label: "TXT ZIP", hint: "독후감 1편당 파일 1개" },
] as const;

type Props = {
  campaignId: number;
  submittedCount: number;
  consentedReviewCount: number;
};

export default function ExportPanel({
  campaignId,
  submittedCount,
  consentedReviewCount,
}: Props) {
  const [reviews, setReviews] = useState<CampaignReviewSummary[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authFetch(
      `${API_BASE}/api/dojangdan/manage/campaigns/${campaignId}/reviews`
    );
    const json = await res.json().catch(() => null);
    setReviews(json?.data ?? []);
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function download(format: string) {
    setDownloading(format);
    setError(null);
    try {
      const res = await authFetch(
        `${API_BASE}/api/dojangdan/manage/campaigns/${campaignId}/export?format=${format}`
      );
      if (!res.ok) {
        setError("내보내기에 실패했습니다.");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
      const plain = /filename="([^"]+)"/i.exec(disposition)?.[1];
      const fileName = encoded
        ? decodeURIComponent(encoded)
        : plain ?? `dojangdan-${campaignId}.${format}`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-brown-100 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-lg font-bold text-brown-900">독후감 내보내기</h2>

      <div className="mt-3 rounded-xl bg-cream-50 px-4 py-3">
        <p className="text-base font-bold text-brown-800">
          활용 동의 {consentedReviewCount}건 / 전체 {submittedCount}건
        </p>
        <p className="mt-1 text-xs leading-5 text-brown-500">
          동의된 독후감은 상세페이지, SNS, 보도자료에 사용할 수 있습니다. 동의하지 않은 독후감은
          건수에만 포함되고 본문은 내보내지지 않습니다.
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {FORMATS.map((format) => (
          <button
            key={format.key}
            type="button"
            onClick={() => download(format.key)}
            disabled={downloading !== null || consentedReviewCount === 0}
            className="rounded-xl border border-cream-200 px-4 py-3 text-left hover:border-brown-200 disabled:opacity-50"
          >
            <span className="block text-sm font-semibold text-brown-800">
              {downloading === format.key ? "준비 중…" : format.label}
            </span>
            <span className="mt-0.5 block text-xs text-brown-400">{format.hint}</span>
          </button>
        ))}
      </div>

      {consentedReviewCount === 0 && (
        <p className="mt-3 text-xs text-brown-400">
          아직 활용에 동의한 독후감이 없어 내보낼 수 없습니다.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {reviews.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-brown-700">제출된 독후감</h3>
          <ul className="mt-3 space-y-2">
            {reviews.map((review) => (
              <li
                key={review.applicationId}
                className="rounded-xl border border-cream-200 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-brown-800">
                    {review.displayName}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      review.consentPromotional
                        ? "bg-brown-100 text-brown-700"
                        : "bg-cream-100 text-brown-400"
                    }`}
                  >
                    {review.consentPromotional ? "활용 동의" : "미동의"}
                  </span>
                  {review.consentPromotional && review.consentExcerpt && (
                    <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-brown-500">
                      발췌·편집 허용
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs text-brown-400">
                  {formatDate(review.submittedAt)} 제출 · {review.reviewLength.toLocaleString()}자
                </p>

                {review.content ? (
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-brown-600">
                    {review.content}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-brown-400">
                    활용에 동의하지 않아 본문은 표시되지 않습니다.
                  </p>
                )}

                <Link
                  href={`/reviews/${review.reviewId}`}
                  className="mt-2 inline-flex text-xs font-semibold text-brown-600 underline"
                >
                  원문 보기
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
