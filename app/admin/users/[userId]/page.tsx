"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authFetch, getValidToken } from "../../../lib/auth";

interface TimelineEvent {
  id: number;
  eventType: string;
  label: string;
  description: string;
  path: string;
  createdAt: string;
  ip: string | null;
  deviceId: string | null;
  device: string | null;
  browser: string | null;
  operatingSystem: string | null;
  meta: Record<string, unknown>;
}

interface UserActivityDetail {
  basic: {
    id: number;
    nickname: string;
    createdAt: string;
    oauthProviders: string[];
    reviewCount: number;
    createdGroupCount: number;
    joinedGroupCount: number;
  };
  access: {
    firstLoginAt: string | null;
    recentLoginAt: string | null;
    recentActivityAt: string | null;
    recentIp: string | null;
    recentDevice: string | null;
    recentBrowser: string | null;
    recentOperatingSystem: string | null;
    deviceIds: string[];
  };
  timeline: { content: TimelineEvent[]; totalElements: number };
  relatedAccounts: Array<{
    userId: number;
    nickname: string;
    score: number;
    strength: string;
    reasons: string[];
    lastRelatedAt: string | null;
  }>;
  notice: string;
}

const eventOptions = [
  ["", "주요 활동 전체"],
  ["user_registered", "회원가입"],
  ["login_succeeded", "로그인 성공"],
  ["reading_group_created", "독서모임 생성"],
  ["reading_group_joined", "독서모임 가입"],
  ["reading_group_join_requested", "독서모임 가입 요청"],
  ["reading_group_member_approved", "독서모임 가입 승인"],
  ["reading_group_book_added", "독서모임 책 추가"],
  ["reading_group_review_attached", "모임 독후감 연결"],
  ["review_created", "독후감 작성"],
  ["profile_updated", "프로필 수정"],
  ["official_profile_applied", "공식 프로필 신청"],
  ["page_view", "페이지 조회"],
  ["review_write_click", "독후감 작성 시작"],
  ["book_search", "책 검색"],
  ["web_novel_search", "웹소설 검색"],
  ["book_click_search", "검색 결과 책 선택"],
  ["share_click", "공유"],
  ["revision_saved", "독후감 저장"],
  ["heartbeat", "체류 신호(기술 로그)"],
  ["session_end", "세션 종료(기술 로그)"],
];

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", { hour12: false });
}

export default function AdminUserActivityPage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<UserActivityDetail | null>(null);
  const [eventType, setEventType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includeTechnical, setIncludeTechnical] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadActivity() {
    const token = getValidToken();
    if (!token) {
      router.replace("/auth/login");
      return;
    }
    setLoading(true);
    try {
      const query = new URLSearchParams({ size: "100", sort: "createdAt,desc" });
      if (eventType) query.set("eventType", eventType);
      if (from) query.set("from", from);
      if (to) query.set("to", to);
      if (includeTechnical) query.set("includeTechnical", "true");
      const response = await authFetch(`/api/admin/users/${params.userId}/activity?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) return router.replace("/auth/login");
      if (response.status === 403) return router.replace("/");
      if (!response.ok) return;
      const json = await response.json();
      setDetail(json.data ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivity();
    // 필터 적용은 버튼으로만 실행합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.userId]);

  if (loading && !detail) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-brown-400">회원 활동을 불러오는 중...</div>;
  }
  if (!detail) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-brown-400">회원 활동 정보를 확인할 수 없습니다.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin?tab=users" className="text-sm text-brown-400 hover:text-brown-600">← 관리자 회원 목록</Link>
          <h1 className="mt-2 font-serif text-3xl font-bold text-brown-900">{detail.basic.nickname} 활동 상세</h1>
          <p className="mt-1 text-sm text-brown-400">사용자 ID {detail.basic.id} · 가입 {formatDate(detail.basic.createdAt)}</p>
        </div>
        <Link href={`/users/${detail.basic.id}`} className="rounded-xl border border-cream-300 bg-white px-4 py-2 text-sm text-brown-600">공개 프로필 보기</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="OAuth" value={detail.basic.oauthProviders.join(", ") || "-"} />
        <Summary label="작성 독후감" value={`${detail.basic.reviewCount}개`} />
        <Summary label="생성한 독서모임" value={`${detail.basic.createdGroupCount}개`} />
        <Summary label="가입한 독서모임" value={`${detail.basic.joinedGroupCount}개`} />
      </div>

      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl font-bold text-brown-900">접속 정보</h2>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Info label="첫 로그인" value={formatDate(detail.access.firstLoginAt)} />
          <Info label="최근 로그인" value={formatDate(detail.access.recentLoginAt)} />
          <Info label="최근 활동" value={formatDate(detail.access.recentActivityAt)} />
          <Info label="최근 IP" value={detail.access.recentIp ?? "-"} />
          <Info label="최근 기기" value={detail.access.recentDevice ?? "-"} />
          <Info label="브라우저·OS" value={[detail.access.recentBrowser, detail.access.recentOperatingSystem].filter(Boolean).join(" · ") || "-"} />
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium text-brown-400">사용한 임의 기기 ID</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {detail.access.deviceIds.map((deviceId) => <code key={deviceId} className="rounded-lg bg-cream-50 px-2 py-1 text-xs text-brown-600">{deviceId}</code>)}
            {detail.access.deviceIds.length === 0 && <span className="text-sm text-brown-300">아직 기록이 없습니다.</span>}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-bold text-yellow-900">연관 가능성이 있는 계정 {detail.relatedAccounts.length}개</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-yellow-800">{detail.notice}</p>
        <div className="mt-4 space-y-3">
          {detail.relatedAccounts.map((account) => (
            <div key={account.userId} className="rounded-xl bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/admin/users/${account.userId}`} className="font-semibold text-brown-900 hover:underline">{account.nickname} · ID {account.userId}</Link>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${account.strength === "높음" ? "bg-red-50 text-red-600" : account.strength === "검토 필요" ? "bg-yellow-100 text-yellow-700" : "bg-cream-100 text-brown-500"}`}>{account.strength} · {account.score}점</span>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-brown-600">{account.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              <p className="mt-2 text-xs text-brown-300">마지막 연관 신호 {formatDate(account.lastRelatedAt)}</p>
            </div>
          ))}
          {detail.relatedAccounts.length === 0 && <p className="rounded-xl bg-white py-5 text-center text-sm text-yellow-700">현재 보관 기간 안에서 겹치는 신호가 없습니다.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <form onSubmit={(event) => { event.preventDefault(); loadActivity(); }} className="grid gap-2 rounded-2xl border border-cream-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
          <select value={eventType} onChange={(event) => {
            const value = event.target.value;
            setEventType(value);
            if (value === "heartbeat" || value === "session_end") setIncludeTechnical(true);
          }} className="rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-700">
            {eventOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-700" />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-700" />
          <label className="flex items-center gap-2 rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-600">
            <input type="checkbox" checked={includeTechnical} onChange={(event) => {
              const checked = event.target.checked;
              setIncludeTechnical(checked);
              if (!checked && (eventType === "heartbeat" || eventType === "session_end")) setEventType("");
            }} />
            기술 로그 포함
          </label>
          <button disabled={loading} className="rounded-xl bg-brown-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">활동 필터 적용</button>
          <p className="text-xs leading-5 text-brown-400 sm:col-span-2 lg:col-span-5">기본값은 실제 사용자 행동을 보기 쉽게 보여주며, 체류 신호와 세션 종료 기록은 숨깁니다.</p>
        </form>

        <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl font-bold text-brown-900">활동 타임라인</h2>
          <p className="mt-1 text-xs text-brown-400">조건에 맞는 {includeTechnical ? "전체 기록" : "주요 활동"} {detail.timeline.totalElements}건 · 최신 100건 표시</p>
          <div className="mt-4 space-y-3">
            {detail.timeline.content.map((event) => (
              <div key={event.id} className="border-l-2 border-cream-300 pl-4">
                <p className="text-xs text-brown-300">{formatDate(event.createdAt)}</p>
                <p className="mt-1 font-medium text-brown-900">{event.description}</p>
                {event.eventType === "page_view" && event.path && <p className="mt-1 break-all font-mono text-xs text-brown-300">{event.path}</p>}
                <p className="mt-1 text-xs text-brown-400">{event.label} · IP {event.ip ?? "-"} · {[event.device, event.browser, event.operatingSystem].filter(Boolean).join(" · ") || "기기 정보 없음"}</p>
                {event.deviceId && <p className="mt-1 break-all font-mono text-xs text-brown-300">기기 {event.deviceId}</p>}
              </div>
            ))}
            {detail.timeline.content.length === 0 && <p className="py-8 text-center text-sm text-brown-300">조건에 맞는 활동이 없습니다.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm"><p className="text-xs text-brown-400">{label}</p><p className="mt-1 font-semibold text-brown-900">{value}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-cream-50 p-3"><p className="text-xs text-brown-400">{label}</p><p className="mt-1 break-all text-brown-700">{value}</p></div>;
}
