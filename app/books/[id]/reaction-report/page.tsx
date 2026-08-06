import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import AiReadingCard from "../../../components/AiReadingCard";
import { fetchApiData, SITE_URL } from "../../../lib/serverApi";

type BookReactionReport = {
  book: {
    id: number;
    title: string;
    author: string;
    thumbnail: string | null;
  };
  reviewCount: number;
  participantCount: number;
  averageRating: number;
  commonEmotionKeywords: string[];
  representativeOneLineReview: string | null;
  recommendedForSummary: string | null;
  impressivePointSummary: string | null;
  cards: Array<{
    reviewId: number;
    authorNickname: string;
    oneLineReview: string | null;
    emotionKeywords: string[];
    recommendedFor: string | null;
    impressivePoint: string | null;
    rating: number;
  }>;
  aggregateAvailable: boolean;
  minimumAggregateReviewCount: number;
  commonReviewKeywords: Array<{ keyword: string; count: number }>;
  ratingDistribution: { positive: number; neutral: number; negative: number };
  perspectiveNotes: string[];
};

type Props = {
  params: Promise<{ id: string }>;
};

async function getReport(id: string) {
  return fetchApiData<BookReactionReport>(`/api/books/${encodeURIComponent(id)}/reaction-report`, {
    cache: "no-store",
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) {
    return {
      title: "독자 반응 리포트 - 책도장",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: `${report.book.title} 독자 반응 리포트 | 책도장`,
    description: `${report.book.title}에 남겨진 공개 독후감과 AI 독서카드를 모아본 독자 반응 리포트입니다.`,
    alternates: { canonical: `/books/${report.book.id}/reaction-report` },
    openGraph: {
      type: "article",
      locale: "ko_KR",
      url: `${SITE_URL}/books/${report.book.id}/reaction-report`,
      siteName: "책도장",
      title: `${report.book.title} 독자 반응 리포트`,
      description: "공개 독후감의 한 줄 감상, 감정 키워드, 추천 독자층을 모아봅니다.",
      images: report.book.thumbnail
        ? [{ url: report.book.thumbnail, width: 400, height: 600, alt: report.book.title }]
        : undefined,
    },
  };
}

export default async function BookReactionReportPage({ params }: Props) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();
  const hasPublicReviews = report.reviewCount > 0;
  const hasCards = report.cards.length > 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <div className="mb-4">
        <Link href={`/books/${report.book.id}`} className="text-sm text-brown-400 hover:text-brown-700">
          책 상세로 돌아가기
        </Link>
      </div>

      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
        <div className="flex gap-4">
          {report.book.thumbnail ? (
            <Image
              src={report.book.thumbnail}
              alt={`${report.book.title} 책 표지`}
              width={76}
              height={110}
              className="h-[110px] w-[76px] shrink-0 rounded object-cover shadow-sm"
              priority
            />
          ) : (
            <div className="h-[110px] w-[76px] shrink-0 rounded bg-cream-200" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-brown-400">독자 반응 리포트</p>
            <h1 className="mt-1 font-serif text-2xl font-bold leading-snug text-brown-900">
              {report.book.title}
            </h1>
            <p className="mt-1 text-sm text-brown-500">{report.book.author}</p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3">
        <SummaryCard label="참여 독자 수" value={`${report.participantCount}명`} />
        <SummaryCard label="공개 독후감 수" value={`${report.reviewCount}개`} />
        <SummaryCard label="평균 별점" value={report.averageRating ? report.averageRating.toFixed(1) : "0.0"} />
        <SummaryCard label="AI 카드 생성 수" value={`${report.cards.length}개`} />
      </section>

      {!hasPublicReviews && (
        <EmptyReport title="아직 공개 독후감이 없어요." body="첫 번째 도장이 남겨지면 이 책의 독자 반응을 모아볼 수 있어요." />
      )}

      {hasPublicReviews && !hasCards && (
        <EmptyReport title="아직 리포트를 만들 만큼 충분한 AI 독서카드가 없어요." body="공개 독후감에 AI 독서카드가 생성되면 감정 키워드와 추천 독자층이 표시됩니다." />
      )}

      {hasPublicReviews && !report.aggregateAvailable && (
        <section className="mt-5 rounded-2xl border border-cream-200 bg-cream-50 p-5">
          <h2 className="font-serif text-lg font-bold text-brown-900">관점 집계는 조금 더 기다릴게요</h2>
          <p className="mt-2 text-sm leading-6 text-brown-500">
            서로 다른 독자와 공개 독후감이 각각 {report.minimumAggregateReviewCount}개 이상 쌓였을 때만 공통 키워드와 반응 차이를 표시합니다.
          </p>
        </section>
      )}

      {report.aggregateAvailable && (
        <section className="mt-5 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-900">여러 독후감에서 확인된 관점</h2>
          <p className="mt-1 text-xs text-brown-400">AI의 추측이 아니라 사용자가 직접 선택한 키워드와 별점만 집계합니다.</p>
          {report.commonReviewKeywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {report.commonReviewKeywords.map((item) => (
                <span key={item.keyword} className="rounded-full bg-cream-100 px-3 py-1 text-sm text-brown-600">#{item.keyword} {item.count}</span>
              ))}
            </div>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-sage-50 p-3 text-sage-700">높은 별점<br /><b>{report.ratingDistribution.positive}</b></div>
            <div className="rounded-xl bg-cream-50 p-3 text-brown-500">중간 별점<br /><b>{report.ratingDistribution.neutral}</b></div>
            <div className="rounded-xl bg-rose-50 p-3 text-rose-700">낮은 별점<br /><b>{report.ratingDistribution.negative}</b></div>
          </div>
          {report.perspectiveNotes.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm leading-6 text-brown-600">
              {report.perspectiveNotes.map((note) => <li key={note}>· {note}</li>)}
            </ul>
          )}
        </section>
      )}

      {hasCards && (
        <>
          <section className="mt-5 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-brown-400">최근 생성된 AI 카드의 한 줄 감상</p>
            <p className="mt-2 font-serif text-xl font-bold leading-8 text-brown-900">
              {report.representativeOneLineReview ?? "대표 한 줄 감상이 아직 없어요."}
            </p>
          </section>

          {report.aggregateAvailable && (
            <section className="mt-5 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
              <h2 className="font-serif text-lg font-bold text-brown-900">공통 감정 키워드</h2>
              {report.commonEmotionKeywords.length === 0 ? (
                <p className="mt-3 text-sm text-brown-400">아직 반복해서 확인된 감정 키워드가 없어요.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {report.commonEmotionKeywords.map((keyword) => (
                    <span key={keyword} className="rounded-full bg-cream-100 px-3 py-1 text-sm text-brown-600">
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="mt-5 grid gap-3">
            <InsightCard title="최근 AI 카드가 짚은 인상적인 지점" body={report.impressivePointSummary} />
            <InsightCard title="최근 AI 카드의 추천 독자" body={report.recommendedForSummary} />
          </section>

          <section className="mt-8">
            <h2 className="font-serif text-xl font-bold text-brown-900">독자 AI 카드</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {report.cards.map((card) => (
                <div key={card.reviewId} className="flex flex-col gap-2">
                  <AiReadingCard
                    compact
                    card={{
                      bookTitle: report.book.title,
                      bookAuthor: report.book.author,
                      bookThumbnail: report.book.thumbnail,
                      authorNickname: card.authorNickname,
                      oneLineReview: card.oneLineReview ?? "",
                      emotionKeywords: card.emotionKeywords,
                      recommendedFor: card.recommendedFor ?? "",
                      impressivePoint: card.impressivePoint,
                    }}
                  />
                  <Link
                    href={`/reviews/${card.reviewId}`}
                    className="text-center text-xs text-brown-400 hover:text-brown-700"
                  >
                    독후감 전문 보기 →
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-brown-400">{label}</p>
      <p className="mt-1 font-serif text-2xl font-bold text-brown-900">{value}</p>
    </div>
  );
}

function InsightCard({ title, body }: { title: string; body: string | null }) {
  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-lg font-bold text-brown-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-brown-600">{body || "아직 표시할 내용이 충분하지 않아요."}</p>
    </div>
  );
}

function EmptyReport({ title, body }: { title: string; body: string }) {
  return (
    <section className="mt-5 rounded-2xl border border-cream-200 bg-white px-5 py-12 text-center shadow-sm">
      <p className="font-serif text-lg font-bold text-brown-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-brown-400">{body}</p>
    </section>
  );
}
