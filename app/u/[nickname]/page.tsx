import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type Review } from "../../components/ReviewCard";
import ExpandableBio from "../../components/ExpandableBio";
import ProfileAvatar from "../../components/ProfileAvatar";
import PublicProfileStats from "../../components/PublicProfileStats";
import { fetchApiData, shareText, SITE_URL } from "../../lib/serverApi";
import PublicProfileReviews from "./PublicProfileReviews";

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

        <PublicProfileStats
          userId={profile.id}
          reviewCount={profile.reviewCount}
          finishedCount={profile.librarySummary?.finishedCount ?? 0}
          followerCount={profile.followerCount}
          followingCount={profile.followingCount}
        />

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

      <PublicProfileReviews nickname={profile.nickname} reviews={reviews ?? []} />
    </div>
  );
}
