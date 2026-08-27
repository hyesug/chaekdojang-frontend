import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "../lib/serverApi";

const title = "독서 기록 사이트 | 독후감·서재 관리 - 책도장";
const description =
  "책도장은 독후감 작성, 읽은 책 서재 관리, 별점과 감상 기록, 독서 목표와 다른 독자의 리뷰를 한곳에서 관리할 수 있는 독서 기록 서비스입니다.";

const features = [
  {
    title: "독후감 작성",
    description: "책을 읽고 떠오른 생각과 오래 기억하고 싶은 문장을 기록해요.",
  },
  {
    title: "읽은 책 서재 관리",
    description: "읽은 책을 온라인 서재에 모아 나만의 독서 이력을 만들어요.",
  },
  {
    title: "별점 및 감상 기록",
    description: "별점과 짧은 감상을 함께 남겨 책에 대한 인상을 간직해요.",
  },
  {
    title: "독서 목표 관리",
    description: "나에게 맞는 독서 목표를 세우고 기록이 쌓이는 흐름을 확인해요.",
  },
  {
    title: "다른 독자의 독후감 탐색",
    description: "같은 책을 읽은 독자의 다양한 감상과 책 취향을 발견해요.",
  },
  {
    title: "독서모임",
    description: "함께 읽을 책을 정하고 모임 구성원과 독서 기록을 나눠요.",
  },
  {
    title: "AI 독서카드",
    description: "긴 독후감을 한 줄 감상과 감정 키워드가 담긴 카드로 정리해요.",
  },
];

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  keywords: [
    "독서 기록",
    "독서 기록 사이트",
    "독후감",
    "독후감 사이트",
    "온라인 서재",
    "책 기록",
    "독서 SNS",
  ],
  alternates: { canonical: "/reading-log" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/reading-log",
    siteName: "책도장",
    title,
    description,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default function ReadingLogPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "책도장",
    alternateName: "Chaekdojang",
    url: `${SITE_URL}/reading-log`,
    description,
    applicationCategory: "LifestyleApplication",
    applicationSubCategory: "독서 기록 서비스",
    operatingSystem: "Web",
    inLanguage: "ko-KR",
    featureList: features.map((feature) => feature.title),
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="rounded-2xl border border-cream-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-sage-700">책도장 독서 기록</p>
        <h1 className="mt-2 font-serif text-3xl font-bold leading-tight text-brown-900 sm:text-4xl">
          독서 기록을 한곳에서 관리하세요
        </h1>
        <p className="mt-4 text-sm leading-7 text-brown-600 sm:text-base">
          책도장은 읽은 책과 독후감, 별점, 감상을 기록하고 다른 독자와 책 취향을 나눌 수 있는 독서 기록 서비스입니다.
        </p>
      </section>

      <section className="mt-9">
        <h2 className="font-serif text-2xl font-bold text-brown-900">
          책도장에서 할 수 있는 것
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-cream-200 bg-cream-50 p-5"
            >
              <h3 className="font-semibold text-brown-800">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-brown-500">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-9 rounded-2xl border border-cream-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="font-serif text-2xl font-bold text-brown-900">
          독서 기록을 꾸준히 남겨보세요
        </h2>
        <p className="mt-4 text-sm leading-7 text-brown-600 sm:text-base">
          책을 다 읽은 뒤 긴 글을 완성하지 않아도 괜찮아요. 마음에 남은 장면이나 한 줄 감상부터 적으면 그날의 생각이 나만의 독서 기록으로 쌓입니다.
        </p>
        <p className="mt-3 text-sm leading-7 text-brown-600 sm:text-base">
          시간이 지난 뒤 기록을 다시 펼쳐보면 같은 책을 읽던 때의 마음과 달라진 생각을 돌아볼 수 있습니다. 온라인 서재에 모인 책과 독후감은 다음 책을 고르는 데에도 도움이 됩니다.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/write"
            className="inline-flex items-center justify-center rounded-full bg-brown-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brown-800"
          >
            독후감 쓰기
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center justify-center rounded-full border border-brown-300 bg-white px-5 py-3 text-sm font-semibold text-brown-700 hover:border-brown-500"
          >
            다른 독자의 독후감 보기
          </Link>
        </div>
      </section>
    </main>
  );
}
