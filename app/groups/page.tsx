import Link from "next/link";
import { fetchApiData, SITE_URL } from "../lib/serverApi";

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
  imageUrl: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  joinPolicy: "OPEN" | "APPROVAL";
  ownerNickname: string;
  books: ReadingGroupBook[];
  createdAt: string;
};

export const metadata = {
  title: "독서모임 - 책도장",
  description: "책도장에서 독서모임이 함께 읽은 책과 독후감을 모아보세요.",
  alternates: { canonical: "/groups" },
  openGraph: {
    title: "독서모임 - 책도장",
    description: "우리 독서모임이 함께 읽은 책과 독후감을 한곳에 모아보세요.",
    url: `${SITE_URL}/groups`,
    siteName: "책도장",
  },
};

export default async function GroupsPage() {
  const groups = (await fetchApiData<ReadingGroup[]>("/api/groups", {
    next: { revalidate: 120 },
  })) ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <section className="rounded-3xl border border-cream-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-brown-400">책도장 독서모임</p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-brown-900">
          함께 읽은 책과 독후감을 모아보세요
        </h1>
        <p className="mt-3 text-sm leading-6 text-brown-500">
          독서모임장이 모임을 만들고, 멤버들이 같은 책에 쓴 독후감을 한곳에 모아볼 수 있습니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/groups/new" className="rounded-full bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800">
            독서모임 만들기
          </Link>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        {groups.map((group) => (
          <Link key={group.id} href={`/groups/${group.slug}`} className="block rounded-2xl border border-cream-200 bg-white p-5 shadow-sm hover:bg-cream-50">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-serif text-xl font-bold text-brown-900">{group.name}</h2>
                <p className="mt-1 text-sm text-brown-400">모임장 {group.ownerNickname} · 책 {group.books.length}권</p>
                {group.description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-brown-600">{group.description}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-cream-100 px-3 py-1 text-xs text-brown-500">
                {group.joinPolicy === "OPEN" ? "바로 가입" : "승인제"}
              </span>
            </div>
          </Link>
        ))}
        {groups.length === 0 && (
          <div className="rounded-2xl border border-cream-200 bg-white py-16 text-center text-brown-400">
            <p>아직 공개 독서모임이 없어요.</p>
            <p className="mt-1 text-sm">첫 번째 모임을 만들어보세요.</p>
          </div>
        )}
      </section>
    </main>
  );
}
