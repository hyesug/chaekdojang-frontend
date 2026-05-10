"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type Post = {
  id: number;
  author: { id?: number; nickname: string; profileImage: string | null };
  book?: { title: string; author: string; thumbnail: string | null } | null;
  rating: number;
  content: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
};

type Comment = {
  id: number;
  author: { id: number; nickname: string; profileImage: string | null };
  content: string;
  createdAt: string;
};

const BASE = "http://localhost:8080";

const COVER_COLORS = [
  "#8B6048", "#6E7A4A", "#4A6E7A", "#7A4A6E", "#6E4A7A", "#4A7A6E",
];

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

/**
 * JWT payload를 디코딩해서 현재 로그인한 사용자의 id를 꺼낸다.
 * 백엔드가 sub / id / userId 중 하나에 담는다고 가정.
 */
function getMyUserId(): number | null {
  const token = getToken();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // base64url → base64 변환 후 디코딩
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
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCountChange(-1);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* 반투명 배경 — 클릭하면 닫힘 */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col shadow-xl">
        {/* 헤더 */}
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

        {/* 댓글 목록 */}
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
                {/* 내가 쓴 댓글에만 삭제 버튼 표시 */}
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

        {/* 입력창 */}
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
                  // Shift+Enter는 줄바꿈, Enter만 누르면 제출
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
// 피드 카드
// ─────────────────────────────────────────────
export default function PostCard({ post }: { post: Post }) {
  const coverColor = COVER_COLORS[post.id % COVER_COLORS.length];
  const router = useRouter();

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [showComments, setShowComments] = useState(false);

  // 카드가 마운트될 때 내 좋아요 여부 조회
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${BASE}/api/reviews/${post.id}/like/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json !== null) {
          // 백엔드가 { data: true } 또는 그냥 true 형태로 줄 수 있음
          setLiked(Boolean(json.data ?? json));
        }
      })
      .catch(() => {});
  }, [post.id]);

  async function handleLike() {
    if (!getToken()) {
      router.push("/auth/login");
      return;
    }

    // 낙관적 업데이트: 요청 전에 먼저 UI에 반영
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));

    const res = await fetch(`${BASE}/api/reviews/${post.id}/like`, {
      method: next ? "POST" : "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    // 요청 실패 시 원래대로 되돌리기
    if (!res.ok) {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    }
  }

  return (
    <>
      <article className="bg-white rounded-2xl border border-cream-200 p-5 hover:shadow-md transition-shadow">
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
            {/* 작성자 + 날짜 */}
            <div className="flex items-center justify-between mb-1">
              {post.author.id != null ? (
                <Link
                  href={`/users/${post.author.id}`}
                  className="text-xs text-brown-400 font-medium hover:text-brown-700 hover:underline transition-colors"
                >
                  {post.author.nickname}
                </Link>
              ) : (
                <span className="text-xs text-brown-400 font-medium">
                  {post.author.nickname}
                </span>
              )}
              <time className="text-xs text-brown-300" dateTime={post.createdAt}>
                {post.createdAt.slice(0, 7).replace("-", ".")}
              </time>
            </div>

            {/* 책 정보 — 백엔드가 book 필드를 주는 경우에만 표시 */}
            {post.book && (
              <>
                <p className="font-serif text-base font-bold text-brown-800 leading-snug">
                  {post.book.title}
                </p>
                <p className="text-xs text-brown-400 mb-1">{post.book.author}</p>
              </>
            )}
            <Stars rating={post.rating} />
          </div>
        </div>

        {/* 독후감 본문 — 3줄까지만 표시 */}
        <p className="mt-3 text-sm text-brown-600 leading-relaxed line-clamp-3">
          {post.content}
        </p>

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
        </div>
      </article>

      {/* 댓글 모달 — showComments가 true일 때만 렌더링 */}
      {showComments && (
        <CommentModal
          reviewId={post.id}
          onClose={() => setShowComments(false)}
          onCountChange={(delta) => setCommentCount((c) => c + delta)}
        />
      )}
    </>
  );
}
