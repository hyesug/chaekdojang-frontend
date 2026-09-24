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
 */
import { readFileSync, existsSync } from 'node:fs';
import { predictTimeline } from '../public/unse-8f3k2m/src/semantic/timing/timeline.js';
import { DOMAIN_LABEL } from '../public/unse-8f3k2m/src/semantic/timing/schema.js';
import { SYSTEM_NAME, SYSTEM_IDS } from '../public/unse-8f3k2m/src/semantic/extract.js';
import {
  scoreEvent, scoreEventYearly, permutationBaseline, permutationP,
  personWeighted, personBootstrap,
} from '../public/unse-8f3k2m/src/validation/timingMetrics.js';

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
}));

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

// ── 순열 기준선 ──
const nulls = [];
for (const r of M) {
  const b = permutationBaseline(seriesOf(r.result, r.domain), 10000);
  if (b && !b.unscorable) nulls.push(b);
}
if (nulls.length) {
  const nm = avg(nulls.map((b) => b.mean));
  const nlo = avg(nulls.map((b) => b.lo));
  const nhi = avg(nulls.map((b) => b.hi));
  console.log('## 기준선 — 같은 사람의 같은 시계열 안에서 사건월을 무작위로 뽑으면');
  console.log(`  null 평균 ${nm}%  ·  95% 구간 ${nlo}~${nhi}%  (10,000회 · seed 고정)`);
  const p = permutationP(ew, nulls.flatMap((b) => [b.mean]));
  console.log(`  관측 ${ew}% 가 null 평균보다 ${ew > nm ? '높음' : '낮음'}`);
  console.log(`  ※ 사건이 ${M.length}건뿐이라 이 차이를 "검증됐다"로 읽지 않는다. p 값도 적지 않는다.`);
  void p;
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
console.log('## 체계별 — native resolution 에 맞춰 잰다');
console.log('');
for (const [d, list] of Object.entries(byDom)) {
  const lm = list.filter((r) => r.precision === 'month');
  console.log(`### ${DOMAIN_LABEL[d]} (사건 ${list.length}건 · 월 ${lm.length}건)`);
  console.log('   체계        눈금    채점  구분못함  없음  백분위   월지표');
  for (const id of SYSTEM_IDS) {
    const res = resolutionOf(list[0].result, id);
    let ok = 0, flat = 0, na = 0;
    const ps = [];
    for (const row of list) {
      const series = seriesOf(row.result, row.domain, id);
      if (!series.some((e) => Number.isFinite(e.v))) { na++; continue; }
      // 해 단위 체계는 해로 접어서 잰다 — 달 눈금으로 부풀리지 않는다
      const useYear = res === 'year' || row.precision === 'year';
      const s = useYear ? scoreEventYearly(series, row.year)
        : scoreEvent(series, row.key);
      if (s.unscorable === 'no_variation') { flat++; continue; }
      if (s.unscorable) { na++; continue; }
      ok++; ps.push(s.eventPercentile);
    }
    if (res === 'none') {
      console.log(`   ${pad(SYSTEM_NAME[id], 10)} ${pad('none', 6)}  — 시기 해상도가 없어 평가 제외`);
      continue;
    }
    const monthMetric = res === 'month' ? `${pctOf(list.filter((r) => r.precision === 'month').map((row) => {
      const s = scoreEvent(seriesOf(row.result, row.domain, id), row.key);
      return s.unscorable ? null : s.top3Within3;
    }).filter((x) => x != null)) ?? '—'}%` : 'N/A (연 단위)';
    console.log(`   ${pad(SYSTEM_NAME[id], 10)} ${pad(res, 6)} ${pad(ok, 5)} ${pad(flat, 9)} ${pad(na, 5)} ${pad(avg(ps) != null ? avg(ps) + '%' : '—', 8)} ${monthMetric}`);
  }
  console.log('');
}

console.log('## 읽는 법');
console.log('  · development-set 결과다. blind 가 아니다.');
console.log('  · 백분위가 50 을 조금 넘는다고 예측력이 입증된 것이 아니다.');
console.log('  · n 이 1~5 인 체계 결과로 어느 체계가 낫다고 고르지 않는다 — observed only.');
console.log('  · "구분못함"은 성능이 낮은 것이 아니라 그 기간을 가르지 못한 것이다.');
console.log('  · 확률로 보정된 값이 아니다.');
