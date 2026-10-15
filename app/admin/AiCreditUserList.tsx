"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../lib/api";
import { authFetch, getValidToken } from "../lib/auth";
import AiCreditUserPanel from "./AiCreditUserPanel";

/**
 * 'AI 질문권' 탭의 회원 목록 — 질문권 기록이 있는 회원마다 잔액·사용 횟수·마지막 사용.
 * 줄을 누르면 그 회원의 잔액·원장(AiCreditUserPanel)과 AI 질문 이용 기록을 펼친다.
 * 백엔드 GET /api/admin/ai-credits/users, /api/admin/ai-credits/{userId}/usages.
 */
type UserRow = {
  userId: number; nickname: string; email: string | null; admin: boolean;
  totalBalance: number; freeRemaining: number; purchasedBalance: number;
  uses: number; failures: number; lastUsedAt: string | null; totalCost: number;
};
type UserPage = { users: UserRow[]; total: number; page: number; size: number };
type UsageRow = {
  requestId: string; tier: string; model: string; questionCategory: string | null; detailLevel: string | null;
  sessionId: string | null; creditUsed: number | null; success: boolean; errorType: string | null;
  inputTokens: number | null; outputTokens: number | null; estimatedCost: number | null; durationMs: number; requestedAt: string;
};

const PAGE_SIZE = 30;
const when = (v: string | null) => (v ? new Date(v).toLocaleString("ko-KR") : "-");

async function getJson<T>(path: string): Promise<T | null> {
  const token = getValidToken();
  if (!token) return null;
  const res = await authFetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message ?? "불러오지 못했습니다.");
  return (json?.data ?? null) as T | null;
}

function UsageHistory({ userId }: { userId: number }) {
  const [rows, setRows] = useState<UsageRow[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setRows(null);
    setError("");
    getJson<UsageRow[]>(`/api/admin/ai-credits/${userId}/usages?limit=200`)
      .then((r) => setRows(r ?? []))
      .catch((e: Error) => setError(e.message));
  }, [userId]);

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!rows) return <p className="text-sm text-brown-400">이용 기록을 불러오는 중...</p>;
  if (rows.length === 0) return <p className="text-sm text-brown-400">아직 AI 질문 이용 기록이 없습니다.</p>;
  const sessions = new Set(rows.map((r) => r.sessionId).filter(Boolean)).size;
  return (
    <div>
      <p className="text-xs text-brown-400">최근 {rows.length}건 · 대화 {sessions}개. 질문·답 본문은 저장하지 않아 이용 시각·풀이·분류·결과만 보입니다.</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-cream-200 text-left text-xs text-brown-400"><th className="py-2 pr-3">일시</th><th className="py-2 pr-3">풀이</th><th className="py-2 pr-3">질문 분류</th><th className="py-2 pr-3">대화</th><th className="py-2 pr-3">결과</th><th className="py-2 pr-3 text-right">토큰(입/출)</th><th className="py-2 text-right">원가</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.requestId} className="border-b border-cream-100 last:border-0">
                <td className="whitespace-nowrap py-2 pr-3 text-xs text-brown-400">{when(r.requestedAt)}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-brown-600">{r.tier}{r.detailLevel ? ` · ${r.detailLevel}` : ""}</td>
                <td className="py-2 pr-3 text-brown-600">{r.questionCategory ?? "-"}</td>
                <td className="whitespace-nowrap py-2 pr-3 font-mono text-xs text-brown-400" title={r.sessionId ?? ""}>{r.sessionId ? r.sessionId.slice(0, 8) : "-"}</td>
                <td className={`whitespace-nowrap py-2 pr-3 ${r.success ? "text-sage-700" : "text-red-500"}`} title={r.errorType ?? ""}>{r.success ? `사용 ${r.creditUsed ?? 1}회` : "실패·복구"}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-right text-brown-600">{r.inputTokens == null ? "-" : `${r.inputTokens.toLocaleString()} / ${(r.outputTokens ?? 0).toLocaleString()}`}</td>
                <td className="whitespace-nowrap py-2 text-right text-brown-600">{r.estimatedCost == null ? "-" : `$${Number(r.estimatedCost).toFixed(4)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AiCreditUserList({ refreshKey = 0, onSelect }: { refreshKey?: number; onSelect?: (userId: number) => void }) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<UserPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
      if (search) params.set("q", search);
      setData(await getJson<UserPage>(`/api/admin/ai-credits/users?${params}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
      <h3 className="font-serif text-lg font-bold text-brown-900">회원별 질문권·이용 기록</h3>
      <p className="mt-1 text-sm text-brown-500">질문권 기록이 있는 회원을 최근 사용 순으로 봅니다. 줄을 누르면 원장과 AI 질문 이용 기록이 펼쳐집니다.</p>
      <form onSubmit={(e) => { e.preventDefault(); setPage(0); setSearch(query.trim()); }} className="mt-4 flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="닉네임·이메일·회원 ID" className="min-w-0 flex-1 rounded-lg border border-cream-300 px-3 py-2 text-sm sm:max-w-xs" />
        <button className="rounded-lg border border-cream-300 px-4 py-2 text-sm font-semibold text-brown-700">검색</button>
      </form>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      {loading && !data && <p className="mt-3 text-sm text-brown-400">회원 목록을 불러오는 중...</p>}
      {data && (
        <div className="mt-4 overflow-x-auto">
          {data.users.length === 0 ? (
            <p className="text-sm text-brown-400">{search ? "검색 결과가 없습니다." : "아직 질문권 기록이 있는 회원이 없습니다."}</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-cream-200 text-left text-xs text-brown-400"><th className="py-2 pr-3">회원</th><th className="py-2 pr-3 text-right">보유</th><th className="py-2 pr-3 text-right">무료 / 구매·지급</th><th className="py-2 pr-3 text-right">질문 사용</th><th className="py-2 pr-3 text-right">실패</th><th className="py-2 pr-3">마지막 사용</th><th className="py-2 text-right">누적 원가</th></tr></thead>
              <tbody>
                {data.users.map((u) => (
                  <UserRowView key={u.userId} u={u} open={openId === u.userId} onToggle={() => { setOpenId(openId === u.userId ? null : u.userId); onSelect?.(u.userId); }} refreshKey={refreshKey} />
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-3 flex items-center justify-between text-sm text-brown-500">
            <span>총 {data.total.toLocaleString()}명</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-cream-300 px-3 py-1 disabled:opacity-40">이전</button>
              <span>{page + 1} / {pages}</span>
              <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-cream-300 px-3 py-1 disabled:opacity-40">다음</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserRowView({ u, open, onToggle, refreshKey }: { u: UserRow; open: boolean; onToggle: () => void; refreshKey: number }) {
  return (
    <>
      <tr onClick={onToggle} className={`cursor-pointer border-b border-cream-100 hover:bg-cream-50 ${open ? "bg-cream-50" : ""}`}>
        <td className="py-2 pr-3">
          <span className="font-semibold text-brown-800">{u.nickname}</span>
          {u.admin && <span className="ml-1 rounded bg-sage-100 px-1 text-xs text-sage-700">관리자</span>}
          <span className="block text-xs text-brown-400">#{u.userId}{u.email ? ` · ${u.email}` : ""}</span>
        </td>
        <td className="whitespace-nowrap py-2 pr-3 text-right font-semibold text-brown-800">{u.totalBalance}회</td>
        <td className="whitespace-nowrap py-2 pr-3 text-right text-brown-600">{u.freeRemaining} / {u.purchasedBalance}</td>
        <td className="whitespace-nowrap py-2 pr-3 text-right text-brown-600">{u.uses.toLocaleString()}회</td>
        <td className="whitespace-nowrap py-2 pr-3 text-right text-brown-400">{u.failures}</td>
        <td className="whitespace-nowrap py-2 pr-3 text-xs text-brown-400">{when(u.lastUsedAt)}</td>
        <td className="whitespace-nowrap py-2 text-right text-brown-600">${Number(u.totalCost).toFixed(4)}</td>
      </tr>
      {open && (
        <tr className="border-b border-cream-200">
          <td colSpan={7} className="space-y-5 bg-cream-50/40 p-4">
            <AiCreditUserPanel userId={u.userId} refreshKey={refreshKey} />
            <div>
              <h4 className="mb-2 text-sm font-semibold text-brown-800">AI 질문 이용 기록</h4>
              <UsageHistory userId={u.userId} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
