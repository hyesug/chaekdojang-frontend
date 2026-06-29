import Link from "next/link";
import AiReadingCard from "../../components/AiReadingCard";
import { sampleAiReadingCard, type AiReadingCardData } from "../../lib/aiReadingCard";

const sampleCards: AiReadingCardData[] = [
  sampleAiReadingCard,
  {
    bookTitle: "데미안",
    authorNickname: "문장수집가",
    oneLineReview: "불안 속에서 자기 목소리를 찾아가는 책",
    emotionKeywords: ["불안", "용기", "내면", "성장"],
    recommendedFor: "남의 기준에서 벗어나고 싶은 사람",
    impressivePoint: "성장이 편안한 확신보다 흔들리는 질문에서 시작된다는 점이 오래 남는다.",
  },
  {
    bookTitle: "데미안",
    authorNickname: "밤의독서",
    oneLineReview: "나를 둘러싼 껍질을 깨닫게 하는 이야기",
    emotionKeywords: ["해방", "고독", "탐색", "각성"],
    recommendedFor: "자기 안의 어두움까지 마주하고 싶은 사람",
    impressivePoint: "밝은 세계와 어두운 세계를 나누기보다 함께 받아들이는 태도가 인상 깊다.",
  },
];

const commonKeywords = ["성장", "불안", "자기발견", "해방"];

export default function DojangdanDemoPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <section className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brown-300">
          Dojangdan Demo
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-brown-900">
          도장단 독서 결과 예시
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-brown-500">
          같은 책을 읽은 사람들의 독후감을 AI 독서카드로 모아보고, 공통 감정과 대표 감상을 한눈에 확인할 수 있습니다.
        </p>
      </section>

      <section className="mb-8 rounded-lg border border-cream-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs text-brown-300">이번 도장단 책</p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-brown-800">데미안</h2>
            <p className="text-sm text-brown-500">헤르만 헤세</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-cream-50 px-4 py-3">
              <p className="text-xs text-brown-300">참여자 수</p>
              <p className="mt-1 text-xl font-bold text-brown-800">12명</p>
            </div>
            <div className="rounded-lg bg-cream-50 px-4 py-3">
              <p className="text-xs text-brown-300">대표 한 줄 감상</p>
              <p className="mt-1 text-sm font-semibold text-brown-700">
                각자의 알을 깨고 나오는 순간을 다르게 기록했습니다.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs text-brown-300">공통 감정 키워드</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {commonKeywords.map((keyword) => (
              <span key={keyword} className="rounded-full bg-cream-100 px-3 py-1 text-sm text-brown-600">
                {keyword}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {sampleCards.map((card) => (
          <AiReadingCard key={`${card.authorNickname}-${card.oneLineReview}`} card={card} compact />
        ))}
      </section>

      <div className="mt-8 text-center">
        <Link
          href="/books/demian"
          className="inline-flex rounded-full bg-brown-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brown-800"
        >
          전체 독후감 보기
        </Link>
      </div>
    </main>
  );
}
