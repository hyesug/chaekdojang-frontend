"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../lib/api";
import { authFetch, getValidToken } from "../lib/auth";
// 운세 사전 문장으로 출처를 거꾸로 찾는다 — 운세 계산 모듈은 끌어오지 않는 가벼운 두 파일만
import { DICT_FILES } from "../../public/unse/src/semantic/dictFiles.js";
import { buildSentenceIndex, traceSources } from "../../public/unse/src/semantic/sourceTrace.js";

type SectionCount = { section: string; up: number; down: number };
type FeedbackItem = {
  id: number;
  mode: "solo" | "pair";
  section: string;
  verdict: "up" | "down";
  snippet: string | null;
  comment: string | null;
  createdAt: string;
  resolvedAt: string | null;
};
type Summary = { sections: SectionCount[]; recent: FeedbackItem[] };
type Source = { file: string; key: string; field: string; text: string; label: string };
type SentenceIndex = ReturnType<typeof buildSentenceIndex>;

/** 공개 사전 파일(/unse/dict/*.json)을 한 번 불러와 문장 색인을 만든다 */
async function loadSentenceIndex(): Promise<SentenceIndex> {
  const files = DICT_FILES as string[];
  const all = await Promise.all(files.map((f) => fetch(`/unse/dict/${f}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))));
  return buildSentenceIndex(Object.fromEntries(files.map((f, i) => [f, all[i]])));
}

/**
 * 운세 피드백 — 칸별 👍/👎 집계와 최근 피드백.
 * 👎 비율이 높은 칸이 위로 온다. 생년월일·이름은 저장되지 않는다.
 * 저장된 문장을 운세 사전과 맞대어 문장마다 출처(예: 사주 辛 일간 × 辰월 · 성격)를 붙인다.
 * 고친 피드백은 '처리 완료'로 숨긴다(지우지 않는다 — "처리된 것도 보기"로 다시 볼 수 있다).
 */
export default function FortuneFeedbackPanel() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [onlyDown, setOnlyDown] = useState(true);
  const [onlyComment, setOnlyComment] = useState(false);
  const [index, setIndex] = useState<SentenceIndex | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);

  async function post(path: string, body?: unknown) {
    const token = getValidToken();
    setBusy(true);
    try {
      const res = await authFetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      setReload((n) => n + 1);
    } catch {
      setError("처리하지 못했습니다. 잠시 뒤 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  }
  const resolve = (ids: number[]) => ids.length && post("/api/admin/fortune-feedback/resolve", { ids });
  const reopen = (id: number) => post(`/api/admin/fortune-feedback/${id}/reopen`);

  useEffect(() => {
    let alive = true;
    loadSentenceIndex().then((x) => alive && setIndex(x)).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const token = getValidToken();
      const res = await authFetch(`${API_BASE}/api/admin/fortune-feedback?limit=300&includeResolved=${showResolved}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!alive) return;
      if (!res.ok) { setError(`불러오지 못했습니다 (HTTP ${res.status})`); return; }
      setData((await res.json())?.data ?? null);
    })().catch(() => alive && setError("불러오지 못했습니다"));
    return () => { alive = false; };
  }, [showResolved, reload]);

  const sections = useMemo(() => (data?.sections ?? [])
    .map((s) => ({ ...s, total: s.up + s.down, rate: s.up + s.down ? s.down / (s.up + s.down) : 0 }))
    .sort((a, b) => b.rate - a.rate || b.down - a.down), [data]);
  // 피드백마다 문장 출처
  const sourcesOf = useMemo(() => {
    const m = new Map<number, Source[]>();
    if (index) for (const x of data?.recent ?? []) m.set(x.id, traceSources(x.snippet ?? "", index) as Source[]);
    return m;
  }, [data, index]);
  // 👎가 몰린 출처 — 같은 사전 문장이 여러 피드백에 걸리면 위로
  const downSources = useMemo(() => {
    const c = new Map<string, { label: string; text: string; down: number; up: number; ids: number[] }>();
    for (const x of data?.recent ?? []) {
      if (x.resolvedAt) continue;
      for (const s of sourcesOf.get(x.id) ?? []) {
        const k = `${s.file}|${s.key}|${s.field}`;
        const v = c.get(k) ?? { label: s.label, text: s.text, down: 0, up: 0, ids: [] };
        if (x.verdict === "down") v.down += 1; else v.up += 1;
        v.ids.push(x.id);
        c.set(k, v);
      }
    }
    return [...c.values()].filter((v) => v.down > 0).sort((a, b) => b.down - a.down || a.up - b.up).slice(0, 30);
  }, [data, sourcesOf]);
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
        {/* 표 대신 줄 목록 — 휴대폰에서 칸 이름 열이 보이지 않았다 */}
        <ul className="mt-4 divide-y divide-cream-100">
          {sections.map((s) => (
            <li key={s.section} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
              <span className="min-w-0 flex-1 font-medium text-brown-800">{s.section}</span>
              <span className="shrink-0 text-brown-600">👍 {s.up} · 👎 {s.down} · <b className="text-brown-800">👎 {Math.round(s.rate * 100)}%</b></span>
            </li>
          ))}
        </ul>
        {sections.length === 0 && <p className="py-6 text-center text-sm text-brown-400">아직 받은 피드백이 없어요</p>}
      </div>

      <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
        <h3 className="font-serif text-lg font-bold text-brown-900">👎가 몰린 문장 출처</h3>
        <p className="mt-1 text-sm text-brown-500">
          피드백에 저장된 문장을 운세 사전과 맞대어 어느 규칙에서 나온 문장인지 찾았습니다. 같은 출처에 👎가 쌓이면 그 사전 문장을 고칠 차례입니다.
          그 문장을 고쳤으면 &lsquo;이 출처 처리 완료&rsquo;를 눌러 숨기세요(매주 자동 수정 작업은 고친 뒤 알아서 처리합니다).
        </p>
        {!index && <p className="mt-3 text-sm text-brown-400">사전을 불러오는 중…</p>}
        <ul className="mt-3 space-y-2">
          {downSources.map((v) => (
            <li key={v.label + v.text} className="rounded-xl bg-cream-50 p-3 text-sm">
              <p className="font-semibold text-brown-800">{v.label} <span className="font-normal text-brown-500">· 👎 {v.down}{v.up ? ` · 👍 ${v.up}` : ""}</span></p>
              <p className="mt-1 text-brown-600">“{v.text}”</p>
              <button type="button" disabled={busy} onClick={() => void resolve(v.ids)} className="mt-2 rounded-lg border border-cream-300 bg-white px-3 py-1 text-xs font-semibold text-brown-700 disabled:opacity-50">이 출처 처리 완료 ({v.ids.length}건)</button>
            </li>
          ))}
        </ul>
        {index && downSources.length === 0 && <p className="py-4 text-center text-sm text-brown-400">출처를 찾은 👎 피드백이 아직 없어요</p>}
      </div>

      <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-lg font-bold text-brown-900">최근 피드백</h3>
          <div className="flex gap-3 text-sm text-brown-600">
            <label className="flex items-center gap-1"><input type="checkbox" checked={onlyDown} onChange={(e) => setOnlyDown(e.target.checked)} />👎만</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={onlyComment} onChange={(e) => setOnlyComment(e.target.checked)} />한 줄 있는 것만</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />처리된 것도 보기</label>
          </div>
        </div>
        <ul className="mt-3 space-y-3">
          {recent.map((x) => (
            <li key={x.id} className={`rounded-xl bg-cream-50 p-3 ${x.resolvedAt ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs text-brown-400">
                  {new Date(x.createdAt).toLocaleString("ko-KR")} · {x.mode === "pair" ? "궁합" : "개인"} · {x.section} · {x.verdict === "up" ? "👍" : "👎"}
                  {x.resolvedAt && ` · 처리 완료 ${new Date(x.resolvedAt).toLocaleDateString("ko-KR")}`}
                </p>
                {x.resolvedAt
                  ? <button type="button" disabled={busy} onClick={() => void reopen(x.id)} className="shrink-0 rounded-lg border border-cream-300 bg-white px-2.5 py-1 text-xs text-brown-600 disabled:opacity-50">되돌리기</button>
                  : <button type="button" disabled={busy} onClick={() => void resolve([x.id])} className="shrink-0 rounded-lg border border-cream-300 bg-white px-2.5 py-1 text-xs font-semibold text-brown-700 disabled:opacity-50">처리 완료</button>}
              </div>
              {x.comment && <p className="mt-1 font-semibold text-brown-800">“{x.comment}”</p>}
              {x.snippet && <p className="mt-1 line-clamp-3 text-sm text-brown-500">{x.snippet}</p>}
              {(sourcesOf.get(x.id) ?? []).length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {(sourcesOf.get(x.id) ?? []).map((src) => (
                    <li key={src.label + src.text} title={src.text} className="rounded-full border border-cream-300 bg-white px-2 py-0.5 text-xs text-brown-600">{src.label}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {recent.length === 0 && <p className="py-6 text-center text-sm text-brown-400">조건에 맞는 피드백이 없어요</p>}
      </div>
    </section>
  );
}
