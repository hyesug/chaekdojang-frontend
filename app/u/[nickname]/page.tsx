import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type Review } from "../../components/ReviewCard";
import ExpandableBio from "../../components/ExpandableBio";
import ProfileAvatar from "../../components/ProfileAvatar";
import PublicProfileStats from "../../components/PublicProfileStats";
import ReadingGoalProgress from "../../components/ReadingGoalProgress";
import { fetchApiData, SITE_URL } from "../../lib/serverApi";
import PublicProfileReviews from "./PublicProfileReviews";
import PublicProfileFollowButton from "./PublicProfileFollowButton";

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

type ReadingGoal = {
  year: number;
  targetCount: number;
  finishedCount: number;
  remainingCount: number;
  progressPercent: number;
  publicVisible: boolean;
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
  const description = profile.bio || `${profile.nickname}님의 공개 독후감과 독서 기록을 책도장에서 확인해보세요.`;

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
  const readingGoal = await fetchApiData<ReadingGoal>(`/api/users/${profile.id}/reading-goal`, { cache: "no-store" });
  const showReadingGoal = readingGoal?.targetCount != null && readingGoal.publicVisible;
  const encodedNickname = encodeURIComponent(profile.nickname);

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:py-8">
      <div className="mb-5 rounded-2xl border border-cream-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3 sm:gap-4">
          <ProfileAvatar src={profile.profileImage} name={profile.nickname} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-serif text-xl font-bold text-brown-800 sm:text-2xl">{profile.nickname}</h1>
              <PublicProfileFollowButton userId={profile.id} />
            </div>
            {profile.bio && <ExpandableBio bio={profile.bio} className="mt-1" />}
          </div>
        </div>

        <PublicProfileStats
          userId={profile.id}
          reviewCount={profile.reviewCount}
          followerCount={profile.followerCount}
          followingCount={profile.followingCount}
        />

        {showReadingGoal && (
          <div className="mt-4">
            <ReadingGoalProgress goal={readingGoal} compact />
          </div>
        )}

        {profile.lifeBook && (
          <Link href={`/books/${profile.lifeBook.id}`} className="mt-4 flex items-center gap-2.5 rounded-xl border border-cream-200 bg-cream-50 p-2.5 transition-colors hover:bg-white">
            {profile.lifeBook.thumbnail && (
              <Image src={profile.lifeBook.thumbnail} alt={profile.lifeBook.title} width={34} height={48} className="h-12 w-[34px] rounded object-cover" />
            )}
            <div className="min-w-0">
              <p className="text-xs text-brown-400">인생책</p>
              <p className="truncate text-sm font-semibold text-brown-800">{profile.lifeBook.title}</p>
              <p className="truncate text-xs text-brown-400">{profile.lifeBook.author}</p>
            </div>
          </Link>
        )}

        <Link
          href={`/u/${encodedNickname}/library`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-cream-200 bg-white px-3 py-1.5 text-xs font-medium text-brown-500 transition-colors hover:bg-cream-50 hover:text-brown-700"
        >
          <span aria-hidden="true">📚</span>
          서재 보기
        </Link>
      </div>

      <PublicProfileReviews nickname={profile.nickname} reviews={reviews ?? []} />
    </div>
  );
}
