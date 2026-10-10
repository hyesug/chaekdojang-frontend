"use client";

import { useMemo, useState } from "react";
import ReviewCard, { type Review } from "../../components/ReviewCard";

type Props = {
  nickname: string;
  reviews: Review[];
};

function normalize(value: string | null | undefined) {
  return (value ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

export default function PublicProfileReviews({ nickname, reviews }: Props) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalize(query);

  const filteredReviews = useMemo(() => {
    if (!normalizedQuery) return reviews;
    return reviews.filter((review) => {
      const searchable = [
        review.book?.title,
        review.book?.author,
        review.content,
      ].map(normalize).join(" ");
      return searchable.includes(normalizedQuery);
    });
  }, [normalizedQuery, reviews]);

  if (reviews.length === 0) {
    return <div className="text-center py-12 text-brown-400">아직 공개 독후감이 없어요.</div>;
  }

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-lg font-bold text-brown-800">
            {nickname}님의 공개 독후감
          </h2>
          <p className="mt-1 text-xs text-brown-400">
            {filteredReviews.length} / {reviews.length}개
          </p>
        </div>
        <label className="block sm:w-72">
          <span className="sr-only">독후감 검색</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="책 제목, 저자, 내용 검색"
            className="cdj-field text-sm w-full"
          />
        </label>
      </div>

      {filteredReviews.length === 0 ? (
        <div className="cdj-card py-12 text-center text-brown-400">
          검색 결과가 없어요.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredReviews.map((review) => (
            <ReviewCard key={review.id} post={review} />
          ))}
        </div>
      )}
    </section>
  );
}
