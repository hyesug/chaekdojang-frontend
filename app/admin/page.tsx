"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE } from "../lib/api";

interface User { id: number; nickname: string; email: string; role: string; createdAt: string; }
interface Review { id: number; authorNickname: string; bookTitle: string; content: string; rating: number; hidden: boolean; createdAt: string; }
interface BookStat { bookId: number; title: string; author: string; reviewCount: number; }
interface Inquiry { id: number; title: string; authorName: string; createdAt: string; }
interface AccessLog {
  id: number;
  ip: string;
  matchedUserId: number | null;
  matchedNickname: string | null;
  method: string;
  uri: string;
  status: number;
  elapsedMs: number;
  createdAt: string;
}
interface MetricEvent {
  id: number;
  userId: number | null;
  nickname: string | null;
  eventType: string;
  sessionId: string;
  path: string;
  referrer: string | null;
  durationMs: number;
  device: string | null;
  ip: string | null;
  createdAt: string;
}
interface ErrorLog {
  id: number;
  level: string;
  method: string;
  uri: string;
  status: number;
  exceptionType: string;
  message: string;
  ip: string | null;
  userId: number | null;
  createdAt: string;
}

type AccessFilters = {
  q: string;
  method: string;
  statusGroup: string;
};

type MetricFilters = {
  q: string;
  eventType: string;
  userType: string;
};

type ErrorFilters = {
  q: string;
  level: string;
  statusGroup: string;
};

function formatLogTime(value: string) {
  const normalized = value.replace("T", " ");
  const [, month, day, hour, minute, second] =
    normalized.match(/^\d{4}-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/) ?? [];
  if (!month) return normalized;
  return `${month}.${day} ${hour}:${minute}:${second}`;
}

function normalizePath(value: string) {
  const path = value.split("?")[0].split("#")[0];
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function getRouteLabel(value: string) {
  const path = normalizePath(value);
  const labels: Record<string, string> = {
    "/": "홈 피드",
    "/search": "책 검색",
    "/library": "내 서재",
    "/stats": "독서 통계",
    "/write": "독후감 작성",
    "/cs": "고객센터",
    "/admin": "관리자 페이지",
    "/admin/access-logs": "관리자 > 접속 기록",
    "/admin/metrics": "관리자 > 지표 로그",
    "/profile": "내 프로필",
    "/bookmarks": "북마크",
    "/notifications": "알림",
    "/explore": "둘러보기",
    "/auth/login": "로그인",
    "/auth/register": "회원가입",
    "/auth/callback": "소셜 로그인 처리",
    "/setup-nickname": "닉네임 설정",
    "/privacy": "개인정보처리방침",
    "/terms": "이용약관",
    "/dojangdan": "도장단",
    "/api/dev/login": "로컬 개발용 로그인",
    "/api/metrics/events": "사용 지표 수집",
    "/api/admin/users": "관리자 > 회원 목록 조회",
    "/api/admin/reviews": "관리자 > 독후감 목록 조회",
    "/api/admin/reviews/stats": "관리자 > 책별 독후감 통계",
    "/api/admin/inquiries": "관리자 > 문의 목록 조회",
    "/api/admin/access-logs": "관리자 > 접속 기록 조회",
    "/api/admin/metrics": "관리자 > 지표 로그 조회",
    "/api/users/me": "내 계정 정보 확인",
  };

  if (labels[path]) return labels[path];
  if (/^\/reviews\/\d+$/.test(path)) return "독후감 상세";
  if (/^\/books\/\d+$/.test(path)) return "책 상세";
  if (/^\/chat\/\d+$/.test(path)) return "책 채팅";
  if (/^\/users\/\d+$/.test(path)) return "사용자 프로필";
  if (/^\/u\/[^/]+$/.test(path)) return "사용자 프로필";
  if (/^\/admin\/inquiries\/\d+$/.test(path)) return "관리자 > 문의 상세";
  if (path.startsWith("/api/")) return "서비스 요청";
  return "기타 페이지";
}

function getMetricEventLabel(eventType: string) {
  if (eventType === "page_view") return "페이지 열림";
  if (eventType === "login_success") return "로그인 성공";
  if (eventType === "heartbeat") return "머무는 중";
  if (eventType === "session_end") return "페이지 떠남";
  return eventType;
}

function getMethodLabel(method: string) {
  if (method === "GET") return "조회";
  if (method === "POST") return "등록";
  if (method === "PATCH") return "수정";
  if (method === "PUT") return "전체 수정";
  if (method === "DELETE") return "삭제";
  return method;
}

function getStatusLabel(status: number) {
  if (status < 300) return `정상 (${status})`;
  if (status < 400) return `이동 (${status})`;
  if (status < 500) return `요청 문제 (${status})`;
  return `서버 문제 (${status})`;
}

function getDeviceLabel(device: string | null) {
  if (device === "mobile") return "휴대폰";
  if (device === "tablet") return "태블릿";
  if (device === "desktop") return "PC";
  return device ?? "-";
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"users" | "reviews" | "inquiries" | "access" | "metrics" | "errors">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [bookStats, setBookStats] = useState<BookStat[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [accessPage, setAccessPage] = useState(0);
  const [accessTotalPages, setAccessTotalPages] = useState(1);
  const [metricEvents, setMetricEvents] = useState<MetricEvent[]>([]);
  const [metricPage, setMetricPage] = useState(0);
  const [metricTotalPages, setMetricTotalPages] = useState(1);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [errorPage, setErrorPage] = useState(0);
  const [errorTotalPages, setErrorTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewTotalPages, setReviewTotalPages] = useState(1);
  const [reviewAuthorQ, setReviewAuthorQ] = useState("");
  const [reviewTitleQ, setReviewTitleQ] = useState("");
  const [appliedSearch, setAppliedSearch] = useState({ author: "", title: "" });
  const [accessQ, setAccessQ] = useState("");
  const [accessMethod, setAccessMethod] = useState("");
  const [accessStatusGroup, setAccessStatusGroup] = useState("");
  const [appliedAccessFilters, setAppliedAccessFilters] = useState<AccessFilters>({ q: "", method: "", statusGroup: "" });
  const [metricQ, setMetricQ] = useState("");
  const [metricEventType, setMetricEventType] = useState("");
  const [metricUserType, setMetricUserType] = useState("");
  const [appliedMetricFilters, setAppliedMetricFilters] = useState<MetricFilters>({ q: "", eventType: "", userType: "" });
  const [errorQ, setErrorQ] = useState("");
  const [errorLevel, setErrorLevel] = useState("");
  const [errorStatusGroup, setErrorStatusGroup] = useState("");
  const [appliedErrorFilters, setAppliedErrorFilters] = useState<ErrorFilters>({ q: "", level: "", statusGroup: "" });

  function getToken() {
    if (typeof window === "undefined") return null;
    const t = localStorage.getItem("token");
    return !t || t === "undefined" || t === "null" ? null : t;
  }

  async function load() {
    const token = getToken();
    if (!token) { router.replace("/auth/login"); return; }
    const h = { Authorization: `Bearer ${token}` };
    setLoading(true);
    try {
      if (tab === "users") {
        const r = await fetch(`${API_BASE}/api/admin/users?size=50`, { headers: h });
        if (r.status === 403) { setUnauthorized(true); return; }
        const j = await r.json();
        setUsers(j.data?.content ?? []);
      } else if (tab === "inquiries") {
        const r = await fetch(`${API_BASE}/api/admin/inquiries?size=50`, { headers: h });
        if (r.status === 403) { setUnauthorized(true); return; }
        const j = await r.json();
        setInquiries(j.data?.content ?? []);
      }
    } finally { setLoading(false); }
  }

  async function loadAccessLogs(page: number, filters: AccessFilters = appliedAccessFilters) {
    const token = getToken();
    if (!token) { router.replace("/auth/login"); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), size: "50" });
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.method) params.set("method", filters.method);
      if (filters.statusGroup) params.set("statusGroup", filters.statusGroup);
      const r = await fetch(`${API_BASE}/api/admin/access-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 403) { setUnauthorized(true); return; }
      const j = await r.json();
      setAccessLogs(j.data?.content ?? []);
      setAccessTotalPages(j.data?.totalPages ?? 1);
      setAccessPage(page);
    } finally { setLoading(false); }
  }

  async function loadMetricEvents(page: number, filters: MetricFilters = appliedMetricFilters) {
    const token = getToken();
    if (!token) { router.replace("/auth/login"); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), size: "50" });
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.eventType) params.set("eventType", filters.eventType);
      if (filters.userType) params.set("userType", filters.userType);
      const r = await fetch(`${API_BASE}/api/admin/metrics?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 403) { setUnauthorized(true); return; }
      const j = await r.json();
      setMetricEvents(j.data?.content ?? []);
      setMetricTotalPages(j.data?.totalPages ?? 1);
      setMetricPage(page);
    } finally { setLoading(false); }
  }

  async function loadErrorLogs(page: number, filters: ErrorFilters = appliedErrorFilters) {
    const token = getToken();
    if (!token) { router.replace("/auth/login"); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), size: "50" });
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.level) params.set("level", filters.level);
      if (filters.statusGroup) params.set("statusGroup", filters.statusGroup);
      const r = await fetch(`${API_BASE}/api/admin/error-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 403) { setUnauthorized(true); return; }
      const j = await r.json();
      setErrorLogs(j.data?.content ?? []);
      setErrorTotalPages(j.data?.totalPages ?? 1);
      setErrorPage(page);
    } finally { setLoading(false); }
  }

  async function loadReviews(page: number, author: string, title: string) {
    const token = getToken();
    if (!token) { router.replace("/auth/login"); return; }
    const h = { Authorization: `Bearer ${token}` };
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), size: "20" });
      if (author) params.set("author", author);
      if (title) params.set("title", title);
      const [rv, st] = await Promise.all([
        fetch(`${API_BASE}/api/admin/reviews?${params}`, { headers: h }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/reviews/stats`, { headers: h }).then((r) => r.json()),
      ]);
      setReviews(rv.data?.content ?? []);
      setReviewTotalPages(rv.data?.totalPages ?? 1);
      setReviewPage(page);
      setBookStats(st.data ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (tab === "reviews") {
      setAppliedSearch({ author: "", title: "" });
      setReviewAuthorQ("");
      setReviewTitleQ("");
      loadReviews(0, "", "");
    } else if (tab === "access") {
      setAccessQ("");
      setAccessMethod("");
      setAccessStatusGroup("");
      const empty = { q: "", method: "", statusGroup: "" };
      setAppliedAccessFilters(empty);
      loadAccessLogs(0, empty);
    } else if (tab === "metrics") {
      setMetricQ("");
      setMetricEventType("");
      setMetricUserType("");
      const empty = { q: "", eventType: "", userType: "" };
      setAppliedMetricFilters(empty);
      loadMetricEvents(0, empty);
    } else if (tab === "errors") {
      setErrorQ("");
      setErrorLevel("");
      setErrorStatusGroup("");
      const empty = { q: "", level: "", statusGroup: "" };
      setAppliedErrorFilters(empty);
      loadErrorLogs(0, empty);
    } else {
      load();
    }
  }, [tab]);

  async function setRole(userId: number, role: string) {
    const token = getToken();
    if (!token) return;
    const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    await fetch(`${API_BASE}/api/admin/users/${userId}/role`, {
      method: "PATCH", headers: h, body: JSON.stringify({ role }),
    });
    load();
  }

  async function toggleHidden(reviewId: number, hidden: boolean) {
    const token = getToken();
    if (!token) return;
    const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    await fetch(`${API_BASE}/api/admin/reviews/${reviewId}/hidden`, {
      method: "PATCH", headers: h, body: JSON.stringify({ hidden }),
    });
    loadReviews(reviewPage, appliedSearch.author, appliedSearch.title);
  }

  function handleReviewSearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedSearch({ author: reviewAuthorQ, title: reviewTitleQ });
    loadReviews(0, reviewAuthorQ, reviewTitleQ);
  }

  function handleAccessSearch(e: React.FormEvent) {
    e.preventDefault();
    const filters = { q: accessQ, method: accessMethod, statusGroup: accessStatusGroup };
    setAppliedAccessFilters(filters);
    loadAccessLogs(0, filters);
  }

  function resetAccessFilters() {
    const empty = { q: "", method: "", statusGroup: "" };
    setAccessQ("");
    setAccessMethod("");
    setAccessStatusGroup("");
    setAppliedAccessFilters(empty);
    loadAccessLogs(0, empty);
  }

  function handleMetricSearch(e: React.FormEvent) {
    e.preventDefault();
    const filters = { q: metricQ, eventType: metricEventType, userType: metricUserType };
    setAppliedMetricFilters(filters);
    loadMetricEvents(0, filters);
  }

  function resetMetricFilters() {
    const empty = { q: "", eventType: "", userType: "" };
    setMetricQ("");
    setMetricEventType("");
    setMetricUserType("");
    setAppliedMetricFilters(empty);
    loadMetricEvents(0, empty);
  }

  function handleErrorSearch(e: React.FormEvent) {
    e.preventDefault();
    const filters = { q: errorQ, level: errorLevel, statusGroup: errorStatusGroup };
    setAppliedErrorFilters(filters);
    loadErrorLogs(0, filters);
  }

  function resetErrorFilters() {
    const empty = { q: "", level: "", statusGroup: "" };
    setErrorQ("");
    setErrorLevel("");
    setErrorStatusGroup("");
    setAppliedErrorFilters(empty);
    loadErrorLogs(0, empty);
  }

  if (unauthorized) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <p className="text-2xl mb-2">🔒</p>
      <p className="text-brown-600 font-medium">관리자만 접근할 수 있어요</p>
      <button onClick={() => router.back()} className="mt-4 text-sm text-brown-400 underline">돌아가기</button>
    </div>
  );

  const tabs = [
    { key: "users", label: "👥 회원" },
    { key: "reviews", label: "📖 독후감" },
    { key: "inquiries", label: "💬 문의" },
    { key: "access", label: "🔍 기능 사용 기록" },
    { key: "metrics", label: "📈 페이지 방문 기록" },
    { key: "errors", label: "🚨 오류 로그" },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-brown-800 mb-6">관리자 페이지</h1>

      <div className="flex gap-1 mb-6 bg-cream-200 rounded-xl p-1">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${tab === key ? "bg-white text-brown-800 shadow-sm" : "text-brown-400 hover:text-brown-600"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-brown-300 py-8">불러오는 중...</p>}

      {/* 회원 관리 */}
      {!loading && tab === "users" && (
        <div>
          <div className="hidden bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden sm:block">
            <table className="w-full text-sm">
              <thead className="bg-cream-100">
                <tr>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">닉네임</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">이메일</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">역할</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">가입일</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    tabIndex={0}
                    role="link"
                    onClick={() => router.push(`/users/${u.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") router.push(`/users/${u.id}`);
                    }}
                    className="border-t border-cream-100 cursor-pointer hover:bg-cream-50 focus:outline-none focus:bg-cream-50"
                  >
                    <td className="px-4 py-3 text-brown-800">{u.nickname}</td>
                    <td className="px-4 py-3 text-brown-500">{u.email ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === "SUPER_ADMIN" ? "bg-red-100 text-red-600" :
                        u.role === "ADMIN" ? "bg-blue-100 text-blue-600" : "bg-cream-200 text-brown-500"}`}>
                        {u.role === "SUPER_ADMIN" ? "슈퍼관리자" : u.role === "ADMIN" ? "관리자" : "일반"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brown-400">{new Date(u.createdAt).toLocaleDateString("ko-KR")}</td>
                    <td className="px-4 py-3">
                      {u.role !== "SUPER_ADMIN" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRole(u.id, u.role === "ADMIN" ? "USER" : "ADMIN");
                          }}
                          className={`px-3 py-1 text-xs rounded-lg ${u.role === "ADMIN" ? "bg-cream-200 text-brown-500 hover:bg-cream-300" : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}>
                          {u.role === "ADMIN" ? "권한 해제" : "관리자 지정"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-brown-300">회원이 없어요</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:hidden">
            {users.map((u) => (
              <div
                key={u.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/users/${u.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") router.push(`/users/${u.id}`);
                }}
                className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-brown-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-brown-800">{u.nickname}</p>
                    <p className="mt-1 break-all text-xs text-brown-400">{u.email ?? "-"}</p>
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.role === "SUPER_ADMIN" ? "bg-red-100 text-red-600" :
                    u.role === "ADMIN" ? "bg-blue-100 text-blue-600" : "bg-cream-200 text-brown-500"}`}>
                    {u.role === "SUPER_ADMIN" ? "슈퍼관리자" : u.role === "ADMIN" ? "관리자" : "일반"}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-cream-100 pt-3">
                  <span className="text-xs text-brown-400">
                    가입일 {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                  {u.role !== "SUPER_ADMIN" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRole(u.id, u.role === "ADMIN" ? "USER" : "ADMIN");
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs ${u.role === "ADMIN" ? "bg-cream-200 text-brown-500 hover:bg-cream-300" : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}
                    >
                      {u.role === "ADMIN" ? "권한 해제" : "관리자 지정"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <p className="rounded-2xl border border-cream-200 bg-white py-8 text-center text-sm text-brown-300">
                회원이 없어요
              </p>
            )}
          </div>
        </div>
      )}

      {/* 독후감 관리 */}
      {!loading && tab === "reviews" && (
        <div className="flex flex-col gap-6">
          {bookStats.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-cream-200">
              <h2 className="text-sm font-bold text-brown-700 mb-4">📊 책별 독후감 통계 (Top 10)</h2>
              <div className="flex flex-col gap-2">
                {bookStats.slice(0, 10).map((s, i) => (
                  <div key={s.bookId} className="flex items-center gap-3">
                    <span className="text-xs text-brown-400 w-4">{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm text-brown-800">{s.title}</p>
                      <p className="text-xs text-brown-400">{s.author}</p>
                    </div>
                    <span className="text-sm font-bold text-brown-600">{s.reviewCount}개</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* 검색 */}
          <form onSubmit={handleReviewSearch} className="flex gap-2">
            <input
              value={reviewAuthorQ}
              onChange={(e) => setReviewAuthorQ(e.target.value)}
              placeholder="작성자 닉네임"
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-cream-300 bg-white focus:outline-none focus:border-brown-400 transition"
            />
            <input
              value={reviewTitleQ}
              onChange={(e) => setReviewTitleQ(e.target.value)}
              placeholder="책 제목"
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-cream-300 bg-white focus:outline-none focus:border-brown-400 transition"
            />
            <button type="submit" className="px-4 py-2 text-sm bg-brown-600 text-white rounded-xl hover:bg-brown-700 transition-colors">검색</button>
            {(appliedSearch.author || appliedSearch.title) && (
              <button type="button" onClick={() => {
                setReviewAuthorQ(""); setReviewTitleQ("");
                setAppliedSearch({ author: "", title: "" });
                loadReviews(0, "", "");
              }} className="px-3 py-2 text-sm border border-cream-300 text-brown-400 rounded-xl hover:bg-cream-50 transition-colors">초기화</button>
            )}
          </form>

          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-cream-100">
                <tr>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">작성자</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">책</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">내용</th>
                  <th className="px-4 py-3 text-brown-600 font-medium">상태</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id} className={`border-t border-cream-100 ${r.hidden ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 text-brown-800">{r.authorNickname}</td>
                    <td className="px-4 py-3 text-brown-500">{r.bookTitle ?? "-"}</td>
                    <td className="px-4 py-3 text-brown-600 max-w-xs truncate">{r.content}</td>
                    <td className="px-4 py-3 text-center">
                      {r.hidden ? <span className="text-xs text-red-400">비공개</span> : <span className="text-xs text-green-500">공개</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleHidden(r.id, !r.hidden)}
                        className={`px-3 py-1 text-xs rounded-lg ${r.hidden ? "bg-green-50 text-green-600 hover:bg-green-100" : "bg-red-50 text-red-500 hover:bg-red-100"}`}>
                        {r.hidden ? "공개" : "비공개"}
                      </button>
                    </td>
                  </tr>
                ))}
                {reviews.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-brown-300">검색 결과가 없어요</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 페이징 */}
          {reviewTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => loadReviews(reviewPage - 1, appliedSearch.author, appliedSearch.title)}
                disabled={reviewPage === 0}
                className="px-3 py-1.5 text-sm border border-cream-300 rounded-lg text-brown-500 hover:bg-cream-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >← 이전</button>
              <span className="text-sm text-brown-400">{reviewPage + 1} / {reviewTotalPages}</span>
              <button
                onClick={() => loadReviews(reviewPage + 1, appliedSearch.author, appliedSearch.title)}
                disabled={reviewPage >= reviewTotalPages - 1}
                className="px-3 py-1.5 text-sm border border-cream-300 rounded-lg text-brown-500 hover:bg-cream-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >다음 →</button>
            </div>
          )}
        </div>
      )}

      {/* 문의 관리 */}
      {!loading && tab === "inquiries" && (
        <div className="flex flex-col gap-3">
          {inquiries.map((q) => (
            <Link key={q.id} href={`/admin/inquiries/${q.id}`}
              className="bg-white rounded-2xl p-4 shadow-sm border border-cream-200 hover:border-brown-300 transition-colors flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brown-800">{q.title}</p>
                <p className="text-xs text-brown-400 mt-0.5">{q.authorName} · {new Date(q.createdAt).toLocaleDateString("ko-KR")}</p>
              </div>
              <span className="text-xs text-brown-400">→</span>
            </Link>
          ))}
          {inquiries.length === 0 && <p className="text-center text-brown-300 py-8">문의가 없어요</p>}
        </div>
      )}

      {/* 접속 기록 */}
      {!loading && tab === "access" && (
        <div className="flex flex-col gap-4">
          <form onSubmit={handleAccessSearch} className="grid gap-2 rounded-2xl border border-cream-200 bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto]">
            <input
              value={accessQ}
              onChange={(e) => setAccessQ(e.target.value)}
              placeholder="메뉴, 기능, 접속 위치 검색"
              className="rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
            />
            <select
              value={accessMethod}
              onChange={(e) => setAccessMethod(e.target.value)}
              className="rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-600 focus:border-brown-400 focus:outline-none"
            >
              <option value="">전체 작업</option>
              <option value="GET">조회</option>
              <option value="POST">등록</option>
              <option value="PATCH">수정</option>
              <option value="PUT">전체 수정</option>
              <option value="DELETE">삭제</option>
            </select>
            <select
              value={accessStatusGroup}
              onChange={(e) => setAccessStatusGroup(e.target.value)}
              className="rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-600 focus:border-brown-400 focus:outline-none"
            >
              <option value="">전체 결과</option>
              <option value="2xx">정상 처리</option>
              <option value="3xx">다른 곳으로 이동</option>
              <option value="4xx">요청 문제</option>
              <option value="5xx">서버 문제</option>
            </select>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 rounded-xl bg-brown-600 px-4 py-2 text-sm text-white hover:bg-brown-700">
                검색
              </button>
              {(appliedAccessFilters.q || appliedAccessFilters.method || appliedAccessFilters.statusGroup) && (
                <button type="button" onClick={resetAccessFilters} className="rounded-xl border border-cream-300 px-3 py-2 text-sm text-brown-400 hover:bg-cream-50">
                  초기화
                </button>
              )}
            </div>
          </form>

          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-cream-100">
                <tr>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium whitespace-nowrap">시간</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">접속 위치</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">작업</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">메뉴/기능</th>
                  <th className="px-4 py-3 text-brown-600 font-medium text-center">결과</th>
                  <th className="px-4 py-3 text-brown-600 font-medium text-right">걸린 시간</th>
                </tr>
              </thead>
              <tbody>
                {accessLogs.map((a) => (
                  <tr key={a.id} className="border-t border-cream-100 hover:bg-cream-50">
                    <td className="px-4 py-2.5 text-brown-400 whitespace-nowrap text-xs">
                      {formatLogTime(a.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 text-brown-500 text-xs">
                      <div className="font-mono">{a.ip}</div>
                      {a.matchedUserId && (
                        <div className="mt-0.5 text-[11px] text-brown-300">
                          사용자 #{a.matchedUserId}
                          {a.matchedNickname ? ` · ${a.matchedNickname}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-medium ${
                        a.method === "GET" ? "bg-green-50 text-green-600" :
                        a.method === "POST" ? "bg-blue-50 text-blue-600" :
                        a.method === "PATCH" || a.method === "PUT" ? "bg-yellow-50 text-yellow-600" :
                        a.method === "DELETE" ? "bg-red-50 text-red-500" : "bg-cream-100 text-brown-400"
                      }`}>{getMethodLabel(a.method)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-brown-600 text-xs max-w-xs truncate" title={a.uri}>
                      {getRouteLabel(a.uri)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-xs font-medium ${
                        a.status < 300 ? "text-green-500" :
                        a.status < 400 ? "text-blue-400" :
                        a.status < 500 ? "text-yellow-500" : "text-red-500"
                      }`}>{getStatusLabel(a.status)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-brown-400 text-xs">{a.elapsedMs}ms</td>
                  </tr>
                ))}
                {accessLogs.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-brown-300">기록이 없어요</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {accessTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => loadAccessLogs(accessPage - 1, appliedAccessFilters)}
                disabled={accessPage === 0}
                className="px-3 py-1.5 text-sm border border-cream-300 rounded-lg text-brown-500 hover:bg-cream-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >← 이전</button>
              <span className="text-sm text-brown-400">{accessPage + 1} / {accessTotalPages}</span>
              <button
                onClick={() => loadAccessLogs(accessPage + 1, appliedAccessFilters)}
                disabled={accessPage >= accessTotalPages - 1}
                className="px-3 py-1.5 text-sm border border-cream-300 rounded-lg text-brown-500 hover:bg-cream-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >다음 →</button>
            </div>
          )}
        </div>
      )}

      {/* 페이지 방문 기록 */}
      {!loading && tab === "metrics" && (
        <div className="flex flex-col gap-4">
          <form onSubmit={handleMetricSearch} className="grid gap-2 rounded-2xl border border-cream-200 bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto]">
            <input
              value={metricQ}
              onChange={(e) => setMetricQ(e.target.value)}
              placeholder="메뉴, 사용자, 접속 위치 검색"
              className="rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
            />
            <select
              value={metricEventType}
              onChange={(e) => setMetricEventType(e.target.value)}
              className="rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-600 focus:border-brown-400 focus:outline-none"
            >
              <option value="">전체 방문 상태</option>
              <option value="page_view">페이지 열림</option>
              <option value="login_success">로그인 성공</option>
              <option value="heartbeat">머무는 중</option>
              <option value="session_end">페이지 떠남</option>
            </select>
            <select
              value={metricUserType}
              onChange={(e) => setMetricUserType(e.target.value)}
              className="rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-600 focus:border-brown-400 focus:outline-none"
            >
              <option value="">전체 사용자</option>
              <option value="member">회원</option>
              <option value="guest">비회원</option>
            </select>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 rounded-xl bg-brown-600 px-4 py-2 text-sm text-white hover:bg-brown-700">
                검색
              </button>
              {(appliedMetricFilters.q || appliedMetricFilters.eventType || appliedMetricFilters.userType) && (
                <button type="button" onClick={resetMetricFilters} className="rounded-xl border border-cream-300 px-3 py-2 text-sm text-brown-400 hover:bg-cream-50">
                  초기화
                </button>
              )}
            </div>
          </form>

          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-cream-100">
                <tr>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium whitespace-nowrap">시간</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">방문 상태</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">사용자</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">메뉴</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">기기</th>
                  <th className="px-4 py-3 text-brown-600 font-medium text-right">머문 시간</th>
                </tr>
              </thead>
              <tbody>
                {metricEvents.map((event) => (
                  <tr key={event.id} className="border-t border-cream-100 hover:bg-cream-50">
                    <td className="px-4 py-2.5 text-brown-400 whitespace-nowrap text-xs">
                      {formatLogTime(event.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-medium ${
                        event.eventType === "page_view" ? "bg-blue-50 text-blue-600" :
                        event.eventType === "login_success" ? "bg-purple-50 text-purple-600" :
                        event.eventType === "heartbeat" ? "bg-green-50 text-green-600" :
                        "bg-cream-100 text-brown-500"
                      }`}>{getMetricEventLabel(event.eventType)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-brown-500 text-xs">{event.nickname ?? "비회원"}</td>
                    <td className="px-4 py-2.5 text-brown-600 text-xs max-w-xs truncate" title={event.path}>
                      {getRouteLabel(event.path)}
                    </td>
                    <td className="px-4 py-2.5 text-brown-400 text-xs">{getDeviceLabel(event.device)}</td>
                    <td className="px-4 py-2.5 text-right text-brown-400 text-xs">
                      {event.durationMs > 0 ? `${Math.round(event.durationMs / 1000)}초` : "-"}
                    </td>
                  </tr>
                ))}
                {metricEvents.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-brown-300">지표 로그가 없어요</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {metricTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => loadMetricEvents(metricPage - 1, appliedMetricFilters)}
                disabled={metricPage === 0}
                className="px-3 py-1.5 text-sm border border-cream-300 rounded-lg text-brown-500 hover:bg-cream-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >← 이전</button>
              <span className="text-sm text-brown-400">{metricPage + 1} / {metricTotalPages}</span>
              <button
                onClick={() => loadMetricEvents(metricPage + 1, appliedMetricFilters)}
                disabled={metricPage >= metricTotalPages - 1}
                className="px-3 py-1.5 text-sm border border-cream-300 rounded-lg text-brown-500 hover:bg-cream-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >다음 →</button>
            </div>
          )}
        </div>
      )}

      {/* 오류 로그 */}
      {!loading && tab === "errors" && (
        <div className="flex flex-col gap-4">
          <form onSubmit={handleErrorSearch} className="grid gap-2 rounded-2xl border border-cream-200 bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto]">
            <input
              value={errorQ}
              onChange={(e) => setErrorQ(e.target.value)}
              placeholder="주소, 예외명, 메시지, IP 검색"
              className="rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
            />
            <select
              value={errorLevel}
              onChange={(e) => setErrorLevel(e.target.value)}
              className="rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-600 focus:border-brown-400 focus:outline-none"
            >
              <option value="">전체 심각도</option>
              <option value="ERROR">서버 오류</option>
              <option value="WARN">요청 오류</option>
            </select>
            <select
              value={errorStatusGroup}
              onChange={(e) => setErrorStatusGroup(e.target.value)}
              className="rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-600 focus:border-brown-400 focus:outline-none"
            >
              <option value="">전체 결과</option>
              <option value="4xx">요청 문제</option>
              <option value="5xx">서버 문제</option>
            </select>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 rounded-xl bg-brown-600 px-4 py-2 text-sm text-white hover:bg-brown-700">
                검색
              </button>
              {(appliedErrorFilters.q || appliedErrorFilters.level || appliedErrorFilters.statusGroup) && (
                <button type="button" onClick={resetErrorFilters} className="rounded-xl border border-cream-300 px-3 py-2 text-sm text-brown-400 hover:bg-cream-50">
                  초기화
                </button>
              )}
            </div>
          </form>

          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-cream-100">
                <tr>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium whitespace-nowrap">시간</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">심각도</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">위치</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">예외</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">메시지</th>
                  <th className="text-left px-4 py-3 text-brown-600 font-medium">사용자/IP</th>
                </tr>
              </thead>
              <tbody>
                {errorLogs.map((event) => (
                  <tr key={event.id} className="border-t border-cream-100 hover:bg-cream-50">
                    <td className="px-4 py-2.5 text-brown-400 whitespace-nowrap text-xs">
                      {formatLogTime(event.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-medium ${
                        event.level === "ERROR" ? "bg-red-50 text-red-600" : "bg-yellow-50 text-yellow-600"
                      }`}>
                        {event.level === "ERROR" ? "서버 오류" : "요청 오류"} ({event.status})
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-brown-600 text-xs max-w-[180px] truncate" title={event.uri}>
                      {getRouteLabel(event.uri)}
                    </td>
                    <td className="px-4 py-2.5 text-brown-500 text-xs font-mono">{event.exceptionType}</td>
                    <td className="px-4 py-2.5 text-brown-600 text-xs max-w-sm truncate" title={event.message}>
                      {event.message}
                    </td>
                    <td className="px-4 py-2.5 text-brown-400 text-xs">
                      {event.userId ? `사용자 #${event.userId}` : "비회원"}
                      {event.ip ? <div className="mt-0.5 font-mono">{event.ip}</div> : null}
                    </td>
                  </tr>
                ))}
                {errorLogs.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-brown-300">오류 로그가 없어요</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {errorTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => loadErrorLogs(errorPage - 1, appliedErrorFilters)}
                disabled={errorPage === 0}
                className="px-3 py-1.5 text-sm border border-cream-300 rounded-lg text-brown-500 hover:bg-cream-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >← 이전</button>
              <span className="text-sm text-brown-400">{errorPage + 1} / {errorTotalPages}</span>
              <button
                onClick={() => loadErrorLogs(errorPage + 1, appliedErrorFilters)}
                disabled={errorPage >= errorTotalPages - 1}
                className="px-3 py-1.5 text-sm border border-cream-300 rounded-lg text-brown-500 hover:bg-cream-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >다음 →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
