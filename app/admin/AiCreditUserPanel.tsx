"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../lib/api";
import { authFetch, getValidToken } from "../lib/auth";

/**
 * 회원 한 명의 AI 질문권 — 잔액(무료·구매/지급·총)과 최근 원장.
 * 관리자 회원 상세와 'AI 질문권' 탭이 같이 쓴다. 백엔드 GET /api/admin/ai-credits/{userId}.
 */
type Balance = { freeRemaining: number; purchasedBalance: number; totalBalance: number; unlimited?: boolean };
type Ledger = { id: string; amount: number; type: string; referenceId: string | null; description: string; createdAt: string };
type AdminView = { balance: Balance; ledger: Ledger[]; orders: unknown[]; staleReservations: number };

const TYPE_LABEL: Record<string, string> = {
  FREE_GRANT: "첫 질문 무료",
  REVIEW_REWARD: "독후감 보상",
  USE: "사용",
  REFUND: "실패 복구",
  ADMIN_GRANT: "관리자 지급",
  ADMIN_REVOKE: "관리자 회수",
  PURCHASE: "구매",
};

export default function AiCreditUserPanel({ userId, refreshKey = 0, canGrant = false }: { userId: string | number; refreshKey?: number; canGrant?: boolean }) {
  const [view, setView] = useState<AdminView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantMessage, setGrantMessage] = useState("");

  const load = useCallback(async () => {
    const token = getValidToken();
    if (!token || !String(userId).trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`${API_BASE}/api/admin/ai-credits/${encodeURIComponent(String(userId).trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setView(null); setError(json?.message ?? "질문권 정보를 불러오지 못했습니다."); return; }
      setView(json?.data ?? null);
    } catch {
      setError("질문권 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  /** 질문권 지급 — 모든 변경은 원장과 관리자 감사 로그에 남는다(백엔드 adjust) */
  async function grant(amount: number) {
    const token = getValidToken();
    if (!token) return;
    const why = reason.trim() || "관리자 지급";
    setGranting(true);
    setGrantMessage("");
    try {
      const res = await authFetch(`${API_BASE}/api/admin/ai-credits/${encodeURIComponent(String(userId).trim())}/adjustments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount, description: why }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setGrantMessage(json?.message ?? "지급하지 못했습니다."); return; }
      setGrantMessage(`${amount}회를 지급했습니다.`);
      setReason("");
      await load();
    } finally {
      setGranting(false);
    }
  }

  if (loading && !view) return <p className="text-sm text-brown-400">질문권을 불러오는 중...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!view) return null;

  const used = view.ledger.filter((l) => l.type === "USE").reduce((n, l) => n - l.amount, 0);
  const rewards = view.ledger.filter((l) => l.type === "REVIEW_REWARD").length;
  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        {[
          ["총 잔액", view.balance.unlimited ? `무제한 (원장 ${view.balance.totalBalance}회)` : `${view.balance.totalBalance}회`],
          ["무료 (첫 질문·독후감)", `${view.balance.freeRemaining}회`],
          ["구매·지급", `${view.balance.purchasedBalance}회`],
          ["최근 사용", `${used}회`],
          ["독후감 보상", `${rewards}번`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-cream-50 p-3">
            <dt className="text-xs text-brown-400">{label}</dt>
            <dd className="mt-1 font-semibold text-brown-800">{value}</dd>
          </div>
        ))}
      </dl>
      {view.balance.unlimited && <p className="mt-3 text-sm text-sage-700">관리자 계정이라 질문권 제한 없이 물을 수 있습니다(모자라면 자동 충전).</p>}
      {canGrant && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="지급 사유 (비우면 '관리자 지급')" className="min-w-0 flex-1 rounded-lg border border-cream-300 px-3 py-2 text-sm" />
          {[1, 3, 5].map((n) => (
            <button key={n} type="button" disabled={granting} onClick={() => void grant(n)} className="rounded-lg bg-brown-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">+{n}회</button>
          ))}
          {grantMessage && <p className="w-full text-sm text-brown-600">{grantMessage}</p>}
        </div>
      )}
      {view.staleReservations > 0 && (
        <p className="mt-3 text-sm text-amber-700">15분 넘게 정산되지 않은 예약이 {view.staleReservations}건 있습니다.</p>
      )}
      <p className="mt-2 text-xs text-brown-400">최근 사용·독후감 보상은 최근 원장 100건 기준입니다.</p>
      <div className="mt-4 overflow-x-auto">
        {view.ledger.length === 0 ? (
          <p className="text-sm text-brown-400">아직 질문권 기록이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-cream-200 text-left text-xs text-brown-400"><th className="py-2 pr-3">일시</th><th className="py-2 pr-3">종류</th><th className="py-2 pr-3">내용</th><th className="py-2 text-right">수량</th></tr></thead>
            <tbody>
              {view.ledger.slice(0, 30).map((l) => (
                <tr key={l.id} className="border-b border-cream-100 last:border-0">
                  <td className="whitespace-nowrap py-2 pr-3 text-xs text-brown-400">{new Date(l.createdAt).toLocaleString("ko-KR")}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-brown-600">{TYPE_LABEL[l.type] ?? l.type}</td>
                  <td className="py-2 pr-3 text-brown-600">{l.description}</td>
                  <td className={`whitespace-nowrap py-2 text-right font-semibold ${l.amount > 0 ? "text-sage-700" : "text-brown-700"}`}>{l.amount > 0 ? "+" : ""}{l.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
