"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProfileAvatar from "./ProfileAvatar";
import { API_BASE } from "../lib/api";
import { authFetch } from "../lib/auth";

const BASE = API_BASE;

type Comment = {
  id: number;
  author: { id: number | null; nickname: string; profileImage: string | null };
  content: string;
  createdAt: string;
};

type Me = {
  id: number;
};

type ReviewResponse = {
  likeCount: number;
  commentCount: number;
};

type Props = {
  reviewId: number;
  initialLikeCount: number;
  initialCommentCount: number;
};

export default function ReviewEngagement({
  reviewId,
  initialLikeCount,
  initialCommentCount,
}: Props) {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const loadComments = useCallback(async () => {
    const res = await fetch(`${BASE}/api/reviews/${reviewId}/comments`, { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    const nextComments = (json.data ?? json) as Comment[];
    setComments(nextComments);
    setCommentCount(nextComments.length);
  }, [reviewId]);

  useEffect(() => {
    authFetch(`${BASE}/api/users/me`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const me = (json?.data ?? json) as Me | null;
        setCurrentUserId(me?.id ?? null);
      })
      .catch(() => {});

    authFetch(`${BASE}/api/reviews/${reviewId}/like/status`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json !== null) setLiked(Boolean(json.data ?? json));
      })
      .catch(() => {});

    fetch(`${BASE}/api/reviews/${reviewId}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const review = (json?.data ?? json) as ReviewResponse | null;
        if (!review) return;
        setLikeCount(review.likeCount);
        setCommentCount(review.commentCount);
      })
      .catch(() => {});

    loadComments();
  }, [reviewId, loadComments]);

  async function handleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((count) => count + (next ? 1 : -1));

    const res = await authFetch(`${BASE}/api/reviews/${reviewId}/like`, {
      method: next ? "POST" : "DELETE",
    });

    if (res.status === 401) {
      setLiked(!next);
      setLikeCount((count) => count + (next ? -1 : 1));
      router.push("/auth/login");
      return;
    }

    if (!res.ok) {
      setLiked(!next);
      setLikeCount((count) => count + (next ? -1 : 1));
    }
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        router.push("/auth/login");
        return;
      }

      if (res.ok) {
        setCommentText("");
        await loadComments();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCommentDelete(commentId: number) {
    const res = await authFetch(`${BASE}/api/reviews/${reviewId}/comments/${commentId}`, {
      method: "DELETE",
    });
    if (res.status === 401) {
      router.push("/auth/login");
      return;
    }
    if (res.ok) await loadComments();
  }

  return (
    <section className="mt-7 pt-5 border-t border-cream-200">
      <div className="flex flex-wrap items-center gap-4 text-sm text-brown-400">
        <button
          type="button"
          onClick={handleLike}
          className="flex items-center gap-1.5 transition-colors group"
          aria-label={liked ? "좋아요 취소" : "좋아요"}
        >
          <span className={`text-lg leading-none ${liked ? "text-red-500" : "text-brown-300 group-hover:text-red-400"}`}>
            {liked ? "♥" : "♡"}
          </span>
          <span className={liked ? "text-red-500" : "text-brown-400"}>{likeCount}</span>
        </button>
        <span>댓글 {commentCount}</span>
      </div>

      <div className="mt-5 space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-brown-300">첫 댓글을 남겨보세요</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-2">
              <ProfileAvatar src={comment.author.profileImage} name={comment.author.nickname} size="xs" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-brown-600">{comment.author.nickname}</span>
                  <span className="text-xs text-brown-300">{comment.createdAt.slice(0, 10)}</span>
                </div>
                <p className="mt-0.5 text-sm leading-relaxed text-brown-700">{comment.content}</p>
              </div>
              {currentUserId !== null && currentUserId === comment.author.id && (
                <button
                  type="button"
                  onClick={() => handleCommentDelete(comment.id)}
                  className="flex-shrink-0 text-xs text-red-400 hover:text-red-600"
                >
                  삭제
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleCommentSubmit} className="mt-5 flex gap-2 items-end">
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          rows={1}
          disabled={submitting}
          placeholder="댓글을 입력하세요..."
          className="min-h-10 flex-1 resize-none rounded-lg border border-cream-200 px-3 py-2 text-sm text-brown-700 placeholder:text-brown-300 focus:outline-none focus:border-brown-400 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!commentText.trim() || submitting}
          className="rounded-lg bg-brown-700 px-4 py-2 text-sm text-white hover:bg-brown-800 disabled:opacity-40"
        >
          등록
        </button>
      </form>
    </section>
  );
}
