"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ReviewDetailModal from "./ReviewDetailModal";
import ProfileAvatar from "./ProfileAvatar";
import StarRating, { StarInput } from "./ui/StarRating";
import { ModalHeader, ModalShell } from "./ui/ModalShell";
import { LoadingState } from "./ui/LoadingState";
import {
  Bookmark, Camera, Check, ChevronRight, EyeOff, Globe, Heart, Link2, Lock, MessageCircle, Share2,
} from "lucide-react";
import { API_BASE } from "../lib/api";
import { authFetch, getValidToken } from "../lib/auth";
import { buildSearchLinks } from "../lib/purchaseLinks";
import { bookReturnStorageKey } from "../lib/returnMemory";

export type Review = {
  id: number;
  author: { id?: number | null; nickname: string; profileImage: string | null };
  book?: {
    id?: number;
    title: string;
    author: string;
    thumbnail: string | null;
    source?: string;
    contentType?: "BOOK" | "WEB_NOVEL";
    sourceUrl?: string | null;
  } | null;
  aiSummary?: {
    oneLineReview: string;
    emotionKeywords: string[];
    recommendedFor: string;
    impressivePoint: string;
  } | null;
  rating: number;
  content: string;
  hidden?: boolean;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  previousReviewId?: number | null;
  sourceReviewId?: number | null;
  keywords?: string[];
  spoiler?: boolean;
};

type Comment = {
  id: number;
  author: { id: number | null; nickname: string; profileImage: string | null };
  content: string;
  createdAt: string;
};

type Me = {
  id: number;
};

const BASE = API_BASE;
const SHARE_COPY = "읽은 책에 나만의 감상을 찍다";
const FEED_STATE_KEY = "chaekdojang:feed-state";
const PENDING_REVIEW_KEY = "chaekdojang:pending-review";

const COVER_COLORS = [
  "#8B6048", "#6E7A4A", "#4A6E7A", "#7A4A6E", "#6E4A7A", "#4A7A6E",
];

function getToken(): string | null {
  return getValidToken();
}

const shareRowCls =
  "flex w-full items-center gap-3 rounded-lg border border-cream-300 bg-cream-50 px-4 py-3 text-left text-sm font-medium text-brown-800 transition-colors hover:border-brown-200 hover:bg-cream-100";

// ─────────────────────────────────────────────
// 댓글 모달
// ─────────────────────────────────────────────
function CommentModal({
  reviewId,
  currentUserId,
  onClose,
  onCountChange,
}: {
  reviewId: number;
  currentUserId: number | null;
  onClose: () => void;
  onCountChange: (delta: number) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const isLoggedIn = !!getToken();

  useEffect(() => {
    loadComments();
  }, [reviewId]);

  async function loadComments() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/reviews/${reviewId}/comments`);
      if (res.ok) {
        const json = await res.json();
        setComments(json.data ?? json);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoggedIn) {
      router.push("/auth/login");
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      const res = await authFetch(`${BASE}/api/reviews/${reviewId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.status === 401) {

        router.push("/auth/login");
        return;
      }
      if (res.ok) {
        setText("");
        onCountChange(1);
        await loadComments();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: number) {
    const res = await authFetch(
      `${BASE}/api/reviews/${reviewId}/comments/${commentId}`,
      {
        method: "DELETE",
      }
    );
    if (res.status === 401) {

      router.push("/auth/login");
      return;
    }
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCountChange(-1);
    }
  }

  return (
    <ModalShell title="댓글" onClose={onClose} className="sm:max-w-lg">
      <ModalHeader
        title={<>댓글 <span className="ml-1 text-sm font-medium text-sage-600 tabular">{comments.length || ""}</span></>}
        onClose={onClose}
      />

      <div className="min-h-40 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {loading ? (
          <LoadingState label="댓글을 불러오는 중" />
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <MessageCircle size={28} strokeWidth={1.5} className="text-sage-400" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-brown-800">아직 댓글이 없어요</p>
            <p className="mt-1 text-xs text-sage-600">첫 댓글로 감상을 나눠보세요</p>
          </div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex items-start gap-3">
              <ProfileAvatar src={c.author.profileImage} name={c.author.nickname} size="xs" />
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-baseline gap-2">
                  <span className="text-[13px] font-semibold text-brown-800">{c.author.nickname}</span>
                  <span className="cdj-meta">{c.createdAt.slice(0, 10).replaceAll("-", ".")}</span>
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-brown-900">{c.content}</p>
              </div>
              {currentUserId !== null && currentUserId === c.author.id && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className="mt-0.5 flex-shrink-0 text-xs text-sage-600 transition-colors hover:text-wine-500"
                >
                  삭제
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-cream-300 bg-cream-50 px-4 py-3">
        {isLoggedIn ? (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }}
              placeholder="댓글을 입력하세요"
              aria-label="댓글 입력"
              rows={1}
              disabled={submitting}
              className="cdj-field flex-1 resize-none text-sm"
            />
            <button type="submit" disabled={!text.trim() || submitting} className="cdj-button cdj-button--primary">
              등록
            </button>
          </>
        ) : (
          <button type="button" onClick={() => router.push("/auth/login")} className="cdj-button cdj-button--secondary w-full">
            로그인하고 댓글 남기기
          </button>
        )}
      </form>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────
// 독후감 수정 모달
// ─────────────────────────────────────────────
function EditModal({
  initialContent,
  initialRating,
  saving,
  onClose,
  onSave,
}: {
  initialContent: string;
  initialRating: number;
  saving: boolean;
  onClose: () => void;
  onSave: (content: string, rating: number) => void;
}) {
  const [content, setContent] = useState(initialContent);
  const [rating, setRating] = useState(initialRating);

  return (
    <ModalShell title="독후감 수정" onClose={onClose} className="sm:max-w-lg">
      <ModalHeader title="독후감 수정" onClose={onClose} />
      <div className="space-y-4 overflow-y-auto px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-sage-600">별점</span>
          <StarInput rating={rating} onChange={setRating} />
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          aria-label="독후감 내용"
          className="cdj-field resize-none text-[15px] leading-7"
          placeholder="독후감을 입력하세요"
          autoFocus
        />
      </div>
      <div className="flex justify-end gap-2 border-t border-cream-300 px-5 py-3">
        <button onClick={onClose} className="cdj-button cdj-button--ghost">
          취소
        </button>
        <button
          onClick={() => onSave(content, rating)}
          disabled={saving || !content.trim()}
          className="cdj-button cdj-button--primary"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────
// 피드 카드
// ─────────────────────────────────────────────
export default function ReviewCard({
  post,
  forceOwner = false,
  onNavigateToDetail,
  onVisibilityChange,
  returnTo,
}: {
  post: Review;
  forceOwner?: boolean;
  onNavigateToDetail?: () => void;
  onVisibilityChange?: (review: Review) => void;
  returnTo?: string;
}) {
  const coverColor = COVER_COLORS[post.id % COVER_COLORS.length];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const myId = currentUserId;

  const isOwner =
    forceOwner || (myId !== null && post.author.id != null && myId === post.author.id);
  const isOther =
    myId !== null && post.author.id != null && myId !== post.author.id;

  // 좋아요
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [showComments, setShowComments] = useState(false);

  // 삭제
  const [deleted, setDeleted] = useState(false);

  // 수정
  const [editing, setEditing] = useState(false);
  const [displayContent, setDisplayContent] = useState(post.content);
  const [displayRating, setDisplayRating] = useState(post.rating);
  const [hidden, setHidden] = useState(Boolean(post.hidden));
  const [saving, setSaving] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);

  // 팔로우
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // 상세 모달
  const [showDetail, setShowDetail] = useState(false);

  // 북마크
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkSaving, setBookmarkSaving] = useState(false);
  const [bookmarkFeedback, setBookmarkFeedback] = useState("");

  // 공유
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [instaCopied, setInstaCopied] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const canOpenHiddenDetail = hidden && isOwner;
  const currentReturnTo =
    pathname?.startsWith("/books/")
      ? `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
      : undefined;
  const effectiveReturnTo = returnTo ?? currentReturnTo;
  const reviewHref = effectiveReturnTo
    ? `/reviews/${post.id}?${new URLSearchParams({ returnTo: effectiveReturnTo }).toString()}`
    : `/reviews/${post.id}`;
  const bookHref = pathname?.startsWith("/books/") && effectiveReturnTo
    ? effectiveReturnTo
    : post.book?.id
    ? `/books/${post.book.id}`
    : "#";

  function rememberReturnTo() {
    if (!effectiveReturnTo) return;
    try {
      sessionStorage.setItem(`chaekdojang:return-to:${post.id}`, effectiveReturnTo);
      if (post.book?.id) {
        sessionStorage.setItem(bookReturnStorageKey(post.book.id), effectiveReturnTo);
      }
    } catch {
      /* storage may be unavailable */
    }
  }

  useEffect(() => {
    rememberReturnTo();
  }, [effectiveReturnTo, post.book?.id, post.id]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setCurrentUserId(null);
      return;
    }
    authFetch(`${BASE}/api/users/me`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const me = (json?.data ?? json) as Me | null;
        setCurrentUserId(me?.id ?? null);
      })
      .catch(() => setCurrentUserId(null));
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    authFetch(`${BASE}/api/reviews/${post.id}/like/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json !== null) setLiked(Boolean(json.data ?? json));
      })
      .catch(() => {});
  }, [post.id]);

  useEffect(() => {
    if (!isOther || !post.author.id) return;
    const token = getToken();
    if (!token) return;
    authFetch(`${BASE}/api/users/${post.author.id}/follow/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json !== null) setFollowing(Boolean(json.data ?? json));
      })
      .catch(() => {});
  }, [post.author.id, isOther]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    authFetch(`${BASE}/api/reviews/${post.id}/bookmark/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json !== null) setBookmarked(Boolean(json.data ?? json));
      })
      .catch(() => {});
  }, [post.id]);

  async function handleLike() {
    if (!getToken()) {
      router.push("/auth/login");
      return;
    }
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));

    const res = await authFetch(`${BASE}/api/reviews/${post.id}/like`, {
      method: next ? "POST" : "DELETE",
    });

    if (res.status === 401) {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));

      router.push("/auth/login");
      return;
    }
    if (!res.ok) {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    }
  }

  async function handleDelete() {
    if (!confirm("이 독후감을 삭제할까요?")) return;
    const res = await authFetch(`${BASE}/api/reviews/${post.id}`, {
      method: "DELETE",
    });
    if (res.status === 204 || res.ok) {
      setDeleted(true);
    } else if (res.status === 401) {

      router.push("/auth/login");
    }
  }

  async function handleSave(content: string, rating: number) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await authFetch(`${BASE}/api/reviews/${post.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content, rating }),
      });
      if (res.ok) {
        setDisplayContent(content);
        setDisplayRating(rating);
        setEditing(false);
      } else if (res.status === 401) {

        router.push("/auth/login");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleVisibilityToggle() {
    if (!isOwner || visibilitySaving) return;
    const next = !hidden;
    setHidden(next);
    setVisibilitySaving(true);
    try {
      const res = await authFetch(`${BASE}/api/reviews/${post.id}/hidden`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hidden: next }),
      });
      if (res.status === 401) {
        setHidden(!next);

        router.push("/auth/login");
        return;
      }
      if (!res.ok) {
        setHidden(!next);
        return;
      }
      const json = await res.json().catch(() => null);
      const savedHidden = json?.data?.hidden;
      const updatedPost = {
        ...post,
        hidden: typeof savedHidden === "boolean" ? savedHidden : next,
      };
      if (typeof savedHidden === "boolean") {
        setHidden(savedHidden);
      }
      onVisibilityChange?.(updatedPost);
      sessionStorage.removeItem(FEED_STATE_KEY);
      sessionStorage.removeItem(PENDING_REVIEW_KEY);
    } finally {
      setVisibilitySaving(false);
    }
  }

  async function handleBookmark() {
    if (!getToken()) { router.push("/auth/login"); return; }
    if (bookmarkSaving) return;
    const next = !bookmarked;
    setBookmarked(next);
    setBookmarkSaving(true);
    setBookmarkFeedback(next ? "저장됨" : "해제됨");
    try {
      const res = await authFetch(`${BASE}/api/reviews/${post.id}/bookmark`, {
        method: next ? "POST" : "DELETE",
      });
      if (res.status === 401) {
        setBookmarked(!next);
        router.push("/auth/login");
      } else if (!res.ok) {
        setBookmarked(!next);
        setBookmarkFeedback("실패");
      }
    } catch {
      setBookmarked(!next);
      setBookmarkFeedback("실패");
    } finally {
      setBookmarkSaving(false);
      window.setTimeout(() => setBookmarkFeedback(""), 1600);
    }
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/reviews/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API 미지원 */
    }
  }

  async function handleFollow() {
    if (!post.author.id) return;
    if (!getToken()) {
      router.push("/auth/login");
      return;
    }
    setFollowLoading(true);
    const next = !following;
    setFollowing(next);
    try {
      const res = await authFetch(`${BASE}/api/users/${post.author.id}/follow`, {
        method: next ? "POST" : "DELETE",
      });
      if (res.status === 401) {
        setFollowing(!next);

        router.push("/auth/login");
      } else if (!res.ok) {
        setFollowing(!next);
      }
    } finally {
      setFollowLoading(false);
    }
  }

  if (deleted) return null;

  const profileHref = `/u/${encodeURIComponent(post.author.nickname)}`;
  const purchaseLinks = post.book ? buildSearchLinks(post.book.title, post.book.source, post.book.sourceUrl) : [];

  return (
    <>
      <article className="cdj-card cdj-card--interactive overflow-hidden">
        {/* 작성자 줄: 프로필 · 팔로우 · (내 글이면) 관리 · 날짜 */}
        <header className="flex items-center justify-between gap-3 px-5 pt-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Link href={profileHref} className="shrink-0">
              <ProfileAvatar src={post.author.profileImage} name={post.author.nickname} size="xs" />
            </Link>
            {post.author.id != null ? (
              <Link href={profileHref} className="truncate text-[13px] font-semibold text-brown-800 hover:underline">
                {post.author.nickname}
              </Link>
            ) : (
              <span className="truncate text-[13px] font-semibold text-brown-800">{post.author.nickname}</span>
            )}
            {isOther && (
              <>
                <span className="text-cream-300" aria-hidden="true">·</span>
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`flex-shrink-0 text-[13px] font-semibold transition-colors disabled:opacity-50 ${
                    following ? "text-sage-600 hover:text-wine-500" : "text-brown-700 hover:text-brown-800"
                  }`}
                >
                  {following ? "팔로잉" : "팔로우"}
                </button>
              </>
            )}
          </div>

          <div className="flex flex-shrink-0 items-center gap-1 whitespace-nowrap">
            {isOwner && !editing && (
              <>
                <button
                  onClick={handleVisibilityToggle}
                  disabled={visibilitySaving}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                    hidden ? "bg-wine-50 text-wine-700 hover:bg-red-100" : "bg-brown-100 text-brown-700 hover:bg-brown-200"
                  }`}
                  title={hidden ? "누르면 공개로 바뀝니다" : "누르면 비공개로 바뀝니다"}
                >
                  {hidden ? <Lock size={11} aria-hidden="true" /> : <Globe size={11} aria-hidden="true" />}
                  {visibilitySaving ? "저장 중" : hidden ? "비공개" : "공개"}
                </button>
                <button
                  onClick={() => router.push(`/write?reviewId=${post.id}`)}
                  className="rounded px-1.5 py-0.5 text-xs text-sage-600 transition-colors hover:bg-cream-200 hover:text-brown-800"
                >
                  수정
                </button>
                <button
                  onClick={handleDelete}
                  className="rounded px-1.5 py-0.5 text-xs text-sage-600 transition-colors hover:bg-wine-50 hover:text-wine-500"
                >
                  삭제
                </button>
              </>
            )}
            <time className="cdj-meta ml-1" dateTime={post.createdAt}>
              {post.createdAt.slice(0, 7).replace("-", ".")}
            </time>
          </div>
        </header>

        <div className="px-5 pb-1 pt-4">
          {/* 책 정보 */}
          <div className="flex gap-4">
            {post.book?.id ? (
              <Link href={bookHref} className="cdj-cover w-[60px]" onClick={(e) => e.stopPropagation()} tabIndex={-1} aria-hidden="true">
                {post.book.thumbnail ? (
                  <img src={post.book.thumbnail} alt="" loading="lazy" />
                ) : (
                  <span className="flex h-full items-end justify-center pb-2 font-serif text-sm font-bold text-white/80" style={{ backgroundColor: coverColor }}>
                    {post.book.title?.[0]}
                  </span>
                )}
              </Link>
            ) : (
              <div className="cdj-cover w-[60px]" aria-hidden="true">
                {post.book?.thumbnail ? (
                  <img src={post.book.thumbnail} alt="" loading="lazy" />
                ) : (
                  <span className="flex h-full items-end justify-center pb-2 font-serif text-sm font-bold text-white/80" style={{ backgroundColor: coverColor }}>
                    {post.book?.title?.[0] ?? ""}
                  </span>
                )}
              </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col justify-center">
              {post.book &&
                (post.book.id ? (
                  <Link
                    href={bookHref}
                    className="line-clamp-2 font-serif text-[17px] font-bold leading-snug text-brown-800 transition-colors hover:text-brown-600"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {post.book.title}
                  </Link>
                ) : (
                  <p className="line-clamp-2 font-serif text-[17px] font-bold leading-snug text-brown-800">{post.book.title}</p>
                ))}
              {post.book?.author && <p className="mt-0.5 truncate text-[13px] text-sage-600">{post.book.author}</p>}
              <StarRating rating={displayRating} className="mt-2" />
            </div>
          </div>

          {post.aiSummary?.oneLineReview && (
            <p className="cdj-quote mt-4 text-[15px]">{post.aiSummary.oneLineReview}</p>
          )}

          {/* 본문 — 짧은 감상과 본문이 함께 저장된 경우에만 첫 문단을 건너뜀 */}
          {(() => {
            const paragraphs = displayContent.split("\n\n");
            const bodyWithoutShortReview = paragraphs.length > 1
              ? paragraphs.slice(1).join("\n\n").trim()
              : "";
            const bodyText = post.aiSummary?.oneLineReview && bodyWithoutShortReview
              ? bodyWithoutShortReview
              : displayContent.trim();
            if (!bodyText) return null;
            if (post.spoiler && !spoilerRevealed) {
              return (
                <button
                  type="button"
                  onClick={() => setSpoilerRevealed(true)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-amber-400/60 bg-amber-50 px-4 py-4 text-sm font-medium text-amber-700"
                >
                  <EyeOff size={15} aria-hidden="true" />
                  스포일러가 있어요 · 눌러서 보기
                </button>
              );
            }
            const body = (
              <>
                <p className="line-clamp-3 text-[15px] leading-7 text-brown-900/85 transition-colors group-hover:text-brown-900">
                  {bodyText}
                </p>
                <span className="mt-1 inline-flex items-center text-[13px] font-medium text-sage-600 transition-colors group-hover:text-brown-700">
                  더 보기
                  <ChevronRight size={14} aria-hidden="true" />
                </span>
              </>
            );
            return canOpenHiddenDetail ? (
              <button type="button" className="group mt-3 block w-full text-left" onClick={() => setShowDetail(true)}>
                {body}
              </button>
            ) : (
              <Link
                href={hidden ? "#" : reviewHref}
                className="group mt-3 block w-full text-left"
                onClick={(e) => {
                  if (hidden) { e.preventDefault(); return; }
                  onNavigateToDetail?.();
                  rememberReturnTo();
                }}
              >
                {body}
              </Link>
            );
          })()}

          {post.keywords && post.keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.keywords.map((keyword) => (
                <span key={keyword} className="rounded bg-cream-200/80 px-2 py-0.5 text-xs text-sage-700">
                  #{keyword}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 반응 줄 */}
        <footer className="mt-3 flex items-center gap-1 border-t border-cream-200 px-3 py-1.5">
          <button
            onClick={handleLike}
            className={`flex h-9 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium transition-colors hover:bg-cream-200 ${
              liked ? "text-wine-500" : "text-sage-600 hover:text-brown-800"
            }`}
            aria-label={liked ? "좋아요 취소" : "좋아요"}
            aria-pressed={liked}
          >
            <Heart size={18} strokeWidth={1.75} className={liked ? "fill-wine-500" : ""} aria-hidden="true" />
            <span className="tabular">{likeCount}</span>
          </button>

          <button
            onClick={() => setShowComments(true)}
            className="flex h-9 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-sage-600 transition-colors hover:bg-cream-200 hover:text-brown-800"
            aria-label="댓글 보기"
          >
            <MessageCircle size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className="tabular">{commentCount}</span>
          </button>

          <button
            onClick={() => setShowShare(true)}
            className="flex h-9 items-center rounded-md px-2 text-sage-600 transition-colors hover:bg-cream-200 hover:text-brown-800"
            aria-label="공유"
          >
            <Share2 size={17} strokeWidth={1.75} aria-hidden="true" />
          </button>

          {purchaseLinks.length > 0 && (
            <div className="ml-auto hidden items-center gap-3 pr-1 sm:flex">
              {purchaseLinks.map((link) => (
                <a
                  key={link.provider}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sage-600 transition-colors hover:text-brown-800 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}

          <button
            onClick={handleBookmark}
            disabled={bookmarkSaving}
            className={`${purchaseLinks.length > 0 ? "sm:ml-1" : ""} ml-auto flex h-9 items-center gap-1 rounded-md px-2 text-[13px] font-medium transition-colors hover:bg-cream-200 disabled:opacity-60 ${
              bookmarked ? "text-brown-700" : "text-sage-600 hover:text-brown-800"
            }`}
            aria-label={bookmarked ? "북마크 해제" : "북마크"}
            aria-pressed={bookmarked}
          >
            <Bookmark size={18} strokeWidth={1.75} className={bookmarked ? "fill-brown-700" : ""} aria-hidden="true" />
            {bookmarkFeedback && <span className="text-xs">{bookmarkFeedback}</span>}
          </button>
        </footer>
      </article>

      {editing && (
        <EditModal
          initialContent={displayContent}
          initialRating={displayRating}
          saving={saving}
          onClose={() => setEditing(false)}
          onSave={handleSave}
        />
      )}

      {showComments && (
        <CommentModal
          reviewId={post.id}
          currentUserId={currentUserId}
          onClose={() => setShowComments(false)}
          onCountChange={(delta) => setCommentCount((c) => c + delta)}
        />
      )}

      {showDetail && (
        <ReviewDetailModal
          reviewId={post.id}
          returnTo={effectiveReturnTo}
          onClose={() => setShowDetail(false)}
          onEngagementChange={({ likeCount: nextLikeCount, commentCount: nextCommentCount, liked: nextLiked }) => {
            setLikeCount(nextLikeCount);
            setCommentCount(nextCommentCount);
            if (typeof nextLiked === "boolean") setLiked(nextLiked);
          }}
        />
      )}

      {showShare && (
        <ModalShell title="공유하기" onClose={() => setShowShare(false)} className="sm:max-w-sm">
          <ModalHeader title="공유하기" onClose={() => setShowShare(false)} />
          <div className="px-5 pb-5 pt-4">
            {post.book?.title && <p className="mb-4 truncate text-sm text-sage-600">{post.book.title}</p>}
            {(() => {
              const shareUrl = `${window.location.origin}/reviews/${post.id}`;
              const shareText = `${SHARE_COPY} ${post.book?.title ?? "독후감"}`;
              return (
                <div className="flex flex-col gap-2">
                  {/* 링크 복사 */}
                  <button onClick={handleCopyLink} className={shareRowCls}>
                    {copied ? <Check size={18} className="text-brown-700" aria-hidden="true" /> : <Link2 size={18} className="text-sage-600" aria-hidden="true" />}
                    {copied ? "링크를 복사했어요" : "링크 복사"}
                  </button>

                  {/* 트위터(X) */}
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowShare(false)}
                    className={shareRowCls}
                  >
                    <span className="flex w-[18px] justify-center text-base font-bold leading-none text-sage-700" aria-hidden="true">𝕏</span>
                    X(트위터)에 공유
                  </a>

                  {/* 페이스북 */}
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowShare(false)}
                    className={shareRowCls}
                  >
                    <span className="flex w-[18px] justify-center text-base font-bold leading-none text-sage-700" aria-hidden="true">f</span>
                    페이스북에 공유
                  </a>

                  {/* 인스타그램 — 직접 공유 API 없음, 링크 복사 후 안내 */}
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(shareUrl);
                        setInstaCopied(true);
                        setTimeout(() => setInstaCopied(false), 3000);
                      } catch { /* 무시 */ }
                    }}
                    className={shareRowCls}
                  >
                    {instaCopied ? <Check size={18} className="text-brown-700" aria-hidden="true" /> : <Camera size={18} className="text-sage-600" aria-hidden="true" />}
                    <span className="flex flex-col">
                      인스타그램 공유
                      <span className="text-xs font-normal text-sage-600">
                        {instaCopied ? "링크를 복사했어요. 인스타그램에 붙여넣으세요" : "링크를 복사해 붙여넣어 주세요"}
                      </span>
                    </span>
                  </button>
                </div>
              );
            })()}
          </div>
        </ModalShell>
      )}
    </>
  );
}
