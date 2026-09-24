/**
 * validate-scenario.mjs — **시나리오 층을 조각마다 따로 잰다**
 *
 *   node scripts/validate-scenario.mjs
 *
 * `validate-timing.mjs` 는 "그 달이 몇 번째인가" 하나만 잰다. 그런데 이
 * 파이프라인은 시기 말고도 사건 종류·국면·방향·상세·순서를 말한다. 맞은
 * 것과 틀린 것이 한 숫자에 뭉쳐 있으면 어디가 되고 어디가 안 되는지 알 수 없다.
 *
 * ── 잴 수 있는 것만 잰다 ───────────────────────────────────
 * 정답표(`validation/cases.json`)에는 `{domain, year, month, what}` 뿐이다.
 * 사건 종류·방향·지역 라벨이 없으므로 그 지표들은 **잴 수 없다**. 없는 것을
 * `what` 문장에서 추측해 채우면 그건 채점이 아니라 답 베끼기다. 무엇이
 * 없어서 못 재는지 아래에 그대로 적는다.
 *
 * ── 기준선 없는 적중률은 뜻이 없다 ─────────────────────────
 * "국면 안에 들어왔다"는 국면이 넓으면 저절로 맞는다. 지표마다 **아무렇게나
 * 찍었을 때의 값**을 함께 낸다.
 *
 * ── blind 가 아니다 ────────────────────────────────────────
 * P01~P12 는 규칙을 만드는 동안 여러 번 본 자료다. 여기 숫자는
 * development-set 값이고 새 사례로 옮겨 간다는 보장이 없다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { prepareScenario } from '../public/unse-8f3k2m/src/semantic/scenario/index.js';
import { composePrepared } from '../public/unse-8f3k2m/src/semantic/scenario/composer.js';
import { DOMAIN_LABEL } from '../public/unse-8f3k2m/src/semantic/domains.js';
import { EVENT_CANDIDATES } from '../public/unse-8f3k2m/src/semantic/timing/events.js';
import { personWeighted } from '../public/unse-8f3k2m/src/validation/timingMetrics.js';

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

const mn = (k) => { const [y, m] = String(k).split('-').map(Number); return y * 12 + (m - 1); };
const key = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
const pct = (xs) => (xs.length ? Math.round((xs.filter(Boolean).length / xs.length) * 1000) / 10 : null);
const avg = (xs) => { const v = xs.filter((x) => x != null); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
const pad = (s, n) => String(s ?? '').padEnd(n);

// ── 사건을 모은다 ──
const rows = [];
for (const c of cases) {
  for (const e of c.events ?? []) {
    const domain = DOMAIN_OF[e.domain];
    if (!domain || !e.year) continue;
    rows.push({
      person: c.id, birth: c.birth, domain, what: e.what,
      year: e.year, month: e.month ?? null,
      key: e.month != null ? key(e.year, e.month) : null,
      /** 라벨이 있으면 쓰고 없으면 못 잰다 — 문장에서 추측하지 않는다 */
      eventType: e.eventType ?? null,
      direction: e.direction ?? null,
      location: e.location ?? null,
      currentState: c.currentState ?? c.state ?? null,
    });
  }
}
if (!rows.length) { console.error('채점할 사건이 없습니다.'); process.exit(1); }

console.log('# 시나리오 층 검증 (development-set)');
console.log('');
console.log('P01~P12 는 규칙을 만드는 동안 여러 번 본 자료입니다. **blind validation 이 아닙니다.**');
console.log('');

// ── 사람마다 한 번만 계산하고 사건을 그 위에 얹는다 ──
const scored = [];
const failures = [];
for (const r of rows) {
  const from = `${r.year - 3}-01`;
  const to = `${r.year + 3}-12`;
  let prepared = null; let scenario = null;
  try {
    prepared = prepareScenario({
      birth: r.birth, domain: r.domain, from, to,
      // 사건을 넘기지 않는다 — 넘기면 눈을 가린 것이 아니다
      currentState: r.currentState,
    });
    scenario = composePrepared(prepared);
  } catch (err) { failures.push({ ...r, why: err.message }); continue; }

  const months = Object.keys(prepared.result?.timeline ?? {});
  const all = prepared.timingPhases ?? [];
  const total = (mn(to) - mn(from)) + 1;
  const evMonth = r.key ? mn(r.key) : null;

  // ── 시기 ──
  const win = scenario.primary?.timing ?? null;
  const inWindow = win && evMonth != null
    && mn(win.from) <= evMonth && evMonth <= mn(win.to);
  const winMonths = win ? (mn(win.to) - mn(win.from)) + 1 : 0;
  // 경계에서 몇 달 빗나갔나 — 0 이면 안에 든 것이다
  const missBy = win && evMonth != null
    ? Math.max(0, mn(win.from) - evMonth, evMonth - mn(win.to)) : null;
  const near3 = missBy != null ? missBy <= 3 : null;

  // ── 국면 — 어느 토막에 떨어졌나 ──
  let phaseRole = null; let inAnyPhase = false;
  let coveredMonths = 0;
  for (const p of all) {
    coveredMonths += (mn(p.end) - mn(p.start)) + 1;
    if (evMonth == null) continue;
    if (mn(p.start) <= evMonth && evMonth <= mn(p.end)) {
      inAnyPhase = true;
      for (const [role, seg] of [['buildup', p.buildup], ['peak', p.peak], ['resolution', p.resolution]]) {
        if (seg && mn(seg.from) <= evMonth && evMonth <= mn(seg.to)) phaseRole = role;
      }
    }
  }

  // ── 사건 종류 — **라벨이 있을 때만** ──
  const cands = (EVENT_CANDIDATES[r.domain] ?? []).map((c) => c.key);
  const said = scenario.primary?.event?.type ?? null;
  const eventTypeHit = r.eventType ? said === r.eventType : null;
  const inTop = r.eventType
    ? (scenario.primary?.candidatesInPhase ?? []).some((x) => x.type === r.eventType) : null;

  scored.push({
    ...r, scenario, prepared,
    total, months: months.length,
    inWindow: win && evMonth != null ? inWindow : null,
    missBy, near3,
    windowShare: win ? winMonths / total : null,
    // ±3달까지 늘린 창이 전체에서 차지하는 몫 (near3 의 기준선)
    nearShare: win ? Math.min(1, (winMonths + 6) / total) : null,
    winFrom: win?.from ?? null, winTo: win?.to ?? null,
    inAnyPhase: evMonth != null ? inAnyPhase : null,
    phaseCoverage: coveredMonths / total,
    phaseRole,
    phaseCount: all.length,
    eventTypeHit, inTop, said,
    candidateCount: cands.length,
    allowedLevel: scenario.meta?.allowedLevel ?? 0,
    grain: scenario.primary?.timing?.grain ?? null,
    coherenceOk: scenario.coherence?.ok ?? null,
    answersQuestion: scenario.questionAnswer?.answersQuestion ?? null,
    chainCount: scenario.chains?.chains?.length ?? 0,
    chainDropped: scenario.chains?.dropped?.length ?? 0,
  });
}

// ═════════════════════════════════════════════════════════════
console.log('## 데이터');
console.log(`  사람 ${new Set(rows.map((r) => r.person)).size}명 · 사건 ${rows.length}건 · 계산 실패 ${failures.length}건`);
const withMonth = scored.filter((r) => r.key);
console.log(`  월 precision ${withMonth.length}건 · 연 precision ${scored.length - withMonth.length}건`);
console.log('');

// ── 라벨이 있어야 잴 수 있는 것 ──
const missing = [
  ['eventType', '사건 종류 적중', scored.filter((r) => r.eventType).length],
  ['direction', '방향 적중', scored.filter((r) => r.direction).length],
  ['location', '지역 단계 적중', scored.filter((r) => r.location).length],
  ['currentState', '상태 기계 적용', scored.filter((r) => r.currentState).length],
];
console.log('## 라벨이 없어 못 재는 것');
console.log('');
for (const [k, label, n] of missing) {
  console.log(`  ${pad(label, 16)} ${pad(k, 14)} 라벨 있는 사건 ${n}/${scored.length}` +
    (n ? '' : '  ← 잴 수 없음'));
}
console.log('');
console.log('  `what` 문장을 읽어 사건 종류를 짐작해 채우지 않습니다. 그건 채점이 아니라');
console.log('  답을 베끼는 일입니다. 라벨을 넣으려면 cases.json 의 각 사건에');
console.log('  `eventType`(events.js 의 key) · `direction` · `location` 을 적으면 됩니다.');
console.log('');

// ── ① 시기 ──
console.log('## ① 시기 — 실제 사건이 주 구간 안에 들어왔나');
console.log('');
const tw = withMonth.filter((r) => r.inWindow != null);
const twHit = pct(tw.map((r) => r.inWindow));
const twNull = avg(tw.map((r) => r.windowShare * 100));
console.log(`  주 구간 적중     ${twHit}%   (${tw.length}건)`);
console.log(`  아무 데나 찍으면 ${twNull}%   ← 주 구간이 전체 기간에서 차지하는 몫`);
console.log(`  ${twHit > twNull ? '기준선보다 높다' : '**기준선보다 낮다**'} — 차이 ${Math.round((twHit - twNull) * 10) / 10}%p`);
console.log('');
const n3 = pct(tw.map((r) => r.near3));
const n3Null = avg(tw.map((r) => r.nearShare * 100));
console.log(`  ±3달까지 늘리면  ${n3}%   (기준선 ${n3Null}%)`);
console.log(`  빗나간 달 (평균)  ${avg(tw.map((r) => r.missBy))}달 · 가장 가까운 것 ${Math.min(...tw.map((r) => r.missBy))}달`);
console.log('');
console.log('  사람  분야    실제      주 구간              빗나감');
for (const r of tw) {
  console.log(`  ${pad(r.person, 5)} ${pad(DOMAIN_LABEL[r.domain], 6)} ${pad(r.key, 9)} ` +
    `${pad(`${r.winFrom}~${r.winTo}`, 20)} ${r.missBy === 0 ? '안에 듦' : `${r.missBy}달`}`);
}
console.log('');

// ── ② 국면 ──
console.log('## ② 국면 — 준비·고비·정리 중 어디에 떨어졌나');
console.log('');
const ph = withMonth.filter((r) => r.inAnyPhase != null);
const phHit = pct(ph.map((r) => r.inAnyPhase));
const phNull = avg(ph.map((r) => r.phaseCoverage * 100));
console.log(`  국면 안 적중     ${phHit}%   (${ph.length}건)`);
console.log(`  아무 데나 찍으면 ${phNull}%   ← 국면이 전체 기간에서 차지하는 몫`);
const roles = { buildup: 0, peak: 0, resolution: 0, none: 0 };
for (const r of ph) roles[r.phaseRole ?? 'none'] += 1;
console.log(`  떨어진 자리      준비 ${roles.buildup} · 고비 ${roles.peak} · 정리 ${roles.resolution} · 국면 밖 ${roles.none}`);
console.log(`  ※ '고비'에 몰려야 뜻이 있습니다. 준비·정리에 고르게 퍼지면 국면을 가른 뜻이 없습니다.`);
console.log('');

// ── ③ 사건 종류 ──
console.log('## ③ 사건 종류');
console.log('');
const et = scored.filter((r) => r.eventTypeHit != null);
if (!et.length) {
  console.log('  **잴 수 없습니다.** 정답 사건 종류가 라벨로 없습니다.');
  console.log(`  참고로 엔진이 고른 것: ${scored.map((r) => r.said ?? '—').join(', ')}`);
  console.log(`  분야별 후보 수: ${[...new Set(scored.map((r) => r.domain))]
    .map((d) => `${DOMAIN_LABEL[d]} ${(EVENT_CANDIDATES[d] ?? []).length}`).join(' · ')}`);
} else {
  console.log(`  1위 적중        ${pct(et.map((r) => r.eventTypeHit))}%   (${et.length}건)`);
  console.log(`  후보 안에 있음   ${pct(et.map((r) => r.inTop))}%`);
  console.log(`  아무거나 찍으면 ${avg(et.map((r) => 100 / r.candidateCount))}%`);
}
console.log('');

// ── ④ 구체성 ──
console.log('## ④ 어디까지 내려갔나 (게이트가 실제로 연 단계)');
console.log('');
const lv = {};
for (const r of scored) lv[r.allowedLevel] = (lv[r.allowedLevel] ?? 0) + 1;
console.log(`  허용 단계  ${Object.entries(lv).sort().map(([k, v]) => `${k}단계 ${v}건`).join(' · ')}`);
const gr = {};
for (const r of scored) gr[r.grain ?? 'none'] = (gr[r.grain ?? 'none'] ?? 0) + 1;
console.log(`  시기 눈금  ${Object.entries(gr).map(([k, v]) => `${k} ${v}건`).join(' · ')}`);
console.log(`  ※ 단계가 낮다고 나쁜 것이 아닙니다. 근거가 거기까지라는 뜻입니다.`);
console.log('');

// ── ⑤ 내부 일관성 ──
console.log('## ⑤ 내부 일관성 (정답이 없어도 잴 수 있는 것)');
console.log('');
console.log(`  coherence 통과   ${pct(scored.map((r) => r.coherenceOk))}%   (${scored.length}건)`);
console.log(`  사슬이 남은 건   ${pct(scored.map((r) => r.chainCount > 0))}%`);
console.log(`  순서가 안 맞아 버린 사슬  평균 ${avg(scored.map((r) => r.chainDropped))}개`);
console.log(`  물은 것과 답이 다름  ${pct(scored.map((r) => r.answersQuestion === false))}%`);
console.log('');

// ── ⑥ 사람 단위 ──
const pw = personWeighted(tw, (r) => (r.inWindow ? 100 : 0));
if (pw) {
  console.log('## ⑥ 사람 단위 (한 사람이 사건을 여럿 내도 한 몫)');
  console.log('');
  console.log(`  주 구간 적중  ${pw.mean}%   (${pw.people}명)`);
  console.log(`  사람별: ${pw.perPerson.map((p) => `${p.person} ${Math.round(p.mean)}%(${p.n}건)`).join(' · ')}`);
  console.log('');
}

console.log('## 읽는 법');
console.log('  · development-set 결과입니다. blind 가 아닙니다.');
console.log('  · 기준선을 넘지 못한 지표는 "아직 신호가 없다"로 읽습니다.');
console.log('  · 사건이 열 건 남짓이라 어떤 차이도 "검증됐다"로 읽지 않습니다.');
console.log('  · 라벨이 없어 못 잰 지표를 "통과"로 세지 마세요.');
if (failures.length) {
  console.log('');
  console.log(`## 계산 실패 ${failures.length}건`);
  for (const f of failures) console.log(`  ${f.person} ${f.domain} ${f.year} — ${f.why}`);
}
