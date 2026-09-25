/**
 * diagnose-ceiling.mjs — **답을 쥐고 뒤에서 맞춰 본다 (시기 편)**
 *
 *   node scripts/diagnose-ceiling.mjs
 *
 * 묻는 것은 하나다.
 *
 *   "지금 못 맞히는 것이 **해석을 못 해서**인가, **거기 없어서**인가?"
 *
 * 이 저장소는 직업·성향에 대해 이미 역산을 해 봤다(README 의 '역산' 절).
 * 정답을 알려 주고 뒤에서 지표를 골라도 우연 수준이었다. 그런데 **시기**
 * 에는 그 실험을 하지 않았다. 여기서 한다.
 *
 * ── 방법 ───────────────────────────────────────────────────
 * 사건이 일어난 달을 **미리 알려 주고**, 열다섯 체계 가운데 그 달을 가장
 * 높게 본 체계를 사후에 고른다(oracle). 이건 실전에서 쓸 수 없는 반칙이다.
 * 반칙을 해도 못 찾으면, 그건 고르는 방법의 문제가 아니다.
 *
 * ── 반칙에는 반칙의 기준선을 댄다 ──────────────────────────
 * 열다섯 중 최고를 고르면 신호가 없어도 값이 올라간다. 그래서 **사건 달을
 * 무작위로 옮긴 뒤 똑같이 열다섯 중 최고를 고르는** 기준선과 견준다.
 * 이 둘을 견주지 않으면 "역산하니 70%!" 같은 착시가 생긴다.
 *
 * ── 그리고 한결같은가 ──────────────────────────────────────
 * 사건마다 다른 체계가 1등이면 그건 규칙이 아니라 그때그때 이긴 것을
 * 고른 것이다. 어느 체계가 몇 번 1등이었는지 함께 센다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { predictTimeline } from '../public/unse/src/semantic/timing/timeline.js';
import { SYSTEM_IDS, SYSTEM_NAME } from '../public/unse/src/semantic/extract.js';
import { DOMAIN_LABEL } from '../public/unse/src/semantic/timing/schema.js';
import { midRank, seededRandom } from '../public/unse/src/semantic/timing/schema.js';

const file = process.argv[2] ?? 'validation/cases.json';
if (!existsSync(file)) { console.error(`${file} 이 없습니다.`); process.exit(1); }
const cases = JSON.parse(readFileSync(file, 'utf8'));

const DOMAIN_OF = {
  직업: 'career', 재물: 'wealth', 관계: 'relationship', 결혼: 'marriage',
  주거: 'residence', 이사: 'movement', 건강: 'health', 학업: 'education', 자녀: 'children',
};
const pad = (s, n) => String(s ?? '').padEnd(n);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

// ── 사건마다 체계별 시계열을 뽑는다 ──
const events = [];
for (const c of cases) {
  for (const e of c.events ?? []) {
    const domain = DOMAIN_OF[e.domain];
    if (!domain || !e.year || e.month == null) continue;   // 달을 아는 것만
    events.push({ person: c.id, birth: c.birth, domain,
      key: `${e.year}-${String(e.month).padStart(2, '0')}`, year: e.year });
  }
}
if (!events.length) { console.error('달을 아는 사건이 없습니다.'); process.exit(1); }

console.log('# 천장 진단 — 답을 쥐고 뒤에서 맞춰도 되는가 (시기)');
console.log('');
console.log('열다섯 체계 가운데 **사건 달을 가장 높게 본 것을 사후에 고른** 값입니다.');
console.log('실전에서 쓸 수 없는 반칙이고, 반칙을 해도 못 찾으면 고르는 방법의 문제가 아닙니다.');
console.log('');

const rows = [];
for (const ev of events) {
  const from = `${ev.year - 3}-01`;
  const to = `${ev.year + 3}-12`;
  let r = null;
  try { r = predictTimeline({ birth: ev.birth, from, to, domains: [ev.domain] }); }
  catch (err) { console.log(`  ! ${ev.person} ${ev.domain} — ${err.message}`); continue; }

  const keys = Object.keys(r.timeline).sort();
  const per = [];
  for (const id of SYSTEM_IDS) {
    const vals = keys.map((k) => r.systemResults[id]?.months?.[k]?.rawActivations?.[ev.domain] ?? null);
    const xs = vals.filter(Number.isFinite);
    if (xs.length < 3 || new Set(xs).size <= 1) continue;   // 못 가르는 체계는 뺀다
    const i = keys.indexOf(ev.key);
    if (i < 0 || !Number.isFinite(vals[i])) continue;
    const p = midRank(xs, vals[i]).percentile;
    if (p == null) continue;
    per.push({ id, pct: p, vals, keys });
  }
  // 합친 것도 함께
  const pooled = keys.map((k) => r.timeline[k]?.domains?.[ev.domain]?.rawActivation ?? null);
  const px = pooled.filter(Number.isFinite);
  const pi = keys.indexOf(ev.key);
  const pooledPct = px.length > 2 && new Set(px).size > 1 && pi >= 0 && Number.isFinite(pooled[pi])
    ? midRank(px, pooled[pi]).percentile : null;

  if (!per.length) continue;
  per.sort((a, b) => b.pct - a.pct);
  rows.push({ ...ev, per, best: per[0], pooledPct, n: keys.length });
}

if (!rows.length) { console.error('채점할 것이 없습니다.'); process.exit(1); }

// ── 반칙의 기준선: 사건 달을 무작위로 옮기고 똑같이 열다섯 중 최고를 고른다 ──
const rnd = seededRandom(20260924);
const ROUNDS = 2000;
const nullBest = [];
for (let t = 0; t < ROUNDS; t++) {
  const picks = [];
  for (const row of rows) {
    let b = -1;
    for (const s of row.per) {
      const xs = s.vals.filter(Number.isFinite);
      const v = xs[Math.floor(rnd() * xs.length)];
      const p = midRank(xs, v).percentile;
      if (p != null && p > b) b = p;
    }
    if (b >= 0) picks.push(b);
  }
  if (picks.length) nullBest.push(avg(picks));
}
nullBest.sort((a, b) => a - b);
const nb = {
  mean: r1(avg(nullBest)),
  lo: r1(nullBest[Math.floor(nullBest.length * 0.025)]),
  hi: r1(nullBest[Math.floor(nullBest.length * 0.975)]),
};

const obsBest = r1(avg(rows.map((x) => x.best.pct)));
const obsPooled = r1(avg(rows.map((x) => x.pooledPct).filter((v) => v != null)));

console.log('## 사건마다 — 가장 잘 본 체계를 사후에 고르면');
console.log('');
console.log('  사람  분야    사건      1등 체계      백분위   합친 것   쓸 수 있던 체계');
for (const x of rows) {
  console.log(`  ${pad(x.person, 5)} ${pad(DOMAIN_LABEL[x.domain], 6)} ${pad(x.key, 9)} ` +
    `${pad(SYSTEM_NAME[x.best.id], 12)} ${pad(x.best.pct + '%', 8)} ` +
    `${pad((x.pooledPct ?? '—') + '%', 9)} ${x.per.length}개`);
}
console.log('');
console.log('## 천장');
console.log('');
console.log(`  사후에 최고를 고른 값   ${obsBest}%   (${rows.length}건)`);
console.log(`  같은 반칙의 기준선      ${nb.mean}%   95% 구간 ${nb.lo}~${nb.hi}%`);
console.log(`  합친 것(반칙 없음)      ${obsPooled}%`);
console.log('');
const inside = obsBest >= nb.lo && obsBest <= nb.hi;
console.log(inside
  ? '  → **반칙을 해도 기준선 안이다.** 열다섯 중 최고를 사후에 골라도 무작위로'
  : '  → 반칙한 값이 기준선 밖이다. 뽑아낼 것이 남아 있을 수 있다.');
if (inside) {
  console.log('     고른 것과 구별되지 않는다. 고르는 방법을 바꿔서 될 일이 아니다.');
}
console.log('');

// ── 한결같은가 ──
const wins = {};
for (const x of rows) wins[x.best.id] = (wins[x.best.id] ?? 0) + 1;
const ranked = Object.entries(wins).sort((a, b) => b[1] - a[1]);
console.log('## 1등이 한결같은가');
console.log('');
console.log(`  ${ranked.map(([id, n]) => `${SYSTEM_NAME[id]} ${n}번`).join(' · ')}`);
const top = ranked[0]?.[1] ?? 0;
const avgPool = r1(avg(rows.map((x) => x.per.length)));
console.log(`  가장 많이 1등한 체계가 ${top}/${rows.length}건.` +
  ` 쓸 수 있던 체계가 평균 ${avgPool}개이니 아무 신호가 없어도` +
  ` 한 체계가 ${r1(rows.length / avgPool)}건쯤은 1등한다.`);
console.log(top <= rows.length / avgPool + 1
  ? '  → 사건마다 다른 체계가 1등이다. **규칙이 아니라 그때그때 이긴 것을 고른 것이다.**'
  : '  → 한 체계가 유난히 자주 1등이다. 그 체계만 따로 재 볼 값어치가 있다.');
console.log('');

// ── 얼마나 모아야 지금 보이는 차이를 잡아낼 수 있나 ──
const pooledVals = rows.map((x) => x.pooledPct).filter((v) => v != null);
const m = avg(pooledVals);
const sd = Math.sqrt(avg(pooledVals.map((v) => (v - m) ** 2)));
const d = sd > 0 ? (m - 50) / sd : 0;
const need = d !== 0 ? Math.ceil(((2.8 / Math.abs(d)) ** 2)) : Infinity;
console.log('## 표본을 늘리면 잡히나 (지금 보이는 차이 기준)');
console.log('');
console.log(`  합친 것의 평균 ${r1(m)}% · 표준편차 ${r1(sd)} · 효과크기 d=${r1(d * 10) / 10}`);
console.log(`  이 크기의 차이를 80% 힘으로 잡으려면 사건이 약 **${Number.isFinite(need) ? need : '∞'}건** 필요하다`
  + ` (지금 ${pooledVals.length}건).`);
console.log('  ※ 이건 "모으면 된다"가 아니라 "지금 차이가 진짜라고 쳤을 때 필요한 수"다.');
console.log('     앞선 두 표본(43건·11건)에서 모두 기준선을 넘지 못했으므로,');
console.log('     늘렸을 때 0 으로 수렴할 가능성도 같은 무게로 열려 있다.');
console.log('');
console.log('## 읽는 법');
console.log('  · 이건 예측이 아니라 **상한선**이다. 실전에서는 어느 체계가 맞을지 미리 못 고른다.');
console.log('  · 상한선이 기준선 안이면, 더 나은 해석 규칙을 만들어도 그 위로 못 간다.');
