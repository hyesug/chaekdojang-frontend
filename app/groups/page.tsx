import Link from "next/link";
import GroupsClient, { type ReadingGroupListItem } from "./GroupsClient";
import { DEFAULT_OG_IMAGE, fetchApiData, SITE_URL } from "../lib/serverApi";

type ReadingGroupBook = {
  id: number;
  bookId: number;
  title: string;
  author: string;
  thumbnail: string | null;
  status: "UPCOMING" | "READING" | "COMPLETED";
  deadline: string | null;
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
  ownerNickname: string | null;
  memberCount: number;
  member: boolean;
  manager: boolean;
  books: ReadingGroupBook[];
  createdAt: string;
};

const description =
  "책도장에서 독서모임을 만들고 함께 읽을 책을 정해, 멤버들이 쓴 독후감과 모임 질문을 한곳에 모아보세요.";

export const metadata = {
  title: "독서모임 만들기·함께 읽은 독후감 모으기",
  description,
  alternates: { canonical: "/groups" },
  openGraph: {
    title: "독서모임 - 책도장",
    description,
    url: `${SITE_URL}/groups`,
    siteName: "책도장",
    images: [DEFAULT_OG_IMAGE],
  },
};

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const groups = (await fetchApiData<ReadingGroup[]>("/api/groups", {
    cache: "no-store",
  })) ?? [];

  return (
    <main className="cdj-page cdj-page--reading">
      <section className="cdj-card p-6">
        <p className="text-sm font-semibold text-brown-400">책도장 독서모임</p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-brown-900">
          함께 읽은 책과 독후감을 모아보세요
        </h1>
        <p className="mt-3 text-sm leading-6 text-brown-500">
          독서모임장이 모임을 만들고, 멤버들이 같은 책에 쓴 독후감을 한곳에 모아볼 수 있습니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/groups/new" className="cdj-button cdj-button--primary">
            독서모임 만들기
          </Link>
        </div>
      </section>

      <GroupsClient initialGroups={groups as ReadingGroupListItem[]} />
    </main>
  );
}
