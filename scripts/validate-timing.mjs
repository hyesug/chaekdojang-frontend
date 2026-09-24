/**
 * validate-timing.mjs — **실제 사건 날짜로 시기 엔진을 잰다**
 *
 *   node scripts/validate-timing.mjs
 *
 * ── 지키는 것 ─────────────────────────────────────────────
 * 1. **순위로 잰다.** "그 달 0.82" 는 뜻이 없다. 그 사람의 그 기간 안에서
 *    몇 번째였나(percentile)가 읽을 수 있는 전부다.
 * 2. **사건 없는 달과 함께 본다.** 사건이 있던 달만 보고 "높았다"고 하면
 *    안 된다 — 다른 달도 높았을 수 있다.
 * 3. **창을 여러 개 둔다.** ±0/1/3/6개월을 함께 낸다. 정확히 그 달만
 *    맞혀야 성공이라고 하지 않는다.
 * 4. **남의 사건과 섞어 본다.** 제대로 짝지었을 때가 더 나은지 본다.
 *
 * ── 지키지 않으면 안 되는 것 ───────────────────────────────
 * 사건 날짜를 보고 그 달이 높아지도록 규칙을 고치지 않는다. 규칙을 먼저
 * 만들고, 그다음 재고, 여러 사건에서 같은 오류가 되풀이될 때만 고친다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { predictTimeline } from '../public/unse-8f3k2m/src/semantic/timing/timeline.js';
import { DOMAIN_LABEL } from '../public/unse-8f3k2m/src/semantic/timing/schema.js';
import { SYSTEM_NAME, SYSTEM_IDS } from '../public/unse-8f3k2m/src/semantic/extract.js';

const file = process.argv[2] ?? 'validation/cases.json';
if (!existsSync(file)) {
  console.error(`${file} 이 없습니다 (개인정보라 저장소에 없습니다).`);
  process.exit(1);
}
const cases = JSON.parse(readFileSync(file, 'utf8'));

/** 사례 파일의 분야 이름 → 이 엔진의 분야 */
const DOMAIN_OF = {
  직업: 'career', 재물: 'wealth', 관계: 'relationship', 결혼: 'marriage',
  주거: 'residence', 이사: 'movement', 건강: 'health', 학업: 'education', 자녀: 'children',
};

const rows = [];
for (const c of cases) {
  const evs = (c.events ?? []).filter((e) => e.year && DOMAIN_OF[e.domain]);
  if (!evs.length) continue;
  const years = evs.map((e) => e.year);
  const from = `${Math.min(...years) - 3}-01`;
  const to = `${Math.max(...years) + 3}-12`;
  let r;
  try { r = predictTimeline({ birth: c.birth, from, to }); }
  catch (err) { console.error(`  ! ${c.id} ${err.message}`); continue; }
  for (const e of evs) {
    const d = DOMAIN_OF[e.domain];
    const key = `${e.year}-${String(e.month ?? 6).padStart(2, '0')}`;
    rows.push({ person: c.id, domain: d, key, what: e.what, monthKnown: e.month != null, result: r });
  }
}
if (!rows.length) { console.error('채점할 사건이 없습니다.'); process.exit(1); }

const monthNo = (k) => { const [y, m] = k.split('-').map(Number); return y * 12 + m - 1; };

/** 한 사건을 채점한다 */
function score(r, domain, key, sysId = null) {
  const keys = Object.keys(r.timeline).sort();
  const val = (k) => sysId
    ? (r.systemResults[sysId]?.months?.[k]?.activations?.[domain] ?? null)
    : (r.timeline[k]?.domains?.[domain]?.activation ?? null);
  const all = keys.map((k) => ({ k, v: val(k) })).filter((x) => x.v != null);
  if (!all.length || !all.find((x) => x.k === key)) return null;
  const sorted = all.slice().sort((a, b) => b.v - a.v);
  const idx = sorted.findIndex((x) => x.k === key);
  const n = all.length;
  const best = sorted[0].v;
  const peaks = sorted.filter((x) => x.v === best).map((x) => x.k);
  const within = (tol) => sorted.slice(0, Math.max(1, Math.round(n * 0))).length; // placeholder
  const hitAt = (kk) => sorted.slice(0, kk).some((x) => Math.abs(monthNo(x.k) - monthNo(key)) === 0);
  const tolHit = (tol) => sorted.slice(0, 3).some((x) => Math.abs(monthNo(x.k) - monthNo(key)) <= tol);
  void within;
  return {
    percentile: Math.round((1 - idx / Math.max(1, n - 1)) * 100),
    rank: idx + 1, n,
    hit1: hitAt(1), hit3: hitAt(3), hit5: hitAt(5),
    tol1: tolHit(1), tol3: tolHit(3), tol6: tolHit(6),
    peakError: Math.min(...peaks.map((p) => Math.abs(monthNo(p) - monthNo(key)))),
  };
}

const pad = (s, n) => String(s ?? '').padEnd(n);
const pct = (xs) => (xs.length ? Math.round((xs.filter(Boolean).length / xs.length) * 100) : 0);
const avg = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

console.log(`# 시기 검증 — 실제 사건 ${rows.length}건 (${new Set(rows.map((r) => r.person)).size}명)`);
console.log('');
console.log('## 사건별');
console.log('');
console.log('사람  분야    사건월     순위/전체  백분위  ±1  ±3  ±6  최고점 오차');
const pooled = [];
for (const row of rows) {
  const s = score(row.result, row.domain, row.key);
  if (!s) { console.log(`${pad(row.person, 5)} ${pad(DOMAIN_LABEL[row.domain], 6)} ${row.key}  — 그 달을 계산하지 못함`); continue; }
  pooled.push(s);
  console.log(`${pad(row.person, 5)} ${pad(DOMAIN_LABEL[row.domain], 6)} ${row.key}  ${pad(`${s.rank}/${s.n}`, 9)} ${pad(s.percentile + '%', 7)} ${pad(s.tol1 ? 'O' : '·', 3)} ${pad(s.tol3 ? 'O' : '·', 3)} ${pad(s.tol6 ? 'O' : '·', 3)} ${s.peakError}달  ${row.monthKnown ? '' : '(월 미상 — 6월로 가정)'}`);
}
console.log('');
console.log('## 합계');
console.log(`  평균 백분위   ${avg(pooled.map((s) => s.percentile))}%   ← 50%가 우연`);
console.log(`  Hit@1 ${pct(pooled.map((s) => s.hit1))}%  Hit@3 ${pct(pooled.map((s) => s.hit3))}%  Hit@5 ${pct(pooled.map((s) => s.hit5))}%`);
console.log(`  ±1달 ${pct(pooled.map((s) => s.tol1))}%  ±3달 ${pct(pooled.map((s) => s.tol3))}%  ±6달 ${pct(pooled.map((s) => s.tol6))}%`);
console.log(`  최고점까지 평균 ${avg(pooled.map((s) => s.peakError))}달`);
console.log('');

// ── 남의 사건과 섞기 ──
const shuffled = [];
for (const a of rows) for (const b of rows) {
  if (a.person === b.person || a.domain !== b.domain) continue;
  const s = score(a.result, a.domain, b.key);
  if (s) shuffled.push(s);
}
console.log('## 기준선 — 남의 사건 날짜로 채점하면');
console.log(`  평균 백분위 ${avg(shuffled.map((s) => s.percentile))}%  (제대로: ${avg(pooled.map((s) => s.percentile))}%)`);
console.log(`  ±3달 ${pct(shuffled.map((s) => s.tol3))}%  (제대로: ${pct(pooled.map((s) => s.tol3))}%)`);
console.log('');

// ── 체계별 ──
console.log('## 체계별 — 어느 체계가 이 분야의 시기를 잡는가');
console.log('');
const byDomain = {};
for (const row of rows) (byDomain[row.domain] ??= []).push(row);
for (const [d, list] of Object.entries(byDomain)) {
  console.log(`### ${DOMAIN_LABEL[d]} (${list.length}건)`);
  const scores = SYSTEM_IDS.map((id) => {
    const ss = list.map((row) => score(row.result, d, row.key, id)).filter(Boolean);
    return { id, n: ss.length, p: avg(ss.map((s) => s.percentile)), tol3: pct(ss.map((s) => s.tol3)) };
  }).filter((x) => x.n && x.p != null).sort((a, b) => b.p - a.p);
  for (const x of scores.slice(0, 6)) {
    console.log(`   ${pad(SYSTEM_NAME[x.id], 10)} 백분위 ${pad(x.p + '%', 7)} ±3달 ${pad(x.tol3 + '%', 6)} (n=${x.n})`);
  }
  console.log('');
}
console.log('※ 사건이 적어 이 숫자로 체계를 고르지 않는다. 지금은 **틀이 도는지**를 본 것이다.');
