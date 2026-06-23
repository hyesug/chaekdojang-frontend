"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProfileAvatar from "./ProfileAvatar";
import ReviewViewTracker from "./ReviewViewTracker";
import { API_BASE } from "../lib/api";

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

function Stars({ rating }: { rating: number }) {
  return (
    <span>
      <span className="text-amber-500">{"★".repeat(rating)}</span>
      <span className="text-cream-300">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function EditableStars({ rating, onChange }: { rating: number; onChange: (r: number) => void }) {
  return (
    <span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`text-base leading-none transition-colors ${n <= rating ? "text-amber-500" : "text-cream-300 hover:text-amber-300"}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

type Props = {
  reviewId: number;
  onClose: () => void;
};

export default function ReviewDetailModal({ reviewId, onClose }: Props) {
  const router = useRouter();
  const myId = getMyUserId();
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
        const token = getToken();
        const [reviewRes] = await Promise.all([
          fetch(`${BASE}/api/reviews/${reviewId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }),
        ]);
        if (reviewRes.ok) {
          const json = await reviewRes.json();
          const data: ReviewDetail = json.data ?? json;
          setReview(data);
          setLikeCount(data.likeCount);
          if (!data.hidden) {
            loadComments();
          }
        }
      } finally {
        setLoading(false);
      }

      const token = getToken();
      if (token) {
        // 좋아요 상태
        fetch(`${BASE}/api/reviews/${reviewId}/like/status`, {
          headers: { Authorization: `Bearer ${token}` },
        })
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
    fetch(`${BASE}/api/users/${review.author.id}/follow/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (json !== null) setFollowing(Boolean(json.data ?? json)); })
      .catch(() => {});
  }, [review?.author.id, myId]);

  async function loadComments() {
    const res = await fetch(`${BASE}/api/reviews/${reviewId}/comments`);
    if (res.ok) {
      const json = await res.json();
      setComments(json.data ?? json);
    }
  }

  async function handleLike() {
    if (!getToken()) { router.push("/auth/login"); return; }
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    const res = await fetch(`${BASE}/api/reviews/${reviewId}/like`, {
      method: next ? "POST" : "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.status === 401) {
      setLiked(!next); setLikeCount((c) => c + (next ? -1 : 1));
      localStorage.removeItem("token"); router.push("/auth/login");
    } else if (!res.ok) {
      setLiked(!next); setLikeCount((c) => c + (next ? -1 : 1));
    }
  }

  async function handleFollow() {
    if (!review?.author.id) return;
    if (!getToken()) { router.push("/auth/login"); return; }
    setFollowLoading(true);
    const next = !following;
    setFollowing(next);
    try {
      const res = await fetch(`${BASE}/api/users/${review.author.id}/follow`, {
        method: next ? "POST" : "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) {
        setFollowing(!next); localStorage.removeItem("token"); router.push("/auth/login");
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
      const res = await fetch(`${BASE}/api/reviews/${reviewId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.status === 401) {
        localStorage.removeItem("token"); router.push("/auth/login"); return;
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
      const res = await fetch(`${BASE}/api/reviews/${review.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ content: editContent, rating: editRating }),
      });
      if (res.ok) {
        setReview((prev) => prev ? { ...prev, content: editContent, rating: editRating } : prev);
        setEditing(false);
      } else if (res.status === 401) {
        localStorage.removeItem("token"); router.push("/auth/login");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCommentDelete(commentId: number) {
    const res = await fetch(`${BASE}/api/reviews/${reviewId}/comments/${commentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <ReviewViewTracker reviewId={reviewId} />
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200 flex-shrink-0">
          <span className="font-serif font-bold text-brown-800 text-sm">독후감</span>
          <div className="flex items-center gap-3">
            {review && !review.hidden && (
              <Link
                href={`/reviews/${reviewId}`}
                onClick={onClose}
                className="text-xs text-brown-400 hover:text-brown-700 transition-colors"
              >
                공개 페이지
              </Link>
            )}
            {!loading && review && myId === review.author.id && !editing && (
              <button
                onClick={() => { setEditContent(review.content); setEditRating(review.rating); setEditing(true); }}
                className="text-xs text-brown-400 hover:text-brown-700 transition-colors"
              >
                수정
              </button>
            )}
            <button onClick={onClose} className="text-brown-400 hover:text-brown-600 text-xl leading-none">✕</button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-brown-400 text-sm">불러오는 중…</div>
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
                  className="w-14 h-20 rounded shadow-sm object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-20 rounded shadow-sm flex-shrink-0 bg-brown-200 flex items-center justify-center text-white font-bold">
                  {review.book?.title?.[0] ?? "📖"}
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
                      href={`/users/${review.author.id}`}
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
                    ? <EditableStars rating={editRating} onChange={setEditRating} />
                    : <Stars rating={review.rating} />
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
                    className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-700 focus:outline-none focus:border-brown-400 resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2 justify-end">
                    <button
                      onClick={() => setEditing(false)}
                      className="px-3 py-1.5 text-xs text-brown-500 bg-cream-100 rounded-lg hover:bg-cream-200 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !editContent.trim()}
                      className="px-3 py-1.5 text-xs text-white bg-brown-600 rounded-lg hover:bg-brown-700 disabled:opacity-40 transition-colors"
                    >
                      {saving ? "저장 중…" : "저장"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-brown-700 leading-relaxed whitespace-pre-wrap">{review.content}</p>
              )}
            </div>

            {/* 좋아요 */}
            <div className="px-5 py-3 flex items-center gap-4 border-b border-cream-100">
              <button
                onClick={handleLike}
                className="flex items-center gap-1.5 text-sm group transition-colors"
                aria-label={liked ? "좋아요 취소" : "좋아요"}
              >
                <span className={`text-lg leading-none transition-colors ${liked ? "text-red-500" : "text-brown-300 group-hover:text-red-400"}`}>
                  {liked ? "♥" : "♡"}
                </span>
                <span className={liked ? "text-red-500 text-sm" : "text-brown-400 text-sm"}>{likeCount}</span>
              </button>
              <span className="text-sm text-brown-400">💬 {comments.length}</span>
            </div>

            {/* 댓글 목록 */}
            <div className="px-5 py-3 space-y-4">
              {comments.length === 0 ? (
                <p className="text-center text-xs text-brown-300 py-4">첫 댓글을 남겨보세요</p>
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
          className="px-5 py-3 border-t border-cream-200 flex gap-2 items-end flex-shrink-0 bg-white"
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
                placeholder="댓글을 입력하세요…"
                rows={1}
                disabled={submitting}
                className="flex-1 resize-none rounded-xl border border-cream-200 px-3 py-2 text-sm text-brown-700 placeholder:text-brown-300 focus:outline-none focus:border-brown-400 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || submitting}
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
