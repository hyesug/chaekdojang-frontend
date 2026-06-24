"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReviewDetailModal from "../components/ReviewDetailModal";
import { API_BASE } from "../lib/api";
import { authFetch, getValidToken } from "../lib/auth";

type Tab = "dashboard" | "users" | "reviews" | "inquiries" | "officialProfiles" | "pages" | "actions" | "security" | "audit";

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

type OfficialProfileType = "AUTHOR" | "PUBLISHER" | "BOOKSTORE";
type OfficialProfileApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";
type OfficialProfileStatus = "DRAFT" | "ACTIVE" | "HIDDEN";

interface OfficialProfileApplication {
  id: number;
  applicantId: number;
  applicantNickname: string;
  type: OfficialProfileType;
  displayName: string;
  bio: string | null;
  officialUrl: string | null;
  contactEmail: string;
  proofUrl: string | null;
  status: OfficialProfileApplicationStatus;
  reviewNote: string | null;
  profileSlug: string | null;
  createdAt: string;
}

interface OfficialProfileBook {
  id: number;
  title: string;
  author: string;
  publisher: string | null;
  thumbnail: string | null;
  reviewCount: number;
}

interface OfficialProfile {
  id: number;
  type: OfficialProfileType;
  displayName: string;
  slug: string;
  bio: string | null;
  officialUrl: string | null;
  contactEmail: string | null;
  status: OfficialProfileStatus;
  verified: boolean;
  featured: boolean;
  books: OfficialProfileBook[];
}

interface BookSearchResult {
  id: number;
  title: string;
  author: string;
  publisher: string | null;
  thumbnail: string | null;
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

type SecurityEvent = {
  key: string;
  severity: string;
  source: "error" | "access";
  type: string;
  method: string;
  uri: string;
  status: number;
  ip: string;
  message: string;
  exceptionType?: string;
  count: number;
  lastAt: string;
};

const tabs: Array<{ key: Tab; label: string }> = [
  { key: "dashboard", label: "📊 운영 현황" },
  { key: "users", label: "👥 회원" },
  { key: "reviews", label: "📖 독후감" },
  { key: "inquiries", label: "💬 문의" },
  { key: "officialProfiles", label: "🏷️ 공식 프로필" },
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

function formatDuration(ms: number) {
  if (!ms || ms <= 0) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${Math.round(ms / 1000)}초`;
}

function actorLabel(event: MetricEvent) {
  if (event.nickname) return event.nickname;
  if (event.userId != null) return `회원 #${event.userId}`;
  return "비회원";
}

function shortSession(value: string) {
  if (!value) return "-";
  return value.length > 8 ? value.slice(0, 8) : value;
}

function getAuditActionLabel(action: string) {
  if (action === "USER_ROLE_CHANGED") return "권한 변경";
  if (action === "REVIEW_HIDDEN") return "독후감 숨김";
  if (action === "REVIEW_UNHIDDEN") return "독후감 공개";
  if (action === "INQUIRY_COMMENT_CREATED") return "문의 답변";
  if (action === "OFFICIAL_PROFILE_APPROVED") return "공식 프로필 승인";
  if (action === "OFFICIAL_PROFILE_REJECTED") return "공식 프로필 반려";
  if (action === "OFFICIAL_PROFILE_UPDATED") return "공식 프로필 수정";
  if (action === "OFFICIAL_PROFILE_BOOK_ADDED") return "공식 프로필 책 연결";
  if (action === "OFFICIAL_PROFILE_BOOK_REMOVED") return "공식 프로필 책 해제";
  return action;
}

function getAuditTargetLabel(targetType: string) {
  if (targetType === "USER") return "회원";
  if (targetType === "REVIEW") return "독후감";
  if (targetType === "INQUIRY") return "문의";
  if (targetType === "OFFICIAL_PROFILE") return "공식 프로필";
  if (targetType === "OFFICIAL_PROFILE_APPLICATION") return "공식 프로필 신청";
  return targetType || "-";
}

const officialProfileTypeLabels: Record<OfficialProfileType, string> = {
  AUTHOR: "작가",
  PUBLISHER: "출판사",
  BOOKSTORE: "서점",
};

const officialApplicationStatusLabels: Record<OfficialProfileApplicationStatus, string> = {
  PENDING: "검토 중",
  APPROVED: "승인됨",
  REJECTED: "반려됨",
};

const officialProfileStatusLabels: Record<OfficialProfileStatus, string> = {
  DRAFT: "초안",
  ACTIVE: "공개",
  HIDDEN: "숨김",
};

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
  const [officialApplications, setOfficialApplications] = useState<OfficialProfileApplication[]>([]);
  const [officialProfiles, setOfficialProfiles] = useState<OfficialProfile[]>([]);
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
  const [bookSearchProfile, setBookSearchProfile] = useState<OfficialProfile | null>(null);
  const [bookSearchQuery, setBookSearchQuery] = useState("");
  const [bookSearchResults, setBookSearchResults] = useState<BookSearchResult[]>([]);
  const [bookSearching, setBookSearching] = useState(false);

  function getToken() {
    return getValidToken();
  }

  async function fetchAdmin<T>(path: string): Promise<T | null> {
    const token = getToken();
    if (!token) {
      router.replace("/auth/login");
      return null;
    }
    const res = await authFetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      
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
        nextOfficialApplications,
        nextOfficialProfiles,
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
        fetchPage<OfficialProfileApplication>("/api/admin/profile-applications?size=100"),
        fetchAdmin<OfficialProfile[]>("/api/admin/profiles"),
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
      setOfficialApplications(nextOfficialApplications);
      setOfficialProfiles(nextOfficialProfiles ?? []);
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

  const filteredOfficialApplications = officialApplications.filter((application) => {
    const text = `${application.displayName} ${application.applicantNickname} ${application.contactEmail} ${application.status}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  const filteredOfficialProfiles = officialProfiles.filter((profile) => {
    const text = `${profile.displayName} ${profile.slug} ${profile.status} ${profile.books.map((book) => book.title).join(" ")}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  const recentPageViews = visibleMetrics
    .filter((event) => event.eventType === "page_view")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const filteredPageViews = recentPageViews.filter((event) => {
    const text = `${getRouteLabel(event.path)} ${event.path} ${event.nickname ?? ""} ${referrerLabel(event.referrer)} ${event.ip ?? ""}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  const filteredActions = visibleMetrics
    .filter((event) => !["heartbeat", "session_end"].includes(event.eventType))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((event) => {
      const text = `${getMetricEventLabel(event.eventType)} ${event.nickname ?? ""} ${event.path} ${event.ip ?? ""}`.toLowerCase();
      return text.includes(query.toLowerCase());
    });

  const securityEvents = useMemo(() => {
    const map = new Map<string, SecurityEvent>();
    visibleErrors.forEach((log) => {
      const uri = normalizePath(log.uri);
      const message = log.message || "(no message)";
      const key = `error:${log.status}:${log.exceptionType}:${uri}:${message}:${log.ip ?? ""}`;
      const previous = map.get(key);
      const item: SecurityEvent = {
        key,
        severity: log.status >= 500 ? "오류" : "주의",
        source: "error",
        type: suspiciousType(log.uri, log.status),
        method: log.method,
        uri,
        status: log.status,
        ip: log.ip ?? "-",
        message,
        exceptionType: log.exceptionType,
        count: (previous?.count ?? 0) + 1,
        lastAt: previous && previous.lastAt > log.createdAt ? previous.lastAt : log.createdAt,
      };
      map.set(key, item);
    });
    visibleAccessLogs
      .filter((log) => log.status >= 500 || suspiciousType(log.uri) !== "기타 이상 요청")
      .forEach((log) => {
        const uri = normalizePath(log.uri);
        const key = `access:${log.status}:${log.method}:${uri}:${log.ip}`;
        const previous = map.get(key);
        const item: SecurityEvent = {
          key,
          severity: log.status >= 500 ? "오류" : "주의",
          source: "access",
          type: suspiciousType(log.uri, log.status),
          method: log.method,
          uri,
          status: log.status,
          ip: log.ip,
          message: `HTTP ${log.status} 응답 · ${log.elapsedMs}ms`,
          count: (previous?.count ?? 0) + 1,
          lastAt: previous && previous.lastAt > log.createdAt ? previous.lastAt : log.createdAt,
        };
        map.set(key, item);
      });
    return Array.from(map.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [visibleErrors, visibleAccessLogs]);

  const filteredSecurityEvents = securityEvents.filter((item) => {
    const text = `${item.type} ${item.method} ${item.uri} ${item.status} ${item.ip} ${item.exceptionType ?? ""} ${item.message}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

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
    const reason = window.prompt(role === "ADMIN" ? "관리자 권한을 부여하는 사유를 입력해주세요." : "관리자 권한을 해제하는 사유를 입력해주세요.");
    if (!reason || reason.trim().length < 5) return;
    const res = await authFetch(`${API_BASE}/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role, reason: reason.trim() }),
    });
    if (res.status === 401) { router.replace("/auth/login"); return; }
    if (res.status === 403) { setUnauthorized(true); return; }
    loadAll();
  }

  async function toggleHidden(reviewId: number, hidden: boolean) {
    const token = getToken();
    if (!token) return;
    const reason = window.prompt(hidden ? "독후감을 비공개로 전환하는 사유를 입력해주세요." : "독후감을 다시 공개하는 사유를 입력해주세요.");
    if (!reason || reason.trim().length < 5) return;
    const res = await authFetch(`${API_BASE}/api/admin/reviews/${reviewId}/hidden`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ hidden, reason: reason.trim() }),
    });
    if (res.status === 401) { router.replace("/auth/login"); return; }
    if (res.status === 403) { setUnauthorized(true); return; }
    loadAll();
  }

  async function reviewOfficialApplication(applicationId: number, action: "approve" | "reject") {
    const token = getToken();
    if (!token) return;
    const reason = window.prompt(action === "approve" ? "공식 프로필 신청을 승인하는 사유를 입력해주세요." : "공식 프로필 신청을 반려하는 사유를 입력해주세요.");
    if (!reason || reason.trim().length < 5) return;
    const res = await authFetch(`${API_BASE}/api/admin/profile-applications/${applicationId}/${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reviewNote: reason.trim() }),
    });
    if (res.status === 401) { router.replace("/auth/login"); return; }
    if (res.status === 403) { setUnauthorized(true); return; }
    loadAll();
  }

  async function addOfficialProfileBook(profileId: number, bookId: number) {
    const token = getToken();
    if (!token || !Number.isFinite(bookId) || bookId <= 0) return;
    const res = await authFetch(`${API_BASE}/api/admin/profiles/${profileId}/books`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ bookId }),
    });
    if (res.status === 401) { router.replace("/auth/login"); return; }
    if (res.status === 403) { setUnauthorized(true); return; }
    setBookSearchProfile(null);
    setBookSearchQuery("");
    setBookSearchResults([]);
    loadAll();
  }

  async function searchBooksForOfficialProfile(e?: React.FormEvent) {
    e?.preventDefault();
    if (!bookSearchQuery.trim() || bookSearching) return;
    setBookSearching(true);
    try {
      const res = await fetch(`${API_BASE}/api/books/search?q=${encodeURIComponent(bookSearchQuery.trim())}`);
      if (!res.ok) return;
      const json = await res.json();
      setBookSearchResults((json.data ?? []).slice(0, 10));
    } finally {
      setBookSearching(false);
    }
  }

  function closeBookSearchModal() {
    if (bookSearching) return;
    setBookSearchProfile(null);
    setBookSearchQuery("");
    setBookSearchResults([]);
  }

  async function removeOfficialProfileBook(profileId: number, bookId: number) {
    const token = getToken();
    if (!token) return;
    const res = await authFetch(`${API_BASE}/api/admin/profiles/${profileId}/books/${bookId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) { router.replace("/auth/login"); return; }
    if (res.status === 403) { setUnauthorized(true); return; }
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

          {tab === "officialProfiles" && (
            <section className="space-y-5">
              <div>
                <h2 className="mb-3 font-serif text-lg font-bold text-brown-900">신청 목록</h2>
                <div className="space-y-3">
                  {filteredOfficialApplications.map((application) => (
                    <div key={application.id} className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-brown-600">
                              {officialProfileTypeLabels[application.type]}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs ${
                              application.status === "APPROVED"
                                ? "bg-green-50 text-green-600"
                                : application.status === "REJECTED"
                                ? "bg-red-50 text-red-500"
                                : "bg-yellow-50 text-yellow-600"
                            }`}>
                              {officialApplicationStatusLabels[application.status]}
                            </span>
                          </div>
                          <p className="mt-2 font-serif text-lg font-bold text-brown-900">{application.displayName}</p>
                          <p className="mt-1 text-sm text-brown-500">
                            신청자 {application.applicantNickname} · {application.contactEmail} · {formatLogTime(application.createdAt)}
                          </p>
                          {application.bio && <p className="mt-2 line-clamp-2 text-sm leading-6 text-brown-600">{application.bio}</p>}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {application.officialUrl && (
                              <a href={application.officialUrl} target="_blank" rel="noopener noreferrer" className="text-brown-500 underline underline-offset-2">
                                공식 링크
                              </a>
                            )}
                            {application.proofUrl && (
                              <a href={application.proofUrl} target="_blank" rel="noopener noreferrer" className="text-brown-500 underline underline-offset-2">
                                증빙 링크
                              </a>
                            )}
                            {application.profileSlug && (
                              <Link href={`/profiles/${application.profileSlug}`} className="text-brown-500 underline underline-offset-2">
                                공개 프로필
                              </Link>
                            )}
                          </div>
                        </div>
                        {application.status === "PENDING" && (
                          <div className="flex shrink-0 gap-2">
                            <button
                              onClick={() => reviewOfficialApplication(application.id, "approve")}
                              className="rounded-lg bg-green-50 px-3 py-1.5 text-xs text-green-600 hover:bg-green-100"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => reviewOfficialApplication(application.id, "reject")}
                              className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-500 hover:bg-red-100"
                            >
                              반려
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredOfficialApplications.length === 0 && <EmptyState>공식 프로필 신청이 없어요</EmptyState>}
                </div>
              </div>

              <div>
                <h2 className="mb-3 font-serif text-lg font-bold text-brown-900">공식 프로필</h2>
                <div className="space-y-3">
                  {filteredOfficialProfiles.map((profile) => (
                    <div key={profile.id} className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-brown-600">
                              {officialProfileTypeLabels[profile.type]}
                            </span>
                            <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-brown-500">
                              {officialProfileStatusLabels[profile.status]}
                            </span>
                            {profile.verified && <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600">인증</span>}
                            {profile.featured && <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs text-yellow-600">상단</span>}
                          </div>
                          <p className="mt-2 font-serif text-lg font-bold text-brown-900">{profile.displayName}</p>
                          <Link href={`/profiles/${profile.slug}`} className="mt-1 inline-block text-xs text-brown-400 underline underline-offset-2">
                            /profiles/{profile.slug}
                          </Link>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            onClick={() => setBookSearchProfile(profile)}
                            className="rounded-lg border border-cream-300 px-3 py-1.5 text-xs text-brown-600 hover:bg-cream-50"
                          >
                            책 검색
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {profile.books.map((book) => (
                          <div key={book.id} className="flex items-center justify-between gap-3 rounded-xl bg-cream-50 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-brown-800">{book.title}</p>
                              <p className="text-xs text-brown-400">{book.author} · 독후감 {book.reviewCount}개 · 책 ID {book.id}</p>
                            </div>
                            <button
                              onClick={() => removeOfficialProfileBook(profile.id, book.id)}
                              className="shrink-0 text-xs text-red-400 hover:text-red-600"
                            >
                              해제
                            </button>
                          </div>
                        ))}
                        {profile.books.length === 0 && (
                          <p className="rounded-xl bg-cream-50 px-3 py-3 text-sm text-brown-300">연결된 책이 없어요</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredOfficialProfiles.length === 0 && <EmptyState>공식 프로필이 없어요</EmptyState>}
                </div>
              </div>
            </section>
          )}

          {tab === "pages" && (
            <section className="space-y-3">
              {filteredPageViews.slice(0, 120).map((event) => (
                <div key={event.id} className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-medium text-brown-600">페이지 조회</span>
                        <p className="font-medium text-brown-900">{getRouteLabel(event.path)}</p>
                      </div>
                      <p className="mt-2 break-all font-mono text-xs text-brown-400">{normalizePath(event.path)}</p>
                      <p className="mt-2 text-sm text-brown-500">
                        {actorLabel(event)} · {getDeviceLabel(event.device)} · 유입 {referrerLabel(event.referrer)}
                      </p>
                    </div>
                    <div className="shrink-0 text-left text-xs text-brown-300 sm:text-right">
                      <p>{formatLogTime(event.createdAt)}</p>
                      <p className="mt-1">세션 {shortSession(event.sessionId)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {filteredPageViews.length === 0 && <EmptyState>페이지 조회 기록이 없어요</EmptyState>}
            </section>
          )}

          {tab === "actions" && (
            <section className="space-y-3">
              {filteredActions.slice(0, 120).map((event) => (
                <div key={event.id} className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-brown-900">{getMetricEventLabel(event.eventType)}</p>
                      <p className="mt-1 text-sm text-brown-500">
                        {actorLabel(event)} · {getDeviceLabel(event.device)} · {getRouteLabel(event.path)}
                      </p>
                      <p className="mt-2 break-all font-mono text-xs text-brown-400">{normalizePath(event.path)}</p>
                      <p className="mt-2 text-xs text-brown-300">
                        체류 {formatDuration(event.durationMs)} · 유입 {referrerLabel(event.referrer)}
                      </p>
                    </div>
                    <div className="shrink-0 text-left text-xs text-brown-300 sm:text-right">
                      <p>{formatLogTime(event.createdAt)}</p>
                      <p className="mt-1">세션 {shortSession(event.sessionId)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {filteredActions.length === 0 && <EmptyState>사용자 행동 기록이 없어요</EmptyState>}
            </section>
          )}

          {tab === "security" && (
            <section className="space-y-3">
              {filteredSecurityEvents.slice(0, 120).map((item) => (
                <div key={item.key} className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${item.severity === "오류" ? "bg-red-50 text-red-500" : "bg-yellow-50 text-yellow-600"}`}>{item.severity}</span>
                        <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-brown-500">{item.status}</span>
                        <p className="font-medium text-brown-900">{item.type}</p>
                      </div>
                      <p className="mt-2 break-all font-mono text-xs text-brown-400">{item.method} {item.uri}</p>
                      <p className="mt-2 text-sm leading-6 text-brown-700">
                        {item.exceptionType ? `${item.exceptionType}: ` : ""}{item.message}
                      </p>
                      <p className="mt-2 text-xs text-brown-300">
                        IP {item.ip} · {item.source === "error" ? "오류 로그" : "접근 로그"} · {formatLogTime(item.lastAt)}
                      </p>
                    </div>
                    {item.count > 1 && <p className="shrink-0 rounded-full bg-cream-100 px-3 py-1 text-xs font-semibold text-brown-600">중복 {item.count}회</p>}
                  </div>
                </div>
              ))}
              {filteredSecurityEvents.length === 0 && <EmptyState>보안·오류 이슈가 없어요</EmptyState>}
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
      {bookSearchProfile && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 sm:items-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeBookSearchModal} />
          <div className="relative z-10 w-full max-w-xl rounded-t-2xl border border-cream-200 bg-white p-5 shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-lg font-bold text-brown-900">책 연결</h2>
                <p className="mt-1 text-sm text-brown-400">{bookSearchProfile.displayName} 프로필에 연결할 책을 검색하세요.</p>
              </div>
              <button
                type="button"
                onClick={closeBookSearchModal}
                className="text-xl leading-none text-brown-300 hover:text-brown-600"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <form onSubmit={searchBooksForOfficialProfile} className="mt-4 flex gap-2">
              <input
                value={bookSearchQuery}
                onChange={(event) => setBookSearchQuery(event.target.value)}
                placeholder="책 제목, 저자, ISBN 검색"
                className="min-w-0 flex-1 rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-800 focus:border-brown-400 focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                disabled={bookSearching || !bookSearchQuery.trim()}
                className="rounded-xl bg-brown-600 px-4 py-2 text-sm text-white hover:bg-brown-700 disabled:opacity-50"
              >
                {bookSearching ? "검색 중" : "검색"}
              </button>
            </form>

            <div className="mt-4 max-h-[52vh] overflow-y-auto">
              {bookSearchResults.length === 0 ? (
                <p className="rounded-xl bg-cream-50 py-8 text-center text-sm text-brown-300">
                  검색어를 입력하고 책을 찾아보세요.
                </p>
              ) : (
                <div className="space-y-2">
                  {bookSearchResults.map((book) => {
                    const alreadyLinked = bookSearchProfile.books.some((item) => item.id === book.id);
                    return (
                      <div key={book.id} className="flex items-center gap-3 rounded-xl border border-cream-200 px-3 py-2">
                        {book.thumbnail ? (
                          <img src={book.thumbnail} alt={book.title} className="h-14 w-10 shrink-0 rounded object-cover shadow-sm" />
                        ) : (
                          <div className="flex h-14 w-10 shrink-0 items-end justify-center rounded bg-brown-200 pb-1 text-xs font-bold text-white">
                            {book.title[0]}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-brown-800">{book.title}</p>
                          <p className="truncate text-xs text-brown-400">{book.author}</p>
                          {book.publisher && <p className="truncate text-xs text-brown-300">{book.publisher}</p>}
                        </div>
                        <button
                          type="button"
                          disabled={alreadyLinked}
                          onClick={() => addOfficialProfileBook(bookSearchProfile.id, book.id)}
                          className="shrink-0 rounded-lg border border-cream-300 px-3 py-1.5 text-xs text-brown-600 hover:bg-cream-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {alreadyLinked ? "연결됨" : "연결"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
