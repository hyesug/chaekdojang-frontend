import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_OG_IMAGE, SITE_URL } from "../lib/serverApi";
import { jsonLdHtml } from "../lib/jsonLd";
import { GUIDES } from "../guides/content";
import {
  ABOUT_AUDIENCES,
  ABOUT_COMPARISONS,
  ABOUT_DESCRIPTION,
  ABOUT_FAQ,
  ABOUT_FEATURES,
  ABOUT_PUBLISHED_AT,
  ABOUT_STEPS,
  ABOUT_SUMMARY,
  ABOUT_TITLE,
  ABOUT_UPDATED_AT,
  formatKoreanDate as formatDate,
} from "./content";

// 검색 엔진과 AI 가 JS 없이도 읽도록 서버에서 미리 그려 두는 정적 페이지다.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: { absolute: ABOUT_TITLE },
  description: ABOUT_DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/about",
    siteName: "책도장",
    title: ABOUT_TITLE,
    description: ABOUT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary",
    title: ABOUT_TITLE,
    description: ABOUT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function AboutPage() {
  const pageUrl = `${SITE_URL}/about`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: ABOUT_TITLE,
        description: ABOUT_DESCRIPTION,
        inLanguage: "ko-KR",
        datePublished: ABOUT_PUBLISHED_AT,
        dateModified: ABOUT_UPDATED_AT,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#organization` },
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "서비스 소개", item: pageUrl },
        ],
      },
    ],
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />

      <nav aria-label="현재 위치" className="text-xs text-sage-600">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-brown-800">홈</Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="text-brown-700">서비스 소개</li>
        </ol>
      </nav>

      <header className="cdj-card mt-4 p-6 sm:p-8">
        <p className="text-sm font-semibold text-sage-700">책도장 서비스 소개</p>
        <h1 className="mt-2 font-serif text-3xl font-bold leading-tight text-brown-900 sm:text-4xl">
          독후감을 쓰고 읽은 책을 기록하는 독서 SNS, 책도장
        </h1>
        <p className="mt-4 text-sm leading-7 text-brown-600 sm:text-base">{ABOUT_SUMMARY}</p>
        <p className="mt-4 text-xs text-sage-600">
          작성 <time dateTime={ABOUT_PUBLISHED_AT}>{formatDate(ABOUT_PUBLISHED_AT)}</time>
          {" · "}
          최종 수정 <time dateTime={ABOUT_UPDATED_AT}>{formatDate(ABOUT_UPDATED_AT)}</time>
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/auth/login?mode=signup"
            className="inline-flex items-center justify-center rounded-full bg-brown-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brown-800"
          >
            회원가입하고 시작하기
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center justify-center rounded-full border border-brown-300 bg-white px-5 py-3 text-sm font-semibold text-brown-700 hover:border-brown-500"
          >
            다른 독자의 독후감 보기
          </Link>
        </div>
      </header>

      <section className="mt-9" aria-labelledby="about-audience">
        <h2 id="about-audience" className="font-serif text-2xl font-bold text-brown-900">
          이런 분께 맞아요
        </h2>
        <ul className="mt-4 space-y-2 text-sm leading-7 text-brown-600 sm:text-base">
          {ABOUT_AUDIENCES.map((audience) => (
            <li key={audience} className="flex gap-2">
              <span aria-hidden="true" className="text-sage-600">·</span>
              <span>{audience}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-9" aria-labelledby="about-features">
        <h2 id="about-features" className="font-serif text-2xl font-bold text-brown-900">
          책도장에서 할 수 있는 것
        </h2>
        <div className="mt-4 space-y-4">
          {ABOUT_FEATURES.map((feature) => (
            <section
              key={feature.id}
              id={feature.id}
              aria-labelledby={`about-feature-${feature.id}`}
              className="rounded-2xl border border-cream-200 bg-cream-50 p-5 sm:p-6"
            >
              <h3 id={`about-feature-${feature.id}`} className="font-serif text-xl font-bold text-brown-800">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-7 text-brown-600 sm:text-base">{feature.summary}</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-brown-500">
                {feature.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span aria-hidden="true" className="text-sage-600">·</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              {(feature.link || feature.guide) && (
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  {feature.link && (
                    <Link href={feature.link.href} className="font-semibold text-brown-700 underline-offset-4 hover:underline">
                      {feature.link.label} →
                    </Link>
                  )}
                  {feature.guide && (
                    <Link href={feature.guide.href} className="text-brown-600 underline-offset-4 hover:underline">
                      가이드: {feature.guide.label} →
                    </Link>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      </section>

      <section className="mt-9" aria-labelledby="about-compare">
        <h2 id="about-compare" className="font-serif text-2xl font-bold text-brown-900">
          다른 독서 기록 방법과 무엇이 다른가요
        </h2>
        <p className="mt-3 text-sm leading-7 text-brown-600 sm:text-base">
          어떤 방법이 낫다기보다 기록하는 목적에 따라 맞는 도구가 다릅니다.
        </p>
        <div className="mt-4 grid gap-3">
          {ABOUT_COMPARISONS.map((item) => (
            <section key={item.method} className="rounded-2xl border border-cream-200 bg-cream-50 p-5">
              <h3 className="font-semibold text-brown-800">{item.method}</h3>
              <dl className="mt-2 space-y-2 text-sm leading-6">
                <div>
                  <dt className="font-medium text-sage-700">좋은 점</dt>
                  <dd className="text-brown-500">{item.strength}</dd>
                </div>
                <div>
                  <dt className="font-medium text-sage-700">책도장에서는</dt>
                  <dd className="text-brown-500">{item.difference}</dd>
                </div>
              </dl>
            </section>
          ))}
        </div>
      </section>

      <section className="cdj-card mt-9 p-6 sm:p-8" aria-labelledby="about-start">
        <h2 id="about-start" className="font-serif text-2xl font-bold text-brown-900">
          시작하는 방법
        </h2>
        <ol className="mt-4 space-y-4">
          {ABOUT_STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brown-700 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <div>
                <p className="font-semibold text-brown-800">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-brown-500">
                  {step.body}
                  {step.link && (
                    <>
                      {" "}
                      <Link href={step.link.href} className="font-semibold text-brown-700 underline underline-offset-4">
                        {step.link.label}
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-9" aria-labelledby="about-faq">
        <h2 id="about-faq" className="font-serif text-2xl font-bold text-brown-900">
          자주 묻는 질문
        </h2>
        <div className="mt-4 divide-y divide-cream-200 rounded-2xl border border-cream-200 bg-cream-50">
          {ABOUT_FAQ.map((item) => (
            <section key={item.question} className="p-5">
              <h3 className="font-semibold text-brown-800">{item.question}</h3>
              <p className="mt-2 text-sm leading-7 text-brown-600">
                {item.answer}
                {item.link && (
                  <>
                    {" "}
                    <Link href={item.link.href} className="font-semibold text-brown-700 underline underline-offset-4">
                      {item.link.label}
                    </Link>
                  </>
                )}
              </p>
            </section>
          ))}
        </div>
      </section>

      <section className="mt-9" aria-labelledby="about-guides">
        <h2 id="about-guides" className="font-serif text-2xl font-bold text-brown-900">
          독서 가이드
        </h2>
        <ul className="mt-4 space-y-2 text-sm leading-6">
          {GUIDES.map((guide) => (
            <li key={guide.slug}>
              <Link href={`/guides/${guide.slug}`} className="font-semibold text-brown-700 underline-offset-4 hover:underline">
                {guide.title} →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-9 text-sm leading-7 text-brown-500">
        더 궁금한 점은 <Link href="/cs" className="font-semibold text-brown-700 underline underline-offset-4">고객센터</Link>로 문의해 주세요.
        이용 조건은 <Link href="/terms" className="underline underline-offset-4">이용약관</Link>과{" "}
        <Link href="/privacy" className="underline underline-offset-4">개인정보처리방침</Link>에서 확인할 수 있습니다.
      </p>
    </article>
  );
}
