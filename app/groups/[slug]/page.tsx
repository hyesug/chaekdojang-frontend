import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import BackButton from "../../components/BackButton";
import { bookPathSegment, SITE_URL } from "../../lib/serverApi";
import { fetchGroupApiData } from "../groupServerApi";
import GroupDetailClient from "./GroupDetailClient";
import GroupInviteShare from "./GroupInviteShare";
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
  status: "UPCOMING" | "READING" | "COMPLETED";
  deadline: string | null;
  reviewCount: number;
  createdAt: string;
};

type ReadingGroup = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  notice: string | null;
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

const STATUS_LABEL = {
  UPCOMING: "다음 책",
  READING: "읽는 중",
  COMPLETED: "완독",
} as const;

function formatDeadline(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" })
    .format(new Date(`${value}T00:00:00+09:00`));
}

function deadlineBadge(value: string) {
  const target = new Date(`${value}T00:00:00+09:00`).getTime();
  const now = new Date();
  const today = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  today.setHours(0, 0, 0, 0);
  const days = Math.round((target - today.getTime()) / 86_400_000);
  if (days === 0) return "D-day";
  return days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
}

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
  const readingBook = group.books.find((book) => book.status === "READING") ?? null;
  const upcomingBook = group.books.find((book) => book.status === "UPCOMING") ?? null;
  const progressLabel = readingBook
    ? "읽는 중"
    : upcomingBook
      ? "다음 책 준비"
      : group.books.length > 0
        ? "모든 책 완독"
        : "책 선정 전";

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
              {!privateContentLocked && (
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                  {progressLabel}
                </span>
              )}
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
            {(group.manager || group.member) && (
              <div className="mt-3">
                <GroupInviteShare
                  slug={group.slug}
                  name={group.name}
                  description={group.description}
                  imageUrl={group.imageUrl}
                  currentBook={readingBook?.title ?? upcomingBook?.title ?? null}
                  deadline={readingBook?.deadline ?? upcomingBook?.deadline ?? null}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {!privateContentLocked && group.notice && (
        <section className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 px-5 py-4">
          <p className="text-xs font-semibold text-yellow-800">📢 모임장 공지</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-brown-700">{group.notice}</p>
        </section>
      )}

      {!privateContentLocked && (
        <GroupManageClient slug={group.slug} manager={group.manager} member={group.member} visibility={group.visibility} joinPolicy={group.joinPolicy} notice={group.notice} books={group.books.map((book) => ({ id: book.id, title: book.title, bookId: book.bookId, status: book.status, deadline: book.deadline, note: book.note }))} />
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
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-lg font-bold text-brown-900">{item.title}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "READING" ? "bg-green-50 text-green-700" : item.status === "COMPLETED" ? "bg-brown-100 text-brown-700" : "bg-yellow-50 text-yellow-700"}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-brown-500">{item.author}</p>
                  {item.deadline && (
                    <p className="mt-2 text-sm font-medium text-brown-600">
                      마감일 {formatDeadline(item.deadline)} · {deadlineBadge(item.deadline)}
                    </p>
                  )}
                  {item.note && <p className="mt-2 text-sm text-brown-400">{item.note}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/groups/${group.slug}/books/${item.id}`} className="rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800">
                      질문·중간 생각 / 독후감 {item.reviewCount}개
                    </Link>
                    <Link href={`/books/${bookPathSegment(item.bookId, item.slug)}`} className="rounded-full border border-cream-300 px-4 py-2 text-sm text-brown-600 hover:bg-cream-50">
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
