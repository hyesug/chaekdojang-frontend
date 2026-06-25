import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewCard, { type Review } from "../../components/ReviewCard";
import ExpandableBio from "../../components/ExpandableBio";
import ProfileAvatar from "../../components/ProfileAvatar";
import { fetchApiData, shareText, SITE_URL } from "../../lib/serverApi";

type UserProfile = {
  id: number;
  nickname: string;
  bio: string | null;
  profileImage: string | null;
  reviewCount: number;
  followerCount: number;
  followingCount: number;
  librarySummary: {
    readingCount: number;
    finishedCount: number;
    wishlistCount: number;
  };
  lifeBook: { id: number; title: string; author: string; thumbnail: string | null } | null;
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
  const decodedNickname = decodeURIComponent(nickname);
  const profile = await getProfile(decodedNickname);
  if (!profile) {
    return {
      title: "프로필을 찾을 수 없습니다",
      robots: { index: false, follow: false },
    };
  }

  const title = `${profile.nickname}님의 책도장`;
  const description = profile.bio || shareText();

  return {
    title,
    description,
    alternates: { canonical: `/u/${encodeURIComponent(profile.nickname)}` },
    openGraph: {
      type: "profile",
      locale: "ko_KR",
      url: `${SITE_URL}/u/${encodeURIComponent(profile.nickname)}`,
      siteName: "책도장",
      title,
      description,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function NicknameProfilePage({ params }: Props) {
  const { nickname } = await params;
  const decodedNickname = decodeURIComponent(nickname);
  const profile = await getProfile(decodedNickname);
  if (!profile) notFound();

  const reviews = await fetchApiData<Review[]>(`/api/users/${profile.id}/reviews`);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg border border-brown-100 p-6 shadow-sm mb-6">
        <div className="flex items-center gap-4">
          <ProfileAvatar src={profile.profileImage} name={profile.nickname} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl font-bold text-brown-800 truncate">{profile.nickname}</h1>
            <ExpandableBio bio={profile.bio || shareText()} className="mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-5">
          {[
            { label: "독후감", count: profile.reviewCount },
            { label: "완독", count: profile.librarySummary?.finishedCount ?? 0 },
            { label: "팔로워", count: profile.followerCount },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-cream-50 px-3 py-3 text-center border border-cream-200">
              <p className="text-xl font-bold text-brown-800">{item.count}</p>
              <p className="text-xs text-brown-400 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>

        {profile.lifeBook && (
          <Link href={`/books/${profile.lifeBook.id}`} className="mt-5 flex items-center gap-3 rounded-lg bg-cream-50 border border-cream-200 p-3 hover:bg-white">
            {profile.lifeBook.thumbnail && (
              <Image src={profile.lifeBook.thumbnail} alt={profile.lifeBook.title} width={42} height={58} className="rounded object-cover" />
            )}
            <div className="min-w-0">
              <p className="text-xs text-brown-400">인생책</p>
              <p className="text-sm font-semibold text-brown-800 truncate">{profile.lifeBook.title}</p>
              <p className="text-xs text-brown-400 truncate">{profile.lifeBook.author}</p>
            </div>
          </Link>
        )}

        <Link
          href={`/calendar?userId=${profile.id}&nickname=${encodeURIComponent(profile.nickname)}`}
          className="mt-5 flex items-center justify-center rounded-lg border border-cream-200 bg-white px-4 py-2 text-sm font-medium text-brown-600 hover:bg-cream-50"
        >
          월별 캘린더
        </Link>
      </div>

      <h2 className="font-serif text-lg font-bold text-brown-800 mb-4">
        {profile.nickname}님의 공개 독후감
      </h2>
      {(reviews ?? []).length === 0 ? (
        <div className="text-center py-12 text-brown-400">아직 공개 독후감이 없어요.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {(reviews ?? []).map((review) => (
            <ReviewCard key={review.id} post={review} />
          ))}
        </div>
      )}
    </div>
  );
}
