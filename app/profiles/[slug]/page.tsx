import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchApiData, SITE_URL } from "../../lib/serverApi";

type OfficialProfileType = "AUTHOR" | "PUBLISHER" | "BOOKSTORE";

type OfficialProfileBook = {
  id: number;
  isbn13: string;
  title: string;
  author: string;
  publisher: string | null;
  thumbnail: string | null;
  reviewCount: number;
};

type OfficialProfile = {
  id: number;
  type: OfficialProfileType;
  displayName: string;
  slug: string;
  bio: string | null;
  imageUrl: string | null;
  officialUrl: string | null;
  instagramUrl: string | null;
  brunchUrl: string | null;
  tumblbugUrl: string | null;
  contactEmail: string | null;
  verified: boolean;
  featured: boolean;
  books: OfficialProfileBook[];
};

type Props = {
  params: Promise<{ slug: string }>;
};

const typeLabels: Record<OfficialProfileType, string> = {
  AUTHOR: "작가",
  PUBLISHER: "출판사",
  BOOKSTORE: "서점",
};

async function getProfile(slug: string) {
  return fetchApiData<OfficialProfile>(`/api/profiles/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfile(slug);
  if (!profile) {
    return {
      title: "공식 프로필 - 책도장",
      robots: { index: false, follow: false },
    };
  }

  const title = `${profile.displayName} 공식 프로필 - 책도장`;
  const description = profile.bio
    ? profile.bio.replace(/\s+/g, " ").slice(0, 150)
    : `${profile.displayName}의 책과 독자 독후감을 책도장에서 확인해보세요.`;

  return {
    title,
    description,
    alternates: { canonical: `/profiles/${profile.slug}` },
    openGraph: {
      type: "profile",
      locale: "ko_KR",
      url: `${SITE_URL}/profiles/${profile.slug}`,
      siteName: "책도장",
      title,
      description,
      images: profile.imageUrl
        ? [{ url: profile.imageUrl, width: 512, height: 512, alt: profile.displayName }]
        : undefined,
    },
  };
}

function externalLabel(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("instagram")) return "인스타그램";
    if (host.includes("brunch")) return "브런치";
    if (host.includes("tumblbug")) return "텀블벅";
    return "공식 링크";
  } catch {
    return "공식 링크";
  }
}

export default async function OfficialProfilePage({ params }: Props) {
  const { slug } = await params;
  const profile = await getProfile(slug);
  if (!profile) notFound();

  const links = [
    profile.officialUrl,
    profile.instagramUrl,
    profile.brunchUrl,
    profile.tumblbugUrl,
  ].filter((url): url is string => Boolean(url));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": profile.type === "AUTHOR" ? "Person" : "Organization",
    name: profile.displayName,
    description: profile.bio ?? undefined,
    url: `${SITE_URL}/profiles/${profile.slug}`,
    sameAs: links,
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="mb-8 border-b border-cream-200 pb-6">
        <div className="flex items-start gap-4">
          {profile.imageUrl ? (
            <Image
              src={profile.imageUrl}
              alt={profile.displayName}
              width={80}
              height={80}
              className="h-20 w-20 rounded-lg border border-cream-200 object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-cream-200 bg-cream-100 font-serif text-2xl font-bold text-brown-600">
              {profile.displayName[0]}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-brown-500">
                {typeLabels[profile.type]}
              </span>
              {profile.verified && (
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600">공식 인증</span>
              )}
            </div>
            <h1 className="mt-2 font-serif text-2xl font-bold text-brown-900">{profile.displayName}</h1>
            {profile.bio && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-brown-600">{profile.bio}</p>}
          </div>
        </div>

        {(links.length > 0 || profile.contactEmail) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {links.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-cream-300 px-3 py-1.5 text-xs text-brown-600 hover:bg-cream-100"
              >
                {externalLabel(url)}
              </a>
            ))}
            {profile.contactEmail && (
              <a
                href={`mailto:${profile.contactEmail}`}
                className="rounded-full bg-brown-600 px-3 py-1.5 text-xs text-white hover:bg-brown-700"
              >
                문의하기
              </a>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="font-serif text-xl font-bold text-brown-900">
            {profile.type === "PUBLISHER" ? "이 출판사의 책에 남겨진 독후감" : "등록한 책과 독후감"}
          </h2>
          <p className="mt-1 text-sm text-brown-400">각 책에 남겨진 독자들의 감상을 모아 볼 수 있어요.</p>
        </div>

        {profile.books.length === 0 ? (
          <div className="rounded-lg border border-cream-200 bg-white py-12 text-center text-sm text-brown-300">
            아직 연결된 책이 없어요.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.books.map((book) => (
              <article key={book.id} className="rounded-lg border border-cream-200 bg-white p-4">
                <div className="flex gap-3">
                  {book.thumbnail ? (
                    <Image
                      src={book.thumbnail}
                      alt={book.title}
                      width={48}
                      height={68}
                      className="h-[68px] w-12 rounded object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex h-[68px] w-12 shrink-0 items-end justify-center rounded bg-brown-200 pb-1 text-xs font-bold text-white">
                      {book.title[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <Link href={`/books/${book.id}`} className="font-serif font-bold text-brown-800 hover:underline">
                      {book.title}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-brown-400">{book.author}</p>
                    {book.publisher && <p className="mt-0.5 truncate text-xs text-brown-300">{book.publisher}</p>}
                  </div>
                </div>
                <Link
                  href={`/books/${book.id}`}
                  className="mt-3 block rounded-lg bg-cream-100 px-3 py-2 text-center text-sm text-brown-700 hover:bg-cream-200"
                >
                  독후감 {book.reviewCount}개 보기
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
