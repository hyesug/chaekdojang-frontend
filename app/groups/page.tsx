import Link from "next/link";
import GroupsClient, { type ReadingGroupListItem } from "./GroupsClient";
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
  joinEnabled: boolean;
  ownerNickname: string;
  member: boolean;
  manager: boolean;
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

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const groups = (await fetchApiData<ReadingGroup[]>("/api/groups", {
    cache: "no-store",
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

      <GroupsClient initialGroups={groups as ReadingGroupListItem[]} />
    </main>
  );
}
