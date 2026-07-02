import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
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

      {hasCards && (
        <>
          <section className="mt-5 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-brown-400">대표 반응</p>
            <p className="mt-2 font-serif text-xl font-bold leading-8 text-brown-900">
              {report.representativeOneLineReview ?? "대표 한 줄 감상이 아직 없어요."}
            </p>
          </section>

          <section className="mt-5 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
            <h2 className="font-serif text-lg font-bold text-brown-900">공통 감정 키워드</h2>
            {report.commonEmotionKeywords.length === 0 ? (
              <p className="mt-3 text-sm text-brown-400">아직 집계할 감정 키워드가 없어요.</p>
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

          <section className="mt-5 grid gap-3">
            <InsightCard title="독자들이 주목한 지점" body={report.impressivePointSummary} />
            <InsightCard title="추천 독자층" body={report.recommendedForSummary} />
          </section>

          <section className="mt-8">
            <h2 className="font-serif text-xl font-bold text-brown-900">개별 AI 카드</h2>
            <div className="mt-4 space-y-3">
              {report.cards.map((card) => (
                <article key={card.reviewId} className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-brown-800">{card.authorNickname}</p>
                      <p className="mt-1 text-xs text-brown-400">별점 {card.rating}</p>
                    </div>
                    <Link href={`/reviews/${card.reviewId}`} className="shrink-0 text-xs font-medium text-brown-400 hover:text-brown-700">
                      독후감 보기
                    </Link>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-brown-700">
                    {card.oneLineReview ?? "한 줄 감상이 아직 없어요."}
                  </p>
                  {card.emotionKeywords.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {card.emotionKeywords.map((keyword) => (
                        <span key={`${card.reviewId}-${keyword}`} className="rounded-full bg-cream-50 px-2.5 py-1 text-xs text-brown-500">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
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
