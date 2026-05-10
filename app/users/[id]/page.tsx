"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import PostCard, { type Post } from "../../components/PostCard";

const BASE = "http://localhost:8080";

type UserProfile = {
  id: number;
  nickname: string;
  bio: string | null;
  profileImage: string | null;
  reviewCount: number;
  followerCount: number;
  followingCount: number;
  isFollowing?: boolean;
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function getMyUserId(): number | null {
  const token = getToken();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const raw = payload.userId ?? payload.id ?? payload.sub;
    return raw != null ? Number(raw) : null;
  } catch {
    return null;
  }
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = Number(params.id);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reviews, setReviews] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  const myId = getMyUserId();
  const isLoggedIn = myId !== null;

  const fetchProfile = useCallback(async () => {
    const token = getToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${BASE}/api/users/${userId}`, { headers });
    if (res.ok) {
      const json = await res.json();
      const data: UserProfile = json.data ?? json;
      setProfile(data);
      setFollowerCount(data.followerCount ?? 0);
      setFollowing(data.isFollowing ?? false);
    }
  }, [userId]);

  const fetchReviews = useCallback(async () => {
    const res = await fetch(`${BASE}/api/users/${userId}/reviews`);
    if (res.ok) {
      const json = await res.json();
      setReviews(json.data ?? []);
    }
  }, [userId]);

  useEffect(() => {
    /* 내 프로필이면 /profile 로 리다이렉트 */
    if (myId !== null && myId === userId) {
      router.replace("/profile");
      return;
    }
    setLoading(true);
    Promise.all([fetchProfile(), fetchReviews()]).finally(() => setLoading(false));
  }, [userId]);

  async function handleFollow() {
    const token = getToken();
    if (!token) {
      router.push("/auth/login");
      return;
    }
    setFollowLoading(true);
    const next = !following;
    /* 낙관적 업데이트 */
    setFollowing(next);
    setFollowerCount((c) => c + (next ? 1 : -1));
    try {
      const res = await fetch(`${BASE}/api/users/${userId}/follow`, {
        method: next ? "POST" : "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setFollowing(!next);
        setFollowerCount((c) => c + (next ? -1 : 1));
      }
    } catch {
      setFollowing(!next);
      setFollowerCount((c) => c + (next ? -1 : 1));
    } finally {
      setFollowLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-brown-400">
        불러오는 중...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-brown-400">
        <p className="text-4xl mb-3">🔍</p>
        <p>존재하지 않는 사용자입니다.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 프로필 카드 */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6 shadow-sm mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brown-200 flex-shrink-0 overflow-hidden flex items-center justify-center text-white text-2xl font-bold">
            {profile.profileImage ? (
              <img
                src={profile.profileImage}
                alt={profile.nickname}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{profile.nickname[0]}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl font-bold text-brown-800 truncate">
              {profile.nickname}
            </h1>
            {profile.bio && (
              <p className="text-sm text-brown-500 mt-1 line-clamp-2">{profile.bio}</p>
            )}
          </div>
          {/* 로그인한 경우에만 팔로우 버튼 표시 */}
          {isLoggedIn && (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={`px-5 py-2 text-sm rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
                following
                  ? "bg-cream-200 text-brown-600 border border-brown-300 hover:bg-cream-300"
                  : "bg-brown-600 text-white hover:bg-brown-700"
              }`}
            >
              {following ? "팔로잉" : "팔로우"}
            </button>
          )}
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-cream-200 text-center">
          <div>
            <p className="font-bold text-brown-800 text-xl">{profile.reviewCount}</p>
            <p className="text-xs text-brown-400 mt-0.5">독후감</p>
          </div>
          <div>
            <p className="font-bold text-brown-800 text-xl">{followerCount}</p>
            <p className="text-xs text-brown-400 mt-0.5">팔로워</p>
          </div>
          <div>
            <p className="font-bold text-brown-800 text-xl">{profile.followingCount}</p>
            <p className="text-xs text-brown-400 mt-0.5">팔로잉</p>
          </div>
        </div>
      </div>

      {/* 독후감 목록 */}
      <h2 className="font-serif text-lg font-bold text-brown-800 mb-4">
        {profile.nickname}님의 독후감
      </h2>
      {reviews.length === 0 ? (
        <div className="text-center py-12 text-brown-400">
          <p className="text-4xl mb-3">📖</p>
          <p>아직 독후감이 없어요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
