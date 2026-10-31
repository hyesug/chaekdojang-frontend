import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AiReadingCard from "../../components/AiReadingCard";
import { sampleAiReadingCard } from "../../lib/aiReadingCard";
import { DEFAULT_OG_IMAGE, SITE_URL } from "../../lib/serverApi";
import { jsonLdHtml } from "../../lib/jsonLd";
import { formatKoreanDate } from "../../about/content";
import { findGuide, GUIDES, type GuideSection } from "../content";

type Props = {
  params: Promise<{ slug: string }>;
};

// 글은 코드에 있는 정해진 몇 편뿐이라 빌드 때 모두 그려 두고, 다른 주소는 404 로 둔다.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) return { title: "독서 가이드", robots: { index: false, follow: false } };

  const path = `/guides/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      locale: "ko_KR",
      url: path,
      siteName: "책도장",
      title: guide.title,
      description: guide.description,
      publishedTime: guide.publishedAt,
      modifiedTime: guide.updatedAt,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary",
      title: guide.title,
      description: guide.description,
      images: [DEFAULT_OG_IMAGE.url],
    },
  };
}

function Section({ section }: { section: GuideSection }) {
  const ListTag = section.list?.ordered ? "ol" : "ul";
  return (
    <section className="mt-9">
      <h2 className="font-serif text-2xl font-bold text-brown-900">{section.heading}</h2>
      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph} className="mt-3 text-sm leading-7 text-brown-600 sm:text-base">{paragraph}</p>
      ))}
      {section.list && (
        <ListTag
          className={`mt-3 space-y-2 pl-5 text-sm leading-7 text-brown-600 sm:text-base ${
            section.list.ordered ? "list-decimal" : "list-disc"
          }`}
        >
          {section.list.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ListTag>
      )}
      {section.example && (
        <figure className="mt-4 rounded-2xl border border-cream-200 bg-cream-50 p-5">
          <figcaption className="text-xs font-semibold text-sage-700">{section.example.label}</figcaption>
          <div className="mt-2 space-y-2 font-serif text-sm leading-7 text-brown-800 sm:text-base">
            {section.example.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </figure>
      )}
      {section.aiCardSample && (
        <figure className="mt-5">
          <AiReadingCard card={sampleAiReadingCard} />
          <figcaption className="mt-2 text-xs text-sage-600">
            예시 카드 — 설명을 위해 만든 예시이며 실제 독자의 독후감이 아닙니다.
          </figcaption>
        </figure>
      )}
      {section.after?.map((paragraph) => (
        <p key={paragraph} className="mt-3 text-sm leading-7 text-brown-600 sm:text-base">{paragraph}</p>
      ))}
      {section.link && (
        <Link
          href={section.link.href}
          className="mt-4 inline-flex text-sm font-semibold text-brown-700 underline-offset-4 hover:underline"
        >
          {section.link.label} →
        </Link>
      )}
    </section>
  );
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) notFound();

  const pageUrl = `${SITE_URL}/guides/${guide.slug}`;
  const organization = { "@type": "Organization", name: "책도장", url: SITE_URL };
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${pageUrl}#article`,
        headline: guide.title,
        description: guide.description,
        inLanguage: "ko-KR",
        datePublished: guide.publishedAt,
        dateModified: guide.updatedAt,
        mainEntityOfPage: pageUrl,
        image: `${SITE_URL}${DEFAULT_OG_IMAGE.url}`,
        author: organization,
        publisher: {
          ...organization,
          logo: { "@type": "ImageObject", url: `${SITE_URL}/chaekdojang-logo-512.png` },
        },
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "독서 가이드", item: `${SITE_URL}/guides` },
          { "@type": "ListItem", position: 3, name: guide.title, item: pageUrl },
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
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-brown-800">홈</Link>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <Link href="/guides" className="hover:text-brown-800">독서 가이드</Link>
          </li>
        </ol>
      </nav>

      <header className="cdj-card mt-4 p-6 sm:p-8">
        <p className="text-sm font-semibold text-sage-700">책도장 독서 가이드</p>
        <h1 className="mt-2 font-serif text-3xl font-bold leading-tight text-brown-900 sm:text-4xl">{guide.title}</h1>
        <p className="mt-4 text-xs text-sage-600">
          작성 <time dateTime={guide.publishedAt}>{formatKoreanDate(guide.publishedAt)}</time>
          {" · "}
          최종 수정 <time dateTime={guide.updatedAt}>{formatKoreanDate(guide.updatedAt)}</time>
          {" · "}
          책도장
        </p>
      </header>

      <section className="mt-6 rounded-2xl border border-cream-200 bg-cream-50 p-5 sm:p-6" aria-labelledby="guide-summary">
        <h2 id="guide-summary" className="text-sm font-semibold text-sage-700">한눈에 보는 답</h2>
        <p className="mt-2 text-sm leading-7 text-brown-700 sm:text-base">{guide.summary}</p>
      </section>

      {guide.sections.map((section) => (
        <Section key={section.heading} section={section} />
      ))}

      <section className="cdj-card mt-10 p-6 sm:p-8" aria-labelledby="guide-related">
        <h2 id="guide-related" className="font-serif text-xl font-bold text-brown-900">함께 읽으면 좋은 글</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {guide.related.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="font-semibold text-brown-700 underline-offset-4 hover:underline">
                {link.label} →
              </Link>
            </li>
          ))}
          <li>
            <Link href="/guides" className="text-brown-600 underline-offset-4 hover:underline">
              독서 가이드 전체 보기 →
            </Link>
          </li>
        </ul>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/auth/login?mode=signup"
            className="inline-flex items-center justify-center rounded-full bg-brown-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brown-800"
          >
            책도장에서 기록 시작하기
          </Link>
          <Link
            href="/about"
            className="inline-flex items-center justify-center rounded-full border border-brown-300 bg-white px-5 py-3 text-sm font-semibold text-brown-700 hover:border-brown-500"
          >
            책도장 서비스 소개
          </Link>
        </div>
      </section>
    </article>
  );
}
