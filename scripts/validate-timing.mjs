/**
 * validate-timing.mjs — **development-set 검증**. 시기 엔진을 과장 없이 잰다
 *
 *   node scripts/validate-timing.mjs
 *
 * ── 이것은 blind validation 이 아니다 ──────────────────────
 * P01~P12 는 규칙을 만들고 고치는 동안 여러 번 봤다. 그러므로 여기 나오는
 * 숫자는 **개발용 자료에서 잰 값**이고, 새로 들어올 사례에 그대로 옮겨
 * 간다는 보장이 없다. 규칙을 얼린 뒤 새 사례로 재야 blind 다.
 *
 * ── 앞선 검증기에서 고친 것 ────────────────────────────────
 *   · 동점을 배열 순서로 깨던 것 → 중간 순위
 *   · 반올림한 값을 채점하던 것 → 원값
 *   · "Top-3 중 하나가 ±3달" 을 "±3달 적중률"로 부르던 것 → 이름 분리
 *   · 값이 전부 같은 시계열에 50% 를 주던 것 → unscorable
 *   · 월 미상 사건을 6월로 채우던 것 → 연 단위로만 채점
 *   · 해 단위 체계를 달 눈금으로 재던 것 → native resolution 으로
 *   · 남의 사건 섞기만 기준선으로 쓰던 것 → 같은 사람 안에서 순열
 *   · 사건별 null 구간을 평균해 합산값에 대던 것 → 합산 통계 자체의 null 분포
 *   · 체계 눈금을 첫 사람 것으로 고정하던 것 → 행마다 그 사람의 눈금
 *   · 창 지표(Top3Within·BestPercentileWithin)에 기준선이 없던 것 → 같이 잰다
 */
import { readFileSync, existsSync } from 'node:fs';
import { predictTimeline } from '../public/unse/src/semantic/timing/timeline.js';
import { DOMAIN_LABEL } from '../public/unse/src/semantic/timing/schema.js';
import { SYSTEM_NAME, SYSTEM_IDS } from '../public/unse/src/semantic/extract.js';
import {
  scoreEvent, scoreEventYearly, scoreAtResolution, aggregateNull, nullPosition,
  personWeighted, personBootstrap,
} from '../public/unse/src/validation/timingMetrics.js';

const file = process.argv[2] ?? 'validation/cases.json';
if (!existsSync(file)) {
  console.error(`${file} 이 없습니다 (개인정보라 저장소에 없습니다).`);
  process.exit(1);
}
const cases = JSON.parse(readFileSync(file, 'utf8'));

const DOMAIN_OF = {
  직업: 'career', 재물: 'wealth', 관계: 'relationship', 결혼: 'marriage',
  주거: 'residence', 이사: 'movement', 건강: 'health', 학업: 'education', 자녀: 'children',
};

// ── 사건을 모은다. **월을 모르면 지어내지 않는다** ──
const rows = [];
let skipped = 0;
for (const c of cases) {
  const evs = (c.events ?? []).filter((e) => e.year && DOMAIN_OF[e.domain]);
  if (!evs.length) continue;
  const years = evs.map((e) => e.year);
  let r;
  try {
    r = predictTimeline({ birth: c.birth, from: `${Math.min(...years) - 3}-01`, to: `${Math.max(...years) + 3}-12` });
  } catch (err) { console.error(`  ! ${c.id} ${err.message}`); skipped += evs.length; continue; }
  for (const e of evs) {
    // 정밀도를 명시한다. 없으면 month 유무로 정한다 — 없는 정밀도를 만들지 않는다
    const precision = e.datePrecision ?? (e.month != null ? 'month' : 'year');
    rows.push({
      person: c.id, domain: DOMAIN_OF[e.domain], what: e.what,
      year: e.year, month: e.month ?? null, precision,
      key: e.month != null ? `${e.year}-${String(e.month).padStart(2, '0')}` : null,
      result: r,
    });
  }
}
if (!rows.length) { console.error('채점할 사건이 없습니다.'); process.exit(1); }

/** 원값 시계열을 꺼낸다 — **반올림된 값을 쓰지 않는다** */
const seriesOf = (r, domain, sysId = null) => Object.keys(r.timeline).sort().map((k) => ({
  k,
  v: sysId
    ? (r.systemResults[sysId]?.months?.[k]?.rawActivations?.[domain] ?? null)
    : (r.timeline[k]?.domains?.[domain]?.rawActivation ?? null),
  // 스무딩 창이 덜 찬 달은 창 지표의 null 후보에서 뺀다 (체계별 시계열은 스무딩하지 않는다)
  full: sysId ? true : (r.timeline[k]?.domains?.[domain]?.windowFull !== false),
}));

/** 사건월이 시계열 양 끝에서 몇 달 떨어져 있는가 — null 후보 제한과 같은 자로 잰다 */
const marginOf = (r, key) => {
  const keys = Object.keys(r.timeline).sort();
  const i = keys.indexOf(key);
  return i < 0 ? null : Math.min(i, keys.length - 1 - i);
};

const resolutionOf = (r, sysId) => {
  const m = Object.values(r.systemResults[sysId]?.months ?? {}).find(Boolean);
  return m?.resolution ?? 'none';
};

const pad = (s, n) => String(s ?? '').padEnd(n);
const pctOf = (xs) => (xs.length ? Math.round((xs.filter(Boolean).length / xs.length) * 100) : null);
const avg = (xs) => { const v = xs.filter((x) => x != null); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };

// ═════════════════════════════════════════════════════════════
console.log('# 시기 검증 (development-set)');
console.log('');
console.log('P01~P12 는 규칙을 만드는 동안 여러 번 본 자료입니다. **blind validation 이 아닙니다.**');
console.log('');

// ── 데이터 ──
const monthly = rows.filter((r) => r.precision === 'month');
const yearly = rows.filter((r) => r.precision === 'year');
console.log('## 데이터');
console.log(`  사람 ${new Set(rows.map((r) => r.person)).size}명 · 사건 ${rows.length}건`);
console.log(`  월 precision ${monthly.length}건 · 연 precision ${yearly.length}건 · 계산 실패 ${skipped}건`);
const byDom = {};
for (const r of rows) (byDom[r.domain] ??= []).push(r);
console.log('  분야별: ' + Object.entries(byDom).map(([d, xs]) => `${DOMAIN_LABEL[d]} ${xs.length}`).join(' · '));
console.log('');

// ── 사건별 ──
console.log('## 사건별 (합친 결과)');
console.log('');
console.log('사람  분야    사건      정밀도  순위/전체   백분위  Top3±1 Top3±3 Top3±6  ±3창최고  최고점오차');
const scored = [];
for (const row of rows) {
  const series = seriesOf(row.result, row.domain);
  const s = row.precision === 'month'
    ? scoreEvent(series, row.key)
    : scoreEventYearly(series, row.year);
  row.score = s;
  if (s.unscorable) {
    console.log(`${pad(row.person, 5)} ${pad(DOMAIN_LABEL[row.domain], 6)} ${pad(row.key ?? row.year, 9)} ${pad(row.precision, 6)}  채점 불가 — ${s.unscorable}${s.note ? ` (${s.note})` : ''}`);
    continue;
  }
  scored.push(row);
  if (row.precision === 'month') {
    console.log(`${pad(row.person, 5)} ${pad(DOMAIN_LABEL[row.domain], 6)} ${pad(row.key, 9)} ${pad('월', 6)}  ${pad(`${s.rank}/${s.n}`, 10)} ${pad(s.eventPercentile + '%', 7)} ${pad(s.top3Within1 ? 'O' : '·', 6)} ${pad(s.top3Within3 ? 'O' : '·', 6)} ${pad(s.top3Within6 ? 'O' : '·', 7)} ${pad(s.bestPercentileWithin3 + '%', 9)} ${s.peakErrorMonths}달`);
  } else {
    console.log(`${pad(row.person, 5)} ${pad(DOMAIN_LABEL[row.domain], 6)} ${pad(row.year, 9)} ${pad('연', 6)}  ${pad(`${s.rank}/${s.n}`, 10)} ${pad(s.eventPercentile + '%', 7)} (연 단위 — 월 지표 해당 없음)`);
  }
}
console.log('');

// ── 앙상블 ──
const M = scored.filter((r) => r.precision === 'month');
const Y = scored.filter((r) => r.precision === 'year');
console.log('## 앙상블');
console.log('');
console.log(`  채점된 사건  월 ${M.length}건 · 연 ${Y.length}건 · 채점 불가 ${rows.length - scored.length}건`);
console.log('');
const ew = avg(M.map((r) => r.score.eventPercentile));
const pw = personWeighted(M, (r) => r.score.eventPercentile);
const boot = personBootstrap(M, (r) => r.score.eventPercentile);
console.log(`  event-weighted  백분위 ${ew}%   (${M.length}건)`);
console.log(`  person-weighted 백분위 ${pw?.mean}%   (${pw?.people}명)`);
if (boot) console.log(`  person bootstrap 95% ${boot.lo}~${boot.hi}%${boot.note ? `  — ${boot.note}` : ''}`);
console.log('');

// ── 순열 기준선 — **합산 통계 자체의 null 분포** ──
//
// 사건 하나짜리 구간(2~98%)을 평균해서 합산값 옆에 놓으면 무엇을 재도 구간 안에
// 들어온다. 열 건의 평균은 그만큼 흔들리지 않기 때문이다. 그래서 회차마다 모든
// 사건을 각자 자기 시계열 안에서 옮기고 **그 회차의 합산값**을 모은다.
const agg = aggregateNull(
  M.map((r) => ({ person: r.person, series: seriesOf(r.result, r.domain) })),
  { rounds: 10000, seed: 20260924 },
);
if (agg) {
  const obs = {
    eventPercentile: ew,
    top3Within1: pctOf(M.map((r) => r.score.top3Within1)),
    top3Within3: pctOf(M.map((r) => r.score.top3Within3)),
    top3Within6: pctOf(M.map((r) => r.score.top3Within6)),
    bestPercentileWithin1: avg(M.map((r) => r.score.bestPercentileWithin1)),
    bestPercentileWithin3: avg(M.map((r) => r.score.bestPercentileWithin3)),
    bestPercentileWithin6: avg(M.map((r) => r.score.bestPercentileWithin6)),
  };
  console.log('## 기준선 — 사건월을 각자 자기 시계열 안에서 무작위로 옮기면');
  console.log(`  합산값 자체의 null 분포. ${agg.rounds.toLocaleString()}회 · seed ${agg.seed} · 사건 ${agg.events}건 · 사람 ${agg.people}명`);
  console.log('  **개별 사건의 null 구간을 평균한 값이 아니다** — 합산 통계의 분포다.');
  // 실제 사건이 가장자리에 붙어 있으면 null 만 제한하는 것이 불공평해진다
  const tight = M.map((r) => ({ person: r.person, key: r.key, margin: marginOf(r.result, r.key) }))
    .filter((x) => x.margin != null && x.margin < 6);
  console.log(`  창 지표의 null 후보는 **실제 사건과 같은 조건**(앞뒤 ±N달 확보 · 창이 다 찬 달)으로 제한한다.`);
  console.log(tight.length
    ? `  ※ 실제 사건 중 가장자리 ±6달 안에 있는 것: ${tight.map((x) => `${x.person} ${x.key}(${x.margin})`).join(', ')}`
    : '  ※ 실제 사건은 모두 앞뒤 6달 이상 여유가 있다 — 같은 조건으로 비교된다.');
  console.log('');
  console.log('  지표                      관측    null평균  null 95% 구간   null 안 위치   후보달');
  const line = (label, key, kind) => {
    const m = agg.metrics[key]?.[kind];
    if (!m) return;
    const o = obs[key];
    const pos = nullPosition(o, m);
    const p = agg.metrics[key].pool;
    console.log(`  ${pad(label, 24)} ${pad(o != null ? o + '%' : '—', 7)} ${pad(m.mean + '%', 9)} ${pad(`${m.lo}~${m.hi}%`, 15)} ${pad(pos != null ? `상위 ${(100 - pos).toFixed(1)}%` : '—', 14)} ${p.candidates}/${p.total}`);
  };
  line('EventPercentile(사건)', 'eventPercentile', 'event');
  // 사람 가중 관측값은 personWeighted, null 도 같은 방식으로 뽑은 분포와 맞댄다
  const pwm = agg.metrics.eventPercentile?.person;
  if (pwm && pw) {
    const pos = nullPosition(pw.mean, pwm);
    console.log(`  ${pad('EventPercentile(사람)', 24)} ${pad(pw.mean + '%', 7)} ${pad(pwm.mean + '%', 9)} ${pad(`${pwm.lo}~${pwm.hi}%`, 15)} ${pos != null ? `상위 ${(100 - pos).toFixed(1)}%` : '—'}`);
  }
  for (const t of [1, 3, 6]) line(`BestPercentileWithin±${t}`, `bestPercentileWithin${t}`, 'event');
  for (const t of [1, 3, 6]) line(`Top3Within±${t}`, `top3Within${t}`, 'event');
  console.log('');
  console.log(`  ※ "null 안 위치"는 경험적 백분위다. 사건이 ${M.length}건뿐이라 p 값으로 적지 않는다.`);
  console.log('  ※ 구간 안에 들어온다는 것은 **우연과 구별되지 않는다**는 뜻이다.');
}
console.log('');

// ── 보조 진단: 남의 사건 ──
const cross = [];
for (const a of M) for (const b of M) {
  if (a.person === b.person || a.domain !== b.domain) continue;
  const s = scoreEvent(seriesOf(a.result, a.domain), b.key);
  if (!s.unscorable) cross.push(s.eventPercentile);
}
if (cross.length) console.log(`## 보조 진단 — 남의 사건 날짜로 채점: ${avg(cross)}%  (주 기준선 아님)`);
console.log('');

// ── 월 지표 ──
console.log('## 월 단위 지표 (이름과 계산이 일치)');
console.log(`  ExactMonth              ${pctOf(M.map((r) => r.score.exactMonth))}%`);
console.log(`  Top1 / Top3 / Top5      ${pctOf(M.map((r) => r.score.top1))}% / ${pctOf(M.map((r) => r.score.top3))}% / ${pctOf(M.map((r) => r.score.top5))}%`);
console.log(`  Top3Within±1/±3/±6      ${pctOf(M.map((r) => r.score.top3Within1))}% / ${pctOf(M.map((r) => r.score.top3Within3))}% / ${pctOf(M.map((r) => r.score.top3Within6))}%`);
console.log(`  BestPercentileWithin±1  ${avg(M.map((r) => r.score.bestPercentileWithin1))}%`);
console.log(`  BestPercentileWithin±3  ${avg(M.map((r) => r.score.bestPercentileWithin3))}%`);
console.log(`  BestPercentileWithin±6  ${avg(M.map((r) => r.score.bestPercentileWithin6))}%`);
console.log(`  PeakErrorMonths (평균)   ${avg(M.map((r) => r.score.peakErrorMonths))}달`);
console.log(`  Top3 동점으로 늘어난 달   평균 ${avg(M.map((r) => r.score.top3Count))}개`);
console.log('');

// ── 체계별 ──
console.log('## 체계별 — native resolution 을 **사람마다 따로** 본다');
console.log('');
console.log('한 체계의 눈금은 사람마다 다를 수 있다. 태을신수는 한 궁에 세 해를 머물고,');
console.log('그 궁이 바뀌는 자리가 사람마다 다르니 어떤 사람의 구간에서는 달이 갈리고');
console.log('어떤 사람의 구간에서는 갈리지 않는다. 첫 사람 눈금을 전체에 씌우면');
console.log('나머지를 남의 자로 재게 된다. **행마다 그 사람의 눈금으로 잰다.**');
console.log('');
for (const [d, list] of Object.entries(byDom)) {
  const lm = list.filter((r) => r.precision === 'month');
  console.log(`### ${DOMAIN_LABEL[d]} (사건 ${list.length}건 · 월 ${lm.length}건)`);
  console.log('   체계        눈금(월/연/없음)  월채점  연채점  구분못함  무자료  백분위   Top3±3');
  for (const id of SYSTEM_IDS) {
    const res = { month: 0, year: 0, none: 0 };
    let monthOk = 0, yearOk = 0, flat = 0, na = 0;
    const ps = [];
    const win = [];
    for (const row of list) {
      // 이 사람의 이 계산에서 이 체계가 무엇을 가를 수 있는가
      const r = resolutionOf(row.result, id);
      res[r] = (res[r] ?? 0) + 1;
      const out = scoreAtResolution(seriesOf(row.result, row.domain, id), {
        resolution: r, precision: row.precision, year: row.year, key: row.key,
      });
      if (out.skipped === 'no_resolution') continue;    // 눈금이 없으면 평가에서 뺀다
      if (out.skipped === 'no_variation') { flat++; continue; }
      if (out.skipped) { na++; continue; }
      ps.push(out.score.eventPercentile);
      if (out.scale === 'year') yearOk++;
      else { monthOk++; win.push(out.score.top3Within3); }
    }
    if (res.none === list.length) {
      console.log(`   ${pad(SYSTEM_NAME[id], 10)} ${pad(`0/0/${res.none}`, 17)} — 시기 해상도가 없어 평가 제외`);
      continue;
    }
    const monthMetric = win.length ? `${pctOf(win)}%` : 'N/A (월 채점 없음)';
    console.log(`   ${pad(SYSTEM_NAME[id], 10)} ${pad(`${res.month}/${res.year}/${res.none}`, 17)} ${pad(monthOk, 7)} ${pad(yearOk, 7)} ${pad(flat, 9)} ${pad(na, 7)} ${pad(avg(ps) != null ? avg(ps) + '%' : '—', 8)} ${monthMetric}`);
  }
  console.log('');
}

console.log('## 읽는 법');
console.log('  · development-set 결과다. blind 가 아니다.');
console.log('  · 백분위가 50 을 조금 넘는다고 예측력이 입증된 것이 아니다.');
console.log('  · n 이 1~5 인 체계 결과로 어느 체계가 낫다고 고르지 않는다 — observed only.');
console.log('  · "구분못함"은 성능이 낮은 것이 아니라 그 기간을 가르지 못한 것이다.');
console.log('  · 확률로 보정된 값이 아니다.');
