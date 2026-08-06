import Link from "next/link";
import { notFound } from "next/navigation";
import AiReadingCard from "../../../../../components/AiReadingCard";
import type { AiReadingCardData } from "../../../../../lib/aiReadingCard";
import { fetchAuthenticatedApiData } from "../../../../../lib/serverApi";
import GroupAnalysisPanel, { type GroupAnalysis } from "./GroupAnalysisPanel";

type Props = {
  params: Promise<{ slug: string; groupBookId: string }>;
};

type GroupBookResult = {
  groupName: string;
  groupSlug: string;
  canManage: boolean;
  book: {
    id: number;
    title: string;
    author: string;
    thumbnail: string | null;
  };
  participantCount: number;
  reviewCount: number;
  averageRating: number;
  generatedCardCount: number;
  commonEmotionKeywords: string[];
  representativeOneLineReview: string | null;
  analysis: GroupAnalysis | null;
  cards: Array<{
    reviewId: number;
    authorNickname: string;
    bookTitle: string;
    oneLineReview: string;
    emotionKeywords: string[];
    recommendedFor: string;
    impressivePoint: string | null;
  }>;
};

export default async function GroupBookResultPage({ params }: Props) {
  const { slug, groupBookId } = await params;
  const result = await fetchAuthenticatedApiData<GroupBookResult>(
    `/api/groups/${encodeURIComponent(slug)}/books/${encodeURIComponent(groupBookId)}/result`,
    { cache: "no-store" }
  );
  if (!result) notFound();

  const cards: AiReadingCardData[] = result.cards.map((card) => ({
    bookTitle: card.bookTitle,
    authorNickname: card.authorNickname,
    oneLineReview: card.oneLineReview,
    emotionKeywords: card.emotionKeywords,
    recommendedFor: card.recommendedFor,
    impressivePoint: card.impressivePoint,
  }));
  const hasReviews = result.reviewCount > 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <section className="mb-8 rounded-lg border border-cream-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brown-300">
          Dojangdan Result
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-brown-900">
          {result.groupName} 독서 결과
        </h1>
        <p className="mt-3 text-sm leading-6 text-brown-500">
          함께 읽은 독후감의 공통점과 서로 다른 해석을 모임 전체 결과로 정리합니다.
        </p>
      </section>

      <section className="mb-8 rounded-lg border border-cream-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs text-brown-300">도장단 책</p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-brown-800">{result.book.title}</h2>
            <p className="text-sm text-brown-500">{result.book.author}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="참여 독자" value={`${result.participantCount}명`} />
          <Stat label="독후감" value={`${result.reviewCount}개`} />
          <Stat label="평균 별점" value={result.reviewCount > 0 ? result.averageRating.toFixed(1) : "0.0"} />
          <Stat label="AI 분석 완료" value={`${result.generatedCardCount}/${result.reviewCount}`} />
        </div>
      </section>

      <GroupAnalysisPanel
        slug={slug}
        groupBookId={groupBookId}
        reviewCount={result.reviewCount}
        canManage={result.canManage}
        initialAnalysis={result.analysis}
      />

      {!hasReviews ? (
        <section className="rounded-2xl border border-cream-200 bg-white py-16 text-center text-brown-400">
          <p>아직 이 책에 등록된 독후감이 없어요.</p>
          <p className="mt-1 text-sm">독후감이 등록되면 AI 결과를 확인할 수 있어요.</p>
        </section>
      ) : (
        <section>
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brown-400">독자별 결과</p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-brown-900">각자의 AI 독서카드</h2>
            <p className="mt-2 text-sm text-brown-500">독후감 작성자가 AI 독서카드를 만든 경우에 표시됩니다.</p>
          </div>
          {cards.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2">
              {cards.map((card) => (
                <AiReadingCard key={`${card.authorNickname}-${card.oneLineReview}`} card={card} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-cream-200 bg-white py-12 text-center text-brown-400">
              아직 생성된 독자별 AI 독서카드가 없어요.
            </div>
          )}
        </section>
      )}

      <div className="mt-8 text-center">
        <Link
          href={`/groups/${encodeURIComponent(slug)}/books/${encodeURIComponent(groupBookId)}`}
          className="inline-flex rounded-full bg-brown-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brown-800"
        >
          전체 독후감 보기
        </Link>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-cream-50 px-4 py-3">
      <p className="text-xs text-brown-400">{label}</p>
      <p className="mt-1 font-serif text-xl font-bold text-brown-800">{value}</p>
    </div>
  );
}
