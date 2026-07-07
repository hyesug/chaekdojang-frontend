"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authFetch } from "../lib/auth";

type ReviewData = {
  id: number;
  content: string;
  rating: number;
  book?: { title: string; author?: string | null } | null;
};

export default function ReviewEditForm({ reviewId }: { reviewId: number }) {
  const router = useRouter();
  const [review, setReview] = useState<ReviewData | null>(null);
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/reviews/${reviewId}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const data = (json?.data ?? json) as ReviewData | null;
        if (data) {
          setReview(data);
          setContent(data.content ?? "");
          setRating(data.rating ?? 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reviewId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !rating) return;
    setSaving(true);
    try {
      const res = await authFetch(`/api/reviews/${reviewId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), rating }),
      });
      if (res.ok) {
        router.push(`/reviews/${reviewId}`);
      } else {
        alert("수정에 실패했어요. 다시 시도해주세요.");
      }
    } catch {
      alert("수정에 실패했어요. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-brown-500">
        불러오는 중...
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-brown-500">
        독후감을 찾을 수 없어요.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8ea_0,#faf6ef_34%,#f2e4ce_100%)]">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-brown-500 hover:text-brown-700"
          >
            ← 뒤로
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-brown-100 bg-white shadow-sm">
          <div className="border-b border-cream-200 bg-cream-50 px-5 pb-5 pt-7 sm:px-8">
            <h1 className="font-serif text-2xl font-bold text-brown-800">독후감 수정</h1>
            {review.book?.title && (
              <p className="mt-1 text-sm text-brown-500">
                {review.book.title}
                {review.book.author && <span className="ml-1.5">· {review.book.author}</span>}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 px-5 py-6 sm:px-8">
            {/* 별점 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-brown-700">별점</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`text-2xl transition-colors ${
                      star <= rating ? "text-amber-500" : "text-cream-300 hover:text-amber-300"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* 독후감 내용 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-brown-700">독후감</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                className="w-full rounded-lg border border-cream-200 bg-white px-4 py-3 text-sm leading-relaxed text-brown-700 placeholder:text-brown-300 focus:border-brown-400 focus:outline-none"
                placeholder="이 책을 읽고..."
              />
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-full px-5 py-2 text-sm text-brown-500 hover:bg-cream-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving || !content.trim() || !rating}
                className="rounded-full bg-brown-700 px-5 py-2 text-sm text-white hover:bg-brown-800 disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
