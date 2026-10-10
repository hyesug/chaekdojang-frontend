"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../lib/api";
import { authFetch, getValidToken } from "../lib/auth";

type SectionCount = { section: string; up: number; down: number };
type FeedbackItem = {
  id: number;
  mode: "solo" | "pair";
  section: string;
  verdict: "up" | "down";
  snippet: string | null;
  comment: string | null;
  createdAt: string;
};
type Summary = { sections: SectionCount[]; recent: FeedbackItem[] };

/**
 * 운세 피드백 — 칸별 👍/👎 집계와 최근 피드백.
 * 👎 비율이 높은 칸이 위로 온다. 생년월일·이름은 저장되지 않는다.
 */
export default function FortuneFeedbackPanel() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [onlyDown, setOnlyDown] = useState(true);
  const [onlyComment, setOnlyComment] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const token = getValidToken();
      const res = await authFetch(`${API_BASE}/api/admin/fortune-feedback?limit=300`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!alive) return;
      if (!res.ok) { setError(`불러오지 못했습니다 (HTTP ${res.status})`); return; }
      setData((await res.json())?.data ?? null);
    })().catch(() => alive && setError("불러오지 못했습니다"));
    return () => { alive = false; };
  }, []);

  const sections = useMemo(() => (data?.sections ?? [])
    .map((s) => ({ ...s, total: s.up + s.down, rate: s.up + s.down ? s.down / (s.up + s.down) : 0 }))
    .sort((a, b) => b.rate - a.rate || b.down - a.down), [data]);
  const recent = useMemo(() => (data?.recent ?? [])
    .filter((x) => (!onlyDown || x.verdict === "down") && (!onlyComment || x.comment)), [data, onlyDown, onlyComment]);

  if (error) return <p className="rounded-2xl border border-cream-200 bg-white p-5 text-sm text-red-600">{error}</p>;
  if (!data) return <p className="rounded-2xl border border-cream-200 bg-white p-5 text-sm text-brown-500">불러오는 중…</p>;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl font-bold text-brown-900">운세 피드백</h2>
        <p className="mt-1 text-sm text-brown-500">
          결과 칸마다 받은 👍/👎입니다. 👎 비율이 높은 칸이 위에 옵니다. 생년월일·이름은 저장하지 않습니다.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-xs text-brown-400">
                <th className="py-2 pr-3">칸</th><th className="py-2 pr-3">👍</th><th className="py-2 pr-3">👎</th><th className="py-2">👎 비율</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => (
                <tr key={s.section} className="border-t border-cream-100">
                  <td className="py-2 pr-3 font-medium text-brown-800">{s.section}</td>
                  <td className="py-2 pr-3 text-brown-600">{s.up}</td>
                  <td className="py-2 pr-3 text-brown-600">{s.down}</td>
                  <td className="py-2 text-brown-600">{Math.round(s.rate * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sections.length === 0 && <p className="py-6 text-center text-sm text-brown-400">아직 받은 피드백이 없어요</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-lg font-bold text-brown-900">최근 피드백</h3>
          <div className="flex gap-3 text-sm text-brown-600">
            <label className="flex items-center gap-1"><input type="checkbox" checked={onlyDown} onChange={(e) => setOnlyDown(e.target.checked)} />👎만</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={onlyComment} onChange={(e) => setOnlyComment(e.target.checked)} />한 줄 있는 것만</label>
          </div>
        </div>
        <ul className="mt-3 space-y-3">
          {recent.map((x) => (
            <li key={x.id} className="rounded-xl bg-cream-50 p-3">
              <p className="text-xs text-brown-400">
                {new Date(x.createdAt).toLocaleString("ko-KR")} · {x.mode === "pair" ? "궁합" : "개인"} · {x.section} · {x.verdict === "up" ? "👍" : "👎"}
              </p>
              {x.comment && <p className="mt-1 font-semibold text-brown-800">“{x.comment}”</p>}
              {x.snippet && <p className="mt-1 line-clamp-3 text-sm text-brown-500">{x.snippet}</p>}
            </li>
          ))}
        </ul>
        {recent.length === 0 && <p className="py-6 text-center text-sm text-brown-400">조건에 맞는 피드백이 없어요</p>}
      </div>
    </section>
  );
}
