/**
 * 눈금을 해로 바꿔서 잰다 — 열다섯이 전부 투표할 수 있는 첫 시험
 *
 * 달 단위로는 열다섯 중 셋만 참여할 수 있었다. 나머지 열둘은 936달을
 * 넉 줄에서 열한 줄로만 가른다 — 동률 덩어리가 200~350달이라 달을 고를 수가
 * 없다. 틀려서가 아니라 **달 단위로 변하는 숫자를 안 내기 때문**이다.
 *
 *   토정비결   한 해에 한 괘        → 12달이 통째로 같은 값
 *   구성학     년반 위주            → 거의 연 단위
 *   태을신수    24·72·360년 주기    → 수십 년이 한 덩어리
 *   주역·육임   질문마다 세우는 점    → 애초에 시계열이 아니다
 *
 * 그러면 **해를 맞히게 하면** 열다섯이 다 참여한다. 눈금만 바꾸는 것이고
 * 사건은 같은 43건을 쓴다.
 *
 * 모든 체계를 같은 길로 부른다 — `forecast(input, chart, 연 단위 period)` 가
 * 내는 영역 점수(areas). 핵심 셋도 예외가 아니다. 한 길로 불러야 체계끼리
 * 견줄 수 있다.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { readFortune } from '../public/unse-8f3k2m/src/engine.js';
import { makePeriod } from '../public/unse-8f3k2m/src/forecast.js';

const ROUNDS = 500;
const CASES = JSON.parse(readFileSync('validation/cases.json', 'utf8'));

const AREA_OF = {
  직업: '직장운', 재물: '금전운', 관계: '애정운', 결혼: '애정운',
  주거: '총운', 이사: '총운', 건강: '건강운', 학업: '학업운', 자녀: '애정운',
};

const FILES = readdirSync('public/unse-8f3k2m/src/systems')
  .filter((f) => f.endsWith('.js') && !f.startsWith('_'));
const MODS = {};
for (const f of FILES) {
  const m = (await import(`../public/unse-8f3k2m/src/systems/${f}`)).default;
  if (typeof m?.forecast === 'function') MODS[f.replace('.js', '')] = m;
}
const NAMES = Object.keys(MODS);

const years = CASES.flatMap((c) => c.events.map((e) => e.year));

/**
 * 후보 해가 20개는 되어야 순위에 뜻이 생긴다.
 *
 * 아래 `pcts()` 가 후보 20해 미만인 사건을 버린다. 사건이 모인 기간이
 * 좁으면(우리 지인들은 2012~2026, 15해뿐이다) **사건이 전부 버려지고
 * 표가 통째로 비어 나온다.** 실제로 그렇게 나왔고, 조용히 비어서 처음엔
 * 체계가 하나도 없는 줄 알았다.
 *
 * 문턱을 낮추지 않고 **창을 넓힌다.** 사건이 없던 해도 후보로 세우는 것이
 * 맞다 — "그 해에는 아무 일도 없었다"는 것도 자료다. 기준선(순열)도 같은
 * 창을 쓰므로 창을 넓혀서 생기는 유불리는 양쪽에 똑같이 걸린다.
 */
const MIN_CANDIDATE_YEARS = 21;
const evFrom = Math.min(...years), evTo = Math.max(...years);
const pad = Math.max(0, MIN_CANDIDATE_YEARS - (evTo - evFrom + 1));
const fromYear = evFrom - pad;          // 뒤로만 넓힌다 — 앞은 아직 오지 않은 해다
const toYear = evTo;
const SPAN = toYear - fromYear + 1;

console.log(`사례 ${CASES.length}명 · 사건 ${CASES.reduce((t, c) => t + c.events.length, 0)}건 · ` +
  `기간 ${fromYear}~${toYear} (${SPAN}년) · 체계 ${NAMES.length}개\n`);

console.log('1단계 — 사람마다 해마다 체계별 점수를 뽑습니다 (사건은 보지 않습니다)');
const perPerson = [];
for (const c of CASES) {
  process.stdout.write(`  ${c.id} …`);
  const r = readFortune(c.birth, { now: new Date(`${fromYear}-06-01T00:00:00Z`) });
  const rows = [];
  for (let y = fromYear; y <= toYear; y++) {
    const period = makePeriod('year', { y, m: 6, d: 15 });
    const s = {};
    for (const n of NAMES) {
      try { s[n] = MODS[n].forecast(r.input, r.chart, period)?.areas ?? null; }
      catch { s[n] = null; }
    }
    rows.push({ y, s });
  }
  perPerson.push(rows);
  console.log(' 완료');
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

/** 한 체계(또는 합산)로 해를 줄 세우고 실제 해가 몇 %인지 */
function pcts(rows, events, key) {
  const out = [];
  for (const ev of events) {
    const area = AREA_OF[ev.domain];
    const scored = rows.map((row) => {
      if (key !== '합산') {
        const v = row.s[key]?.[area];
        return typeof v === 'number' ? { y: row.y, v } : null;
      }
      // 합산 — 체계마다의 무게로 가중평균
      let t = 0, w = 0;
      for (const n of NAMES) {
        const v = row.s[n]?.[area];
        if (typeof v !== 'number') continue;
        const ww = MODS[n].meta?.weight ?? 1;
        t += v * ww; w += ww;
      }
      return w > 0 ? { y: row.y, v: t / w } : null;
    }).filter(Boolean);
    if (scored.length < 20) continue;
    scored.sort((a, b) => b.v - a.v);
    const i = scored.findIndex((x) => x.y === ev.year);
    if (i < 0) continue;
    out.push(i / (scored.length - 1));
  }
  return out;
}

/** 동률 구조 — 78해를 몇 가지로 가르는가 */
function resolution(key) {
  const vals = perPerson[0].map((row) => {
    if (key !== '합산') return row.s[key]?.직장운;
    let t = 0, w = 0;
    for (const n of NAMES) {
      const v = row.s[n]?.직장운;
      if (typeof v !== 'number') continue;
      const ww = MODS[n].meta?.weight ?? 1;
      t += v * ww; w += ww;
    }
    return w > 0 ? Math.round(t / w * 100) / 100 : undefined;
  }).filter((v) => typeof v === 'number');
  const c = {};
  for (const v of vals) c[v] = (c[v] ?? 0) + 1;
  return { distinct: new Set(vals).size, n: vals.length, biggest: Math.max(...Object.values(c)) };
}

console.log('\n2단계 — 체계마다 따로 채점하고 순열 검정을 돌립니다\n');
console.log(`체계          해상도(${SPAN * CASES.length}해)  제대로   기준선     p값     판정`);
const eventSets = CASES.map((c) => c.events);
const rows = [];

for (const key of ['합산', ...NAMES]) {
  const all = perPerson.flatMap((rw, i) => pcts(rw, eventSets[i], key));
  if (all.length < 10) continue;
  const real = mean(all);

  const nul = [];
  for (let r = 0; r < ROUNDS; r++) {
    const perm = eventSets.map((_, i) => i);
    for (let i = perm.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    if (perm.filter((v, i) => v === i).length > perm.length / 4) { r--; continue; }
    const s = perPerson.flatMap((rw, i) => pcts(rw, eventSets[perm[i]], key));
    if (s.length) nul.push(mean(s));
  }
  const better = nul.filter((s) => s <= real).length;
  const p = (better + 1) / (nul.length + 1);
  const res = resolution(key);
  rows.push({ key, real, base: mean(nul), p, res, n: all.length });
}

rows.sort((a, b) => a.p - b.p);
for (const x of rows) {
  const label = x.key === '합산' ? '합산(가중)' : (MODS[x.key].meta?.name ?? x.key);
  const verdict = x.p < 0.05 ? '★ 신호 있음' : x.p < 0.2 ? '애매' : '구별 안 됨';
  console.log(`${label.padEnd(12)} ${String(x.res.distinct).padStart(4)}가지/최대${String(x.res.biggest).padStart(3)}해  ` +
    `${(x.real * 100).toFixed(1).padStart(6)}%  ${(x.base * 100).toFixed(1).padStart(6)}%  ` +
    `${x.p.toFixed(3).padStart(7)}   ${verdict}`);
}

console.log(`\n※ 체계 ${rows.length}개를 동시에 재면 그중 하나쯤은 우연히 p<0.05 가 나온다.`);
console.log(`   제대로 보정하면 p < ${(0.05 / rows.length).toFixed(4)} 여야 신호라고 부를 수 있다.`);
console.log('※ 해상도가 거칠면(가짓수가 적고 동률 덩어리가 크면) p값 자체가 동률 위치의 우연이다.');
