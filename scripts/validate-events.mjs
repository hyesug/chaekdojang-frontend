/**
 * validate-events.mjs — 원전 사건 규칙(semantic/events/rules.js)을 사례집으로 잰다 (3단계 재검증)
 *
 *   node scripts/validate-events.mjs
 *
 * 기준은 docs/unse/rebuild-criteria.md 에 사전 등록한 것을 그대로 쓴다.
 *
 *   체계별 O/X  사건 해가 그 사람 창(18~45세, 현재까지)에서 그 체계 점수 상위 20% 면 O. 우연 20%.
 *   합산 예측   체계마다 점수를 그 사람 창 안 백분위로 바꿔 **같은 무게로 평균** — 고르지 않는다.
 *               가장 높은 해(동점이면 이른 해)를 예측 해로 본다.
 *   기준선     명반 없이 "다른 사람들의 중간 나이"에 일어난다고 말하기 (한 명 빼기).
 *   조합 선택   (참고) 3명 이상 남긴 채 체계 1~3개 조합을 한 명 빼기로 골라 뺀 사람에 대 본다.
 *
 * 예정된 일(plannedFutureEvents)은 주 채점에 넣지 않고 따로 적는다(SCHEMA.md).
 */
import { readFileSync } from 'node:fs';
import { readFortune } from '../public/unse/src/engine.js';
import { eventYears } from '../public/unse/src/semantic/events/rules.js';

const NOW_YEAR = 2026;
const people = JSON.parse(readFileSync('validation/people.json', 'utf8'));
const cases = JSON.parse(readFileSync('validation/cases.json', 'utf8'));
const NAME = { saju: '사주', jamidusu: '자미두수', astrology_modern: '점성(현대)', astrology_classical: '점성(고전)',
  vedic: '베딕', juyeok: '주역', gujeong: '구성학', kabbalah: '카발라', tarot: '타로', thai: '태국',
  hongguk: '홍국기문', yukim: '육임', taeeul: '태을신수', sukyo: '숙요', tojeong: '토정비결', mahabote: '마하보테' };
const SYS = Object.keys(NAME);
const OK = 80;

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
/** 창 안 백분위 (동점은 중간 순위). 전부 같으면 null */
function pctMap(entries) {
  const vs = entries.map(([, v]) => v);
  if (new Set(vs).size <= 1) return null;
  const m = {};
  for (const [k, v] of entries) {
    const hi = vs.filter((x) => x > v).length, eq = vs.filter((x) => x === v).length;
    m[k] = ((vs.length - (hi + (eq + 1) / 2)) / (vs.length - 1)) * 100;
  }
  return m;
}

// ── 사람마다 창과 체계 점수 ─────────────────────────────────
const fortunes = Object.fromEntries(people.map((p) => [p.id, readFortune(p.birth)]));
const windowOf = (p, extra = 0) => [p.birth.year + 18, Math.min(p.birth.year + 45, NOW_YEAR + extra)];
const scoreCache = {};
function scoresOf(p, event, extra = 0) {
  const key = `${p.id}:${event}:${extra}`;
  if (scoreCache[key]) return scoreCache[key];
  const [from, to] = windowOf(p, extra);
  const raw = eventYears(fortunes[p.id], event, from, to);
  const pct = {};
  for (const id of SYS) {
    const r = raw[id];
    pct[id] = r?.available ? pctMap(Object.entries(r.years).map(([y, v]) => [Number(y), v.score])) : null;
  }
  return (scoreCache[key] = { from, to, raw, pct });
}
/** 고른 체계들의 백분위 평균으로 해마다 합산 → 가장 높은 해 */
function predictYear(p, event, systems, extra = 0) {
  const { from, to, pct } = scoresOf(p, event, extra);
  const used = systems.filter((id) => pct[id]);
  if (!used.length) return null;
  let best = null;
  for (let y = from; y <= to; y++) {
    const v = avg(used.map((id) => pct[id][y]));
    if (!best || v > best.v) best = { y, v };
  }
  return best.y;
}
const mark = (v) => (v == null ? '·' : v >= OK ? 'O' : 'X');
const pad = (s, n) => String(s ?? '').padEnd(n);
const head = SYS.map((id) => pad(NAME[id].slice(0, 4), 5)).join('');

function perSystemTable(title, rows, event, extra = 0) {
  console.log(`\n## ${title} — 체계별 O/X (사건 해가 그 체계 상위 20%)`);
  console.log(pad('사람 사건', 16) + head + '  합산');
  const tally = Object.fromEntries(SYS.map((id) => [id, [0, 0]]));
  const all = [];
  for (const r of rows) {
    const p = people.find((x) => x.id === r.person);
    const { pct } = scoresOf(p, event, extra);
    const used = SYS.filter((id) => pct[id]);
    const pool = used.length ? avg(used.map((id) => pct[id][r.year])) : null;
    // 합산의 백분위는 해마다 합산한 값 사이에서 다시 매긴다
    const { from, to } = scoresOf(p, event, extra);
    const sums = []; for (let y = from; y <= to; y++) sums.push([y, avg(used.map((id) => pct[id][y]))]);
    const poolPct = pctMap(sums)?.[r.year] ?? null;
    all.push(poolPct);
    console.log(pad(`${r.person} ${r.year}`, 16) + SYS.map((id) => {
      const v = pct[id]?.[r.year];
      if (v != null) { tally[id][1]++; if (v >= OK) tally[id][0]++; }
      return pad(` ${mark(v)}`, 5);
    }).join('') + `  ${mark(poolPct)} (${poolPct == null ? '-' : Math.round(poolPct)}%)`);
    void pool;
  }
  console.log(pad('합계', 16) + SYS.map((id) => pad(`${tally[id][0]}/${tally[id][1]}`, 5)).join('')
    + `  ${all.filter((v) => v != null && v >= OK).length}/${all.filter((v) => v != null).length}`);
  const best = SYS.filter((id) => tally[id][1] >= 3).sort((a, b) => tally[b][0] / tally[b][1] - tally[a][0] / tally[a][1])[0];
  if (best) console.log(`  가장 높은 체계: ${NAME[best]} ${tally[best][0]}/${tally[best][1]} (우연 기대 ${(tally[best][1] * 0.2).toFixed(1)})`);
  return tally;
}

/** 예측 해 오차 — 합산(고르지 않음) · 나이 기준선 · 한 명 빼기 조합 */
function yearPrediction(title, rows, event, unmarried = []) {
  console.log(`\n## ${title} — 해 맞히기 (한 명 빼기)`);
  const ageOf = (r) => r.year - people.find((x) => x.id === r.person).birth.year;
  const combos = []; const rec = (i, cur) => { if (cur.length) combos.push([...cur]); if (cur.length === 3) return; for (let j = i; j < SYS.length; j++) { cur.push(SYS[j]); rec(j + 1, cur); cur.pop(); } }; rec(0, []);
  const persons = [...new Set(rows.map((r) => r.person))];
  const out = { pool: [], base: [], pick: [] };
  console.log(pad('사람', 6) + pad('실제', 7) + pad('합산', 14) + pad('나이 기준선', 16) + '고른 조합(한 명 빼기)');
  for (const r of rows) {
    const p = people.find((x) => x.id === r.person);
    const train = rows.filter((x) => x.person !== r.person);
    const pool = predictYear(p, event, SYS);
    const base = p.birth.year + Math.round(median(train.map(ageOf)));
    // 조합: 남은 사람들의 평균 오차가 가장 작은 것
    let bestC = null;
    for (const c of combos) {
      const errs = train.map((t) => { const y = predictYear(people.find((x) => x.id === t.person), event, c); return y == null ? null : Math.abs(y - t.year); });
      if (errs.some((e) => e == null)) continue;
      const m = avg(errs);
      if (!bestC || m < bestC.m) bestC = { c, m };
    }
    const pick = bestC ? predictYear(p, event, bestC.c) : null;
    out.pool.push(pool == null ? null : Math.abs(pool - r.year));
    out.base.push(Math.abs(base - r.year));
    out.pick.push(pick == null ? null : Math.abs(pick - r.year));
    console.log(pad(r.person, 6) + pad(r.year, 7) + pad(`${pool} (${pool - r.year >= 0 ? '+' : ''}${pool - r.year})`, 14)
      + pad(`${base} (${base - r.year >= 0 ? '+' : ''}${base - r.year})`, 16)
      + (pick == null ? '불가' : `${pick} (${pick - r.year >= 0 ? '+' : ''}${pick - r.year}) ← ${bestC.c.map((id) => NAME[id]).join('+')}`));
  }
  const m = (xs) => { const v = xs.filter((x) => x != null); return v.length ? avg(v).toFixed(1) : '-'; };
  console.log(`  평균 오차 — 합산 ${m(out.pool)}년 · 나이 기준선 ${m(out.base)}년 · 고른 조합 ${m(out.pick)}년`);
  if (unmarried.length) {
    console.log('  아직 일어나지 않은 사람에게 합산 식이 짚은 해 (현재 이전이면 오답):');
    for (const id of unmarried) {
      const y = predictYear(people.find((x) => x.id === id), event, SYS);
      console.log(`    ${id}: ${y}${y != null && y < NOW_YEAR ? ' ← 이미 일어났어야 함 (오답)' : ''}`);
    }
  }
  void persons;
  return out;
}

// ── 결혼 ───────────────────────────────────────────────────
const marriages = people.filter((p) => p.labels?.relationship?.status === 'known')
  .map((p) => ({ person: p.id, year: Number(String(p.labels.relationship.date ?? '').slice(0, 4)) || p.birth.year + p.labels.relationship.marriedAtAge }));
const neverMarried = people.filter((p) => p.labels?.relationship?.status === 'censored' && p.birth.year >= 1980).map((p) => p.id);
console.log(`# 원전 사건 규칙 재검증 — 결혼 ${marriages.length}건, 출산은 사례 사건으로`);
perSystemTable('결혼', marriages, 'marriage');
yearPrediction('결혼', marriages, 'marriage', neverMarried);

// 예정(참고) — 주 채점과 섞지 않는다
const planned = people.flatMap((p) => (p.plannedFutureEvents ?? []).filter((e) => e.kind === 'marriage')
  .map((e) => ({ person: p.id, year: Number(e.date.slice(0, 4)) })));
if (planned.length) {
  console.log('\n## (참고) 결혼 예정 — 아직 일어나지 않음');
  for (const r of planned) {
    const p = people.find((x) => x.id === r.person);
    const { pct } = scoresOf(p, 'marriage', 2);
    console.log(`  ${r.person} ${r.year}: ` + SYS.filter((id) => pct[id]).map((id) => `${NAME[id]} ${mark(pct[id][r.year])}`).join(' · ')
      + ` · 합산 예측 ${predictYear(p, 'marriage', SYS, 2)}`);
  }
}

// ── 출산 ───────────────────────────────────────────────────
const births = cases.flatMap((c) => c.events.filter((e) => e.domain === '자녀').map((e) => ({ person: c.id, year: e.year })));
perSystemTable('출산', births, 'birth');
const firstBirths = Object.values(Object.groupBy(births, (b) => b.person)).map((xs) => xs.sort((a, b) => a.year - b.year)[0]);
yearPrediction('첫 출산', firstBirths, 'birth');
