"use client";

import { BookOpen, Bookmark, CalendarDays, ChevronRight, Library, Map as MapIcon, X } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReviewCard, { type Review } from "../components/ReviewCard";
import FollowListModal from "../components/FollowListModal";
import ExpandableBio, { MAX_BIO_LENGTH } from "../components/ExpandableBio";
import ProfileAvatar from "../components/ProfileAvatar";
import ReadingGoalProgress from "../components/ReadingGoalProgress";
import { API_BASE } from "../lib/api";
import { authFetch, clearToken, getValidToken, logout } from "../lib/auth";

const BASE = API_BASE;
const FEED_STATE_KEY = "chaekdojang:feed-state";
const PROFILE_SCROLL_STATE_KEY = "chaekdojang:profile-scroll-state";
const DELETE_CONFIRM_TEXT = "계정 삭제";
const MAX_PROFILE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROFILE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const PROFILE_IMAGE_HELP_TEXT = "JPG, PNG, WEBP, GIF 이미지를 5MB 이하로 올릴 수 있어요.";

type RecommendedUser = {
  id: number;
  nickname: string;
  profileImage: string | null;
  bio: string | null;
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
  readingGoal: {
    year: number;
    targetCount: number;
    finishedCount: number;
    progressPercent: number;
    remainingCount: number;
  } | null;
  customerCode: string;
  email: string | null;
  createdAt: string;
  authProviders: ("KAKAO" | "NAVER" | "GOOGLE" | "LOCAL")[];
};

const AUTH_PROVIDER_LABELS: Record<"KAKAO" | "NAVER" | "GOOGLE" | "LOCAL", string> = {
  KAKAO: "카카오",
  NAVER: "네이버",
  GOOGLE: "구글",
  LOCAL: "일반 로그인",
};

const OAUTH_PROVIDERS = ["KAKAO", "NAVER", "GOOGLE"] as const;

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

type OfficialProfileType = "AUTHOR" | "PUBLISHER" | "BOOKSTORE" | "LIBRARY" | "PLATFORM";
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
  LIBRARY: "도서관",
  PLATFORM: "책도장",
};

const APPLICATION_STATUS_LABELS: Record<OfficialProfileApplicationStatus, string> = {
  PENDING: "검토 중",
  APPROVED: "승인됨",
  REJECTED: "반려됨",
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  function linkProvider(provider: "KAKAO" | "NAVER" | "GOOGLE") {
    window.location.assign(`${BASE}/api/users/me/auth-providers/${provider}/link`);
  }
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({ nickname: "", bio: "", profileImage: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [followModal, setFollowModal] = useState<null | "followers" | "followings">(null);
  const [uploading, setUploading] = useState(false);
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
  const profileScrollRestoredRef = useRef(false);

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
        const scrollState = readProfileScrollState();
        const initialQuery = scrollState?.q ?? "";
        setReviewSearchInput(initialQuery);
        reviewSearchRef.current = initialQuery;
        await loadReviewsThroughPage(token, scrollState?.page ?? 0, initialQuery);
        restoreProfileScroll(scrollState);
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

  async function loadReviewsThroughPage(token: string, page: number, q: string) {
    const targetPage = Math.max(0, page);
    for (let nextPage = 0; nextPage <= targetPage; nextPage += 1) {
      await loadReviews(token, nextPage, q);
    }
  }

  function readProfileScrollState() {
    try {
      const raw = sessionStorage.getItem(PROFILE_SCROLL_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { y?: number; page?: number; q?: string; ts?: number };
      if (!parsed.ts || Date.now() - parsed.ts > 30 * 60 * 1000) return null;
      return {
        y: Number.isFinite(parsed.y) ? Math.max(0, parsed.y ?? 0) : 0,
        page: Number.isFinite(parsed.page) ? Math.max(0, parsed.page ?? 0) : 0,
        q: typeof parsed.q === "string" ? parsed.q : "",
      };
    } catch {
      return null;
    }
  }

  function rememberProfileScroll() {
    try {
      sessionStorage.setItem(
        PROFILE_SCROLL_STATE_KEY,
        JSON.stringify({
          y: window.scrollY,
          page: reviewPage,
          q: reviewSearchRef.current,
          ts: Date.now(),
        })
      );
    } catch {
      /* storage may be unavailable */
    }
  }

  function restoreProfileScroll(state: ReturnType<typeof readProfileScrollState>) {
    if (!state || profileScrollRestoredRef.current) return;
    profileScrollRestoredRef.current = true;
    window.requestAnimationFrame(() => {
      window.setTimeout(() => window.scrollTo({ top: state.y, behavior: "auto" }), 0);
    });
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
      <div className="cdj-page cdj-page--reading">
        <LoadingState label="프로필을 불러오는 중" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="cdj-page cdj-page--reading">
        <EmptyState title="프로필을 불러올 수 없어요">잠시 후 다시 시도해주세요.</EmptyState>
      </div>
    );
  }

  return (
    <div className="cdj-page cdj-page--reading">
      {/* 프로필 카드 */}
      <div className="cdj-card p-6 mb-6">
        {!editing ? (
          <>
            <div className="flex items-center gap-4">
              <ProfileAvatar src={profile.profileImage} name={profile.nickname} size="xl" />
              <div className="flex-1 min-w-0">
                <h1 className="truncate font-serif text-2xl font-bold text-brown-800">{profile.nickname}</h1>
                <ExpandableBio bio={profile.bio} className="mt-1" />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => setEditing(true)}
                  className="cdj-button cdj-button--secondary flex-shrink-0"
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

            <section className="mt-6 rounded-lg bg-cream-100 p-4 text-sm text-sage-700">
              <h2 className="text-sm font-bold text-brown-800">계정 정보</h2>
              <dl className="mt-3 space-y-2">
                <div className="flex justify-between gap-4"><dt>책도장 ID</dt><dd className="font-medium text-brown-800">{profile.customerCode}</dd></div>
                {profile.email && <div className="flex justify-between gap-4"><dt>이메일</dt><dd className="truncate text-brown-800">{profile.email}</dd></div>}
                <div className="flex justify-between gap-4"><dt>가입일</dt><dd className="text-brown-800">{new Date(profile.createdAt).toLocaleDateString("ko-KR")}</dd></div>
              </dl>
              <div className="mt-4 border-t border-cream-200 pt-3">
                <p className="text-xs text-brown-400">연결된 로그인 수단</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.authProviders.map((provider) => <span key={provider} className="cdj-tag">{AUTH_PROVIDER_LABELS[provider]}</span>)}
                  {OAUTH_PROVIDERS.filter((provider) => !profile.authProviders.includes(provider)).map((provider) => (
                    <button key={provider} type="button" onClick={() => linkProvider(provider)} className="cdj-button cdj-button--secondary cdj-button--sm">+ {AUTH_PROVIDER_LABELS[provider]} 연결</button>
                  ))}
                </div>
              </div>
            </section>

            {/* 통계 */}
            <div className="mt-6 grid grid-cols-3 divide-x divide-cream-300 rounded-lg border border-cream-300 text-center">
              <div className="px-3 py-3">
                <p className="text-xl font-bold text-brown-800 tabular">{profile.reviewCount}</p>
                <p className="mt-0.5 text-xs text-sage-600">독후감</p>
              </div>
              <button
                onClick={() => setFollowModal("followers")}
                className="px-3 py-3 text-center transition-colors hover:bg-cream-100"
                aria-label="팔로워 목록 보기"
              >
                <p className="text-xl font-bold text-brown-800 tabular">{profile.followerCount}</p>
                <p className="mt-0.5 text-xs text-sage-600">팔로워</p>
              </button>
              <button
                onClick={() => setFollowModal("followings")}
                className="px-3 py-3 text-center transition-colors hover:bg-cream-100"
                aria-label="팔로잉 목록 보기"
              >
                <p className="text-xl font-bold text-brown-800 tabular">{profile.followingCount}</p>
                <p className="mt-0.5 text-xs text-sage-600">팔로잉</p>
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
                  className="rounded-lg bg-cream-100 px-3 py-3 text-center transition-colors hover:bg-cream-200"
                >
                  <p className="text-xl font-bold text-brown-800 tabular">{item.count}</p>
                  <p className="mt-0.5 text-xs text-sage-600">{item.label}</p>
                </Link>
              ))}
            </div>

            <section className="mt-5 rounded-lg border border-cream-300 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-brown-800">독서 목표</h2>
                <Link
                  href="/reading-goal"
                  className="cdj-button cdj-button--primary cdj-button--sm shrink-0"
                >
                  {profile.readingGoal ? "목표 수정" : "목표 설정"}
                </Link>
              </div>
              {profile.readingGoal ? (
                <ReadingGoalProgress goal={profile.readingGoal} compact />
              ) : (
                <p className="text-sm text-sage-600">
                  올해 독서 목표를 설정해보세요
                </p>
              )}
            </section>

            <Link
              href={`/u/${encodeURIComponent(profile.nickname)}`}
              className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-dashed border-cream-300 px-4 py-3 text-sm text-sage-700 transition-colors hover:border-brown-200 hover:text-brown-800"
            >
              <span className="truncate">공유 프로필 <span className="font-medium text-brown-800">/u/{profile.nickname}</span></span>
              <ChevronRight size={16} className="flex-none" aria-hidden="true" />
            </Link>
          </>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <h2 className="cdj-heading mb-1">프로필 수정</h2>
            <div>
              <label className="block text-sm text-brown-600 mb-1.5" htmlFor="p-nickname">
                닉네임
              </label>
              <input
                id="p-nickname"
                required
                value={editForm.nickname}
                onChange={(e) => setEditForm((f) => ({ ...f, nickname: e.target.value }))}
                className="cdj-field text-sm w-full"
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
                className="cdj-field text-sm w-full resize-none"
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
                  className="cdj-button cdj-button--secondary flex-1"
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
                className="cdj-icon-button disabled:opacity-40"
                aria-label="닫기"
              >
                <X size={20} aria-hidden="true" />
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
                className="cdj-field text-sm flex-1"
                placeholder={DELETE_CONFIRM_TEXT}
              />
              <button
                type="submit"
                disabled={deleteConfirmText !== DELETE_CONFIRM_TEXT || deletingAccount}
                className="cdj-button cdj-button--danger"
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
      <div className="cdj-card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-base font-bold text-brown-800">인생책</h2>
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
                className="cdj-field text-sm flex-1"
              />
              <button
                onClick={() => searchLifeBook(lifeBookSearch)}
                disabled={lifeBookSearching}
                className="cdj-button cdj-button--primary"
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

      <div className="cdj-card p-5 mb-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-base font-bold text-brown-800">공식 프로필</h2>
            <p className="mt-1 text-xs text-brown-400">작가, 출판사, 서점 프로필을 신청할 수 있어요.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowOfficialForm((value) => !value)}
            className="cdj-button cdj-button--secondary cdj-button--sm shrink-0"
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
                className="cdj-field text-sm w-full"
              >
                <option value="AUTHOR">작가</option>
                <option value="PUBLISHER">출판사</option>
                <option value="BOOKSTORE">서점</option>
                <option value="LIBRARY">도서관</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-brown-500" htmlFor="official-display-name">표시 이름</label>
              <input
                id="official-display-name"
                required
                value={officialForm.displayName}
                onChange={(e) => setOfficialForm((form) => ({ ...form, displayName: e.target.value }))}
                className="cdj-field text-sm w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brown-500" htmlFor="official-bio">소개글</label>
              <textarea
                id="official-bio"
                value={officialForm.bio}
                onChange={(e) => setOfficialForm((form) => ({ ...form, bio: e.target.value }))}
                rows={3}
                className="cdj-field text-sm w-full resize-none"
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
                  className="cdj-field text-sm w-full"
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
                  className="cdj-field text-sm w-full"
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
                className="cdj-field text-sm w-full"
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
      <nav className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="내 기록 바로가기">
        {[
          { href: "/bookmarks", label: "저장한 독후감", Icon: Bookmark },
          { href: "/library", label: "내 서재", Icon: Library },
          { href: "/calendar", label: "월별 캘린더", Icon: CalendarDays },
          { href: "/stats", label: "독서 인생지도", Icon: MapIcon },
        ].map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="cdj-card cdj-card--interactive flex flex-col items-center gap-2 px-3 py-4 text-sm font-medium text-brown-800"
          >
            <Icon size={20} strokeWidth={1.75} className="text-brown-700" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <Link
        href="/install"
        className="-mt-3 mb-6 block text-center text-xs font-medium text-brown-400 underline underline-offset-2 hover:text-brown-600"
      >
        책도장을 앱처럼 사용하기
      </Link>

      {/* 취향 맞는 독자 추천 */}
      {recommendations.length > 0 && (
        <div className="cdj-card p-5 mb-6">
          <h2 className="font-serif text-base font-bold text-brown-800 mb-1">취향이 비슷한 독자</h2>
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
                <ChevronRight size={16} className="flex-shrink-0 text-sage-500" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 내 독후감 목록 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="cdj-heading">내 독후감</h2>
      </div>

      {/* 검색 */}
      <form onSubmit={handleReviewSearch} className="flex gap-2 mb-4">
        <input
          value={reviewSearchInput}
          onChange={(e) => setReviewSearchInput(e.target.value)}
          placeholder="책 제목 또는 내용 검색"
          className="cdj-field text-sm flex-1"
        />
        <button
          type="submit"
          className="cdj-button cdj-button--primary"
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
            className="cdj-button cdj-button--secondary"
          >
            초기화
          </button>
        )}
      </form>

      {reviews.length === 0 ? (
        <div className="text-center py-12 text-brown-400">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cream-200 text-sage-600"><BookOpen size={22} aria-hidden="true" /></div>
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
                returnTo="/profile"
                onNavigateToDetail={rememberProfileScroll}
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
              className="cdj-button cdj-button--secondary mt-4 w-full"
            >
              {reviewLoadingMore ? "불러오는 중..." : "더보기"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
