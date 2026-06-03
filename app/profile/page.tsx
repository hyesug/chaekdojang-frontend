"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReviewCard, { type Review } from "../components/ReviewCard";
import FollowListModal from "../components/FollowListModal";
import { API_BASE } from "../lib/api";

const BASE = API_BASE;

type ReadingStats = {
  totalFinished: number;
  monthly: { year: number; month: number; count: number }[];
  genres: { genre: string; count: number }[];
};

type UserProfile = {
  id: number;
  nickname: string;
  bio: string | null;
  profileImage: string | null;
  reviewCount: number;
  followerCount: number;
  followingCount: number;
};

type EditForm = {
  nickname: string;
  bio: string;
  profileImage: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({ nickname: "", bio: "", profileImage: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [followModal, setFollowModal] = useState<null | "followers" | "followings">(null);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<ReadingStats | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || token === "undefined" || token === "null") {
      router.push("/auth/login");
      return;
    }
    loadProfile(token);
  }, []);

  async function loadProfile(token: string) {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("token");
        router.push("/auth/login");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        const data: UserProfile = json.data ?? json;
        setProfile(data);
        setEditForm({
          nickname: data.nickname ?? "",
          bio: data.bio ?? "",
          profileImage: data.profileImage ?? "",
        });
        loadReviews(data.id, token);
        loadStats(token);
      }
    } catch {
      /* 서버 미연결 시 무시 */
    } finally {
      setLoading(false);
    }
  }

  async function loadStats(token: string) {
    try {
      const res = await fetch(`${BASE}/api/users/me/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setStats(json.data ?? json);
      }
    } catch {
      /* 무시 */
    }
  }

  async function loadReviews(userId: number, token: string) {
    try {
      const res = await fetch(`${BASE}/api/users/${userId}/reviews`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setReviews(json.data ?? []);
      }
    } catch {
      /* 무시 */
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE}/api/upload/profile-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const json = await res.json();
        const url = (json.data as { url: string }).url;
        setEditForm((f) => ({ ...f, profileImage: url }));
      } else {
        setSaveError("이미지 업로드에 실패했습니다.");
      }
    } catch {
      setSaveError("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;
    setSaving(true);
    setSaveError("");
    try {
      const body: Record<string, string> = { nickname: editForm.nickname };
      if (editForm.bio) body.bio = editForm.bio;
      if (editForm.profileImage) body.profileImage = editForm.profileImage;

      const res = await fetch(`${BASE}/api/users/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        localStorage.removeItem("token");
        router.push("/auth/login");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setProfile((prev) => (prev ? { ...prev, ...(json.data ?? json) } : prev));
        setEditing(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError((data as { message?: string }).message ?? "수정에 실패했습니다.");
      }
    } catch {
      setSaveError("서버에 연결할 수 없습니다.");
    } finally {
      setSaving(false);
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
        프로필을 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 프로필 카드 */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6 shadow-sm mb-6">
        {!editing ? (
          <>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-brown-200 flex-shrink-0 overflow-hidden flex items-center justify-center text-white text-2xl font-bold">
                {profile.profileImage ? (
                  <img src={profile.profileImage} alt={profile.nickname} className="w-full h-full object-cover" />
                ) : (
                  <span>{profile.nickname[0]}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-serif text-xl font-bold text-brown-800 truncate">{profile.nickname}</h1>
                {profile.bio && (
                  <p className="text-sm text-brown-500 mt-1 line-clamp-2">{profile.bio}</p>
                )}
              </div>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 text-sm border border-brown-300 text-brown-600 rounded-full hover:bg-cream-200 transition-colors flex-shrink-0"
              >
                프로필 수정
              </button>
            </div>

            {/* 통계 */}
            <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-cream-200 text-center">
              <div>
                <p className="font-bold text-brown-800 text-xl">{profile.reviewCount}</p>
                <p className="text-xs text-brown-400 mt-0.5">독후감</p>
              </div>
              <button
                onClick={() => setFollowModal("followers")}
                className="flex flex-col items-center hover:opacity-70 transition-opacity"
              >
                <p className="font-bold text-brown-800 text-xl">{profile.followerCount}</p>
                <p className="text-xs text-brown-400 mt-0.5">팔로워</p>
              </button>
              <button
                onClick={() => setFollowModal("followings")}
                className="flex flex-col items-center hover:opacity-70 transition-opacity"
              >
                <p className="font-bold text-brown-800 text-xl">{profile.followingCount}</p>
                <p className="text-xs text-brown-400 mt-0.5">팔로잉</p>
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <h2 className="font-serif text-lg font-bold text-brown-800 mb-1">프로필 수정</h2>
            <div>
              <label className="block text-sm text-brown-600 mb-1.5" htmlFor="p-nickname">
                닉네임
              </label>
              <input
                id="p-nickname"
                required
                value={editForm.nickname}
                onChange={(e) => setEditForm((f) => ({ ...f, nickname: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm text-brown-800 bg-cream-50 focus:outline-none focus:border-brown-400 focus:ring-2 focus:ring-brown-100 transition"
              />
            </div>
            <div>
              <label className="block text-sm text-brown-600 mb-1.5" htmlFor="p-bio">
                자기소개
              </label>
              <textarea
                id="p-bio"
                value={editForm.bio}
                onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="간단한 자기소개를 남겨보세요"
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm text-brown-800 bg-cream-50 placeholder:text-brown-300 focus:outline-none focus:border-brown-400 focus:ring-2 focus:ring-brown-100 transition resize-none"
              />
            </div>
            <div>
              <label className="block text-sm text-brown-600 mb-1.5">
                프로필 이미지
              </label>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-brown-200 flex-shrink-0 overflow-hidden flex items-center justify-center text-white font-bold">
                  {editForm.profileImage ? (
                    <img src={editForm.profileImage} alt="미리보기" className="w-full h-full object-cover" />
                  ) : (
                    <span>{editForm.nickname[0] ?? "?"}</span>
                  )}
                </div>
                <label className={`flex-1 cursor-pointer px-4 py-2.5 rounded-xl border border-cream-300 text-sm text-center transition ${uploading ? "opacity-50 cursor-not-allowed" : "hover:border-brown-400 hover:bg-cream-50"}`}>
                  {uploading ? "업로드 중..." : "사진 변경"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            </div>
            {saveError && (
              <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">{saveError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 bg-brown-600 text-white rounded-xl text-sm font-medium hover:bg-brown-700 transition-colors disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setSaveError("");
                }}
                className="flex-1 py-2.5 border border-brown-300 text-brown-600 rounded-xl text-sm font-medium hover:bg-cream-200 transition-colors"
              >
                취소
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 팔로워/팔로잉 모달 */}
      {followModal && (
        <FollowListModal
          userId={profile.id}
          type={followModal}
          onClose={() => setFollowModal(null)}
        />
      )}

      {/* 빠른 메뉴 */}
      <div className="flex gap-2 mb-6">
        <Link
          href="/bookmarks"
          className="flex-1 py-3 rounded-2xl border border-cream-200 bg-white text-center text-sm text-brown-600 hover:bg-cream-50 hover:shadow-sm transition-all"
        >
          🔖 저장한 독후감
        </Link>
        <Link
          href="/library"
          className="flex-1 py-3 rounded-2xl border border-cream-200 bg-white text-center text-sm text-brown-600 hover:bg-cream-50 hover:shadow-sm transition-all"
        >
          📚 내 서재
        </Link>
      </div>

      {/* 독서 통계 */}
      {stats && (stats.totalFinished > 0 || stats.genres.length > 0) && (
        <div className="bg-white rounded-2xl border border-cream-200 p-5 mb-6">
          <h2 className="font-serif text-base font-bold text-brown-800 mb-4">📊 독서 기록</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center bg-cream-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-brown-800">{stats.totalFinished}</p>
              <p className="text-xs text-brown-400 mt-0.5">완독한 책</p>
            </div>
            {stats.genres[0] && (
              <div className="text-center bg-cream-50 rounded-xl p-3">
                <p className="text-sm font-bold text-brown-800 truncate">{stats.genres[0].genre}</p>
                <p className="text-xs text-brown-400 mt-0.5">최애 장르</p>
              </div>
            )}
          </div>

          {/* 월별 독서량 */}
          {stats.monthly.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-brown-500 font-medium mb-2">월별 독서량</p>
              <div className="flex items-end gap-1 h-16">
                {stats.monthly.slice(0, 6).reverse().map((m) => {
                  const maxCount = Math.max(...stats.monthly.map((x) => x.count));
                  const heightPct = maxCount > 0 ? (m.count / maxCount) * 100 : 0;
                  return (
                    <div key={`${m.year}-${m.month}`} className="flex-1 flex flex-col items-center gap-0.5">
                      <span className="text-xs text-brown-500 font-medium">{m.count}</span>
                      <div
                        className="w-full bg-brown-400 rounded-t"
                        style={{ height: `${Math.max(heightPct * 0.6, 4)}px` }}
                      />
                      <span className="text-xs text-brown-300">{m.month}월</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 장르 분포 */}
          {stats.genres.length > 0 && (
            <div>
              <p className="text-xs text-brown-500 font-medium mb-2">선호 장르</p>
              <div className="flex flex-col gap-1.5">
                {stats.genres.slice(0, 4).map((g) => {
                  const maxCount = stats.genres[0].count;
                  const pct = maxCount > 0 ? Math.round((g.count / maxCount) * 100) : 0;
                  return (
                    <div key={g.genre} className="flex items-center gap-2">
                      <span className="text-xs text-brown-600 w-20 truncate flex-shrink-0">{g.genre}</span>
                      <div className="flex-1 bg-cream-200 rounded-full h-2">
                        <div
                          className="bg-brown-500 h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-brown-400 flex-shrink-0">{g.count}권</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 내 독후감 목록 */}
      <h2 className="font-serif text-lg font-bold text-brown-800 mb-4">내 독후감</h2>
      {reviews.length === 0 ? (
        <div className="text-center py-12 text-brown-400">
          <p className="text-4xl mb-3">📖</p>
          <p>아직 독후감이 없어요</p>
          <Link
            href="/write"
            className="inline-block mt-4 text-sm text-brown-500 underline underline-offset-2"
          >
            첫 독후감 쓰기
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((post) => (
            <ReviewCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
