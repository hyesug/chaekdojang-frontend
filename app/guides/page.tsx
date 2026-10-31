import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_OG_IMAGE, SITE_URL } from "../lib/serverApi";
import { jsonLdHtml } from "../lib/jsonLd";
import { formatKoreanDate } from "../about/content";
import { GUIDES } from "./content";

export const dynamic = "force-static";

const title = "독서 가이드 - 독후감 쓰는 법·독서 기록 습관·AI 독서카드";
const description =
  "독후감 잘 쓰는 방법, 독서 기록을 꾸준히 이어 가는 습관, AI 독서카드 활용법까지 책도장이 정리한 독서 기록 가이드입니다.";

export const metadata: Metadata = {
  title: { absolute: `${title} | 책도장` },
  description,
  alternates: { canonical: "/guides" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/guides",
    siteName: "책도장",
    title,
    description,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function GuidesPage() {
  const pageUrl = `${SITE_URL}/guides`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: title,
        description,
        inLanguage: "ko-KR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        hasPart: GUIDES.map((guide) => ({
          "@type": "Article",
          headline: guide.title,
          url: `${pageUrl}/${guide.slug}`,
          datePublished: guide.publishedAt,
          dateModified: guide.updatedAt,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "독서 가이드", item: pageUrl },
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

      <header className="cdj-card p-6 sm:p-8">
        <p className="text-sm font-semibold text-sage-700">책도장 독서 가이드</p>
        <h1 className="mt-2 font-serif text-3xl font-bold leading-tight text-brown-900 sm:text-4xl">독서 가이드</h1>
        <p className="mt-4 text-sm leading-7 text-brown-600 sm:text-base">{description}</p>
      </header>

      <ul className="mt-8 space-y-4">
        {GUIDES.map((guide) => (
          <li key={guide.slug} className="rounded-2xl border border-cream-200 bg-cream-50 p-5 sm:p-6">
            <h2 className="font-serif text-xl font-bold text-brown-800">
              <Link href={`/guides/${guide.slug}`} className="hover:underline underline-offset-4">
                {guide.title}
              </Link>
            </h2>
            <p className="mt-2 text-sm leading-6 text-brown-500">{guide.description}</p>
            <p className="mt-3 text-xs text-sage-600">
              최종 수정 <time dateTime={guide.updatedAt}>{formatKoreanDate(guide.updatedAt)}</time>
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-9 text-sm leading-7 text-brown-500">
        책도장이 어떤 서비스인지는{" "}
        <Link href="/about" className="font-semibold text-brown-700 underline underline-offset-4">서비스 소개</Link>
        에서 볼 수 있습니다.
      </p>
    </article>
  );
}
