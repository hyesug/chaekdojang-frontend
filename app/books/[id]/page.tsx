"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import ReviewCard, { type Review } from "../../components/ReviewCard";
import { API_BASE } from "../../lib/api";

const BASE = API_BASE;

type Book = {
  id: number;
  title: string;
  author: string;
  publisher: string;
  thumbnail: string | null;
  category: string | null;
};

type LibraryStatus = "READING" | "FINISHED" | "WISHLIST";

type LibraryState = {
  inLibrary: boolean;
  status: LibraryStatus | null;
  libraryId: number | null;
};

type PurchaseLink = {
  id: number | null;
  provider: "COUPANG" | "KYOBO";
  url: string;
};

const STATUS_LABELS: Record<LibraryStatus, string> = {
  READING: "읽는 중",
  FINISHED: "완독",
  WISHLIST: "읽고 싶다",
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = Number(params.id);

  const [book, setBook] = useState<Book | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [purchaseLinks, setPurchaseLinks] = useState<PurchaseLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [libraryState, setLibraryState] = useState<LibraryState>({
    inLibrary: false,
    status: null,
    libraryId: null,
  });
  const [showLibraryMenu, setShowLibraryMenu] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);

  useEffect(() => {
    if (!bookId) return;

    const token = getToken();
    const fetches: Promise<void>[] = [
      fetch(`${BASE}/api/books/${bookId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => { if (json) setBook(json.data ?? json); }),
      fetch(`${BASE}/api/books/${bookId}/reviews`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => { if (json) setReviews(json.data ?? []); }),
      fetch(`${BASE}/api/books/${bookId}/purchase-links`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => { if (json) setPurchaseLinks(json.data ?? []); }),
    ];

    if (token) {
      fetches.push(
        fetch(`${BASE}/api/library/books/${bookId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((json) => {
            if (json) {
              const d = json.data ?? json;
              setLibraryState({
                inLibrary: d.inLibrary,
                status: d.status ?? null,
                libraryId: d.libraryId ?? null,
              });
            }
          })
      );
    }

    Promise.all(fetches)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookId]);

  async function handleAddToLibrary(status: LibraryStatus) {
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }
    setLibraryLoading(true);
    setShowLibraryMenu(false);
    try {
      if (libraryState.inLibrary && libraryState.libraryId) {
        // 이미 담겨 있으면 상태 변경
        const res = await fetch(`${BASE}/api/library/${libraryState.libraryId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        });
        if (res.ok) setLibraryState((prev) => ({ ...prev, status }));
      } else {
        // 새로 추가
        const res = await fetch(`${BASE}/api/library`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ bookId, status }),
        });
        if (res.ok) {
          const json = await res.json();
          const d = json.data ?? json;
          setLibraryState({ inLibrary: true, status, libraryId: d.id });
        }
      }
    } catch {
      /* 무시 */
    } finally {
      setLibraryLoading(false);
    }
  }

  async function handleRemoveFromLibrary() {
    const token = getToken();
    if (!token || !libraryState.libraryId) return;
    setLibraryLoading(true);
    setShowLibraryMenu(false);
    try {
      const res = await fetch(`${BASE}/api/library/${libraryState.libraryId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok || res.status === 204) {
        setLibraryState({ inLibrary: false, status: null, libraryId: null });
      }
    } catch {
      /* 무시 */
    } finally {
      setLibraryLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-brown-400">
        불러오는 중...
      </div>
    );
  }

  if (!book) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-brown-400">
        <p className="text-4xl mb-3">📚</p>
        <p>책 정보를 찾을 수 없습니다.</p>
        <Link href="/search" className="inline-block mt-4 text-sm text-brown-500 underline">
          책 검색하기
        </Link>
      </div>
    );
  }

  const encodedTitle = encodeURIComponent(book.title);
  const isLoggedIn = !!getToken();
  const providerLabels: Record<PurchaseLink["provider"], string> = {
    COUPANG: "쿠팡에서 보기",
    KYOBO: "교보문고에서 보기",
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 책 정보 카드 */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6 mb-8 flex gap-5">
        {book.thumbnail ? (
          <Image
            src={book.thumbnail}
            alt={book.title}
            width={80}
            height={112}
            className="rounded shadow-md object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-20 h-28 rounded shadow-md flex-shrink-0 bg-brown-200 flex items-center justify-center text-white text-2xl font-bold">
            {book.title[0]}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-xl font-bold text-brown-800 leading-snug mb-1">
            {book.title}
          </h1>
          <p className="text-sm text-brown-500">{book.author}</p>
          <p className="text-xs text-brown-300 mt-0.5">{book.publisher}</p>
          {book.category && (
            <span className="inline-block mt-2 px-2 py-0.5 bg-cream-200 text-brown-500 text-xs rounded-full">
              {book.category}
            </span>
          )}

          {/* 구매 링크 — 백엔드 /api/books/{id}/purchase-links 에서 반환 */}
          <div className="flex gap-3 mt-4">
            {purchaseLinks.map((link, index) => (
              <span key={link.provider} className="contents">
                {index > 0 && <span className="text-brown-200 text-xs">|</span>}
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brown-400 hover:text-brown-600 hover:underline transition-colors"
                >
                  {providerLabels[link.provider]} →
                </a>
              </span>
            ))}
          </div>

          {/* 버튼 영역 */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {/* 독후감 쓰기 버튼 */}
            <Link
              href={`/write?bookId=${book.id}&title=${encodedTitle}&author=${encodeURIComponent(book.author)}&publisher=${encodeURIComponent(book.publisher)}${book.thumbnail ? `&thumbnail=${encodeURIComponent(book.thumbnail)}` : ""}`}
              className="px-4 py-1.5 bg-brown-600 text-white text-xs rounded-full hover:bg-brown-700 transition-colors"
            >
              독후감 쓰기
            </Link>

            {/* 서재 담기 버튼 — 로그인 시에만 */}
            {isLoggedIn && (
              <div className="relative">
                <button
                  onClick={() => setShowLibraryMenu((v) => !v)}
                  disabled={libraryLoading}
                  className={`px-4 py-1.5 text-xs rounded-full border transition-colors disabled:opacity-50 ${
                    libraryState.inLibrary
                      ? "bg-cream-200 text-brown-700 border-brown-300 hover:bg-cream-300"
                      : "bg-white text-brown-600 border-brown-300 hover:bg-cream-100"
                  }`}
                >
                  {libraryLoading
                    ? "처리 중..."
                    : libraryState.inLibrary && libraryState.status
                    ? `📚 ${STATUS_LABELS[libraryState.status]} ▾`
                    : "📚 서재 담기 ▾"}
                </button>

                {showLibraryMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowLibraryMenu(false)}
                    />
                    <div className="absolute left-0 top-full mt-1 z-20 bg-white rounded-xl border border-cream-200 shadow-lg overflow-hidden w-36">
                      {(["READING", "FINISHED", "WISHLIST"] as LibraryStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => handleAddToLibrary(s)}
                          className={`w-full px-4 py-2.5 text-xs text-left hover:bg-cream-100 transition-colors ${
                            libraryState.status === s ? "text-brown-800 font-semibold bg-cream-50" : "text-brown-600"
                          }`}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                      {libraryState.inLibrary && (
                        <button
                          onClick={handleRemoveFromLibrary}
                          className="w-full px-4 py-2.5 text-xs text-left text-red-400 hover:bg-red-50 transition-colors border-t border-cream-200"
                        >
                          서재에서 제거
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 채팅방 입장 버튼 — v1.0 이후 오픈 예정 */}
      {/* <Link href={`/chat/${bookId}`} ...> */}

      {/* 독후감 목록 */}
      <h2 className="font-serif text-lg font-bold text-brown-800 mb-4">
        이 책을 읽은 사람들의 독후감
        {reviews.length > 0 && (
          <span className="ml-2 text-sm font-normal text-brown-400">{reviews.length}개</span>
        )}
      </h2>

      {reviews.length === 0 ? (
        <div className="text-center py-16 text-brown-400">
          <p className="text-4xl mb-3">✏️</p>
          <p>아직 독후감이 없어요</p>
          <p className="text-sm mt-1">첫 번째 독후감을 남겨보세요!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} post={review} />
          ))}
        </div>
      )}
    </div>
  );
}
