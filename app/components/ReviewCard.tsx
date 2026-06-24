"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReviewDetailModal from "./ReviewDetailModal";
import ProfileAvatar from "./ProfileAvatar";
import { API_BASE } from "../lib/api";
import { buildSearchLinks } from "../lib/purchaseLinks";

export type Review = {
  id: number;
  author: { id?: number | null; nickname: string; profileImage: string | null };
  book?: { id?: number; title: string; author: string; thumbnail: string | null } | null;
  rating: number;
  content: string;
  hidden?: boolean;
  likeCount: number;
  commentCount: number;
  createdAt: string;
};

type Comment = {
  id: number;
  author: { id: number | null; nickname: string; profileImage: string | null };
  content: string;
  createdAt: string;
};

const BASE = API_BASE;
const SHARE_COPY = "읽은 책에 나만의 감상을 찍다";
const FEED_STATE_KEY = "chaekdojang:feed-state";
const PENDING_REVIEW_KEY = "chaekdojang:pending-review";

const COVER_COLORS = [
  "#8B6048", "#6E7A4A", "#4A6E7A", "#7A4A6E", "#6E4A7A", "#4A7A6E",
];

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
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    const raw = payload.userId ?? payload.id ?? payload.sub;
    return raw != null ? Number(raw) : null;
  } catch {
    return null;
  }
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-sm">
      <span className="text-amber-500">{"★".repeat(rating)}</span>
      <span className="text-cream-300">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function EditableStars({
  rating,
  onChange,
}: {
  rating: number;
  onChange: (r: number) => void;
}) {
  return (
    <span className="text-sm">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`text-base leading-none transition-colors ${
            n <= rating ? "text-amber-500" : "text-brown-200 hover:text-amber-300"
          }`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────
// 댓글 모달
// ─────────────────────────────────────────────
function CommentModal({
  reviewId,
  onClose,
  onCountChange,
}: {
  reviewId: number;
  onClose: () => void;
  onCountChange: (delta: number) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const myId = getMyUserId();
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
      const res = await fetch(`${BASE}/api/reviews/${reviewId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.status === 401) {
        localStorage.removeItem("token");
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
    const res = await fetch(
      `${BASE}/api/reviews/${reviewId}/comments/${commentId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      }
    );
    if (res.status === 401) {
      localStorage.removeItem("token");
      router.push("/auth/login");
      return;
    }
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCountChange(-1);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <h2 className="font-serif font-bold text-brown-800">댓글</h2>
          <button
            onClick={onClose}
            className="text-brown-400 hover:text-brown-600 text-xl leading-none"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {loading ? (
            <p className="text-center text-brown-400 text-sm py-8">불러오는 중…</p>
          ) : comments.length === 0 ? (
            <p className="text-center text-brown-400 text-sm py-8">
              첫 댓글을 남겨보세요 ✏️
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <ProfileAvatar src={c.author.profileImage} name={c.author.nickname} size="xs" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-brown-600">
                      {c.author.nickname}
                    </span>
                    <span className="text-xs text-brown-300">
                      {c.createdAt.slice(0, 10)}
                    </span>
                  </div>
                  <p className="text-sm text-brown-700 leading-relaxed">
                    {c.content}
                  </p>
                </div>
                {myId !== null && myId === c.author.id && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="flex-shrink-0 text-xs text-red-400 hover:text-red-600 mt-0.5"
                  >
                    삭제
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="px-5 py-3 border-t border-cream-200 flex gap-2 items-end"
        >
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
                placeholder="댓글을 입력하세요…"
                rows={1}
                disabled={submitting}
                className="flex-1 resize-none rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-700 placeholder:text-brown-300 focus:outline-none focus:border-brown-400 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!text.trim() || submitting}
                className="px-4 py-2 bg-brown-600 text-white text-sm rounded-xl hover:bg-brown-700 disabled:opacity-40 transition-colors"
              >
                등록
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/auth/login")}
              className="flex-1 py-2 text-sm text-brown-500 bg-cream-100 rounded-xl hover:bg-cream-200 transition-colors"
            >
              로그인하고 댓글 남기기
            </button>
          )}
        </form>
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <h2 className="font-serif font-bold text-brown-800">독후감 수정</h2>
          <button
            onClick={onClose}
            className="text-brown-400 hover:text-brown-600 text-xl leading-none"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-brown-500">별점</span>
            <EditableStars rating={rating} onChange={setRating} />
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-700 focus:outline-none focus:border-brown-400 resize-none"
            placeholder="독후감을 입력하세요…"
            autoFocus
          />
        </div>
        <div className="flex gap-2 px-5 pb-5 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-brown-500 bg-cream-100 rounded-lg hover:bg-cream-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => onSave(content, rating)}
            disabled={saving || !content.trim()}
            className="px-3 py-1.5 text-xs text-white bg-brown-600 rounded-lg hover:bg-brown-700 disabled:opacity-40 transition-colors"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 피드 카드
// ─────────────────────────────────────────────
export default function ReviewCard({
  post,
  forceOwner = false,
  onVisibilityChange,
}: {
  post: Review;
  forceOwner?: boolean;
  onVisibilityChange?: (review: Review) => void;
}) {
  const coverColor = COVER_COLORS[post.id % COVER_COLORS.length];
  const router = useRouter();
  const myId = getMyUserId();

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

  // 공유
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [instaCopied, setInstaCopied] = useState(false);
  const canOpenHiddenDetail = hidden && isOwner;

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${BASE}/api/reviews/${post.id}/like/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
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
    fetch(`${BASE}/api/users/${post.author.id}/follow/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json !== null) setFollowing(Boolean(json.data ?? json));
      })
      .catch(() => {});
  }, [post.author.id, isOther]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${BASE}/api/reviews/${post.id}/bookmark/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
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

    const res = await fetch(`${BASE}/api/reviews/${post.id}/like`, {
      method: next ? "POST" : "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (res.status === 401) {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
      localStorage.removeItem("token");
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
    const res = await fetch(`${BASE}/api/reviews/${post.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.status === 204 || res.ok) {
      setDeleted(true);
    } else if (res.status === 401) {
      localStorage.removeItem("token");
      router.push("/auth/login");
    }
  }

  async function handleSave(content: string, rating: number) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/reviews/${post.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ content, rating }),
      });
      if (res.ok) {
        setDisplayContent(content);
        setDisplayRating(rating);
        setEditing(false);
      } else if (res.status === 401) {
        localStorage.removeItem("token");
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
      const res = await fetch(`${BASE}/api/reviews/${post.id}/hidden`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ hidden: next }),
      });
      if (res.status === 401) {
        setHidden(!next);
        localStorage.removeItem("token");
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
    const next = !bookmarked;
    setBookmarked(next);
    const res = await fetch(`${BASE}/api/reviews/${post.id}/bookmark`, {
      method: next ? "POST" : "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.status === 401) {
      setBookmarked(!next); localStorage.removeItem("token"); router.push("/auth/login");
    } else if (!res.ok) {
      setBookmarked(!next);
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
      const res = await fetch(`${BASE}/api/users/${post.author.id}/follow`, {
        method: next ? "POST" : "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) {
        setFollowing(!next);
        localStorage.removeItem("token");
        router.push("/auth/login");
      } else if (!res.ok) {
        setFollowing(!next);
      }
    } finally {
      setFollowLoading(false);
    }
  }

  if (deleted) return null;

  return (
    <>
      <article className="stamp-card bg-white rounded-lg border border-cream-200 p-5 hover:shadow-md transition-shadow overflow-hidden">
        <div className="flex gap-4">
          {/* 책 표지 */}
          {post.book?.thumbnail ? (
            <img
              src={post.book.thumbnail}
              alt={post.book.title}
              className="flex-shrink-0 w-11 h-16 rounded shadow-sm object-cover"
            />
          ) : (
            <div
              className="flex-shrink-0 w-11 h-16 rounded shadow-sm flex items-end justify-center pb-1 text-white/70 text-xs font-bold"
              style={{ backgroundColor: coverColor }}
              aria-hidden
            >
              {post.book?.title?.[0] ?? "📖"}
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* 작성자 + 팔로우 버튼 + 날짜/수정/삭제 */}
            <div className="flex items-start justify-between gap-3 mb-1">
              {/* 왼쪽: 작성자 + 팔로우 버튼 */}
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <ProfileAvatar src={post.author.profileImage} name={post.author.nickname} size="xs" />
                {post.author.id != null ? (
                  <Link
                    href={`/users/${post.author.id}`}
                    className="text-xs text-brown-400 font-medium hover:text-brown-700 hover:underline transition-colors truncate"
                  >
                    {post.author.nickname}
                  </Link>
                ) : (
                  <span className="text-xs text-brown-400 font-medium truncate">
                    {post.author.nickname}
                  </span>
                )}
                {isOther && (
                  <button
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      following
                        ? "border-brown-300 text-brown-400 hover:border-red-300 hover:text-red-400"
                        : "border-brown-400 text-brown-600 hover:bg-brown-50"
                    } disabled:opacity-50`}
                  >
                    {following ? "팔로잉" : "팔로우"}
                  </button>
                )}
              </div>

              {/* 오른쪽: 수정/삭제(내 글일 때) + 날짜 */}
              <div className="flex flex-shrink-0 items-center justify-end gap-2 whitespace-nowrap">
                {isOwner && !editing && (
                  <>
                    <button
                      onClick={handleVisibilityToggle}
                      disabled={visibilitySaving}
                      className={`text-xs rounded-full px-2 py-0.5 transition-colors disabled:opacity-50 ${
                        hidden
                          ? "bg-red-50 text-red-500 hover:bg-red-100"
                          : "bg-green-50 text-green-600 hover:bg-green-100"
                      }`}
                      title={hidden ? "누르면 공개로 바뀝니다" : "누르면 비공개로 바뀝니다"}
                    >
                      {visibilitySaving ? "저장 중" : hidden ? "비공개" : "공개"}
                    </button>
                    <button
                      onClick={() => setEditing(true)}
                      className="text-xs text-brown-400 hover:text-brown-700 transition-colors"
                    >
                      수정
                    </button>
                    <button
                      onClick={handleDelete}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      삭제
                    </button>
                  </>
                )}
                <time className="text-xs text-brown-300" dateTime={post.createdAt}>
                  {post.createdAt.slice(0, 7).replace("-", ".")}
                </time>
              </div>
            </div>

            {/* 책 정보 */}
            {post.book && (
              <>
                {post.book.id ? (
                  <Link
                    href={`/books/${post.book.id}`}
                    className="font-serif text-base font-bold text-brown-800 leading-snug hover:text-brown-600 hover:underline transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {post.book.title}
                  </Link>
                ) : (
                  <p className="font-serif text-base font-bold text-brown-800 leading-snug">
                    {post.book.title}
                  </p>
                )}
                <p className="text-xs text-brown-400 mb-0.5">{post.book.author}</p>
                {/* 구매 링크 */}
                <div className="flex items-center gap-2 mb-1">
                  {buildSearchLinks(post.book.title).map((link, idx) => (
                    <span key={link.provider} className="contents">
                      {idx > 0 && <span className="text-brown-200 text-xs">|</span>}
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brown-300 hover:text-brown-500 hover:underline transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {link.provider === "COUPANG" ? "쿠팡" : "교보문고"} →
                      </a>
                    </span>
                  ))}
                </div>
              </>
            )}

            <Stars rating={displayRating} />
          </div>
        </div>

        {/* 본문 */}
        {canOpenHiddenDetail ? (
          <button
            type="button"
            className="mt-3 text-left w-full group block"
            onClick={() => setShowDetail(true)}
          >
            <p className="text-sm text-brown-600 leading-relaxed line-clamp-3 group-hover:text-brown-800 transition-colors">
              {displayContent}
            </p>
            <span className="text-xs text-brown-300 group-hover:text-brown-500 transition-colors mt-1 inline-block">
              더 보기
            </span>
          </button>
        ) : (
          <Link
            href={hidden ? "#" : `/reviews/${post.id}`}
            className="mt-3 text-left w-full group block"
            onClick={(e) => {
              if (hidden) e.preventDefault();
            }}
          >
            <p className="text-sm text-brown-600 leading-relaxed line-clamp-3 group-hover:text-brown-800 transition-colors">
              {displayContent}
            </p>
            <span className="text-xs text-brown-300 group-hover:text-brown-500 transition-colors mt-1 inline-block">
              더 보기
            </span>
          </Link>
        )}

        {/* 좋아요 / 댓글 버튼 */}
        <div className="flex items-center gap-5 mt-3 pt-3 border-t border-cream-100">
          <button
            onClick={handleLike}
            className="flex items-center gap-1.5 text-sm transition-colors group"
            aria-label={liked ? "좋아요 취소" : "좋아요"}
          >
            <span
              className={`text-base leading-none transition-colors ${
                liked
                  ? "text-red-500"
                  : "text-brown-300 group-hover:text-red-400"
              }`}
            >
              {liked ? "♥" : "♡"}
            </span>
            <span className={liked ? "text-red-500" : "text-brown-400"}>
              {likeCount}
            </span>
          </button>

          <button
            onClick={() => setShowComments(true)}
            className="flex items-center gap-1.5 text-sm text-brown-400 hover:text-brown-600 transition-colors"
            aria-label="댓글 보기"
          >
            <span className="text-base leading-none">💬</span>
            <span>{commentCount}</span>
          </button>

          {/* 공유 버튼 */}
          <button
            onClick={() => setShowShare(true)}
            className="flex items-center gap-1 text-sm text-brown-300 hover:text-brown-500 transition-colors"
            aria-label="공유"
          >
            <span className="text-base leading-none">↗</span>
          </button>

          {/* 북마크 버튼 — 오른쪽 끝 */}
          <button
            onClick={handleBookmark}
            className="ml-auto flex items-center gap-1 text-sm transition-colors group"
            aria-label={bookmarked ? "북마크 해제" : "북마크"}
          >
            <span className={`text-base leading-none transition-colors ${bookmarked ? "text-brown-600" : "text-brown-200 group-hover:text-brown-400"}`}>
              {bookmarked ? "🔖" : "🔖"}
            </span>
          </button>
        </div>
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
          onClose={() => setShowComments(false)}
          onCountChange={(delta) => setCommentCount((c) => c + delta)}
        />
      )}

      {showDetail && (
        <ReviewDetailModal
          reviewId={post.id}
          onClose={() => setShowDetail(false)}
        />
      )}

      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowShare(false)} />
          <div className="relative z-10 bg-white rounded-2xl p-5 shadow-xl w-72">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-brown-800">공유하기</h3>
              <button
                onClick={() => setShowShare(false)}
                className="text-brown-400 hover:text-brown-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            {post.book?.title && (
              <p className="text-xs text-brown-400 mb-4 truncate">{post.book.title}</p>
            )}
            {(() => {
              const shareUrl = `${window.location.origin}/reviews/${post.id}`;
              const shareText = `${SHARE_COPY} ${post.book?.title ?? "독후감"}`;
              return (
                <div className="flex flex-col gap-2">
                  {/* 링크 복사 */}
                  <button
                    onClick={handleCopyLink}
                    className="w-full py-3 text-sm text-brown-700 bg-cream-100 rounded-xl hover:bg-cream-200 transition-colors flex items-center justify-center gap-2"
                  >
                    🔗 링크 복사{copied && <span className="text-xs text-brown-500">복사됨!</span>}
                  </button>

                  {/* 트위터(X) */}
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowShare(false)}
                    className="w-full py-3 text-sm text-brown-700 bg-cream-100 rounded-xl hover:bg-cream-200 transition-colors flex items-center justify-center gap-2"
                  >
                    𝕏 트위터에 공유
                  </a>

                  {/* 페이스북 */}
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowShare(false)}
                    className="w-full py-3 text-sm text-brown-700 bg-cream-100 rounded-xl hover:bg-cream-200 transition-colors flex items-center justify-center gap-2"
                  >
                    📘 페이스북에 공유
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
                    className="w-full py-3 text-sm text-brown-700 bg-cream-100 rounded-xl hover:bg-cream-200 transition-colors flex flex-col items-center justify-center gap-0.5"
                  >
                    <span>📸 인스타그램 공유</span>
                    {instaCopied
                      ? <span className="text-xs text-brown-500">링크 복사됨! 인스타그램에 붙여넣기하세요</span>
                      : <span className="text-xs text-brown-400">링크를 복사해서 붙여넣기하세요</span>
                    }
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}
