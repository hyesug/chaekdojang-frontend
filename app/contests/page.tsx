import Link from "next/link";
import { fetchApiData, SITE_URL } from "../lib/serverApi";
import {
  ENTRY_TYPE_LABEL,
  contestStatusLabel,
  formatDateTime,
  hostLabel,
  topicLabel,
  type ContestSummary,
} from "./types";

export const metadata = {
  title: "독후감 공모전 - 책도장",
  description: "도서관·출판사와 책도장이 여는 독후감 공모전에 응모하고 수상작을 확인하세요.",
  alternates: { canonical: "/contests" },
  openGraph: {
    title: "독후감 공모전 - 책도장",
    description: "도서관·출판사와 책도장이 여는 독후감 공모전에 응모하고 수상작을 확인하세요.",
    url: `${SITE_URL}/contests`,
    siteName: "책도장",
  },
};

export const dynamic = "force-dynamic";

export default async function ContestListPage() {
  const contests =
    (await fetchApiData<ContestSummary[]>("/api/contests", { cache: "no-store" })) ?? [];

  // 주최자가 마감 처리를 미룬 공모전도 접수 기간이 지났으면 접수 중으로 묶지 않는다.
  const open = contests.filter((contest) => contest.acceptingEntries);
  const judging = contests.filter(
    (contest) => !contest.acceptingEntries && contest.status !== "ANNOUNCED"
  );
  const announced = contests.filter((contest) => contest.status === "ANNOUNCED");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <section className="rounded-3xl border border-cream-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-brown-400">공모전</p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-brown-900">
          지금 열려 있는 독후감 공모전
        </h1>
        <p className="mt-3 text-sm leading-6 text-brown-500">
          도서관·출판사가 책도장에서 여는 공모전과 책도장이 직접 여는 공모전을 한곳에서 봅니다. 응모작은
          내가 쓴 독후감을 연결하거나, 공모전 안에서 새로 작성해 냅니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/contests/me"
            className="rounded-full border border-cream-200 px-4 py-2 text-sm font-semibold text-brown-700 hover:bg-cream-50"
          >
            내 응모 현황
          </Link>
          <Link
            href="/contests/manage"
            className="rounded-full border border-cream-200 px-4 py-2 text-sm font-semibold text-brown-700 hover:bg-cream-50"
          >
            주최자 운영실
          </Link>
        </div>
      </section>

      {contests.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-cream-200 bg-white p-6 text-center text-sm text-brown-500">
          아직 공개된 공모전이 없습니다.
        </p>
      ) : (
        <>
          <ContestSection title="접수 중" contests={open} />
          <ContestSection title="심사 중" contests={judging} />
          <ContestSection title="발표 완료" contests={announced} />
        </>
      )}
    </main>
  );
}

function ContestSection({ title, contests }: { title: string; contests: ContestSummary[] }) {
  if (contests.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-serif text-xl font-bold text-brown-900">{title}</h2>
      <div className="mt-4 space-y-3">
        {contests.map((contest) => (
          <Link
            key={contest.id}
            href={`/contests/${contest.id}`}
            className="flex gap-4 rounded-2xl border border-cream-200 bg-white p-4 shadow-sm hover:border-brown-200"
          >
            {contest.books[0]?.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={contest.books[0].thumbnail}
                alt={contest.books[0].title}
                className="h-24 w-16 flex-shrink-0 rounded object-cover"
              />
            ) : (
              <div className="flex h-24 w-16 flex-shrink-0 items-center justify-center rounded bg-cream-100 text-xs text-brown-400">
                {contest.books.length > 0 ? "표지 없음" : "자유주제"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-semibold text-brown-600">
                  {contestStatusLabel(contest)}
                </span>
                <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-semibold text-brown-600">
                  {ENTRY_TYPE_LABEL[contest.entryType]}
                </span>
                <span className="truncate text-xs text-brown-400">
                  {hostLabel(contest.hostName, contest.hostType)}
                </span>
              </div>
              <p className="mt-1 truncate font-serif text-lg font-bold text-brown-900">
                {contest.title}
              </p>
              <p className="truncate text-sm text-brown-500">{topicLabel(contest)}</p>
              <p className="mt-1 text-xs text-brown-400">
                {contest.entryCount}편 응모 · 접수 마감 {formatDateTime(contest.submitEndAt)} · 발표{" "}
                {formatDateTime(contest.announceAt)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
