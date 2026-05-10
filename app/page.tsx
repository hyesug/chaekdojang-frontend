"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PostCard, { type Post } from "./components/PostCard";

const BASE = "http://localhost:8080";

type FeedTab = "all" | "following";

/* 백엔드 연결 전 보여줄 샘플 데이터 */
const MOCK_POSTS: Post[] = [
  {
    id: 1,
    author: { nickname: "이서연", profileImage: null },
    book: { title: "채식주의자", author: "한강", thumbnail: null },
    rating: 5,
    content:
      "한강 작가의 문장은 언제나 나를 멈추게 한다. 이 책을 읽고 나서 한동안 아무 말도 하지 못했다. 채식을 선택한 영혜의 이야기지만, 결국 이것은 자유에 대한 이야기이고, 폭력에 대한 이야기다.",
    likeCount: 12,
    commentCount: 3,
    createdAt: "2026-05-03",
  },
  {
    id: 2,
    author: { nickname: "김민준", profileImage: null },
    book: { title: "아몬드", author: "손원평", thumbnail: null },
    rating: 4,
    content:
      "감정을 느끼지 못하는 소년 윤재의 이야기. 처음에는 낯설고 어색했지만, 읽어나갈수록 이 소년이 배워가는 '감정'이 내게도 전해지는 느낌이었다.",
    likeCount: 7,
    commentCount: 1,
    createdAt: "2026-04-28",
  },
  {
    id: 3,
    author: { nickname: "박지유", profileImage: null },
    book: { title: "달러구트 꿈 백화점", author: "이미예", thumbnail: null },
    rating: 4,
    content:
      "꿈을 파는 백화점이라는 아이디어가 정말 신선하다. 각 에피소드마다 따뜻한 이야기가 담겨 있어서 지친 하루 끝에 읽기 딱 좋은 책이었다.",
    likeCount: 5,
    commentCount: 0,
    createdAt: "2026-04-20",
  },
];

export default function FeedPage() {
  const [tab, setTab] = useState<FeedTab>("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  /* 로그인 상태 동기화 */
  useEffect(() => {
    function syncAuth() {
      const token = localStorage.getItem("token");
      setLoggedIn(!!token && token !== "undefined" && token !== "null");
    }
    syncAuth();
    window.addEventListener("auth-change", syncAuth);
    return () => window.removeEventListener("auth-change", syncAuth);
  }, []);

  /* 탭이 바뀔 때마다 피드 다시 로드 */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const token = localStorage.getItem("token");
      const hasToken = !!token && token !== "undefined" && token !== "null";

      try {
        if (tab === "following") {
          if (!hasToken) {
            if (!cancelled) setPosts([]);
            return;
          }
          const res = await fetch(`${BASE}/api/reviews/feed`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancelled) {
            if (res.ok) {
              const json = await res.json();
              setPosts(json.data ?? []);
            } else {
              setPosts([]);
            }
          }
        } else {
          const res = await fetch(`${BASE}/api/reviews`);
          if (!cancelled) {
            if (res.ok) {
              const json = await res.json();
              setPosts(json.data ?? MOCK_POSTS);
            } else {
              setPosts(MOCK_POSTS);
            }
          }
        }
      } catch {
        if (!cancelled) setPosts(tab === "all" ? MOCK_POSTS : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 피드 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-brown-800">피드</h1>
          <p className="text-xs text-brown-400 mt-0.5">이웃의 독후감</p>
        </div>
        <Link
          href="/write"
          className="px-4 py-2 text-sm bg-brown-600 text-white rounded-full hover:bg-brown-700 transition-colors"
        >
          + 독후감 쓰기
        </Link>
      </div>

      {/* 탭: 전체 / 팔로잉 */}
      <div className="flex gap-1 mb-6 bg-cream-200 rounded-xl p-1">
        {(
          [
            { value: "all", label: "📚 전체" },
            { value: "following", label: "❤️ 팔로잉" },
          ] as const
        ).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              tab === value
                ? "bg-white text-brown-800 shadow-sm"
                : "text-brown-400 hover:text-brown-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="text-center py-12 text-brown-400">불러오는 중...</div>
      )}

      {/* 팔로잉 탭 — 미로그인 안내 */}
      {!loading && tab === "following" && !loggedIn && (
        <div className="text-center py-16 text-brown-400">
          <p className="text-4xl mb-3">🔒</p>
          <p className="font-medium text-brown-600 mb-1">
            팔로잉 피드는 로그인 후 이용할 수 있어요
          </p>
          <p className="text-sm mb-6">팔로우한 사람들의 독후감만 모아볼 수 있어요</p>
          <Link
            href="/auth/login"
            className="inline-block px-6 py-2.5 bg-brown-600 text-white rounded-full text-sm font-medium hover:bg-brown-700 transition-colors"
          >
            로그인하기
          </Link>
        </div>
      )}

      {/* 독후감 목록 */}
      {!loading && posts.length > 0 && (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && posts.length === 0 && !(tab === "following" && !loggedIn) && (
        <div className="text-center py-24 text-brown-400">
          <p className="text-5xl mb-4">📖</p>
          <p className="font-medium">
            {tab === "following"
              ? "팔로우한 사람의 독후감이 없어요"
              : "아직 독후감이 없어요"}
          </p>
          {tab === "all" && <p className="text-sm mt-2">첫 독후감을 작성해보세요!</p>}
        </div>
      )}
    </div>
  );
}
