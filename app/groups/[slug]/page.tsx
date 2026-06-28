import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import BackButton from "../../components/BackButton";
import { SITE_URL } from "../../lib/serverApi";
import { fetchGroupApiData } from "../groupServerApi";
import GroupDetailClient from "./GroupDetailClient";
import GroupManageClient from "./GroupManageClient";

type ReadingGroupBook = {
  id: number;
  bookId: number;
  title: string;
  author: string;
  publisher: string | null;
  thumbnail: string | null;
  slug: string | null;
  note: string | null;
  reviewCount: number;
  createdAt: string;
};

type ReadingGroup = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  joinPolicy: "OPEN" | "APPROVAL";
  joinEnabled: boolean;
  ownerNickname: string | null;
  memberCount: number;
  member: boolean;
  manager: boolean;
  membershipStatus: "PENDING" | "APPROVED" | "REJECTED" | "BLOCKED" | null;
  books: ReadingGroupBook[];
  createdAt: string;
};

type Props = { params: Promise<{ slug: string }> };

async function getGroup(slug: string) {
  return fetchGroupApiData<ReadingGroup>(`/api/groups/${encodeURIComponent(slug)}`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const group = await getGroup(slug);
  if (!group) return { title: "독서모임 - 책도장", robots: { index: false, follow: false } };
  const description = group.description || `${group.name}에서 함께 읽은 책과 독후감을 책도장에서 확인해보세요.`;
  return {
    title: `${group.name} 독서모임 - 책도장`,
    description,
    alternates: { canonical: `/groups/${group.slug}` },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      url: `${SITE_URL}/groups/${group.slug}`,
      siteName: "책도장",
      title: `${group.name} 독서모임`,
      description,
      images: group.imageUrl ? [{ url: group.imageUrl, alt: group.name }] : undefined,
    },
  };
}

export default async function GroupPage({ params }: Props) {
  const { slug } = await params;
  const group = await getGroup(slug);
  if (!group) notFound();
  const privateContentLocked = group.visibility === "PRIVATE" && !group.member && !group.manager;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4">
        <BackButton fallbackHref="/groups" />
      </div>

      <section className="rounded-3xl border border-cream-200 bg-white p-6 shadow-sm">
        <div className="flex gap-4">
          {group.imageUrl ? (
            <Image src={group.imageUrl} alt={group.name} width={88} height={88} className="h-20 w-20 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-cream-200 text-2xl">📚</div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-2xl font-bold text-brown-900">{group.name}</h1>
              <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-brown-500">
                {group.visibility === "PUBLIC" ? "공개" : "비공개"}
              </span>
              <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-brown-500">
                {group.joinPolicy === "OPEN" ? "바로 가입" : "승인제"}
              </span>
              {!group.joinEnabled && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-500">
                  가입 중지
                </span>
              )}
            </div>
            {!privateContentLocked && (
              <p className="mt-1 text-sm text-brown-400">
                {group.ownerNickname ? `모임장 ${group.ownerNickname} · ` : ""}멤버 {group.memberCount ?? 0}명
              </p>
            )}
            {group.description && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-brown-600">{group.description}</p>}
            {privateContentLocked && (
              <p className="mt-3 rounded-2xl bg-cream-50 px-4 py-3 text-sm leading-6 text-brown-500">
                비공개 모임입니다. 가입 신청이 승인되면 선정 책과 모임 독후감을 볼 수 있어요.
              </p>
            )}
            <div className="mt-4">
              <GroupDetailClient
                slug={group.slug}
                initialMember={group.member}
                initialMemberCount={privateContentLocked ? 0 : group.memberCount ?? 0}
                joinEnabled={group.joinEnabled}
                joinPolicy={group.joinPolicy}
                manager={group.manager}
                initialMembershipStatus={group.membershipStatus}
                showMemberCount={false}
              />
            </div>
          </div>
        </div>
      </section>

      {!privateContentLocked && (
        <GroupManageClient slug={group.slug} manager={group.manager} member={group.member} joinPolicy={group.joinPolicy} books={group.books.map((book) => ({ id: book.id, title: book.title, bookId: book.bookId }))} />
      )}

      {!privateContentLocked && <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-bold text-brown-900">함께 읽는 책</h2>
          {group.manager && (
            <a
              href="#group-book-add"
              className="rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800"
            >
              책 추가하기
            </a>
          )}
        </div>
        <div className="mt-4 space-y-4">
          {group.books.map((item) => (
            <div key={item.id} className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
              <div className="flex gap-4">
                {item.thumbnail ? (
                  <Image src={item.thumbnail} alt={`${item.title} 책 표지`} width={72} height={104} className="h-28 w-[72px] shrink-0 rounded object-cover shadow-sm" />
                ) : (
                  <div className="h-28 w-[72px] shrink-0 rounded bg-cream-200" />
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-serif text-lg font-bold text-brown-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-brown-500">{item.author}</p>
                  {item.note && <p className="mt-2 text-sm text-brown-400">{item.note}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/groups/${group.slug}/books/${item.id}`} className="rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800">
                      그룹 독후감 {item.reviewCount}개 보기
                    </Link>
                    <Link href={`/books/${item.slug || item.bookId}`} className="rounded-full border border-cream-300 px-4 py-2 text-sm text-brown-600 hover:bg-cream-50">
                      책 상세
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {group.books.length === 0 && (
            <div className="rounded-2xl border border-cream-200 bg-white py-16 text-center text-brown-400">
              <p>아직 선정된 책이 없어요.</p>
              <p className="mt-1 text-sm">모임장이 책을 등록하면 독후감을 모아볼 수 있습니다.</p>
              {group.manager && (
                <a
                  href="#group-book-add"
                  className="mt-4 inline-flex rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800"
                >
                  첫 책 추가하기
                </a>
              )}
            </div>
          )}
        </div>
      </section>}
    </main>
  );
}
