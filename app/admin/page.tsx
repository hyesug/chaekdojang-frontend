"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReviewDetailModal from "../components/ReviewDetailModal";
import { API_BASE } from "../lib/api";

type Tab = "dashboard" | "users" | "reviews" | "inquiries" | "pages" | "actions" | "security" | "audit";

interface PageResponse<T> {
  content: T[];
  totalPages?: number;
  totalElements?: number;
}

interface User {
  id: number;
  nickname: string;
  email: string | null;
  role: string;
  createdAt: string;
}

interface Review {
  id: number;
  authorNickname: string;
  bookTitle: string;
  content: string;
  rating: number;
  hidden: boolean;
  createdAt: string;
}

interface BookStat {
  bookId: number;
  title: string;
  author: string;
  reviewCount: number;
}

interface Inquiry {
  id: number;
  title: string;
  authorName: string;
  createdAt: string;
}

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

interface AdminAuditLog {
  id: number;
  actorId: number | null;
  actorNickname: string | null;
  action: string;
  targetType: string;
  targetId: number | null;
  summary: string;
  createdAt: string;
}

interface DashboardSummary {
  todayVisitors: number;
  todayPageViews: number;
  todayReviews: number;
  todayUsers: number;
  todayServerErrors: number;
  todaySuspiciousRequests: number;
}

interface AggregatedPage {
  path: string;
  label: string;
  views: number;
  visitors: number;
  avgDurationSeconds: number;
  topReferrer: string;
  lastAt: string;
}

interface AggregatedAction {
  eventType: string;
  label: string;
  count: number;
  visitors: number;
  lastAt: string;
}

interface AggregatedSecurity {
  severity: string;
  type: string;
  uri: string;
  count: number;
  ip: string;
  lastAt: string;
}

type PageSummary = {
  path: string;
  label: string;
  views: number;
  visitors: Set<string>;
  durationSum: number;
  durationCount: number;
  referrers: Map<string, number>;
  lastAt: string;
};

type ActionSummary = {
  eventType: string;
  label: string;
  count: number;
  visitors: Set<string>;
  lastAt: string;
};

type SecuritySummary = {
  key: string;
  severity: string;
  type: string;
  uri: string;
  count: number;
  ip: string;
  lastAt: string;
};

const tabs: Array<{ key: Tab; label: string }> = [
  { key: "dashboard", label: "📊 운영 현황" },
  { key: "users", label: "👥 회원" },
  { key: "reviews", label: "📖 독후감" },
  { key: "inquiries", label: "💬 문의" },
  { key: "pages", label: "🧭 유입/페이지" },
  { key: "actions", label: "⚡ 사용자 행동" },
  { key: "security", label: "🛡️ 보안·오류" },
  { key: "audit", label: "🧾 관리자 이력" },
];

function formatLogTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replace("T", " ");
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isToday(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function normalizePath(value: string) {
  const path = value.split("?")[0].split("#")[0] || "/";
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function getRouteLabel(value: string) {
  const path = normalizePath(value);
  const labels: Record<string, string> = {
    "/": "홈 피드",
    "/search": "책 검색",
    "/library": "내 서재",
    "/calendar": "독서 캘린더",
    "/stats": "독서 통계",
    "/write": "독후감 작성",
    "/cs": "고객센터",
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
  };
  if (labels[path]) return labels[path];
  if (/^\/reviews\/\d+$/.test(path)) return "독후감 상세";
  if (/^\/books\/[^/]+$/.test(path)) return "책 상세";
  if (/^\/books\/[^/]+\/reviews$/.test(path)) return "책별 독후감 모음";
  if (/^\/users\/\d+$/.test(path) || /^\/u\/[^/]+$/.test(path)) return "사용자 프로필";
  if (path.startsWith("/admin")) return "관리자 페이지";
  if (path.startsWith("/api/admin")) return "관리자 API";
  if (path.startsWith("/api/metrics")) return "지표 수집";
  if (path.startsWith("/api/")) return "서비스 API";
  return "기타 페이지";
}

function getMetricEventLabel(eventType: string) {
  if (eventType === "page_view") return "페이지 조회";
  if (eventType === "login_success") return "로그인 성공";
  if (eventType === "review_write_click") return "독후감 작성 클릭";
  if (eventType === "review_created") return "독후감 등록";
  if (eventType === "book_search") return "책 검색";
  if (eventType === "share_click") return "공유 클릭";
  if (eventType === "heartbeat") return "체류 신호";
  if (eventType === "session_end") return "페이지 이탈";
  return eventType;
}

function getDeviceLabel(device: string | null) {
  if (device === "mobile") return "휴대폰";
  if (device === "tablet") return "태블릿";
  if (device === "desktop") return "PC";
  return device ?? "-";
}

function getAuditActionLabel(action: string) {
  if (action === "USER_ROLE_CHANGED") return "권한 변경";
  if (action === "REVIEW_HIDDEN") return "독후감 숨김";
  if (action === "REVIEW_UNHIDDEN") return "독후감 공개";
  if (action === "INQUIRY_COMMENT_CREATED") return "문의 답변";
  return action;
}

function getAuditTargetLabel(targetType: string) {
  if (targetType === "USER") return "회원";
  if (targetType === "REVIEW") return "독후감";
  if (targetType === "INQUIRY") return "문의";
  return targetType || "-";
}

function visitorKey(event: MetricEvent) {
  return event.userId != null ? `u:${event.userId}` : event.sessionId || event.ip || `event:${event.id}`;
}

function referrerLabel(referrer: string | null) {
  if (!referrer) return "직접 방문";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (host.includes("brunch")) return "브런치";
    if (host.includes("google")) return "구글";
    if (host.includes("naver")) return "네이버";
    if (host.includes("instagram")) return "인스타그램";
    if (host.includes("chaekdojang")) return "책도장 내부";
    return host;
  } catch {
    return referrer;
  }
}

function topReferrer(referrers: Map<string, number>) {
  const [first] = Array.from(referrers.entries()).sort((a, b) => b[1] - a[1]);
  return first?.[0] ?? "-";
}

function suspiciousType(uri: string, status?: number) {
  const path = uri.toLowerCase();
  if (path.includes(".env")) return "환경파일 스캔";
  if (path.includes(".git")) return "Git 저장소 스캔";
  if (path.includes("php") || path.includes("wp-")) return "PHP/워드프레스 스캔";
  if (path.includes("swagger") || path.includes("api-docs")) return "API 문서 접근";
  if (path.includes("..") || path.includes("%2e")) return "경로 조작 시도";
  if (status && status >= 500) return "서버 오류";
  if (status && status >= 400) return "요청 오류";
  return "기타 이상 요청";
}

function StatCard({ label, value, helper }: { label: string; value: string | number; helper?: string }) {
  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-brown-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brown-900">{value}</p>
      {helper && <p className="mt-1 text-xs text-brown-300">{helper}</p>}
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return <div className="rounded-2xl border border-cream-200 bg-white py-12 text-center text-sm text-brown-300">{children}</div>;
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [users, setUsers] = useState<User[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [bookStats, setBookStats] = useState<BookStat[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [metricEvents, setMetricEvents] = useState<MetricEvent[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [aggregatedPages, setAggregatedPages] = useState<AggregatedPage[]>([]);
  const [aggregatedActions, setAggregatedActions] = useState<AggregatedAction[]>([]);
  const [aggregatedSecurity, setAggregatedSecurity] = useState<AggregatedSecurity[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedReviewId, setSelectedReviewId] = useState<number | null>(null);

  function getToken() {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem("token");
    return !token || token === "undefined" || token === "null" ? null : token;
  }

  async function fetchAdmin<T>(path: string): Promise<T | null> {
    const token = getToken();
    if (!token) {
      router.replace("/auth/login");
      return null;
    }
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      localStorage.removeItem("token");
      router.replace("/auth/login");
      return null;
    }
    if (res.status === 403) {
      setUnauthorized(true);
      return null;
    }
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data ?? json) as T;
  }

  async function fetchPage<T>(path: string) {
    const data = await fetchAdmin<PageResponse<T>>(path);
    return data?.content ?? [];
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [
        nextUsers,
        nextReviews,
        nextStats,
        nextInquiries,
        nextAccess,
        nextMetrics,
        nextErrors,
        nextAudit,
        nextDashboard,
        nextPages,
        nextActions,
        nextSecurity,
      ] = await Promise.all([
        fetchPage<User>("/api/admin/users?size=200"),
        fetchPage<Review>("/api/admin/reviews?size=100"),
        fetchAdmin<BookStat[]>("/api/admin/reviews/stats"),
        fetchPage<Inquiry>("/api/admin/inquiries?size=100"),
        fetchPage<AccessLog>("/api/admin/access-logs?size=300"),
        fetchPage<MetricEvent>("/api/admin/metrics?size=500"),
        fetchPage<ErrorLog>("/api/admin/error-logs?size=200"),
        fetchPage<AdminAuditLog>("/api/admin/audit-logs?size=100"),
        fetchAdmin<DashboardSummary>("/api/admin/dashboard/summary"),
        fetchAdmin<AggregatedPage[]>("/api/admin/analytics/pages"),
        fetchAdmin<AggregatedAction[]>("/api/admin/analytics/actions"),
        fetchAdmin<AggregatedSecurity[]>("/api/admin/security/summary"),
      ]);
      setUsers(nextUsers);
      setReviews(nextReviews);
      setBookStats(nextStats ?? []);
      setInquiries(nextInquiries);
      setAccessLogs(nextAccess);
      setMetricEvents(nextMetrics);
      setErrorLogs(nextErrors);
      setAuditLogs(nextAudit);
      setDashboardSummary(nextDashboard);
      setAggregatedPages(nextPages ?? []);
      setAggregatedActions(nextActions ?? []);
      setAggregatedSecurity(nextSecurity ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const adminIds = useMemo(
    () => new Set(users.filter((user) => user.role === "ADMIN" || user.role === "SUPER_ADMIN").map((user) => user.id)),
    [users]
  );

  const adminNicknames = useMemo(
    () => new Set(users.filter((user) => user.role === "ADMIN" || user.role === "SUPER_ADMIN").map((user) => user.nickname).filter(Boolean)),
    [users]
  );

  const visibleMetrics = useMemo(
    () => metricEvents.filter((event) => {
      if (event.userId != null && adminIds.has(event.userId)) return false;
      if (event.nickname && adminNicknames.has(event.nickname)) return false;
      const path = normalizePath(event.path);
      return !path.startsWith("/admin") && !path.startsWith("/api/admin");
    }),
    [metricEvents, adminIds, adminNicknames]
  );

  const visibleAccessLogs = useMemo(
    () => accessLogs.filter((log) => {
      if (log.matchedUserId != null && adminIds.has(log.matchedUserId)) return false;
      if (log.matchedNickname && adminNicknames.has(log.matchedNickname)) return false;
      const path = normalizePath(log.uri);
      return !path.startsWith("/admin") && !path.startsWith("/api/admin");
    }),
    [accessLogs, adminIds, adminNicknames]
  );

  const visibleErrors = useMemo(
    () => errorLogs.filter((log) => {
      if (log.userId != null && adminIds.has(log.userId)) return false;
      const path = normalizePath(log.uri);
      return !path.startsWith("/admin") && !path.startsWith("/api/admin");
    }),
    [errorLogs, adminIds]
  );

  const rawPageSummaries = useMemo(() => {
    const map = new Map<string, PageSummary>();
    visibleMetrics.forEach((event) => {
      const path = normalizePath(event.path);
      if (event.eventType !== "page_view" && event.durationMs <= 0) return;
      const item = map.get(path) ?? {
        path,
        label: getRouteLabel(path),
        views: 0,
        visitors: new Set<string>(),
        durationSum: 0,
        durationCount: 0,
        referrers: new Map<string, number>(),
        lastAt: event.createdAt,
      };
      if (event.eventType === "page_view") item.views += 1;
      item.visitors.add(visitorKey(event));
      if (event.durationMs > 0) {
        item.durationSum += event.durationMs;
        item.durationCount += 1;
      }
      const referrer = referrerLabel(event.referrer);
      item.referrers.set(referrer, (item.referrers.get(referrer) ?? 0) + 1);
      if (event.createdAt > item.lastAt) item.lastAt = event.createdAt;
      map.set(path, item);
    });
    return Array.from(map.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt) || b.views - a.views);
  }, [visibleMetrics]);

  const rawActionSummaries = useMemo(() => {
    const map = new Map<string, ActionSummary>();
    visibleMetrics
      .filter((event) => !["heartbeat", "session_end"].includes(event.eventType))
      .forEach((event) => {
        const item = map.get(event.eventType) ?? {
          eventType: event.eventType,
          label: getMetricEventLabel(event.eventType),
          count: 0,
          visitors: new Set<string>(),
          lastAt: event.createdAt,
        };
        item.count += 1;
        item.visitors.add(visitorKey(event));
        if (event.createdAt > item.lastAt) item.lastAt = event.createdAt;
        map.set(event.eventType, item);
      });
    return Array.from(map.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt) || b.count - a.count);
  }, [visibleMetrics]);

  const rawSecuritySummaries = useMemo(() => {
    const map = new Map<string, SecuritySummary>();
    visibleErrors.forEach((error) => {
      const type = suspiciousType(error.uri, error.status);
      const key = `error:${type}:${normalizePath(error.uri)}:${error.ip ?? ""}`;
      const item = map.get(key) ?? {
        key,
        severity: error.status >= 500 ? "오류" : "주의",
        type,
        uri: normalizePath(error.uri),
        count: 0,
        ip: error.ip ?? "-",
        lastAt: error.createdAt,
      };
      item.count += 1;
      if (error.createdAt > item.lastAt) item.lastAt = error.createdAt;
      map.set(key, item);
    });
    visibleAccessLogs
      .filter((log) => log.status >= 400 || suspiciousType(log.uri) !== "기타 이상 요청")
      .forEach((log) => {
        const type = suspiciousType(log.uri, log.status);
        if (type === "요청 오류" && log.status < 500) return;
        const key = `access:${type}:${normalizePath(log.uri)}:${log.ip}`;
        const item = map.get(key) ?? {
          key,
          severity: log.status >= 500 ? "오류" : "주의",
          type,
          uri: normalizePath(log.uri),
          count: 0,
          ip: log.ip,
          lastAt: log.createdAt,
        };
        item.count += 1;
        if (log.createdAt > item.lastAt) item.lastAt = log.createdAt;
        map.set(key, item);
      });
    return Array.from(map.values()).sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt));
  }, [visibleErrors, visibleAccessLogs]);

  const pageSummaries = useMemo(() => {
    if (aggregatedPages.length === 0) return rawPageSummaries;
    return aggregatedPages.map((page) => ({
      path: page.path,
      label: page.label,
      views: page.views,
      visitors: new Set(Array.from({ length: page.visitors }, (_, index) => String(index))),
      durationSum: page.avgDurationSeconds * 1000,
      durationCount: page.avgDurationSeconds > 0 ? 1 : 0,
      referrers: new Map([[page.topReferrer || "-", 1]]),
      lastAt: page.lastAt,
    })).sort((a, b) => b.lastAt.localeCompare(a.lastAt) || b.views - a.views);
  }, [aggregatedPages, rawPageSummaries]);

  const actionSummaries = useMemo(() => {
    if (aggregatedActions.length === 0) return rawActionSummaries;
    return aggregatedActions.map((action) => ({
      eventType: action.eventType,
      label: action.label,
      count: action.count,
      visitors: new Set(Array.from({ length: action.visitors }, (_, index) => String(index))),
      lastAt: action.lastAt,
    }));
  }, [aggregatedActions, rawActionSummaries]);

  const securitySummaries = useMemo(() => {
    if (aggregatedSecurity.length === 0) return rawSecuritySummaries;
    return aggregatedSecurity.map((item) => ({
      key: `${item.type}:${item.uri}:${item.ip}`,
      severity: item.severity,
      type: item.type,
      uri: item.uri,
      count: item.count,
      ip: item.ip,
      lastAt: item.lastAt,
    }));
  }, [aggregatedSecurity, rawSecuritySummaries]);

  const filteredUsers = users.filter((user) => {
    const text = `${user.nickname} ${user.email ?? ""} ${user.role}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  const filteredReviews = reviews.filter((review) => {
    const text = `${review.authorNickname} ${review.bookTitle} ${review.content}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  const filteredInquiries = inquiries.filter((inquiry) => {
    const text = `${inquiry.title} ${inquiry.authorName}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  const recentActions = visibleMetrics
    .filter((event) => !["heartbeat", "session_end"].includes(event.eventType))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30);

  const fallbackTodayVisitors = new Set(visibleMetrics.filter((event) => isToday(event.createdAt)).map(visitorKey)).size;
  const fallbackTodayPageViews = visibleMetrics.filter((event) => isToday(event.createdAt) && event.eventType === "page_view").length;
  const fallbackTodayReviews = reviews.filter((review) => isToday(review.createdAt)).length;
  const fallbackTodayUsers = users.filter((user) => isToday(user.createdAt)).length;
  const fallbackTodayErrors = visibleErrors.filter((error) => isToday(error.createdAt) && error.status >= 500).length;
  const fallbackTodaySecurity = securitySummaries.filter((item) => isToday(item.lastAt)).reduce((sum, item) => sum + item.count, 0);
  const todayVisitors = dashboardSummary?.todayVisitors ?? fallbackTodayVisitors;
  const todayPageViews = dashboardSummary?.todayPageViews ?? fallbackTodayPageViews;
  const todayReviews = dashboardSummary?.todayReviews ?? fallbackTodayReviews;
  const todayUsers = dashboardSummary?.todayUsers ?? fallbackTodayUsers;
  const todayErrors = dashboardSummary?.todayServerErrors ?? fallbackTodayErrors;
  const todaySecurity = dashboardSummary?.todaySuspiciousRequests ?? fallbackTodaySecurity;

  async function setRole(userId: number, role: string) {
    const token = getToken();
    if (!token) return;
    await fetch(`${API_BASE}/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    loadAll();
  }

  async function toggleHidden(reviewId: number, hidden: boolean) {
    const token = getToken();
    if (!token) return;
    await fetch(`${API_BASE}/api/admin/reviews/${reviewId}/hidden`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ hidden }),
    });
    loadAll();
  }

  function reviewHrefForBook(book: BookStat) {
    const review = reviews.find((item) => item.bookTitle === book.title);
    return review ? `/reviews/${review.id}` : `/books/${book.bookId}/reviews`;
  }

  if (unauthorized) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-2xl mb-2">🔒</p>
        <p className="font-medium text-brown-600">관리자만 접근할 수 있어요</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-brown-400 underline">돌아가기</button>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brown-900">관리자 페이지</h1>
          <p className="mt-1 text-sm text-brown-400">관리자 활동은 분석 화면에서 제외하고 실제 사용자 흐름만 보여줍니다.</p>
        </div>
        <button
          onClick={loadAll}
          className="rounded-xl border border-cream-300 bg-white px-4 py-2 text-sm text-brown-600 hover:bg-cream-50"
        >
          새로고침
        </button>
      </div>

      <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 rounded-xl bg-cream-200 p-1 sm:min-w-0">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setQuery("");
              }}
              className={`min-h-10 shrink-0 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors sm:flex-1 sm:px-2 ${
                tab === key ? "bg-white text-brown-900 shadow-sm" : "text-brown-500 hover:text-brown-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-brown-300">불러오는 중...</p>
      ) : (
        <div className="space-y-5">
          {tab !== "dashboard" && (
            <div className="rounded-2xl border border-cream-200 bg-white p-4">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="현재 탭에서 검색"
                className="w-full rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
              />
            </div>
          )}

          {tab === "dashboard" && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                <StatCard label="오늘 방문자" value={todayVisitors} helper="관리자 제외" />
                <StatCard label="오늘 페이지뷰" value={todayPageViews} />
                <StatCard label="오늘 독후감" value={todayReviews} />
                <StatCard label="오늘 가입" value={todayUsers} />
                <StatCard label="서버 오류" value={todayErrors} helper="오늘 5xx" />
                <StatCard label="의심 요청" value={todaySecurity} helper="스캔/오류 묶음" />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <h2 className="font-serif text-lg font-bold text-brown-900">인기 페이지</h2>
                  <div className="mt-3 space-y-3">
                    {pageSummaries.slice(0, 6).map((page) => (
                      <div key={page.path} className="rounded-xl bg-cream-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-brown-800">{page.label}</p>
                            <p className="truncate text-xs text-brown-300">{page.path}</p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-brown-700">{page.views}회</p>
                        </div>
                        <p className="mt-2 text-xs text-brown-400">방문자 {page.visitors.size}명 · 유입 {topReferrer(page.referrers)} · 마지막 {formatLogTime(page.lastAt)}</p>
                      </div>
                    ))}
                    {pageSummaries.length === 0 && <p className="py-6 text-center text-sm text-brown-300">방문 데이터가 없어요</p>}
                  </div>
                </section>

                <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <h2 className="font-serif text-lg font-bold text-brown-900">사용자 행동</h2>
                  <div className="mt-3 space-y-3">
                    {actionSummaries.slice(0, 6).map((action) => (
                      <div key={action.eventType} className="flex items-center justify-between rounded-xl bg-cream-50 p-3">
                        <div>
                          <p className="font-medium text-brown-800">{action.label}</p>
                          <p className="text-xs text-brown-400">사용자 {action.visitors.size}명 · 마지막 {formatLogTime(action.lastAt)}</p>
                        </div>
                        <p className="text-sm font-bold text-brown-700">{action.count}회</p>
                      </div>
                    ))}
                    {actionSummaries.length === 0 && <p className="py-6 text-center text-sm text-brown-300">행동 데이터가 없어요</p>}
                  </div>
                </section>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <h2 className="font-serif text-lg font-bold text-brown-900">책별 독후감 TOP 5</h2>
                  <div className="mt-3 space-y-2">
                    {bookStats.slice(0, 5).map((book) => (
                      <Link
                        key={book.bookId}
                        href={reviewHrefForBook(book)}
                        className="block rounded-xl bg-cream-50 p-3 hover:bg-cream-100"
                      >
                        <div className="flex justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-brown-800">{book.title}</p>
                            <p className="text-xs text-brown-400">{book.author}</p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-brown-700">{book.reviewCount}개</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <h2 className="font-serif text-lg font-bold text-brown-900">보안·오류 요약</h2>
                  <div className="mt-3 space-y-2">
                    {securitySummaries.slice(0, 5).map((item) => (
                      <div key={item.key} className="rounded-xl bg-cream-50 p-3">
                        <div className="flex justify-between gap-3">
                          <p className="font-medium text-brown-800">{item.type}</p>
                          <p className="text-sm font-bold text-brown-700">{item.count}회</p>
                        </div>
                        <p className="mt-1 truncate text-xs text-brown-400">{item.uri} · {item.ip} · {formatLogTime(item.lastAt)}</p>
                      </div>
                    ))}
                    {securitySummaries.length === 0 && <p className="py-6 text-center text-sm text-brown-300">보안·오류 이슈가 없어요</p>}
                  </div>
                </section>
              </div>
            </>
          )}

          {tab === "users" && (
            <section className="rounded-2xl border border-cream-200 bg-white shadow-sm overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-cream-100 text-left text-brown-600">
                  <tr><th className="px-4 py-3">닉네임</th><th className="px-4 py-3">이메일</th><th className="px-4 py-3">역할</th><th className="px-4 py-3">가입일</th><th className="px-4 py-3"></th></tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-t border-cream-100 hover:bg-cream-50">
                      <td className="px-4 py-3 font-medium text-brown-800">{user.nickname}</td>
                      <td className="px-4 py-3 text-brown-500">{user.email ?? "-"}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-brown-600">{user.role}</span></td>
                      <td className="px-4 py-3 text-brown-400">{new Date(user.createdAt).toLocaleDateString("ko-KR")}</td>
                      <td className="px-4 py-3 text-right">
                        {user.role !== "SUPER_ADMIN" && (
                          <button onClick={() => setRole(user.id, user.role === "ADMIN" ? "USER" : "ADMIN")} className="rounded-lg border border-cream-300 px-3 py-1 text-xs text-brown-500 hover:bg-cream-50">
                            {user.role === "ADMIN" ? "권한 해제" : "관리자 지정"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {tab === "reviews" && (
            <section className="space-y-3">
              {filteredReviews.map((review) => (
                <div key={review.id} className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <button
                      type="button"
                      onClick={() => setSelectedReviewId(review.id)}
                      className="min-w-0 flex-1 rounded-xl text-left hover:bg-cream-50"
                    >
                      <p className="font-serif text-lg font-bold text-brown-900">{review.bookTitle}</p>
                      <p className="mt-1 text-sm text-brown-500">{review.authorNickname} · ★ {review.rating} · {formatLogTime(review.createdAt)}</p>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-brown-600">{review.content}</p>
                    </button>
                    <button onClick={() => toggleHidden(review.id, !review.hidden)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs ${review.hidden ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                      {review.hidden ? "공개로 전환" : "비공개로 전환"}
                    </button>
                  </div>
                </div>
              ))}
              {filteredReviews.length === 0 && <EmptyState>독후감이 없어요</EmptyState>}
            </section>
          )}

          {tab === "inquiries" && (
            <section className="space-y-3">
              {filteredInquiries.map((inquiry) => (
                <Link key={inquiry.id} href={`/admin/inquiries/${inquiry.id}`} className="block rounded-2xl border border-cream-200 bg-white p-4 shadow-sm hover:bg-cream-50">
                  <p className="font-medium text-brown-900">{inquiry.title}</p>
                  <p className="mt-1 text-sm text-brown-400">{inquiry.authorName} · {formatLogTime(inquiry.createdAt)}</p>
                </Link>
              ))}
              {filteredInquiries.length === 0 && <EmptyState>문의가 없어요</EmptyState>}
            </section>
          )}

          {tab === "pages" && (
            <section className="rounded-2xl border border-cream-200 bg-white shadow-sm overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-cream-100 text-left text-brown-600">
                  <tr><th className="px-4 py-3">페이지</th><th className="px-4 py-3 text-right">조회수</th><th className="px-4 py-3 text-right">방문자</th><th className="px-4 py-3">대표 유입</th><th className="px-4 py-3 text-right">평균 체류</th><th className="px-4 py-3">마지막 방문</th></tr>
                </thead>
                <tbody>
                  {pageSummaries.filter((page) => `${page.label} ${page.path}`.toLowerCase().includes(query.toLowerCase())).map((page) => (
                    <tr key={page.path} className="border-t border-cream-100 hover:bg-cream-50">
                      <td className="px-4 py-3"><p className="font-medium text-brown-800">{page.label}</p><p className="text-xs text-brown-300">{page.path}</p></td>
                      <td className="px-4 py-3 text-right font-semibold text-brown-700">{page.views}</td>
                      <td className="px-4 py-3 text-right text-brown-500">{page.visitors.size}</td>
                      <td className="px-4 py-3 text-brown-500">{topReferrer(page.referrers)}</td>
                      <td className="px-4 py-3 text-right text-brown-500">{page.durationCount ? `${Math.round(page.durationSum / page.durationCount / 1000)}초` : "-"}</td>
                      <td className="px-4 py-3 text-brown-400">{formatLogTime(page.lastAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {tab === "actions" && (
            <section className="rounded-2xl border border-cream-200 bg-white shadow-sm overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-cream-100 text-left text-brown-600"><tr><th className="px-4 py-3">시간</th><th className="px-4 py-3">행동</th><th className="px-4 py-3">사용자</th><th className="px-4 py-3">위치</th><th className="px-4 py-3">기기</th></tr></thead>
                <tbody>
                  {recentActions
                    .filter((event) => `${getMetricEventLabel(event.eventType)} ${event.nickname ?? ""} ${event.path}`.toLowerCase().includes(query.toLowerCase()))
                    .map((event) => (
                    <tr key={event.id} className="border-t border-cream-100 hover:bg-cream-50">
                      <td className="px-4 py-3 text-brown-400">{formatLogTime(event.createdAt)}</td>
                      <td className="px-4 py-3 text-brown-800">{getMetricEventLabel(event.eventType)}</td>
                      <td className="px-4 py-3 text-brown-500">{event.nickname ?? "비회원"}</td>
                      <td className="px-4 py-3"><p className="text-brown-700">{getRouteLabel(event.path)}</p><p className="text-xs text-brown-300">{normalizePath(event.path)}</p></td>
                      <td className="px-4 py-3 text-brown-500">{getDeviceLabel(event.device)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {tab === "security" && (
            <section className="space-y-3">
              {securitySummaries.filter((item) => `${item.type} ${item.uri} ${item.ip}`.toLowerCase().includes(query.toLowerCase())).map((item) => (
                <div key={item.key} className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs ${item.severity === "오류" ? "bg-red-50 text-red-500" : "bg-yellow-50 text-yellow-600"}`}>{item.severity}</span><p className="font-medium text-brown-900">{item.type}</p></div>
                      <p className="mt-2 truncate font-mono text-xs text-brown-400">{item.uri}</p>
                      <p className="mt-1 text-xs text-brown-300">IP {item.ip} · 마지막 {formatLogTime(item.lastAt)}</p>
                    </div>
                    <p className="shrink-0 text-lg font-bold text-brown-800">{item.count}회</p>
                  </div>
                </div>
              ))}
              {securitySummaries.length === 0 && <EmptyState>보안·오류 이슈가 없어요</EmptyState>}
            </section>
          )}

          {tab === "audit" && (
            <section className="space-y-3">
              {auditLogs.filter((log) => `${log.actorNickname ?? ""} ${log.action} ${log.targetType} ${log.summary}`.toLowerCase().includes(query.toLowerCase())).map((log) => (
                <div key={log.id} className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-brown-900">{getAuditActionLabel(log.action)}</p>
                      <p className="mt-1 text-sm text-brown-500">{getAuditTargetLabel(log.targetType)} {log.targetId ? `#${log.targetId}` : ""}</p>
                      <p className="mt-2 text-sm text-brown-400">{log.summary}</p>
                    </div>
                    <p className="shrink-0 text-xs text-brown-300">{log.actorNickname ?? "관리자"} · {formatLogTime(log.createdAt)}</p>
                  </div>
                </div>
              ))}
              {auditLogs.length === 0 && <EmptyState>관리자 이력이 없어요</EmptyState>}
            </section>
          )}
        </div>
      )}
      {selectedReviewId != null && (
        <ReviewDetailModal reviewId={selectedReviewId} onClose={() => setSelectedReviewId(null)} />
      )}
    </main>
  );
}
