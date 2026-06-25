"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReviewCard, { type Review } from "../components/ReviewCard";
import FollowListModal from "../components/FollowListModal";
import ExpandableBio, { MAX_BIO_LENGTH } from "../components/ExpandableBio";
import ProfileAvatar from "../components/ProfileAvatar";
import { API_BASE } from "../lib/api";
import { authFetch, clearToken, getValidToken, logout } from "../lib/auth";

const BASE = API_BASE;
const FEED_STATE_KEY = "chaekdojang:feed-state";
const DELETE_CONFIRM_TEXT = "계정 삭제";
const MAX_PROFILE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROFILE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const PROFILE_IMAGE_HELP_TEXT = "JPG, PNG, WEBP, GIF 이미지를 5MB 이하로 올릴 수 있어요.";

type ReadingStats = {
  totalFinished: number;
  monthly: { year: number; month: number; count: number }[];
  genres: { genre: string; count: number }[];
};

type RecommendedUser = {
  id: number;
  nickname: string;
  profileImage: string | null;
  bio: string | null;
  score: number;
};

type LifeBook = {
  id: number;
  title: string;
  author: string;
  thumbnail: string | null;
};

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
  lifeBook: LifeBook | null;
};

type EditForm = {
  nickname: string;
  bio: string;
  profileImage: string;
};

function getProfileImageUploadError(file: File) {
  if (file.size <= 0) return "비어 있는 파일은 업로드할 수 없어요.";
  if (file.size > MAX_PROFILE_IMAGE_SIZE_BYTES) return "이미지 용량이 너무 커요. 5MB 이하로 줄여서 올려주세요.";
  if (!ALLOWED_PROFILE_IMAGE_TYPES.has(file.type)) return "지원하지 않는 이미지 형식이에요. JPG, PNG, WEBP, GIF 파일만 올릴 수 있어요.";
  return null;
}

function getUploadErrorMessage(message?: string) {
  if (!message) return "이미지 업로드에 실패했습니다.";
  if (message.includes("5MB")) return "이미지 용량이 너무 커요. 5MB 이하로 줄여서 올려주세요.";
  if (message.includes("Only JPG")) return "지원하지 않는 이미지 형식이에요. JPG, PNG, WEBP, GIF 파일만 올릴 수 있어요.";
  if (message.includes("valid image")) return "이미지 파일을 확인할 수 없어요. 다른 JPG, PNG, WEBP, GIF 파일로 다시 올려주세요.";
  if (message.includes("4096px")) return "이미지 크기가 너무 커요. 가로·세로 4096px 이하 이미지를 올려주세요.";
  if (message.includes("empty")) return "비어 있는 파일은 업로드할 수 없어요.";
  return message;
}

type OfficialProfileType = "AUTHOR" | "PUBLISHER" | "BOOKSTORE";
type OfficialProfileApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

type OfficialProfileApplication = {
  id: number;
  type: OfficialProfileType;
  displayName: string;
  status: OfficialProfileApplicationStatus;
  reviewNote: string | null;
  profileSlug: string | null;
  createdAt: string;
};

type OfficialProfileApplicationForm = {
  type: OfficialProfileType;
  displayName: string;
  bio: string;
  officialUrl: string;
  contactEmail: string;
  proofUrl: string;
};

const OFFICIAL_PROFILE_TYPE_LABELS: Record<OfficialProfileType, string> = {
  AUTHOR: "작가",
  PUBLISHER: "출판사",
  BOOKSTORE: "서점",
};

const APPLICATION_STATUS_LABELS: Record<OfficialProfileApplicationStatus, string> = {
  PENDING: "검토 중",
  APPROVED: "승인됨",
  REJECTED: "반려됨",
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
  const [lifeBookSearch, setLifeBookSearch] = useState("");
  const [lifeBookResults, setLifeBookResults] = useState<LifeBook[]>([]);
  const [lifeBookSearching, setLifeBookSearching] = useState(false);
  const [showLifeBookSearch, setShowLifeBookSearch] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendedUser[]>([]);
  const [reviewSearchInput, setReviewSearchInput] = useState("");
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewHasMore, setReviewHasMore] = useState(false);
  const [reviewLoadingMore, setReviewLoadingMore] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [officialApplications, setOfficialApplications] = useState<OfficialProfileApplication[]>([]);
  const [showOfficialForm, setShowOfficialForm] = useState(false);
  const [officialForm, setOfficialForm] = useState<OfficialProfileApplicationForm>({
    type: "AUTHOR",
    displayName: "",
    bio: "",
    officialUrl: "",
    contactEmail: "",
    proofUrl: "",
  });
  const [officialSubmitting, setOfficialSubmitting] = useState(false);
  const [officialMessage, setOfficialMessage] = useState("");
  const reviewSearchRef = useRef<string>("");

  useEffect(() => {
    const token = getValidToken();
    if (!token) {
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
        clearToken();
        window.dispatchEvent(new Event("auth-change"));
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
        loadReviews(token, 0, "");
        loadStats(token);
        loadRecommendations(token);
        loadOfficialApplications(token);
      }
    } catch {
      /* 서버 미연결 시 무시 */
    } finally {
      setLoading(false);
    }
  }

  async function loadOfficialApplications(token: string) {
    try {
      const res = await fetch(`${BASE}/api/profile-applications/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setOfficialApplications(json.data ?? []);
      }
    } catch {
      /* 무시 */
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

  async function loadRecommendations(token: string) {
    try {
      const res = await fetch(`${BASE}/api/users/me/recommendations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setRecommendations(json.data ?? []);
      }
    } catch {
      /* 무시 */
    }
  }

  async function loadReviews(token: string, page: number, q: string) {
    if (page === 0) setReviews([]);
    else setReviewLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(page), size: "10" });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`${BASE}/api/users/me/reviews?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const content: Review[] = json.data?.content ?? [];
        const last: boolean = json.data?.last ?? true;
        setReviews((prev) => page === 0 ? content : [...prev, ...content]);
        setReviewHasMore(!last);
        setReviewPage(page);
      }
    } catch {
      /* 무시 */
    } finally {
      setReviewLoadingMore(false);
    }
  }

  function handleReviewSearch(e: React.FormEvent) {
    e.preventDefault();
    const token: string | null = "cookie-session";
    if (!token) return;
    reviewSearchRef.current = reviewSearchInput;
    loadReviews(token, 0, reviewSearchInput);
  }

  function handleLoadMore() {
    const token: string | null = "cookie-session";
    if (!token) return;
    loadReviews(token, reviewPage + 1, reviewSearchRef.current);
  }

  async function searchLifeBook(q: string) {
    if (!q.trim()) { setLifeBookResults([]); return; }
    setLifeBookSearching(true);
    try {
      const res = await fetch(`${BASE}/api/books/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const json = await res.json();
        const books = (json.data ?? []).slice(0, 5).map((b: { id: number; title: string; author: string; thumbnail?: string }) => ({
          id: b.id, title: b.title, author: b.author, thumbnail: b.thumbnail ?? null,
        }));
        setLifeBookResults(books);
      }
    } catch { /* 무시 */ }
    finally { setLifeBookSearching(false); }
  }

  async function selectLifeBook(book: LifeBook | null) {
    const token: string | null = "cookie-session";
    if (!token) return;
    await fetch(`${BASE}/api/users/me/life-book`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bookId: book?.id ?? null }),
    });
    setProfile((prev) => prev ? { ...prev, lifeBook: book } : prev);
    setShowLifeBookSearch(false);
    setLifeBookSearch("");
    setLifeBookResults([]);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = getProfileImageUploadError(file);
    if (validationError) {
      setSaveError(validationError);
      e.target.value = "";
      return;
    }
    const token: string | null = "cookie-session";
    if (!token) return;
    setUploading(true);
    setSaveError("");
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
        await persistProfileImage(url);
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(getUploadErrorMessage((data as { message?: string }).message));
      }
    } catch {
      setSaveError("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  }

  async function persistProfileImage(profileImage: string) {
    const token = getValidToken();
    if (!token) {
      router.push("/auth/login");
      return false;
    }

    const res = await authFetch(`${BASE}/api/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        nickname: editForm.nickname,
        bio: editForm.bio.trim(),
        profileImage,
      }),
    });

    if (res.status === 401) {
      router.push("/auth/login");
      return false;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaveError((data as { message?: string }).message ?? "프로필 이미지 저장에 실패했습니다.");
      return false;
    }

    const json = await res.json();
    const nextProfile = (json.data ?? json) as UserProfile;
    setProfile((prev) => (prev ? { ...prev, ...nextProfile } : nextProfile));
    setEditForm((f) => ({ ...f, profileImage: nextProfile.profileImage ?? "" }));
    sessionStorage.removeItem(FEED_STATE_KEY);
    return true;
  }

  async function handleUseDefaultImage() {
    setEditForm((f) => ({ ...f, profileImage: "" }));
    setSaveError("");
    await persistProfileImage("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const token: string | null = "cookie-session";
    if (!token) return;
    setSaving(true);
    setSaveError("");
    try {
      const body: Record<string, string> = {
        nickname: editForm.nickname,
        bio: editForm.bio.trim(),
        profileImage: editForm.profileImage.trim(),
      };

      const res = await fetch(`${BASE}/api/users/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        
        router.push("/auth/login");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setProfile((prev) => (prev ? { ...prev, ...(json.data ?? json) } : prev));
        sessionStorage.removeItem(FEED_STATE_KEY);
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

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    const token = getValidToken();
    if (!token || deleteConfirmText !== DELETE_CONFIRM_TEXT || deletingAccount) return;

    setDeletingAccount(true);
    setDeleteError("");
    try {
      const res = await authFetch(`${BASE}/api/users/me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        clearToken();
        window.dispatchEvent(new Event("auth-change"));
        router.push("/auth/login");
        return;
      }
      if (!res.ok) {
        setDeleteError("계정 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      await logout();
      clearToken();
      sessionStorage.removeItem(FEED_STATE_KEY);
      window.dispatchEvent(new Event("auth-change"));
      router.replace("/?accountDeleted=true");
      router.refresh();
    } catch {
      setDeleteError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setDeletingAccount(false);
    }
  }

  function closeDeleteModal() {
    if (deletingAccount) return;
    setShowDeleteModal(false);
    setDeleteConfirmText("");
    setDeleteError("");
  }

  async function handleOfficialApply(e: React.FormEvent) {
    e.preventDefault();
    const token: string | null = "cookie-session";
    if (!token || officialSubmitting) return;
    setOfficialSubmitting(true);
    setOfficialMessage("");
    try {
      const res = await fetch(`${BASE}/api/profile-applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: officialForm.type,
          displayName: officialForm.displayName.trim(),
          bio: officialForm.bio.trim(),
          officialUrl: officialForm.officialUrl.trim(),
          contactEmail: officialForm.contactEmail.trim(),
          proofUrl: officialForm.proofUrl.trim(),
        }),
      });
      if (res.status === 401) {
        clearToken();
        router.push("/auth/login");
        return;
      }
      if (!res.ok) {
        setOfficialMessage("신청을 저장하지 못했습니다. 입력값을 확인해 주세요.");
        return;
      }
      setOfficialForm({
        type: "AUTHOR",
        displayName: "",
        bio: "",
        officialUrl: "",
        contactEmail: "",
        proofUrl: "",
      });
      setShowOfficialForm(false);
      setOfficialMessage("신청이 접수되었습니다. 관리자가 확인한 뒤 프로필을 열어드릴게요.");
      await loadOfficialApplications(token);
    } catch {
      setOfficialMessage("서버에 연결할 수 없습니다.");
    } finally {
      setOfficialSubmitting(false);
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
              <ProfileAvatar src={profile.profileImage} name={profile.nickname} size="lg" />
              <div className="flex-1 min-w-0">
                <h1 className="font-serif text-xl font-bold text-brown-800 truncate">{profile.nickname}</h1>
                <ExpandableBio bio={profile.bio} className="mt-1" />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 text-sm border border-brown-300 text-brown-600 rounded-full hover:bg-cream-200 transition-colors flex-shrink-0"
                >
                  프로필 수정
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 text-sm border border-red-200 text-red-500 rounded-full hover:bg-red-50 transition-colors flex-shrink-0"
                >
                  계정 삭제
                </button>
              </div>
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

            <div className="grid grid-cols-3 gap-2 mt-5">
              {[
                { label: "읽는 중", count: profile.librarySummary?.readingCount ?? 0, href: "/library?status=READING" },
                { label: "완독", count: profile.librarySummary?.finishedCount ?? 0, href: "/library?status=FINISHED" },
                { label: "읽고 싶어요", count: profile.librarySummary?.wishlistCount ?? 0, href: "/library?status=WISHLIST" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg border border-cream-200 bg-cream-50 px-3 py-3 text-center hover:border-brown-200 hover:bg-white transition-colors"
                >
                  <p className="text-xl font-bold text-brown-800">{item.count}</p>
                  <p className="text-xs text-brown-400 mt-0.5">{item.label}</p>
                </Link>
              ))}
            </div>

            <Link
              href={`/u/${encodeURIComponent(profile.nickname)}`}
              className="mt-4 block rounded-lg border border-dashed border-brown-200 bg-cream-50 px-4 py-3 text-sm text-brown-600 hover:bg-white transition-colors"
            >
              공유 프로필: /u/{profile.nickname}
            </Link>
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
                maxLength={MAX_BIO_LENGTH}
                onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="간단한 자기소개를 남겨보세요"
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm text-brown-800 bg-cream-50 placeholder:text-brown-300 focus:outline-none focus:border-brown-400 focus:ring-2 focus:ring-brown-100 transition resize-none"
              />
              <p className="mt-1 text-right text-xs text-brown-300">
                {editForm.bio.length} / {MAX_BIO_LENGTH}
              </p>
            </div>
            <div>
              <label className="block text-sm text-brown-600 mb-1.5">
                프로필 이미지
              </label>
              <div className="flex items-center gap-3">
                <ProfileAvatar src={editForm.profileImage} name={editForm.nickname || "책도장"} size="md" />
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
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
                <button
                  type="button"
                  disabled={uploading || !editForm.profileImage}
                  onClick={handleUseDefaultImage}
                  className="flex-1 rounded-xl border border-cream-300 px-4 py-2.5 text-sm text-brown-500 transition hover:border-brown-400 hover:bg-cream-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  기본이미지 쓰기
                </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-brown-300">{PROFILE_IMAGE_HELP_TEXT}</p>
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

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 sm:items-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeDeleteModal} />
          <form
            onSubmit={handleDeleteAccount}
            className="relative z-10 w-full max-w-lg rounded-t-2xl border border-red-100 bg-white p-5 shadow-xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-lg font-bold text-red-700">계정 삭제</h2>
                <p className="mt-2 text-sm leading-6 text-brown-500">
                  삭제하면 이메일, 닉네임, 프로필 이미지, 자기소개는 제거되거나 탈퇴 계정 값으로 바뀝니다.
                  서재, 팔로우, 알림, 북마크, 좋아요 같은 개인 활동 데이터는 정리되고, 공개 독후감과 댓글은 작성자만 탈퇴한 사용자로 표시됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deletingAccount}
                className="text-xl leading-none text-brown-300 hover:text-brown-600 disabled:opacity-40"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <label className="mt-4 block text-sm text-brown-600" htmlFor="delete-confirm">
              계속하려면 <span className="font-semibold text-red-700">{DELETE_CONFIRM_TEXT}</span>를 입력하세요.
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="flex-1 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-brown-800 placeholder:text-brown-300 focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100"
                placeholder={DELETE_CONFIRM_TEXT}
              />
              <button
                type="submit"
                disabled={deleteConfirmText !== DELETE_CONFIRM_TEXT || deletingAccount}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deletingAccount ? "삭제 중..." : "계정 삭제"}
              </button>
            </div>
            {deleteError && (
              <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{deleteError}</p>
            )}
          </form>
        </div>
      )}

      {/* 인생책 */}
      <div className="bg-white rounded-2xl border border-cream-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-base font-bold text-brown-800">📖 인생책</h2>
          <button
            onClick={() => setShowLifeBookSearch((v) => !v)}
            className="text-xs text-brown-400 hover:text-brown-600 transition-colors"
          >
            {showLifeBookSearch ? "취소" : profile.lifeBook ? "변경" : "+ 선택"}
          </button>
        </div>

        {/* 검색 UI */}
        {showLifeBookSearch && (
          <div className="mb-3">
            <div className="flex gap-2">
              <input
                value={lifeBookSearch}
                onChange={(e) => setLifeBookSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchLifeBook(lifeBookSearch)}
                placeholder="책 제목 또는 저자 검색"
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-cream-300 bg-cream-50 focus:outline-none focus:border-brown-400 transition"
              />
              <button
                onClick={() => searchLifeBook(lifeBookSearch)}
                disabled={lifeBookSearching}
                className="px-3 py-2 text-sm bg-brown-600 text-white rounded-xl hover:bg-brown-700 transition-colors disabled:opacity-50"
              >
                검색
              </button>
            </div>
            {lifeBookResults.length > 0 && (
              <ul className="mt-2 border border-cream-200 rounded-xl overflow-hidden">
                {lifeBookResults.map((book) => (
                  <li key={book.id}>
                    <button
                      onClick={() => selectLifeBook(book)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-cream-50 transition-colors text-left"
                    >
                      {book.thumbnail && (
                        <img src={book.thumbnail} alt={book.title} className="w-8 h-11 object-cover rounded flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-brown-800 font-medium truncate">{book.title}</p>
                        <p className="text-xs text-brown-400 truncate">{book.author}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 현재 인생책 표시 */}
        {profile.lifeBook ? (
          <div className="flex items-center gap-3">
            {profile.lifeBook.thumbnail && (
              <img src={profile.lifeBook.thumbnail} alt={profile.lifeBook.title} className="w-12 h-16 object-cover rounded-lg flex-shrink-0 shadow-sm" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-brown-800 truncate">{profile.lifeBook.title}</p>
              <p className="text-xs text-brown-400 mt-0.5 truncate">{profile.lifeBook.author}</p>
            </div>
            {!showLifeBookSearch && (
              <button
                onClick={() => selectLifeBook(null)}
                className="text-xs text-brown-300 hover:text-red-400 transition-colors flex-shrink-0"
              >
                삭제
              </button>
            )}
          </div>
        ) : (
          !showLifeBookSearch && (
            <p className="text-sm text-brown-300 text-center py-2">아직 선택한 인생책이 없어요</p>
          )
        )}
      </div>

      <div className="bg-white rounded-2xl border border-cream-200 p-5 mb-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-base font-bold text-brown-800">공식 프로필</h2>
            <p className="mt-1 text-xs text-brown-400">작가, 출판사, 서점 프로필을 신청할 수 있어요.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowOfficialForm((value) => !value)}
            className="shrink-0 rounded-full border border-brown-300 px-3 py-1.5 text-xs text-brown-600 hover:bg-cream-100"
          >
            {showOfficialForm ? "닫기" : "신청하기"}
          </button>
        </div>

        {officialMessage && (
          <p className="mt-3 rounded-xl bg-cream-50 px-3 py-2 text-sm text-brown-600">{officialMessage}</p>
        )}

        {officialApplications.length > 0 && (
          <div className="mt-4 space-y-2">
            {officialApplications.slice(0, 3).map((application) => (
              <div key={application.id} className="rounded-xl border border-cream-200 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brown-800">{application.displayName}</p>
                    <p className="text-xs text-brown-400">
                      {OFFICIAL_PROFILE_TYPE_LABELS[application.type]} · {APPLICATION_STATUS_LABELS[application.status]}
                    </p>
                  </div>
                  {application.profileSlug && (
                    <Link
                      href={`/profiles/${application.profileSlug}`}
                      className="shrink-0 text-xs text-brown-500 underline underline-offset-2"
                    >
                      보기
                    </Link>
                  )}
                </div>
                {application.reviewNote && (
                  <p className="mt-2 text-xs text-brown-400">{application.reviewNote}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {showOfficialForm && (
          <form onSubmit={handleOfficialApply} className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs text-brown-500" htmlFor="official-type">신청 유형</label>
              <select
                id="official-type"
                value={officialForm.type}
                onChange={(e) => setOfficialForm((form) => ({ ...form, type: e.target.value as OfficialProfileType }))}
                className="w-full rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
              >
                <option value="AUTHOR">작가</option>
                <option value="PUBLISHER">출판사</option>
                <option value="BOOKSTORE">서점</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-brown-500" htmlFor="official-display-name">표시 이름</label>
              <input
                id="official-display-name"
                required
                value={officialForm.displayName}
                onChange={(e) => setOfficialForm((form) => ({ ...form, displayName: e.target.value }))}
                className="w-full rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brown-500" htmlFor="official-bio">소개글</label>
              <textarea
                id="official-bio"
                value={officialForm.bio}
                onChange={(e) => setOfficialForm((form) => ({ ...form, bio: e.target.value }))}
                rows={3}
                className="w-full resize-none rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-brown-500" htmlFor="official-url">공식 링크</label>
                <input
                  id="official-url"
                  value={officialForm.officialUrl}
                  onChange={(e) => setOfficialForm((form) => ({ ...form, officialUrl: e.target.value }))}
                  placeholder="홈페이지, 인스타, 브런치 등"
                  className="w-full rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-brown-500" htmlFor="official-email">연락 이메일</label>
                <input
                  id="official-email"
                  type="email"
                  required
                  value={officialForm.contactEmail}
                  onChange={(e) => setOfficialForm((form) => ({ ...form, contactEmail: e.target.value }))}
                  className="w-full rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-brown-500" htmlFor="official-proof">증빙 링크</label>
              <input
                id="official-proof"
                value={officialForm.proofUrl}
                onChange={(e) => setOfficialForm((form) => ({ ...form, proofUrl: e.target.value }))}
                placeholder="출판사 페이지, 작가 소개, 텀블벅 프로젝트 등"
                className="w-full rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={officialSubmitting}
              className="w-full rounded-xl bg-brown-600 py-2.5 text-sm font-medium text-white hover:bg-brown-700 disabled:opacity-50"
            >
              {officialSubmitting ? "신청 중..." : "신청 접수"}
            </button>
          </form>
        )}
      </div>

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
        <Link
          href="/calendar"
          className="flex-1 py-3 rounded-2xl border border-cream-200 bg-white text-center text-sm text-brown-600 hover:bg-cream-50 hover:shadow-sm transition-all"
        >
          월별 캘린더
        </Link>
      </div>

      {/* 독서 통계 요약 */}
      {stats && (stats.totalFinished > 0 || stats.genres.length > 0) && (
        <div className="bg-white rounded-2xl border border-cream-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-base font-bold text-brown-800">📊 독서 기록</h2>
            <Link href="/calendar" className="text-xs text-brown-400 hover:text-brown-600">
              월별 캘린더
            </Link>
          </div>

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

          {/* 장르 요약 */}
          {stats.genres.length > 0 && (
            <div>
              <p className="text-xs text-brown-500 font-medium mb-2">선호 장르</p>
              <div className="flex flex-wrap gap-2">
                {stats.genres.slice(0, 4).map((g) => {
                  return (
                    <span key={g.genre} className="px-3 py-1 rounded-full bg-cream-100 text-xs text-brown-600">
                      {g.genre} {g.count}권
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 취향 맞는 독자 추천 */}
      {recommendations.length > 0 && (
        <div className="bg-white rounded-2xl border border-cream-200 p-5 mb-6">
          <h2 className="font-serif text-base font-bold text-brown-800 mb-1">🤝 취향이 비슷한 독자</h2>
          <p className="text-xs text-brown-400 mb-4">읽은 책·별점·인생책을 기반으로 추천해요</p>
          <div className="flex flex-col gap-3">
            {recommendations.map((user) => (
              <Link
                key={user.id}
                href={`/users/${user.id}`}
                className="flex items-center gap-3 hover:opacity-75 transition-opacity"
              >
                <ProfileAvatar src={user.profileImage} name={user.nickname} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-brown-800 truncate">{user.nickname}</p>
                  <ExpandableBio bio={user.bio} compact />
                </div>
                <span className="text-brown-300 text-xs flex-shrink-0">›</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 내 독후감 목록 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif text-lg font-bold text-brown-800">내 독후감</h2>
      </div>

      {/* 검색 */}
      <form onSubmit={handleReviewSearch} className="flex gap-2 mb-4">
        <input
          value={reviewSearchInput}
          onChange={(e) => setReviewSearchInput(e.target.value)}
          placeholder="책 제목 또는 내용 검색"
          className="flex-1 px-3 py-2 text-sm rounded-xl border border-cream-300 bg-white focus:outline-none focus:border-brown-400 transition"
        />
        <button
          type="submit"
          className="px-3 py-2 text-sm bg-brown-600 text-white rounded-xl hover:bg-brown-700 transition-colors"
        >
          검색
        </button>
        {reviewSearchRef.current && (
          <button
            type="button"
            onClick={() => {
              setReviewSearchInput("");
              reviewSearchRef.current = "";
              const token: string | null = "cookie-session";
              if (token) loadReviews(token, 0, "");
            }}
            className="px-3 py-2 text-sm border border-cream-300 text-brown-400 rounded-xl hover:bg-cream-50 transition-colors"
          >
            초기화
          </button>
        )}
      </form>

      {reviews.length === 0 ? (
        <div className="text-center py-12 text-brown-400">
          <p className="text-4xl mb-3">📖</p>
          <p>{reviewSearchRef.current ? `"${reviewSearchRef.current}" 검색 결과가 없어요` : "아직 독후감이 없어요"}</p>
          {!reviewSearchRef.current && (
            <Link
              href="/write"
              className="inline-block mt-4 text-sm text-brown-500 underline underline-offset-2"
            >
              첫 독후감 쓰기
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {reviews.map((post) => (
              <ReviewCard
                key={post.id}
                post={post}
                forceOwner
                onVisibilityChange={(updated) => {
                  setReviews((prev) =>
                    prev.map((item) => (item.id === updated.id ? updated : item))
                  );
                }}
              />
            ))}
          </div>
          {reviewHasMore && (
            <button
              onClick={handleLoadMore}
              disabled={reviewLoadingMore}
              className="w-full mt-4 py-3 text-sm text-brown-500 border border-cream-300 rounded-xl hover:bg-cream-50 transition-colors disabled:opacity-50"
            >
              {reviewLoadingMore ? "불러오는 중..." : "더보기"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
