"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../lib/api";
import { authFetch, getValidToken } from "../../lib/auth";
import BookSearchSelect from "./BookSearchSelect";

type GroupBookStatus = "UPCOMING" | "READING" | "COMPLETED";
type GroupBook = { id: number; title: string; bookId: number; status: GroupBookStatus; deadline: string | null };
type GroupMember = {
  id: number;
  userId: number;
  nickname: string;
  profileImage: string | null;
  role: "OWNER" | "MANAGER" | "MEMBER";
  status: "PENDING" | "APPROVED" | "REJECTED" | "BLOCKED";
  createdAt: string;
};
type JoinPolicy = "OPEN" | "APPROVAL";
type MyReview = {
  id: number;
  content: string;
  rating: number;
  hidden: boolean;
  attached: boolean;
  createdAt: string;
};

function getToken() {
  return getValidToken();
}

export default function GroupManageClient({ slug, manager, member, visibility, joinPolicy, notice, books }: { slug: string; manager: boolean; member: boolean; visibility: "PUBLIC" | "PRIVATE"; joinPolicy: JoinPolicy; notice: string | null; books: GroupBook[] }) {
  const router = useRouter();
  const [bookId, setBookId] = useState("");
  const [note, setNote] = useState("");
  const [noticeText, setNoticeText] = useState(notice ?? "");
  const [savedNotice, setSavedNotice] = useState(notice ?? "");
  const [noticeEditing, setNoticeEditing] = useState(!notice);
  const [groupBookId, setGroupBookId] = useState(books[0]?.id ? String(books[0].id) : "");
  const [selectedReviewId, setSelectedReviewId] = useState("");
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingMembers, setPendingMembers] = useState<GroupMember[]>([]);
  const [approvedMembers, setApprovedMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!manager) return;
    const token = getToken();
    if (!token) return;
    setMembersLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/groups/${slug}/members`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const members = (json.data ?? json) as GroupMember[];
      setPendingMembers(members.filter((item) => item.status === "PENDING"));
      setApprovedMembers(members.filter((item) => item.status === "APPROVED"));
    } catch {
      setPendingMembers([]);
      setApprovedMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [manager, slug]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    const nextNotice = notice ?? "";
    setSavedNotice(nextNotice);
    setNoticeText(nextNotice);
    setNoticeEditing(!nextNotice);
  }, [notice]);

  const loadMyReviews = useCallback(async () => {
    if (!member || !groupBookId) return;
    const token = getToken();
    if (!token) return;
    setReviewsLoading(true);
    setSelectedReviewId("");
    try {
      const res = await authFetch(`${API_BASE}/api/groups/${slug}/books/${groupBookId}/my-reviews`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setMyReviews((json.data ?? json) as MyReview[]);
    } catch {
      setMyReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [groupBookId, member, slug]);

  useEffect(() => {
    loadMyReviews();
  }, [loadMyReviews]);

  async function addBook(event: React.FormEvent) {
    event.preventDefault();
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }
    if (!bookId.trim()) { setMessage("검색 결과에서 책을 선택해주세요."); return; }
    setLoading(true);
    setMessage("");
    try {
      const res = await authFetch(`${API_BASE}/api/groups/${slug}/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: Number(bookId), note: note.trim() || null }),
      });
      if (res.status === 401) { router.push("/auth/login"); return; }
      if (!res.ok) throw new Error(await res.text());
      setBookId("");
      setNote("");
      setMessage("선정 책을 추가했어요.");
      router.refresh();
    } catch {
      setMessage("책을 추가하지 못했어요. 권한이나 중복 등록 여부를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function updateNotice(event: React.FormEvent) {
    event.preventDefault();
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }
    setLoading(true);
    setMessage("");
    try {
      const res = await authFetch(`${API_BASE}/api/groups/${slug}/notice`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notice: noticeText.trim() || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const nextNotice = noticeText.trim();
      setSavedNotice(nextNotice);
      setNoticeText(nextNotice);
      setNoticeEditing(false);
      setMessage(savedNotice ? "모임장 공지를 수정했어요." : "모임장 공지를 등록했어요.");
      router.refresh();
    } catch {
      setMessage("모임장 공지를 저장하지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteNotice() {
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }
    if (!window.confirm("모임장 공지를 삭제할까요?")) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await authFetch(`${API_BASE}/api/groups/${slug}/notice`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notice: null }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSavedNotice("");
      setNoticeText("");
      setNoticeEditing(true);
      setMessage("모임장 공지를 삭제했어요.");
      router.refresh();
    } catch {
      setMessage("모임장 공지를 삭제하지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  async function updateBookProgress(event: React.FormEvent<HTMLFormElement>, groupBookId: number) {
    event.preventDefault();
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }
    const formData = new FormData(event.currentTarget);
    const status = String(formData.get("status")) as GroupBookStatus;
    const deadline = String(formData.get("deadline") ?? "");
    setLoading(true);
    setMessage("");
    try {
      const res = await authFetch(`${API_BASE}/api/groups/${slug}/books/${groupBookId}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, deadline: deadline || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage("책 진행 상태를 저장했어요.");
      router.refresh();
    } catch {
      setMessage("책 진행 상태를 저장하지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  async function attachReview(event: React.FormEvent) {
    event.preventDefault();
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }
    if (!groupBookId || !selectedReviewId) {
      setMessage("연결할 독후감을 선택해주세요.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await authFetch(`${API_BASE}/api/groups/${slug}/books/${groupBookId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: Number(selectedReviewId) }),
      });
      if (res.status === 401) { router.push("/auth/login"); return; }
      if (!res.ok) throw new Error(await res.text());
      setSelectedReviewId("");
      setMessage("독후감을 모임에 연결했어요.");
      await loadMyReviews();
      router.refresh();
    } catch {
      setMessage(visibility === "PRIVATE" ? "독후감을 연결하지 못했어요. 내 독후감이고 같은 책인지 확인해주세요." : "독후감을 연결하지 못했어요. 내 공개 독후감이고 같은 책인지 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function detachReview(reviewId: number) {
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }
    if (!groupBookId) return;
    if (!window.confirm("이 독후감 연결을 끊을까요? 독후감 원문은 삭제되지 않습니다.")) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await authFetch(`${API_BASE}/api/groups/${slug}/books/${groupBookId}/reviews/${reviewId}`, {
        method: "DELETE",
      });
      if (res.status === 401) { router.push("/auth/login"); return; }
      if (!res.ok) throw new Error(await res.text());
      setSelectedReviewId("");
      setMessage("독후감 연결을 끊었어요.");
      await loadMyReviews();
      router.refresh();
    } catch {
      setMessage("독후감 연결을 끊지 못했어요. 권한을 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function updateMember(memberId: number, action: "approve" | "reject" | "block") {
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }
    if (action === "block" && !window.confirm("이 사용자를 차단할까요? 차단하면 다시 가입 신청할 수 없습니다.")) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await authFetch(`${API_BASE}/api/groups/${slug}/members/${memberId}/${action}`, {
        method: "POST",
      });
      if (res.status === 401) { router.push("/auth/login"); return; }
      if (!res.ok) throw new Error(await res.text());
      setPendingMembers((members) => members.filter((member) => member.id !== memberId));
      setMessage(action === "approve" ? "가입 요청을 승인했어요." : action === "reject" ? "가입 요청을 거절했어요. 이 사용자는 다시 신청할 수 있어요." : "사용자를 차단했어요. 이 사용자는 다시 신청할 수 없어요.");
      await loadMembers();
      router.refresh();
    } catch {
      setMessage("멤버 상태를 변경하지 못했어요. 권한을 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  if (!manager && !member) return null;

  return (
    <section className="mt-8 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-lg font-bold text-brown-900">모임 관리</h2>
      <p className="mt-1 text-sm text-brown-400">
        {visibility === "PRIVATE"
          ? "모임장이 선정 책을 검색해서 추가하고, 멤버는 자신의 공개/비공개 독후감을 연결할 수 있습니다."
          : "모임장이 선정 책을 검색해서 추가하고, 멤버는 자신의 공개 독후감을 연결할 수 있습니다."}
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {manager && savedNotice && !noticeEditing && (
          <div className="space-y-3 rounded-2xl bg-yellow-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-brown-700">모임장 공지</p>
              <span className="rounded-full bg-white px-2 py-1 text-xs text-brown-400">상단 고정 중</span>
            </div>
            <p className="whitespace-pre-line rounded-xl bg-white px-3 py-3 text-sm leading-6 text-brown-700">{savedNotice}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNoticeEditing(true)}
                className="rounded-xl border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-brown-600 hover:bg-cream-50"
              >
                공지 수정
              </button>
              <button
                type="button"
                onClick={deleteNotice}
                disabled={loading}
                className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50"
              >
                공지 삭제
              </button>
            </div>
          </div>
        )}
        {manager && (!savedNotice || noticeEditing) && (
          <form onSubmit={updateNotice} className="space-y-3 rounded-2xl bg-yellow-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-brown-700">모임장 공지</p>
              <span className="rounded-full bg-white px-2 py-1 text-xs text-brown-400">상단 고정</span>
            </div>
            <textarea
              value={noticeText}
              onChange={(event) => setNoticeText(event.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="모임 일정, 준비물, 변경사항을 알려주세요."
              className="w-full resize-y rounded-xl border border-yellow-200 bg-white px-3 py-2 text-sm leading-6 text-brown-800 focus:border-brown-400 focus:outline-none"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-brown-400">{noticeText.length}/2000</span>
              <div className="flex gap-2">
                {savedNotice && (
                  <button
                    type="button"
                    onClick={() => {
                      setNoticeText(savedNotice);
                      setNoticeEditing(false);
                    }}
                    className="rounded-xl border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-brown-600 hover:bg-cream-50"
                  >
                    취소
                  </button>
                )}
                <button disabled={loading || !noticeText.trim()} className="rounded-xl bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-50">
                  {savedNotice ? "수정 저장" : "공지 등록"}
                </button>
              </div>
            </div>
          </form>
        )}
        {manager && (
          <div className="space-y-3 rounded-2xl bg-cream-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-brown-700">멤버 관리</p>
              <button type="button" onClick={loadMembers} className="text-xs font-medium text-brown-500 hover:text-brown-800">
                새로고침
              </button>
            </div>
            {membersLoading && <p className="text-sm text-brown-400">불러오는 중...</p>}
            {joinPolicy === "APPROVAL" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-brown-500">가입 승인 대기</p>
                  {!membersLoading && pendingMembers.length === 0 && (
                    <p className="rounded-xl bg-white px-3 py-4 text-sm text-brown-400">승인 대기 중인 멤버가 없어요.</p>
                  )}
                  {!membersLoading && pendingMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-brown-800">{member.nickname}</p>
                        <p className="text-xs text-brown-400">요청일 {new Date(member.createdAt).toLocaleDateString("ko-KR")}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" disabled={loading} onClick={() => updateMember(member.id, "approve")} className="rounded-lg bg-brown-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brown-800 disabled:opacity-50">
                          승인
                        </button>
                        <button type="button" disabled={loading} onClick={() => updateMember(member.id, "reject")} className="rounded-lg border border-cream-300 px-3 py-1.5 text-xs font-semibold text-brown-500 hover:bg-cream-100 disabled:opacity-50">
                          거절
                        </button>
                        <button type="button" disabled={loading} onClick={() => updateMember(member.id, "block")} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50">
                          차단
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 border-t border-cream-200 pt-4">
                  <p className="text-xs font-semibold text-brown-500">가입 회원</p>
                  {!membersLoading && approvedMembers.length === 0 && (
                    <p className="rounded-xl bg-white px-3 py-4 text-sm text-brown-400">가입한 멤버가 없어요.</p>
                  )}
                  {!membersLoading && approvedMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-brown-800">{member.nickname}</p>
                        <p className="text-xs text-brown-400">
                          {member.role === "OWNER" ? "모임장" : member.role === "MANAGER" ? "관리자" : "멤버"} · 가입일 {new Date(member.createdAt).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-600">가입 중</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {!membersLoading && approvedMembers.length === 0 && (
                  <p className="rounded-xl bg-white px-3 py-4 text-sm text-brown-400">가입한 멤버가 없어요.</p>
                )}
                {!membersLoading && approvedMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-brown-800">{member.nickname}</p>
                      <p className="text-xs text-brown-400">
                        {member.role === "OWNER" ? "모임장" : member.role === "MANAGER" ? "관리자" : "멤버"} · 가입일 {new Date(member.createdAt).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-600">가입 중</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
        {manager && (
          <form id="group-book-add" onSubmit={addBook} className="scroll-mt-24 space-y-3 rounded-2xl bg-cream-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-brown-700">선정 책 추가</p>
              <span className="rounded-full bg-white px-2 py-1 text-xs text-brown-400">책 검색</span>
            </div>
            <BookSearchSelect value={bookId} onChange={(id) => setBookId(id)} />
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="회차/기간 메모" className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none" />
            <button disabled={loading} className="w-full rounded-xl bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-50">책 추가</button>
          </form>
        )}
        {manager && books.length > 0 && (
          <div className="space-y-3 rounded-2xl bg-cream-50 p-4 lg:col-span-2">
            <div>
              <p className="text-sm font-semibold text-brown-700">책 진행 상태</p>
              <p className="mt-1 text-xs text-brown-400">선정 책마다 다음 책·읽는 중·완독 상태와 마감일을 설정할 수 있어요.</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {books.map((book) => (
                <form key={book.id} onSubmit={(event) => updateBookProgress(event, book.id)} className="space-y-3 rounded-xl bg-white p-3">
                  <p className="truncate text-sm font-semibold text-brown-800">{book.title}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1 text-xs text-brown-500">
                      <span>진행 상태</span>
                      <select name="status" defaultValue={book.status} className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-brown-700 focus:border-brown-400 focus:outline-none">
                        <option value="UPCOMING">다음 책</option>
                        <option value="READING">읽는 중</option>
                        <option value="COMPLETED">완독</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs text-brown-500">
                      <span>마감일</span>
                      <input name="deadline" type="date" defaultValue={book.deadline ?? ""} className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-brown-700 focus:border-brown-400 focus:outline-none" />
                    </label>
                  </div>
                  <button disabled={loading} className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm font-semibold text-brown-600 hover:bg-cream-100 disabled:opacity-50">
                    상태 저장
                  </button>
                </form>
              ))}
            </div>
          </div>
        )}
        {member && books.length > 0 && (
          <form onSubmit={attachReview} className="space-y-3 rounded-2xl bg-cream-50 p-4">
            <p className="text-sm font-semibold text-brown-700">내 독후감 연결</p>
            <select value={groupBookId} onChange={(event) => setGroupBookId(event.target.value)} className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-700 focus:border-brown-400 focus:outline-none">
              {books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
            </select>
            {reviewsLoading && <p className="rounded-xl bg-white px-3 py-4 text-sm text-brown-400">내 독후감을 불러오는 중...</p>}
            {!reviewsLoading && myReviews.length === 0 && (
              <p className="rounded-xl bg-white px-3 py-4 text-sm text-brown-400">
                {visibility === "PRIVATE" ? "이 책에 작성한 독후감이 없어요." : "이 책에 작성한 공개 독후감이 없어요."}
              </p>
            )}
            {!reviewsLoading && myReviews.length > 0 && (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {myReviews.map((review) => (
                  <div key={review.id} className={`rounded-xl border px-3 py-2 text-sm ${review.attached ? "border-green-100 bg-white text-brown-500" : "border-cream-200 bg-white text-brown-700 hover:border-brown-300"}`}>
                    <div className="flex items-start gap-2">
                      {!review.attached && (
                        <input
                          type="radio"
                          name="group-review"
                          value={review.id}
                          checked={selectedReviewId === String(review.id)}
                          onChange={(event) => setSelectedReviewId(event.target.value)}
                          className="mt-1"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-brown-400">
                          <span>별점 {review.rating}</span>
                          <span>{new Date(review.createdAt).toLocaleDateString("ko-KR")}</span>
                          {review.hidden && <span className="font-medium text-red-500">비공개</span>}
                          {review.attached && <span className="font-medium text-green-600">이미 연결됨</span>}
                        </div>
                        <p className="mt-1 line-clamp-2 leading-5">{review.content}</p>
                        {review.attached && (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => detachReview(review.id)}
                            className="mt-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50"
                          >
                            연결 끊기
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button disabled={loading || !selectedReviewId} className="w-full rounded-xl bg-brown-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-50">선택한 독후감 연결</button>
          </form>
        )}
      </div>
      {message && <p className="mt-3 text-sm text-brown-500">{message}</p>}
    </section>
  );
}
