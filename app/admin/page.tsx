"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReviewDetailModal from "../components/ReviewDetailModal";
import { API_BASE } from "../lib/api";
import { authFetch, getValidToken } from "../lib/auth";

type Tab = "dashboard" | "users" | "reviews" | "groups" | "inquiries" | "officialProfiles" | "actions" | "security" | "audit";

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

interface AdminReadingGroup {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  joinPolicy: "OPEN" | "APPROVAL";
  joinEnabled: boolean;
  ownerId: number;
  ownerNickname: string;
  memberCount: number;
  pendingCount: number;
  bookCount: number;
  createdAt: string;
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
  userAgent: string | null;
  referer: string | null;
  createdAt: string;
}

interface BookTitleResponse {
  id?: number;
  title: string;
  author?: string;
  thumbnail?: string | null;
}

interface ReviewLookupResponse {
  id: number;
  content: string;
  author: { nickname: string };
  book: { title: string; author: string; thumbnail: string | null } | null;
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
  todayBookSearches?: number;
  todayBookDetailViews?: number;
  todayReviewDetailViews?: number;
  todayReviews: number;
  todayUsers: number;
  todayServerErrors: number;
  todaySuspiciousRequests: number;
}

interface AggregatedSecurity {
  severity: string;
  type: string;
  uri: string;
  count: number;
  ip: string;
  lastAt: string;
}

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
  userId?: number | null;
  userAgent?: string | null;
  referer?: string | null;
  occurrenceTimes: string[];
};

type ContentViewSummary = {
  path: string;
  title: string;
  subtitle: string;
  thumbnail?: string | null;
  views: number;
  visitors: Set<string>;
  lastAt: string;
  href: string;
};

const tabs: Array<{ key: Tab; label: string }> = [
  { key: "dashboard", label: "📊 운영 현황" },
  { key: "users", label: "👥 회원" },
  { key: "reviews", label: "📖 독후감" },
  { key: "groups", label: "👪 독서모임" },
  { key: "inquiries", label: "💬 문의" },
  { key: "officialProfiles", label: "🏷️ 공식 프로필" },
  { key: "actions", label: "🧭 유입·사용자 행동" },
  { key: "security", label: "🛡️ 보안·오류" },
  { key: "audit", label: "🧾 관리자 이력" },
];

const LIST_PAGE_SIZE = 50;

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

function appendPageParam(path: string, page: number) {
  return `${path}${path.includes("?") ? "&" : "?"}page=${page}`;
}

function getPageCount(total: number) {
  return Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
}

function paginate<T>(items: T[], page: number) {
  const start = page * LIST_PAGE_SIZE;
  return items.slice(start, start + LIST_PAGE_SIZE);
}

function getBookPath(value: string) {
  const path = normalizePath(value);
  return /^\/books\/[^/]+$/.test(path) ? path : null;
}

function getBookSlug(value: string) {
  return getBookPath(value)?.split("/").pop() ?? null;
}

function getReviewPath(value: string) {
  const path = normalizePath(value);
  return /^\/reviews\/\d+$/.test(path) ? path : null;
}

function getReviewId(value: string) {
  const id = getReviewPath(value)?.split("/").pop();
  return id ? Number(id) : null;
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

function classifyErrorLike(method: string, uri: string, status: number) {
  const path = normalizePath(uri);
  const lower = path.toLowerCase();
  if (method === "POST" && path === "/api/auth/refresh" && (status === 401 || status === 403)) {
    return {
      label: "세션 갱신 실패",
      description: "로그인 만료, refresh token 없음, 폐기된 세션, 브라우저 쿠키 누락, 봇 요청 가능성이 있습니다.",
      impact: "사용자가 로그인 페이지로 이동했거나 로그인 상태가 풀렸을 수 있습니다.",
      botSuspected: false,
      userImpactLikely: false,
    };
  }
  if (method === "GET" && path.startsWith("/api/books/public/") && status === 404) {
    return {
      label: "공개 책 상세 조회 실패",
      description: "없는 책 ID/slug 접근, 삭제된 책, 비공개 책, 오래된 링크, 봇 접근 가능성이 있습니다.",
      impact: "사용자가 책 상세 페이지에서 404를 봤을 수 있습니다.",
      botSuspected: false,
      userImpactLikely: true,
    };
  }
  if ([".env", ".git", "wp-login.php", "xmlrpc.php", "phpmyadmin", ".php", ".bak", ".sql", "swagger-ui", "v3/api-docs", "actuator"].some((needle) => lower.includes(needle))) {
    return {
      label: "스캐너 의심 요청",
      description: "일반 사용자가 아니라 취약점 스캐너일 가능성이 높습니다.",
      impact: "일반 사용자 영향은 낮습니다.",
      botSuspected: true,
      userImpactLikely: false,
    };
  }
  if (status >= 500) {
    return {
      label: "서버 오류",
      description: "실제 서버 예외 가능성이 높으므로 우선 확인이 필요합니다.",
      impact: "사용자가 기능 실패를 경험했을 수 있습니다.",
      botSuspected: false,
      userImpactLikely: true,
    };
  }
  if (status === 403) {
    return {
      label: "권한 없음",
      description: "권한이 없는 사용자가 보호된 리소스에 접근했습니다.",
      impact: "권한이 필요한 기능에서 차단되었을 수 있습니다.",
      botSuspected: false,
      userImpactLikely: true,
    };
  }
  if (status === 404) {
    return {
      label: "리소스 없음",
      description: "존재하지 않는 경로나 삭제된 리소스 접근입니다.",
      impact: "사용자가 404 화면을 봤을 수 있습니다.",
      botSuspected: false,
      userImpactLikely: true,
    };
  }
  return {
    label: suspiciousType(uri, status),
    description: "추가 확인이 필요한 요청 오류입니다.",
    impact: "사용자 영향 여부를 referer와 User-Agent로 확인하세요.",
    botSuspected: false,
    userImpactLikely: status >= 400,
  };
}

function getActionDescription(
  event: MetricEvent,
  bookMetaByPath: Record<string, BookTitleResponse>,
  reviewMetaByPath: Record<string, ReviewLookupResponse>
) {
  const path = normalizePath(event.path);
  const review = reviewMetaByPath[path];
  if (event.eventType === "page_view" && review) {
    const bookTitle = review.book?.title ?? "책 정보 없음";
    return `${actorLabel(event)} · ${review.author.nickname}님의 ${bookTitle} 독후감을 봤어요`;
  }
  const book = bookMetaByPath[path];
  if (event.eventType === "page_view" && book) {
    return `${actorLabel(event)} · ${book.title} 책을 봤어요`;
  }
  if (event.eventType === "page_view") {
    const reviewId = getReviewId(path);
    if (reviewId) return `${actorLabel(event)} · 독후감 #${reviewId}을 봤어요`;
    return `${actorLabel(event)} · ${getRouteLabel(path)}을 봤어요`;
  }
  return `${actorLabel(event)} · ${getMetricEventLabel(event.eventType)}`;
}

function getActionContext(
  event: MetricEvent,
  bookMetaByPath: Record<string, BookTitleResponse>,
  reviewMetaByPath: Record<string, ReviewLookupResponse>
) {
  const path = normalizePath(event.path);
  const review = reviewMetaByPath[path];
  if (review) {
    const book = review.book;
    return `독후감 상세 · 작성자 ${review.author.nickname} · ${book ? `${book.title}${book.author ? ` · ${book.author}` : ""}` : "책 정보 없음"}`;
  }
  const reviewId = getReviewId(path);
  if (reviewId) return `독후감 상세 · ID ${reviewId}`;
  const book = bookMetaByPath[path];
  if (book) return `책 상세 · ${book.title}${book.author ? ` · ${book.author}` : ""}`;
  return getRouteLabel(path);
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

function PaginationControls({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pageCount = getPageCount(total);
  if (pageCount <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
      <button
        type="button"
        disabled={page <= 0}
        onClick={() => onChange(page - 1)}
        className="rounded-xl border border-cream-300 px-3 py-1.5 text-xs text-brown-500 transition hover:border-brown-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        이전
      </button>
      <span className="text-xs text-brown-400">
        {page + 1} / {pageCount} · 총 {total.toLocaleString()}개
      </span>
      <button
        type="button"
        disabled={page >= pageCount - 1}
        onClick={() => onChange(page + 1)}
        className="rounded-xl border border-cream-300 px-3 py-1.5 text-xs text-brown-500 transition hover:border-brown-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        다음
      </button>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [users, setUsers] = useState<User[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [bookStats, setBookStats] = useState<BookStat[]>([]);
  const [readingGroups, setReadingGroups] = useState<AdminReadingGroup[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [officialApplications, setOfficialApplications] = useState<OfficialProfileApplication[]>([]);
  const [officialProfiles, setOfficialProfiles] = useState<OfficialProfile[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [metricEvents, setMetricEvents] = useState<MetricEvent[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [aggregatedSecurity, setAggregatedSecurity] = useState<AggregatedSecurity[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedReviewId, setSelectedReviewId] = useState<number | null>(null);
  const [bookSearchProfile, setBookSearchProfile] = useState<OfficialProfile | null>(null);
  const [bookSearchQuery, setBookSearchQuery] = useState("");
  const [bookSearchResults, setBookSearchResults] = useState<BookSearchResult[]>([]);
  const [bookSearching, setBookSearching] = useState(false);
  const [bookMetaByPath, setBookMetaByPath] = useState<Record<string, BookTitleResponse>>({});
  const [reviewMetaByPath, setReviewMetaByPath] = useState<Record<string, ReviewLookupResponse>>({});
  const [usersPage, setUsersPage] = useState(0);
  const [reviewsPage, setReviewsPage] = useState(0);
  const [groupsPage, setGroupsPage] = useState(0);
  const [inquiriesPage, setInquiriesPage] = useState(0);
  const [officialApplicationsPage, setOfficialApplicationsPage] = useState(0);
  const [officialProfilesPage, setOfficialProfilesPage] = useState(0);
  const [actionsPage, setActionsPage] = useState(0);
  const [securityPage, setSecurityPage] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const [securityTypeFilter, setSecurityTypeFilter] = useState("");
  const [securityStatusFilter, setSecurityStatusFilter] = useState("");
  const [securityAudienceFilter, setSecurityAudienceFilter] = useState("");
  const [securityGroupBy, setSecurityGroupBy] = useState("default");
  const [expandedSecurityKey, setExpandedSecurityKey] = useState<string | null>(null);

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

  async function fetchAllPages<T>(path: string) {
    const first = await fetchAdmin<PageResponse<T>>(appendPageParam(path, 0));
    if (!first) return [];

    const content = [...(first.content ?? [])];
    const totalPages = first.totalPages ?? 1;
    for (let page = 1; page < totalPages; page += 1) {
      const next = await fetchAdmin<PageResponse<T>>(appendPageParam(path, page));
      content.push(...(next?.content ?? []));
    }
    return content;
  }

  async function fetchContentLookups(events: MetricEvent[], adminReviews: Review[], stats: BookStat[]) {
    const bookFallbacks = Object.fromEntries(
      stats.map((book) => [normalizePath(`/books/${book.bookId}`), {
        id: book.bookId,
        title: book.title,
        author: book.author,
        thumbnail: null,
      }])
    );
    const reviewFallbacks = Object.fromEntries(
      adminReviews.map((review) => [normalizePath(`/reviews/${review.id}`), {
        id: review.id,
        content: review.content,
        author: { nickname: review.authorNickname },
        book: { title: review.bookTitle, author: "", thumbnail: null },
      }])
    );
    const paths = Array.from(new Set(events.map((event) => getBookPath(event.path)).filter(Boolean) as string[])).slice(0, 80);
    const bookEntries = await Promise.all(paths.map(async (path) => {
      const slug = getBookSlug(path);
      if (!slug) return null;
      try {
        const res = await fetch(`${API_BASE}/api/books/public/${encodeURIComponent(slug)}`, {
          credentials: "include",
        });
        if (res.ok) {
          const json = await res.json();
          const book = (json.data ?? json) as BookTitleResponse;
          if (book.title) return [path, book] as const;
        }
      } catch {
        // fall through to the id-based lookup below
      }
      if (/^\d+$/.test(slug)) {
        try {
          const res = await fetch(`${API_BASE}/api/books/${encodeURIComponent(slug)}`, {
            credentials: "include",
          });
          if (!res.ok) return null;
          const json = await res.json();
          const book = (json.data ?? json) as BookTitleResponse;
          return book.title ? [path, book] as const : null;
        } catch {
          return null;
        }
      }
      return null;
    }));
    const reviewPaths = Array.from(new Set(events.map((event) => getReviewPath(event.path)).filter(Boolean) as string[])).slice(0, 80);
    const reviewEntries = await Promise.all(reviewPaths.map(async (path) => {
      const reviewId = getReviewId(path);
      if (!reviewId) return null;
      try {
        const res = await fetch(`${API_BASE}/api/reviews/${reviewId}`, {
          credentials: "include",
        });
        if (!res.ok) return null;
        const json = await res.json();
        const review = (json.data ?? json) as ReviewLookupResponse;
        return review.id ? [path, review] as const : null;
      } catch {
        return null;
      }
    }));
    const books = {
      ...bookFallbacks,
      ...Object.fromEntries(bookEntries.filter(Boolean) as Array<readonly [string, BookTitleResponse]>),
    };
    return {
      books,
      reviews: {
        ...reviewFallbacks,
        ...Object.fromEntries(reviewEntries.filter(Boolean) as Array<readonly [string, ReviewLookupResponse]>),
      },
    };
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [
        nextUsers,
        nextReviews,
        nextStats,
        nextReadingGroups,
        nextInquiries,
        nextOfficialApplications,
        nextOfficialProfiles,
        nextAccess,
        nextMetrics,
        nextErrors,
        nextAudit,
        nextDashboard,
        nextSecurity,
      ] = await Promise.all([
        fetchAllPages<User>("/api/admin/users?size=200"),
        fetchAllPages<Review>("/api/admin/reviews?size=200"),
        fetchAdmin<BookStat[]>("/api/admin/reviews/stats"),
        fetchAllPages<AdminReadingGroup>("/api/admin/groups?size=200"),
        fetchAllPages<Inquiry>("/api/admin/inquiries?size=200"),
        fetchAllPages<OfficialProfileApplication>("/api/admin/profile-applications?size=200"),
        fetchAdmin<OfficialProfile[]>("/api/admin/profiles"),
        fetchAllPages<AccessLog>("/api/admin/access-logs?size=200"),
        fetchAllPages<MetricEvent>("/api/admin/metrics?size=200"),
        fetchAllPages<ErrorLog>("/api/admin/error-logs?size=200"),
        fetchAllPages<AdminAuditLog>("/api/admin/audit-logs?size=200"),
        fetchAdmin<DashboardSummary>("/api/admin/dashboard/summary"),
        fetchAdmin<AggregatedSecurity[]>("/api/admin/security/summary"),
      ]);
      const nextContentLookups = await fetchContentLookups(nextMetrics, nextReviews, nextStats ?? []);
      setUsers(nextUsers);
      setReviews(nextReviews);
      setBookStats(nextStats ?? []);
      setReadingGroups(nextReadingGroups);
      setInquiries(nextInquiries);
      setOfficialApplications(nextOfficialApplications);
      setOfficialProfiles(nextOfficialProfiles ?? []);
      setAccessLogs(nextAccess);
      setMetricEvents(nextMetrics);
      setErrorLogs(nextErrors);
      setAuditLogs(nextAudit);
      setBookMetaByPath(nextContentLookups.books);
      setReviewMetaByPath(nextContentLookups.reviews);
      setDashboardSummary(nextDashboard);
      setAggregatedSecurity(nextSecurity ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    setUsersPage(0);
    setReviewsPage(0);
    setGroupsPage(0);
    setInquiriesPage(0);
    setOfficialApplicationsPage(0);
    setOfficialProfilesPage(0);
    setActionsPage(0);
    setSecurityPage(0);
    setAuditPage(0);
  }, [query, tab]);

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

  const filteredReadingGroups = readingGroups.filter((group) => {
    const text = `${group.name} ${group.slug} ${group.description ?? ""} ${group.ownerNickname} ${group.visibility} ${group.joinPolicy} ${group.joinEnabled ? "가입가능" : "가입중지"}`.toLowerCase();
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

  const filteredAuditLogs = auditLogs.filter((log) => {
    const text = `${log.actorNickname ?? ""} ${log.action} ${log.targetType} ${log.summary}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  const filteredActions = visibleMetrics
    .filter((event) => !["heartbeat", "session_end"].includes(event.eventType))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((event) => {
      const text = `${getActionDescription(event, bookMetaByPath, reviewMetaByPath)} ${getActionContext(event, bookMetaByPath, reviewMetaByPath)} ${getMetricEventLabel(event.eventType)} ${event.nickname ?? ""} ${event.path} ${event.ip ?? ""}`.toLowerCase();
      return text.includes(query.toLowerCase());
    });

  const securityEvents = useMemo(() => {
    const map = new Map<string, SecurityEvent>();
    visibleErrors.forEach((log) => {
      const uri = normalizePath(log.uri);
      const message = log.message || "(no message)";
      const groupKey = securityGroupBy === "ip"
        ? log.ip ?? "-"
        : securityGroupBy === "path"
        ? uri
        : `${log.status}:${log.exceptionType}:${uri}:${message}:${log.ip ?? ""}`;
      const key = `error:${groupKey}`;
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
        userId: previous?.userId ?? log.userId,
        userAgent: previous?.userAgent ?? log.userAgent,
        referer: previous?.referer ?? log.referer,
        occurrenceTimes: [...(previous?.occurrenceTimes ?? []), log.createdAt].sort((a, b) => b.localeCompare(a)).slice(0, 20),
      };
      map.set(key, item);
    });
    visibleAccessLogs
      .filter((log) => log.status >= 500 || suspiciousType(log.uri) !== "기타 이상 요청")
      .forEach((log) => {
        const uri = normalizePath(log.uri);
        const groupKey = securityGroupBy === "ip"
          ? log.ip
          : securityGroupBy === "path"
          ? uri
          : `${log.status}:${log.method}:${uri}:${log.ip}`;
        const key = `access:${groupKey}`;
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
          occurrenceTimes: [...(previous?.occurrenceTimes ?? []), log.createdAt].sort((a, b) => b.localeCompare(a)).slice(0, 20),
        };
        map.set(key, item);
      });
    return Array.from(map.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [visibleErrors, visibleAccessLogs, securityGroupBy]);

  const filteredSecurityEvents = securityEvents.filter((item) => {
    const info = classifyErrorLike(item.method, item.uri, item.status);
    const text = `${info.label} ${item.type} ${item.method} ${item.uri} ${item.status} ${item.ip} ${item.exceptionType ?? ""} ${item.message} ${item.userAgent ?? ""} ${item.referer ?? ""}`.toLowerCase();
    if (!text.includes(query.toLowerCase())) return false;
    if (securityTypeFilter && info.label !== securityTypeFilter) return false;
    if (securityStatusFilter && String(item.status) !== securityStatusFilter) return false;
    if (securityAudienceFilter === "bot" && !info.botSuspected) return false;
    if (securityAudienceFilter === "user" && !info.userImpactLikely) return false;
    return true;
  });

  const todayVisibleMetrics = visibleMetrics.filter((event) => isToday(event.createdAt));

  const todayBookViews = useMemo(() => {
    const map = new Map<string, ContentViewSummary>();
    todayVisibleMetrics
      .filter((event) => event.eventType === "page_view")
      .forEach((event) => {
        const path = getBookPath(event.path);
        if (!path) return;
        const book = bookMetaByPath[path];
        const item = map.get(path) ?? {
          path,
          title: book?.title ?? getRouteLabel(path),
          subtitle: book?.author ? `${book.author} · 책 상세` : "책 상세",
          thumbnail: book?.thumbnail,
          views: 0,
          visitors: new Set<string>(),
          lastAt: event.createdAt,
          href: path,
        };
        item.views += 1;
        item.visitors.add(visitorKey(event));
        if (event.createdAt > item.lastAt) item.lastAt = event.createdAt;
        map.set(path, item);
      });
    return Array.from(map.values()).sort((a, b) => b.views - a.views || b.lastAt.localeCompare(a.lastAt)).slice(0, 5);
  }, [todayVisibleMetrics, bookMetaByPath]);

  const todayReviewViews = useMemo(() => {
    const map = new Map<string, ContentViewSummary>();
    todayVisibleMetrics
      .filter((event) => event.eventType === "page_view")
      .forEach((event) => {
        const path = getReviewPath(event.path);
        if (!path) return;
        const review = reviewMetaByPath[path];
        const item = map.get(path) ?? {
          path,
          title: review?.book ? `${review.book.title} 독후감` : "독후감 상세",
          subtitle: review ? `작성자 ${review.author.nickname} · ${review.content.slice(0, 36)}` : "독후감 상세",
          thumbnail: review?.book?.thumbnail,
          views: 0,
          visitors: new Set<string>(),
          lastAt: event.createdAt,
          href: path,
        };
        item.views += 1;
        item.visitors.add(visitorKey(event));
        if (event.createdAt > item.lastAt) item.lastAt = event.createdAt;
        map.set(path, item);
      });
    return Array.from(map.values()).sort((a, b) => b.views - a.views || b.lastAt.localeCompare(a.lastAt)).slice(0, 5);
  }, [todayVisibleMetrics, reviewMetaByPath]);

  const todaySearchCount = todayVisibleMetrics.filter((event) =>
    event.eventType === "book_search" || (event.eventType === "page_view" && normalizePath(event.path) === "/search")
  ).length;

  const todayBookDetailViewCount = todayVisibleMetrics.filter((event) =>
    event.eventType === "page_view" && Boolean(getBookPath(event.path))
  ).length;

  const todayReviewDetailViewCount = todayVisibleMetrics.filter((event) =>
    event.eventType === "page_view" && Boolean(getReviewPath(event.path))
  ).length;

  const referrerSummaries = Array.from(todayVisibleMetrics.reduce((map, event) => {
    if (event.eventType === "page_view") {
      const key = referrerLabel(event.referrer);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const impactfulSecurityEvents = filteredSecurityEvents.filter((item) => {
    const info = classifyErrorLike(item.method, item.uri, item.status);
    return info.userImpactLikely;
  }).slice(0, 5);

  const scannerSecurityEvents = filteredSecurityEvents.filter((item) => classifyErrorLike(item.method, item.uri, item.status).botSuspected).slice(0, 5);
  const sessionRefreshEvents = filteredSecurityEvents.filter((item) => classifyErrorLike(item.method, item.uri, item.status).label === "세션 갱신 실패").slice(0, 5);

  const pagedUsers = paginate(filteredUsers, usersPage);
  const pagedReviews = paginate(filteredReviews, reviewsPage);
  const pagedReadingGroups = paginate(filteredReadingGroups, groupsPage);
  const pagedInquiries = paginate(filteredInquiries, inquiriesPage);
  const pagedOfficialApplications = paginate(filteredOfficialApplications, officialApplicationsPage);
  const pagedOfficialProfiles = paginate(filteredOfficialProfiles, officialProfilesPage);
  const pagedActions = paginate(filteredActions, actionsPage);
  const pagedSecurityEvents = paginate(filteredSecurityEvents, securityPage);
  const pagedAuditLogs = paginate(filteredAuditLogs, auditPage);

  const fallbackTodayVisitors = new Set(visibleMetrics.filter((event) => isToday(event.createdAt)).map(visitorKey)).size;
  const fallbackTodayReviews = reviews.filter((review) => isToday(review.createdAt)).length;
  const fallbackTodayUsers = users.filter((user) => isToday(user.createdAt)).length;
  const fallbackTodayErrors = visibleErrors.filter((error) => isToday(error.createdAt) && error.status >= 500).length;
  const fallbackTodaySecurity = securitySummaries.filter((item) => isToday(item.lastAt)).reduce((sum, item) => sum + item.count, 0);
  const todayVisitors = dashboardSummary?.todayVisitors ?? fallbackTodayVisitors;
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

  async function toggleGroupJoin(group: AdminReadingGroup) {
    const token = getToken();
    if (!token) return;
    const enabled = !group.joinEnabled;
    const reason = window.prompt(enabled ? "독서모임 가입을 재개하는 사유를 입력해주세요." : "독서모임 가입을 중지하는 사유를 입력해주세요.");
    if (!reason || reason.trim().length < 5) return;
    const res = await authFetch(`${API_BASE}/api/admin/groups/${group.id}/join-enabled`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, reason: reason.trim() }),
    });
    if (res.status === 401) { router.replace("/auth/login"); return; }
    if (res.status === 403) { setUnauthorized(true); return; }
    loadAll();
  }

  async function deleteGroup(group: AdminReadingGroup) {
    const token = getToken();
    if (!token) return;
    if (!window.confirm(`'${group.name}' 독서모임을 삭제할까요? 멤버, 선정 책, 연결된 그룹 독후감 정보도 함께 삭제됩니다.`)) return;
    const reason = window.prompt("독서모임을 삭제하는 사유를 입력해주세요.");
    if (!reason || reason.trim().length < 5) return;
    const res = await authFetch(`${API_BASE}/api/admin/groups/${group.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
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
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="오늘 방문자" value={todayVisitors} helper="관리자 제외" />
                <StatCard label="책 상세 방문" value={dashboardSummary?.todayBookDetailViews ?? todayBookDetailViewCount} />
                <StatCard label="독후감 상세 방문" value={dashboardSummary?.todayReviewDetailViews ?? todayReviewDetailViewCount} />
                <StatCard label="책 검색" value={dashboardSummary?.todayBookSearches ?? todaySearchCount} />
                <StatCard label="독후감 작성" value={todayReviews} />
                <StatCard label="오늘 가입" value={todayUsers} />
                <StatCard label="서버 오류" value={todayErrors} helper="오늘 5xx" />
                <StatCard label="의심 요청" value={todaySecurity} helper="스캔/오류 묶음" />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <h2 className="font-serif text-lg font-bold text-brown-900">책별 독후감 TOP 5</h2>
                  <div className="mt-3 space-y-3">
                    {bookStats.slice(0, 5).map((book) => (
                      <Link key={book.bookId} href={`/books/${book.bookId}/reviews`} className="block rounded-xl bg-cream-50 p-3 hover:bg-cream-100">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-brown-800">{book.title}</p>
                            <p className="text-xs text-brown-400">{book.author}</p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-brown-700">{book.reviewCount}개</p>
                        </div>
                      </Link>
                    ))}
                    {bookStats.length === 0 && <p className="py-6 text-center text-sm text-brown-300">독후감 데이터가 없어요</p>}
                  </div>
                </section>

                <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <h2 className="font-serif text-lg font-bold text-brown-900">오늘 많이 본 책 TOP 5</h2>
                  <div className="mt-3 space-y-3">
                    {todayBookViews.map((book) => (
                      <Link key={book.path} href={book.href} className="block rounded-xl bg-cream-50 p-3 hover:bg-cream-100">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-brown-800">{book.title}</p>
                            <p className="truncate text-xs text-brown-400">{book.subtitle}</p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-brown-700">{book.views}회</p>
                        </div>
                        <p className="mt-2 text-xs text-brown-400">방문자 {book.visitors.size}명 · 마지막 {formatLogTime(book.lastAt)}</p>
                      </Link>
                    ))}
                    {todayBookViews.length === 0 && <p className="py-6 text-center text-sm text-brown-300">오늘 책 상세 방문이 없어요</p>}
                  </div>
                </section>

                <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <h2 className="font-serif text-lg font-bold text-brown-900">오늘 많이 본 독후감 TOP 5</h2>
                  <div className="mt-3 space-y-3">
                    {todayReviewViews.map((review) => (
                      <Link key={review.path} href={review.href} className="block rounded-xl bg-cream-50 p-3 hover:bg-cream-100">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-brown-800">{review.title}</p>
                            <p className="truncate text-xs text-brown-400">{review.subtitle}</p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-brown-700">{review.views}회</p>
                        </div>
                        <p className="mt-2 text-xs text-brown-400">방문자 {review.visitors.size}명 · 마지막 {formatLogTime(review.lastAt)}</p>
                      </Link>
                    ))}
                    {todayReviewViews.length === 0 && <p className="py-6 text-center text-sm text-brown-300">오늘 독후감 상세 방문이 없어요</p>}
                  </div>
                </section>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <h2 className="font-serif text-lg font-bold text-brown-900">검색·유입</h2>
                  <div className="mt-3 space-y-3">
                    <div className="rounded-xl bg-cream-50 p-3">
                      <p className="font-medium text-brown-800">오늘 책 검색</p>
                      <p className="mt-1 text-2xl font-bold text-brown-900">{dashboardSummary?.todayBookSearches ?? todaySearchCount}</p>
                    </div>
                    {referrerSummaries.map(([label, count]) => (
                      <div key={label} className="flex items-center justify-between rounded-xl bg-cream-50 px-3 py-2">
                        <p className="text-sm text-brown-700">{label}</p>
                        <p className="text-sm font-bold text-brown-700">{count}회</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <h2 className="font-serif text-lg font-bold text-brown-900">사용자 영향 가능 오류</h2>
                  <div className="mt-3 space-y-2">
                    {impactfulSecurityEvents.map((item) => (
                      <div key={item.key} className="rounded-xl bg-red-50 p-3">
                        <p className="font-medium text-red-600">{classifyErrorLike(item.method, item.uri, item.status).label}</p>
                        <p className="mt-1 truncate text-xs text-red-400">{item.method} {item.uri} · {item.count}회 · {formatLogTime(item.lastAt)}</p>
                      </div>
                    ))}
                    {impactfulSecurityEvents.length === 0 && <p className="py-6 text-center text-sm text-brown-300">사용자 영향 가능 오류가 없어요</p>}
                  </div>
                </section>

                <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <h2 className="font-serif text-lg font-bold text-brown-900">스캐너·세션 요약</h2>
                  <div className="mt-3 space-y-2">
                    <div className="rounded-xl bg-cream-50 p-3">
                      <p className="text-sm font-medium text-brown-800">스캐너 의심</p>
                      <p className="text-xs text-brown-400">{scannerSecurityEvents.reduce((sum, item) => sum + item.count, 0)}회</p>
                    </div>
                    <div className="rounded-xl bg-cream-50 p-3">
                      <p className="text-sm font-medium text-brown-800">세션 갱신 실패</p>
                      <p className="text-xs text-brown-400">{sessionRefreshEvents.reduce((sum, item) => sum + item.count, 0)}회</p>
                    </div>
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
                  {pagedUsers.map((user) => (
                    <tr key={user.id} className="border-t border-cream-100 hover:bg-cream-50">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/users/${user.id}`} className="text-brown-800 hover:text-brown-600 hover:underline">
                          {user.nickname}
                        </Link>
                      </td>
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
              <PaginationControls page={usersPage} total={filteredUsers.length} onChange={setUsersPage} />
              {filteredUsers.length === 0 && <div className="border-t border-cream-100 py-8 text-center text-sm text-brown-300">회원이 없어요</div>}
            </section>
          )}

          {tab === "reviews" && (
            <section className="space-y-3">
              {pagedReviews.map((review) => (
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
              <PaginationControls page={reviewsPage} total={filteredReviews.length} onChange={setReviewsPage} />
              {filteredReviews.length === 0 && <EmptyState>독후감이 없어요</EmptyState>}
            </section>
          )}

          {tab === "groups" && (
            <section className="space-y-3">
              {pagedReadingGroups.map((group) => (
                <div key={group.id} className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/groups/${group.slug}`} className="font-serif text-lg font-bold text-brown-900 hover:text-brown-600 hover:underline">
                          {group.name}
                        </Link>
                        <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-brown-600">
                          {group.visibility === "PUBLIC" ? "공개" : "비공개"}
                        </span>
                        <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-brown-600">
                          {group.joinPolicy === "OPEN" ? "바로 가입" : "승인제"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${group.joinEnabled ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                          {group.joinEnabled ? "가입 가능" : "가입 중지"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-brown-500">
                        모임장 {group.ownerNickname} · 멤버 {group.memberCount}명 · 대기 {group.pendingCount}명 · 책 {group.bookCount}권 · {formatLogTime(group.createdAt)}
                      </p>
                      {group.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-brown-600">{group.description}</p>}
                      <p className="mt-1 text-xs text-brown-300">/{group.slug}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => toggleGroupJoin(group)}
                        className={`rounded-lg px-3 py-1.5 text-xs ${group.joinEnabled ? "bg-red-50 text-red-500 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}
                      >
                        {group.joinEnabled ? "가입 중지" : "가입 재개"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteGroup(group)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <PaginationControls page={groupsPage} total={filteredReadingGroups.length} onChange={setGroupsPage} />
              {filteredReadingGroups.length === 0 && <EmptyState>독서모임이 없어요</EmptyState>}
            </section>
          )}

          {tab === "inquiries" && (
            <section className="space-y-3">
              {pagedInquiries.map((inquiry) => (
                <Link key={inquiry.id} href={`/admin/inquiries/${inquiry.id}`} className="block rounded-2xl border border-cream-200 bg-white p-4 shadow-sm hover:bg-cream-50">
                  <p className="font-medium text-brown-900">{inquiry.title}</p>
                  <p className="mt-1 text-sm text-brown-400">{inquiry.authorName} · {formatLogTime(inquiry.createdAt)}</p>
                </Link>
              ))}
              <PaginationControls page={inquiriesPage} total={filteredInquiries.length} onChange={setInquiriesPage} />
              {filteredInquiries.length === 0 && <EmptyState>문의가 없어요</EmptyState>}
            </section>
          )}

          {tab === "officialProfiles" && (
            <section className="space-y-5">
              <div>
                <h2 className="mb-3 font-serif text-lg font-bold text-brown-900">신청 목록</h2>
                <div className="space-y-3">
                  {pagedOfficialApplications.map((application) => (
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
                  <PaginationControls page={officialApplicationsPage} total={filteredOfficialApplications.length} onChange={setOfficialApplicationsPage} />
                  {filteredOfficialApplications.length === 0 && <EmptyState>공식 프로필 신청이 없어요</EmptyState>}
                </div>
              </div>

              <div>
                <h2 className="mb-3 font-serif text-lg font-bold text-brown-900">공식 프로필</h2>
                <div className="space-y-3">
                  {pagedOfficialProfiles.map((profile) => (
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
                  <PaginationControls page={officialProfilesPage} total={filteredOfficialProfiles.length} onChange={setOfficialProfilesPage} />
                  {filteredOfficialProfiles.length === 0 && <EmptyState>공식 프로필이 없어요</EmptyState>}
                </div>
              </div>
            </section>
          )}

          {tab === "actions" && (
            <section className="space-y-3">
              {pagedActions.map((event) => (
                <div key={event.id} className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-brown-900">{getActionDescription(event, bookMetaByPath, reviewMetaByPath)}</p>
                      <p className="mt-1 text-sm text-brown-500">
                        {getMetricEventLabel(event.eventType)} · {getDeviceLabel(event.device)} · {getActionContext(event, bookMetaByPath, reviewMetaByPath)}
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
              <PaginationControls page={actionsPage} total={filteredActions.length} onChange={setActionsPage} />
              {filteredActions.length === 0 && <EmptyState>유입·사용자 행동 기록이 없어요</EmptyState>}
            </section>
          )}

          {tab === "security" && (
            <section className="space-y-3">
              <div className="grid gap-2 rounded-2xl border border-cream-200 bg-white p-3 sm:grid-cols-4">
                <select value={securityTypeFilter} onChange={(event) => setSecurityTypeFilter(event.target.value)} className="rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-700">
                  <option value="">전체 오류 유형</option>
                  <option value="세션 갱신 실패">세션 갱신 실패</option>
                  <option value="공개 책 상세 조회 실패">공개 책 상세 조회 실패</option>
                  <option value="스캐너 의심 요청">스캐너 의심 요청</option>
                  <option value="서버 오류">서버 오류</option>
                  <option value="권한 없음">권한 없음</option>
                  <option value="리소스 없음">리소스 없음</option>
                </select>
                <select value={securityStatusFilter} onChange={(event) => setSecurityStatusFilter(event.target.value)} className="rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-700">
                  <option value="">전체 status</option>
                  {[400, 401, 403, 404, 429, 500, 502, 503].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <select value={securityAudienceFilter} onChange={(event) => setSecurityAudienceFilter(event.target.value)} className="rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-700">
                  <option value="">전체 영향</option>
                  <option value="user">실제 사용자 가능성</option>
                  <option value="bot">봇/스캐너 의심</option>
                </select>
                <select value={securityGroupBy} onChange={(event) => setSecurityGroupBy(event.target.value)} className="rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-700">
                  <option value="default">중복 기준</option>
                  <option value="ip">IP별 묶기</option>
                  <option value="path">path별 묶기</option>
                </select>
              </div>
              {pagedSecurityEvents.map((item) => {
                const info = classifyErrorLike(item.method, item.uri, item.status);
                const expanded = expandedSecurityKey === item.key;
                return (
                  <div key={item.key} className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${item.severity === "오류" ? "bg-red-50 text-red-500" : "bg-yellow-50 text-yellow-600"}`}>{item.severity}</span>
                          <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-brown-500">{item.status}</span>
                          {info.botSuspected && <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-brown-500">봇 의심</span>}
                          {info.userImpactLikely && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-500">사용자 영향 가능</span>}
                          <p className="font-medium text-brown-900">{info.label}</p>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-brown-700">{info.description}</p>
                        <p className="mt-1 text-xs text-brown-400">사용자 영향: {info.impact}</p>
                        <p className="mt-2 break-all font-mono text-xs text-brown-400">{item.method} {item.uri}</p>
                        <p className="mt-2 text-sm leading-6 text-brown-700">
                          {item.exceptionType ? `${item.exceptionType}: ` : ""}{item.message}
                        </p>
                        <p className="mt-2 text-xs text-brown-300">
                          IP {item.ip} · userId {item.userId ?? "비회원/알 수 없음"} · {item.source === "error" ? "오류 로그" : "접근 로그"} · 마지막 {formatLogTime(item.lastAt)}
                        </p>
                        {expanded && (
                          <div className="mt-3 rounded-xl bg-cream-50 p-3 text-xs text-brown-500">
                            <p className="break-all">User-Agent: {item.userAgent ?? "-"}</p>
                            <p className="mt-1 break-all">Referer: {item.referer ?? "-"}</p>
                            <p className="mt-2 font-medium text-brown-700">발생 시각</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.occurrenceTimes.map((time) => <span key={time} className="rounded bg-white px-2 py-1">{formatLogTime(time)}</span>)}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                        {item.count > 1 && <p className="rounded-full bg-cream-100 px-3 py-1 text-xs font-semibold text-brown-600">중복 {item.count}회</p>}
                        <button type="button" onClick={() => setExpandedSecurityKey(expanded ? null : item.key)} className="rounded-lg border border-cream-300 px-3 py-1.5 text-xs text-brown-500 hover:bg-cream-50">
                          {expanded ? "접기" : "상세"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <PaginationControls page={securityPage} total={filteredSecurityEvents.length} onChange={setSecurityPage} />
              {filteredSecurityEvents.length === 0 && <EmptyState>보안·오류 이슈가 없어요</EmptyState>}
            </section>
          )}

          {tab === "audit" && (
            <section className="space-y-3">
              {pagedAuditLogs.map((log) => (
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
              <PaginationControls page={auditPage} total={filteredAuditLogs.length} onChange={setAuditPage} />
              {filteredAuditLogs.length === 0 && <EmptyState>관리자 이력이 없어요</EmptyState>}
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
