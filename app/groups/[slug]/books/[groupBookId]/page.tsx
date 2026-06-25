import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_URL } from "../../../../lib/serverApi";
import { fetchGroupApiData } from "../../../groupServerApi";

type ReadingGroupBook = {
  id: number;
  bookId: number;
  title: string;
  author: string;
  thumbnail: string | null;
  reviewCount: number;
};

type ReadingGroup = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  books: ReadingGroupBook[];
};

type GroupReview = {
  id: number;
  reviewId: number;
  authorId: number;
  authorNickname: string;
  authorProfileImage: string | null;
  bookId: number;
  bookTitle: string;
  bookAuthor: string;
  bookThumbnail: string | null;
  content: string;
  rating: number;
  viewCount: number;
  createdAt: string;
};

type Props = { params: Promise<{ slug: string; groupBookId: string }> };

async function getGroup(slug: string) {
  return fetchGroupApiData<ReadingGroup>(`/api/groups/${encodeURIComponent(slug)}`);
}

async function getReviews(slug: string, groupBookId: string) {
  return (await fetchGroupApiData<GroupReview[]>(`/api/groups/${encodeURIComponent(slug)}/books/${groupBookId}/reviews`)) ?? [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, groupBookId } = await params;
  const group = await getGroup(slug);
  const book = group?.books.find((item) => String(item.id) === groupBookId);
  if (!group || !book) return { title: "그룹 독후감 - 책도장", robots: { index: false, follow: false } };
  const title = `${group.name}의 ${book.title} 독후감 - 책도장`;
  const description = `${group.name} 멤버들이 ${book.title}을 읽고 남긴 독후감을 모아보세요.`;
  return {
    title,
    description,
    alternates: { canonical: `/groups/${group.slug}/books/${groupBookId}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/groups/${group.slug}/books/${groupBookId}`,
      siteName: "책도장",
    },
  };
}

export default async function GroupBookReviewsPage({ params }: Props) {
  const { slug, groupBookId } = await params;
  const [group, reviews] = await Promise.all([getGroup(slug), getReviews(slug, groupBookId)]);
  if (!group) notFound();
  const book = group.books.find((item) => String(item.id) === groupBookId);
  if (!book) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/groups/${group.slug}`} className="text-sm text-brown-400 hover:text-brown-600">
        ← 모임으로 돌아가기
      </Link>

      <section className="mt-4 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
        <div className="flex gap-4">
          {book.thumbnail ? (
            <Image src={book.thumbnail} alt={`${book.title} 책 표지`} width={72} height={104} className="h-28 w-[72px] rounded object-cover shadow-sm" />
          ) : (
            <div className="h-28 w-[72px] rounded bg-cream-200" />
          )}
          <div>
            <p className="text-sm text-brown-400">{group.name}</p>
            <h1 className="mt-1 font-serif text-2xl font-bold text-brown-900">{book.title} 독후감</h1>
            <p className="mt-1 text-sm text-brown-500">{book.author}</p>
            <p className="mt-3 text-sm text-brown-400">이 모임 멤버들이 남긴 독후감 {reviews.length}개</p>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-4">
        {reviews.map((review) => (
          <Link key={review.id} href={`/reviews/${review.reviewId}`} className="block rounded-2xl border border-cream-200 bg-white p-5 shadow-sm hover:bg-cream-50">
            <div className="flex items-center gap-2 text-sm text-brown-400">
              <span>{review.authorNickname}</span>
              <span>·</span>
              <span>{new Date(review.createdAt).toLocaleDateString("ko-KR")}</span>
            </div>
            <div className="mt-2 text-yellow-400">{"★".repeat(review.rating)}<span className="text-cream-300">{"★".repeat(Math.max(0, 5 - review.rating))}</span></div>
            <p className="mt-3 line-clamp-4 text-sm leading-6 text-brown-700">{review.content}</p>
          </Link>
        ))}
        {reviews.length === 0 && (
          <div className="rounded-2xl border border-cream-200 bg-white py-16 text-center text-brown-400">
            <p>아직 이 모임에 연결된 독후감이 없어요.</p>
            <p className="mt-1 text-sm">멤버들이 독후감을 연결하면 이곳에 모입니다.</p>
          </div>
        )}
      </section>
    </main>
  );
}
