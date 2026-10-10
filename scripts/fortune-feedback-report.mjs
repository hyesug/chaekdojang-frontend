#!/usr/bin/env node
/**
 * 운세 피드백 → 고칠 사전 문장 후보.
 *
 *   node scripts/fortune-feedback-report.mjs [--json]
 *
 * 운영 API 의 피드백 내보내기(GET /api/internal/fortune-feedback, 전용 토큰)를 읽어
 * 저장된 문장을 운세 사전과 맞대고(semantic/sourceTrace.js), 출처마다 👍/👎 를 센다.
 * 매주 도는 사전 자동 수정 작업이 이 결과로 고칠 문장을 고른다.
 *
 * 고칠 후보 기준(한 사람 말에 흔들리지 않게): 같은 출처에 👎 3개 이상, 👎 비율 60% 이상.
 * 토큰: 환경변수 FORTUNE_FEEDBACK_EXPORT_TOKEN, 없으면 ~/.chaekdojang/fortune-feedback-token 파일.
 * 사전 문장을 고치면 예전 피드백은 더 이상 맞지 않아 후보에서 저절로 빠진다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DICT_FILES } from '../public/unse/src/semantic/dictFiles.js';
import { buildSentenceIndex, traceSources } from '../public/unse/src/semantic/sourceTrace.js';

export const MIN_DOWN = 3;
export const MIN_DOWN_RATE = 0.6;
const API = process.env.FORTUNE_API_BASE ?? 'https://api.chaekdojang.com';

function token() {
  if (process.env.FORTUNE_FEEDBACK_EXPORT_TOKEN) return process.env.FORTUNE_FEEDBACK_EXPORT_TOKEN.trim();
  const f = join(homedir(), '.chaekdojang', 'fortune-feedback-token');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  throw new Error('토큰이 없습니다 — FORTUNE_FEEDBACK_EXPORT_TOKEN 또는 ~/.chaekdojang/fortune-feedback-token');
}

function loadIndex() {
  const dicts = {};
  for (const f of DICT_FILES) {
    dicts[f] = JSON.parse(readFileSync(new URL(`../public/unse/dict/${f}.json`, import.meta.url), 'utf8'));
  }
  return buildSentenceIndex(dicts);
}

/** 출처별 집계와 고칠 후보 */
export function summarize(items, index) {
  const by = new Map();
  for (const x of items) {
    for (const s of traceSources(x.snippet ?? '', index)) {
      const k = `${s.file}|${s.key}|${s.field}`;
      const v = by.get(k) ?? { file: s.file, key: s.key, field: s.field, label: s.label, text: s.text, up: 0, down: 0, comments: [] };
      if (x.verdict === 'down') { v.down += 1; if (x.comment) v.comments.push(x.comment); } else v.up += 1;
      by.set(k, v);
    }
  }
  const all = [...by.values()].map((v) => ({ ...v, downRate: v.down / Math.max(1, v.up + v.down) }))
    .sort((a, b) => b.down - a.down || b.downRate - a.downRate);
  return {
    total: items.length,
    traced: all.length,
    candidates: all.filter((v) => v.down >= MIN_DOWN && v.downRate >= MIN_DOWN_RATE),
    watch: all.filter((v) => v.down > 0 && !(v.down >= MIN_DOWN && v.downRate >= MIN_DOWN_RATE)).slice(0, 20),
  };
}

async function main() {
  const res = await fetch(`${API}/api/internal/fortune-feedback?limit=500`, { headers: { 'X-Fortune-Feedback-Token': token() } });
  if (!res.ok) throw new Error(`피드백을 읽지 못했습니다 (HTTP ${res.status})`);
  const items = (await res.json())?.data?.recent ?? [];
  const out = summarize(items, loadIndex());
  if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 2)); return; }
  console.log(`피드백 ${out.total}건 · 출처를 찾은 사전 문장 ${out.traced}개 · 고칠 후보 ${out.candidates.length}개 (👎 ${MIN_DOWN}개 이상 · 👎 ${MIN_DOWN_RATE * 100}% 이상)`);
  for (const c of out.candidates) {
    console.log(`\n■ ${c.label}  👎 ${c.down} / 👍 ${c.up}\n  dict/${c.file}.json  "${c.key}".${c.field}\n  "${c.text}"`);
    for (const m of c.comments.slice(0, 5)) console.log(`   - ${m}`);
  }
  if (out.watch.length) console.log(`\n지켜볼 것(기준 미달): ${out.watch.map((w) => `${w.label} 👎${w.down}`).join(' / ')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
