import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchApiData, SITE_URL } from "../../../lib/serverApi";

type UserProfile = {
  id: number;
  nickname: string;
  bio: string | null;
};

type LibraryItem = {
  id: number;
  book: {
    id: number;
    title: string;
    author: string;
    thumbnail: string | null;
  };
};

type Props = {
  params: Promise<{ nickname: string }>;
};

async function getProfile(nickname: string) {
  const decoded = decodeURIComponent(nickname);
  return fetchApiData<UserProfile>(`/api/users/nickname/${encodeURIComponent(decoded)}`);
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
  const description = `${profile.nickname}님이 완독한 책과 독서 기록을 책도장에서 확인해보세요.`;

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

export default async function PublicLibraryPage({ params }: Props) {
  const { nickname } = await params;
  const profile = await getProfile(nickname);
  if (!profile) notFound();

  const items = await fetchApiData<LibraryItem[]>(`/api/users/${profile.id}/library`, { cache: "no-store" });
  const encodedNickname = encodeURIComponent(profile.nickname);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <div className="mb-4">
        <Link href={`/u/${encodedNickname}`} className="text-sm text-brown-400 hover:text-brown-600">
          ← 프로필로 돌아가기
        </Link>
      </div>

      <section className="mb-5 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-brown-400">공개 서재</p>
        <h1 className="mt-1 font-serif text-2xl font-bold text-brown-900">{profile.nickname}님의 서재</h1>
        <p className="mt-2 text-sm leading-6 text-brown-500">
          공개 독후감이 있는 완독 도서만 표시됩니다.
        </p>
      </section>

      {!items || items.length === 0 ? (
        <div className="rounded-2xl border border-cream-200 bg-white py-14 text-center text-brown-400">
          <p className="text-4xl">📚</p>
          <p className="mt-3 text-sm">아직 공개된 서재가 없어요.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/books/${item.book.id}`}
              className="flex items-center gap-3 rounded-2xl border border-cream-200 bg-white p-3 transition-colors hover:bg-cream-50"
            >
              {item.book.thumbnail ? (
                <Image
                  src={item.book.thumbnail}
                  alt={item.book.title}
                  width={46}
                  height={66}
                  className="h-[66px] w-[46px] rounded object-cover shadow-sm"
                />
              ) : (
                <div className="h-[66px] w-[46px] rounded bg-cream-200" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-brown-800">{item.book.title}</p>
                <p className="mt-0.5 truncate text-xs text-brown-400">{item.book.author}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
