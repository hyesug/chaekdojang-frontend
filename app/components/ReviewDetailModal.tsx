"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProfileAvatar from "./ProfileAvatar";
import ReviewViewTracker from "./ReviewViewTracker";
import { API_BASE } from "../lib/api";
import { authFetch, getValidToken } from "../lib/auth";
import { ModalShell } from "./ui/ModalShell";
import StarRating, { StarInput } from "./ui/StarRating";
import { LoadingState } from "./ui/LoadingState";
import { Heart, MessageCircle, X } from "lucide-react";

const BASE = API_BASE;

type ReviewDetail = {
  id: number;
  author: { id: number | null; nickname: string; profileImage: string | null };
  book: { id: number; title: string; author: string; thumbnail: string | null } | null;
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

type Me = {
  id: number;
};

function getToken(): string | null {
  return getValidToken();
}

type Props = {
  reviewId: number;
  onClose: () => void;
  onEngagementChange?: (counts: { likeCount: number; commentCount: number; liked?: boolean }) => void;
  returnTo?: string;
};

export default function ReviewDetailModal({ reviewId, onClose, onEngagementChange, returnTo }: Props) {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const myId = currentUserId;
  const isLoggedIn = !!getToken();

  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 수정
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editRating, setEditRating] = useState(0);
  const [saving, setSaving] = useState(false);

  // 독후감 상세 + 좋아요 상태 로드
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [reviewRes] = await Promise.all([
          fetch(`${BASE}/api/reviews/${reviewId}`, { cache: "no-store" }),
        ]);
        if (reviewRes.ok) {
          const json = await reviewRes.json();
          const data: ReviewDetail = json.data ?? json;
          setReview(data);
          setLikeCount(data.likeCount);
          onEngagementChange?.({ likeCount: data.likeCount, commentCount: data.commentCount });
          if (!data.hidden) {
            loadComments();
          }
        }
      } finally {
        setLoading(false);
      }

      const token = getToken();
      if (token) {
        authFetch(`${BASE}/api/users/me`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((json) => {
            const me = (json?.data ?? json) as Me | null;
            setCurrentUserId(me?.id ?? null);
          })
          .catch(() => setCurrentUserId(null));

        // 좋아요 상태
        authFetch(`${BASE}/api/reviews/${reviewId}/like/status`)
          .then((r) => (r.ok ? r.json() : null))
          .then((json) => { if (json !== null) setLiked(Boolean(json.data ?? json)); })
          .catch(() => {});
      }
    }
    load();
  }, [reviewId]);

  // 팔로우 상태 로드 (작성자가 확인되면)
  useEffect(() => {
    if (!review?.author.id || !myId || myId === review.author.id) return;
    const token = getToken();
    if (!token) return;
    authFetch(`${BASE}/api/users/${review.author.id}/follow/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (json !== null) setFollowing(Boolean(json.data ?? json)); })
      .catch(() => {});
  }, [review?.author.id, myId]);

  async function loadComments() {
    const res = await fetch(`${BASE}/api/reviews/${reviewId}/comments`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      const nextComments = json.data ?? json;
      setComments(nextComments);
      onEngagementChange?.({ likeCount, commentCount: nextComments.length, liked });
    }
  }

  async function handleLike() {
    if (!getToken()) { router.push("/auth/login"); return; }
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    const res = await authFetch(`${BASE}/api/reviews/${reviewId}/like`, {
      method: next ? "POST" : "DELETE",
    });
    if (res.status === 401) {
      setLiked(!next); setLikeCount((c) => c + (next ? -1 : 1));
       router.push("/auth/login");
    } else if (!res.ok) {
      setLiked(!next); setLikeCount((c) => c + (next ? -1 : 1));
    } else {
      onEngagementChange?.({ likeCount: likeCount + (next ? 1 : -1), commentCount: comments.length, liked: next });
    }
  }

  async function handleFollow() {
    if (!review?.author.id) return;
    if (!getToken()) { router.push("/auth/login"); return; }
    setFollowLoading(true);
    const next = !following;
    setFollowing(next);
    try {
      const res = await authFetch(`${BASE}/api/users/${review.author.id}/follow`, {
        method: next ? "POST" : "DELETE",
      });
      if (res.status === 401) {
        setFollowing(!next);  router.push("/auth/login");
      } else if (!res.ok) {
        setFollowing(!next);
      }
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoggedIn) { router.push("/auth/login"); return; }
    const trimmed = commentText.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`${BASE}/api/reviews/${reviewId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.status === 401) {
         router.push("/auth/login"); return;
      }
      if (res.ok) {
        setCommentText("");
        await loadComments();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSave() {
    if (!review || saving) return;
    setSaving(true);
    try {
      const res = await authFetch(`${BASE}/api/reviews/${review.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent, rating: editRating }),
      });
      if (res.ok) {
        setReview((prev) => prev ? { ...prev, content: editContent, rating: editRating } : prev);
        setEditing(false);
      } else if (res.status === 401) {
         router.push("/auth/login");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCommentDelete(commentId: number) {
    const res = await authFetch(`${BASE}/api/reviews/${reviewId}/comments/${commentId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setComments((prev) => {
        const nextComments = prev.filter((c) => c.id !== commentId);
        onEngagementChange?.({ likeCount, commentCount: nextComments.length, liked });
        return nextComments;
      });
    }
  }

  return (
    <>
      <ReviewViewTracker reviewId={reviewId} />
      <ModalShell title="독후감" onClose={onClose} className="sm:max-w-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200 flex-shrink-0">
          <span className="font-serif font-bold text-brown-800 text-sm">독후감</span>
          <div className="flex items-center gap-3">
            {review && !review.hidden && (
              <Link
                href={
                  returnTo
                    ? `/reviews/${reviewId}?${new URLSearchParams({ returnTo }).toString()}`
                    : `/reviews/${reviewId}`
                }
                onClick={onClose}
                className="text-xs text-brown-400 hover:text-brown-700 transition-colors"
              >
                공개 페이지
              </Link>
            )}
            {!loading && review && myId === review.author.id && !editing && (
              <button
                onClick={() => router.push(`/write?reviewId=${review.id}`)}
                className="text-xs text-brown-400 hover:text-brown-700 transition-colors"
              >
                수정
              </button>
            )}
            <button onClick={onClose} className="cdj-icon-button" aria-label="닫기"><X size={20} strokeWidth={1.75} aria-hidden="true" /></button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center"><LoadingState label="독후감을 불러오는 중" /></div>
        ) : !review ? (
          <div className="flex-1 flex items-center justify-center text-brown-400 text-sm">독후감을 불러올 수 없습니다.</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* 책 정보 + 작성자 */}
            <div className="px-5 py-4 flex gap-4 border-b border-cream-100">
              {review.book?.thumbnail ? (
                <img
                  src={review.book.thumbnail}
                  alt={review.book.title}
                  className="h-[84px] w-14 flex-shrink-0 rounded-[3px] object-cover shadow-[0_4px_12px_-4px_rgb(16_42_44/22%)]"
                />
              ) : (
                <div className="w-14 h-20 rounded shadow-sm flex-shrink-0 bg-brown-200 flex items-center justify-center text-white font-bold">
                  {review.book?.title?.[0] ?? ""}
                </div>
              )}
              <div className="flex-1 min-w-0">
                {review.book && (
                  <>
                    <p className="font-serif font-bold text-brown-800 leading-snug">{review.book.title}</p>
                    <p className="text-xs text-brown-400 mt-0.5">{review.book.author}</p>
                  </>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <ProfileAvatar src={review.author.profileImage} name={review.author.nickname} size="xs" />
                  {review.author.id != null ? (
                    <Link
                      href={`/u/${encodeURIComponent(review.author.nickname)}`}
                      onClick={onClose}
                      className="text-xs font-semibold text-brown-600 hover:underline"
                    >
                      {review.author.nickname}
                    </Link>
                  ) : (
                    <span className="text-xs font-semibold text-brown-600">
                      {review.author.nickname}
                    </span>
                  )}
                  {isLoggedIn && review.author.id != null && myId !== review.author.id && (
                    <button
                      onClick={handleFollow}
                      disabled={followLoading}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${
                        following
                          ? "border-brown-300 text-brown-400 hover:border-red-300 hover:text-red-400"
                          : "border-brown-400 text-brown-600 hover:bg-cream-100"
                      }`}
                    >
                      {following ? "팔로잉" : "팔로우"}
                    </button>
                  )}
                  <time className="text-xs text-brown-300 ml-auto">{review.createdAt.slice(0, 10)}</time>
                </div>
                <div className="mt-1">
                  {editing
                    ? <StarInput rating={editRating} onChange={setEditRating} size={20} />
                    : <StarRating rating={review.rating} />
                  }
                </div>
              </div>
            </div>

            {/* 본문 전체 */}
            <div className="px-5 py-4 border-b border-cream-100">
              {editing ? (
                <>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={10}
                    className="cdj-field resize-none text-[15px] leading-7"
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2 justify-end">
                    <button
                      onClick={() => setEditing(false)}
                      className="cdj-button cdj-button--ghost cdj-button--sm"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !editContent.trim()}
                      className="cdj-button cdj-button--primary cdj-button--sm"
                    >
                      {saving ? "저장 중…" : "저장"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="whitespace-pre-wrap text-[15px] leading-[1.85] text-brown-900">{review.content}</p>
              )}
            </div>

            {/* 좋아요 */}
            <div className="px-5 py-3 flex items-center gap-4 border-b border-cream-100">
              <button
                onClick={handleLike}
                className="flex items-center gap-1.5 text-sm group transition-colors"
                aria-label={liked ? "좋아요 취소" : "좋아요"}
              >
                <Heart size={18} strokeWidth={1.75} className={liked ? "fill-wine-500 text-wine-500" : "text-sage-600 group-hover:text-wine-500"} aria-hidden="true" />
                <span className={`text-sm font-medium tabular ${liked ? "text-wine-500" : "text-sage-600"}`}>{likeCount}</span>
              </button>
              <span className="flex items-center gap-1.5 text-sm font-medium text-sage-600"><MessageCircle size={18} strokeWidth={1.75} aria-hidden="true" /><span className="tabular">{comments.length}</span></span>
            </div>

            {/* 댓글 목록 */}
            <div className="px-5 py-3 space-y-4">
              {comments.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-sage-600">아직 댓글이 없어요. 첫 댓글을 남겨보세요</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <ProfileAvatar src={c.author.profileImage} name={c.author.nickname} size="xs" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-brown-600 mr-2">{c.author.nickname}</span>
                      <span className="text-xs text-brown-300 mr-2">{c.createdAt.slice(0, 10)}</span>
                      <p className="text-sm text-brown-700 mt-0.5 leading-relaxed">{c.content}</p>
                    </div>
                    {myId === c.author.id && (
                      <button
                        onClick={() => handleCommentDelete(c.id)}
                        className="flex-shrink-0 text-xs text-red-400 hover:text-red-600"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 댓글 입력창 */}
        <form
          onSubmit={handleCommentSubmit}
          className="flex flex-shrink-0 items-end gap-2 border-t border-cream-300 bg-cream-50 px-4 py-3"
        >
          {isLoggedIn ? (
            <>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleCommentSubmit(e as unknown as React.FormEvent);
                  }
                }}
                placeholder="댓글을 입력하세요" aria-label="댓글 입력"
                rows={1}
                disabled={submitting}
                className="cdj-field flex-1 resize-none text-sm"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || submitting}
                className="cdj-button cdj-button--primary"
              >
                등록
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/auth/login")}
              className="cdj-button cdj-button--secondary flex-1"
            >
              로그인하고 댓글 남기기
            </button>
          )}
        </form>
      </ModalShell>
    </>
  );
}
