import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchApiData, SITE_URL, type ReviewDetail } from "../../../lib/serverApi";

type LibraryStatus = "READING" | "FINISHED" | "WISHLIST";
type TabValue = LibraryStatus | "ALL";

type UserProfile = {
  id: number;
  nickname: string;
  bio: string | null;
};

type LibraryItem = {
  id: number | null;
  book: {
    id: number;
    isbn13?: string;
    title: string;
    author: string;
    thumbnail: string | null;
  };
  status: LibraryStatus;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type Props = {
  params: Promise<{ nickname: string }>;
  searchParams?: Promise<{ status?: string }>;
};

const TABS: Array<{ value: TabValue; label: string }> = [
  { value: "ALL", label: "전체" },
  { value: "READING", label: "읽는 중" },
  { value: "FINISHED", label: "완독" },
  { value: "WISHLIST", label: "읽고 싶다" },
];

const STATUS_LABELS: Record<LibraryStatus, string> = {
  READING: "읽는 중",
  FINISHED: "완독",
  WISHLIST: "읽고 싶다",
};

const COVER_COLORS = ["#8B6048", "#6E7A4A", "#4A6E7A", "#7A4A6E", "#4A7A6E"];

async function getProfile(nickname: string) {
  const decoded = decodeURIComponent(nickname);
  return fetchApiData<UserProfile>(`/api/users/nickname/${encodeURIComponent(decoded)}`);
}

function normalizeStatus(value?: string): TabValue {
  return value === "READING" || value === "FINISHED" || value === "WISHLIST" ? value : "ALL";
}

function tabHref(nickname: string, status: TabValue) {
  const base = `/u/${encodeURIComponent(nickname)}/library`;
  return status === "ALL" ? base : `${base}?status=${status}`;
}

function reviewMapByBook(reviews: ReviewDetail[]) {
  const map = new Map<number, ReviewDetail>();
  reviews.forEach((review) => {
    const bookId = review.book?.id;
    if (bookId && !review.hidden && !map.has(bookId)) {
      map.set(bookId, review);
    }
  });
  return map;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { nickname } = await params;
  const profile = await getProfile(nickname);
  if (!profile) {
    return {
      title: "서재를 찾을 수 없습니다",
      robots: { index: false, follow: false },
    };
  }

  const title = `${profile.nickname}님의 서재 | 책도장`;
  const description = `${profile.nickname}님의 책과 독서 기록을 책도장에서 확인해보세요.`;

  return {
    title,
    description,
    alternates: { canonical: `/u/${encodeURIComponent(profile.nickname)}/library` },
    openGraph: {
      type: "profile",
      locale: "ko_KR",
      url: `${SITE_URL}/u/${encodeURIComponent(profile.nickname)}/library`,
      siteName: "책도장",
      title,
      description,
    },
  };
}

export default async function PublicLibraryPage({ params, searchParams }: Props) {
  const { nickname } = await params;
  const query = searchParams ? await searchParams : undefined;
  const activeTab = normalizeStatus(query?.status);
  const profile = await getProfile(nickname);
  if (!profile) notFound();

  const [items, reviews] = await Promise.all([
    fetchApiData<LibraryItem[]>(`/api/users/${profile.id}/library`, { cache: "no-store" }),
    fetchApiData<ReviewDetail[]>(`/api/users/${profile.id}/reviews`, { cache: "no-store" }),
  ]);
  const libraryItems = items ?? [];
  const visibleReviews = reviews ?? [];
  const reviewByBook = reviewMapByBook(visibleReviews);
  const filtered = activeTab === "ALL"
    ? libraryItems
    : libraryItems.filter((item) => item.status === activeTab);
  const encodedNickname = encodeURIComponent(profile.nickname);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <div className="mb-4">
        <Link href={`/u/${encodedNickname}`} className="text-sm text-brown-400 hover:text-brown-600">
          ← 프로필로 돌아가기
        </Link>
      </div>

      <section className="mb-5 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-brown-400">공개 서재</p>
            <h1 className="mt-1 font-serif text-2xl font-bold text-brown-900">{profile.nickname}님의 서재</h1>
          </div>
          <Link
            href={`/calendar?userId=${profile.id}&nickname=${encodedNickname}`}
            className="rounded-full border border-brown-300 px-4 py-2 text-sm font-medium text-brown-600 hover:bg-cream-100"
          >
            월별 캘린더
          </Link>
        </div>
      </section>

      <div className="mb-5 flex gap-1 rounded-xl bg-cream-200 p-1">
        {TABS.map((tab) => {
          const active = activeTab === tab.value;
          const count = tab.value === "ALL"
            ? libraryItems.length
            : libraryItems.filter((item) => item.status === tab.value).length;
          return (
            <Link
              key={tab.value}
              href={tabHref(profile.nickname, tab.value)}
              scroll={false}
              className={`flex-1 rounded-lg px-2 py-2 text-center text-xs font-medium transition-colors ${
                active ? "bg-white text-brown-800 shadow-sm" : "text-brown-400 hover:text-brown-600"
              }`}
            >
              {tab.label} {count}
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-cream-200 bg-white py-14 text-center text-brown-400">
          <p className="text-4xl">📚</p>
          <p className="mt-3 text-sm">아직 표시할 책이 없어요.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item, index) => {
            const review = reviewByBook.get(item.book.id);
            return (
              <article
                key={`${item.id ?? "review"}-${item.book.id}`}
                className="flex gap-4 rounded-2xl border border-cream-200 bg-white p-4 shadow-sm"
              >
                <Link href={`/books/${item.book.id}`} className="shrink-0">
                  {item.book.thumbnail ? (
                    <Image
                      src={item.book.thumbnail}
                      alt={item.book.title}
                      width={52}
                      height={74}
                      className="h-[74px] w-[52px] rounded object-contain bg-white shadow-sm"
                    />
                  ) : (
                    <div
                      className="flex h-[74px] w-[52px] items-center justify-center rounded px-1 text-center text-xs font-bold leading-tight text-white shadow-sm"
                      style={{ backgroundColor: COVER_COLORS[index % COVER_COLORS.length] }}
                    >
                      {item.book.title.slice(0, 5)}
                    </div>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-brown-500">
                      {STATUS_LABELS[item.status]}
                    </span>
                    {review && (
                      <span className="text-xs text-amber-400">
                        {"★".repeat(review.rating)}
                        <span className="text-cream-300">{"★".repeat(5 - review.rating)}</span>
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/books/${item.book.id}`}
                    className="mt-2 block truncate font-serif font-bold text-brown-800 hover:text-brown-600 hover:underline"
                  >
                    {item.book.title}
                  </Link>
                  <p className="mt-0.5 truncate text-sm text-brown-400">{item.book.author}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/books/${item.book.id}`}
                      className="rounded-full border border-cream-300 px-3 py-1.5 text-xs text-brown-500 hover:bg-cream-50"
                    >
                      책 보기
                    </Link>
                    {review && (
                      <Link
                        href={`/reviews/${review.id}`}
                        className="rounded-full bg-brown-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brown-800"
                      >
                        독후감 보기
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

    </main>
  );
}
