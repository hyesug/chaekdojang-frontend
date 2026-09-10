import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BackButton from "../../components/BackButton";
import { fetchApiData, fetchAuthenticatedApiData, SITE_URL } from "../../lib/serverApi";
import {
  CONTEST_STATUS_LABEL,
  ENTRY_TYPE_LABEL,
  HOST_TYPE_LABEL,
  formatDateTime,
  topicLabel,
  type ContestDetail,
  type ManageContestDetail,
} from "../types";
import ContestEntryPanel from "./ContestEntryPanel";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ preview?: string }>;
};

export const dynamic = "force-dynamic";

// 숫자가 아닌 id는 백엔드로 넘기지 않는다. 넘기면 400이 나고 오류 로그만 쌓인다.
const isNumericId = (id: string) => /^\d+$/.test(id);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!isNumericId(id)) return { title: "공모전 - 책도장" };

  const detail = await fetchApiData<ContestDetail>(`/api/contests/${id}`, { cache: "no-store" });
  if (!detail) return { title: "공모전 - 책도장" };

  const title = `${detail.contest.title} - 책도장 공모전`;
  const description = `${detail.contest.hostName}이 여는 공모전입니다. 접수 마감 ${formatDateTime(
    detail.contest.submitEndAt
  )}.`;
  return {
    title,
    description,
    alternates: { canonical: `/contests/${id}` },
    openGraph: { title, description, url: `${SITE_URL}/contests/${id}`, siteName: "책도장" },
  };
}

export default async function ContestDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!isNumericId(id)) notFound();

  const preview = (await searchParams)?.preview === "1";
  const managedDetail = preview
    ? await fetchAuthenticatedApiData<ManageContestDetail>(`/api/contests/manage/contests/${id}`)
    : null;
  const detail: ContestDetail | null = preview
    ? managedDetail && {
        contest: managedDetail.contest,
        description: managedDetail.description,
        prizeDescription: managedDetail.prizeDescription,
        acceptingEntries: false,
        myEntry: null,
        awards: [],
      }
    : await fetchAuthenticatedApiData<ContestDetail>(`/api/contests/${id}`);
  if (!detail) notFound();

  const { contest } = detail;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <BackButton fallbackHref={preview ? `/contests/manage/${id}` : "/contests"} />

      {preview && (
        <div className="mt-4 rounded-2xl border border-brown-200 bg-cream-50 px-4 py-3 text-sm text-brown-700">
          독자 화면 미리보기입니다. 작성 중인 공모전은 접수를 시작하기 전까지 독자에게 공개되지 않습니다.
        </div>
      )}

      <section className="mt-4 rounded-3xl border border-cream-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-cream-100 px-2.5 py-0.5 text-xs font-semibold text-brown-600">
            {CONTEST_STATUS_LABEL[contest.status]}
          </span>
          <span className="rounded-full bg-cream-100 px-2.5 py-0.5 text-xs font-semibold text-brown-600">
            {ENTRY_TYPE_LABEL[contest.entryType]}
          </span>
          {contest.platformHosted ? (
            <span className="rounded-full bg-brown-700 px-2.5 py-0.5 text-xs font-semibold text-white">
              책도장 주최
            </span>
          ) : (
            <Link
              href={`/profiles/${contest.hostSlug}`}
              className="text-xs text-brown-400 hover:text-brown-600"
            >
              {contest.hostName} · {HOST_TYPE_LABEL[contest.hostType]}
            </Link>
          )}
        </div>
        <h1 className="mt-3 font-serif text-2xl font-bold leading-snug text-brown-900">
          {contest.title}
        </h1>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Stat label="주제" value={topicLabel(contest)} />
          <Stat label="응모" value={`${contest.entryCount}편`} />
          <Stat label="접수 시작" value={formatDateTime(contest.submitStartAt)} />
          <Stat label="접수 마감" value={formatDateTime(contest.submitEndAt)} />
          <Stat label="발표" value={formatDateTime(contest.announceAt)} />
        </dl>

        {contest.books.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-sm font-semibold text-brown-700">지정 도서</p>
            {contest.books.map((book) => (
              <Link
                key={book.bookId}
                href={`/books/${book.bookId}`}
                className="flex gap-3 rounded-2xl bg-cream-50 p-3 hover:bg-cream-100"
              >
                {book.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={book.thumbnail}
                    alt={book.title}
                    className="h-20 w-14 flex-shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="h-20 w-14 flex-shrink-0 rounded bg-cream-100" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-brown-800">{book.title}</p>
                  <p className="truncate text-sm text-brown-500">{book.author}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {detail.description && (
        <section className="mt-6 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-900">공모 요강</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-brown-600">
            {detail.description}
          </p>
        </section>
      )}

      {detail.prizeDescription && (
        <section className="mt-6 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-900">시상 내역</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-brown-600">
            {detail.prizeDescription}
          </p>
        </section>
      )}

      {detail.awards.length > 0 && (
        <section className="mt-6 rounded-2xl border border-brown-100 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-900">수상작</h2>
          <div className="mt-4 space-y-3">
            {detail.awards.map((award) => (
              <article key={award.entryId} className="rounded-2xl bg-cream-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brown-700 px-2.5 py-0.5 text-xs font-semibold text-white">
                    {award.awardName ?? "수상"}
                  </span>
                  <span className="text-sm font-semibold text-brown-800">{award.nickname}</span>
                  {award.bookTitle && (
                    <span className="truncate text-xs text-brown-400">{award.bookTitle}</span>
                  )}
                </div>
                {award.entryTitle && (
                  <p className="mt-2 font-serif text-base font-bold text-brown-900">
                    {award.entryTitle}
                  </p>
                )}
                {award.content && (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-brown-600">
                    {award.content}
                  </p>
                )}
                {award.reviewId && (
                  <Link
                    href={`/reviews/${award.reviewId}`}
                    className="mt-2 inline-flex text-xs font-semibold text-brown-600 underline"
                  >
                    수상 독후감 보기
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {preview ? (
        <section className="mt-6 rounded-2xl border border-cream-200 bg-white p-5 text-sm text-brown-500 shadow-sm">
          접수를 시작하면 이곳에 독자용 응모 영역이 표시됩니다.
        </section>
      ) : (
        <ContestEntryPanel
          contestId={contest.id}
          entryType={contest.entryType}
          contestStatus={contest.status}
          books={contest.books}
          acceptingEntries={detail.acceptingEntries}
          submitStartAt={contest.submitStartAt}
          submitEndAt={contest.submitEndAt}
          initialEntry={detail.myEntry}
        />
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-cream-50 px-3 py-2">
      <dt className="text-xs text-brown-400">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-brown-800">{value}</dd>
    </div>
  );
}
