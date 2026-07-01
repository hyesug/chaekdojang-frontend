import Link from "next/link";
import AiReadingCard from "../../../../../components/AiReadingCard";
import { sampleAiReadingCard, type AiReadingCardData } from "../../../../../lib/aiReadingCard";
import { fetchApiData } from "../../../../../lib/serverApi";

type Props = {
  params: Promise<{ slug: string; groupBookId: string }>;
};

type GroupBookResult = {
  groupName: string;
  groupSlug: string;
  book: {
    id: number;
    title: string;
    author: string;
    thumbnail: string | null;
  };
  participantCount: number;
  commonEmotionKeywords: string[];
  representativeOneLineReview: string | null;
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
  const result = await fetchApiData<GroupBookResult>(
    `/api/groups/${encodeURIComponent(slug)}/books/${encodeURIComponent(groupBookId)}/result`,
    { cache: "no-store" }
  );
  const cards = result?.cards?.length
    ? result.cards.map((card) => ({
        bookTitle: card.bookTitle,
        authorNickname: card.authorNickname,
        oneLineReview: card.oneLineReview,
        emotionKeywords: card.emotionKeywords,
        recommendedFor: card.recommendedFor,
        impressivePoint: card.impressivePoint,
      }))
    : [sampleAiReadingCard];
  const commonKeywords = result?.commonEmotionKeywords?.length
    ? result.commonEmotionKeywords
    : sampleAiReadingCard.emotionKeywords;
  const title = result?.book.title ?? "데미안";
  const author = result?.book.author ?? "헤르만 헤세";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <section className="mb-8 rounded-lg border border-cream-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brown-300">
          Dojangdan Result
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-brown-900">
          {result?.groupName ?? "도장단"} 독서 결과
        </h1>
        <p className="mt-3 text-sm leading-6 text-brown-500">
          같은 책을 읽은 사람들이 남긴 독후감을 AI 독서카드로 모았습니다.
        </p>
      </section>

      <section className="mb-8 rounded-lg border border-cream-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs text-brown-300">도장단 책</p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-brown-800">{title}</h2>
            <p className="text-sm text-brown-500">{author}</p>
          </div>
          <div className="rounded-lg bg-cream-50 px-4 py-3">
            <p className="text-xs text-brown-300">참여자 수</p>
            <p className="mt-1 text-xl font-bold text-brown-800">{result?.participantCount ?? cards.length}명</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-brown-300">대표 한 줄 감상</p>
            <p className="mt-1 text-sm font-semibold text-brown-700">
              {result?.representativeOneLineReview ?? sampleAiReadingCard.oneLineReview}
            </p>
          </div>
          <div>
            <p className="text-xs text-brown-300">공통 감정 키워드</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {commonKeywords.map((keyword) => (
                <span key={keyword} className="rounded-full bg-cream-100 px-3 py-1 text-sm text-brown-600">
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card: AiReadingCardData) => (
          <AiReadingCard key={`${card.authorNickname}-${card.oneLineReview}`} card={card} compact />
        ))}
      </section>

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
