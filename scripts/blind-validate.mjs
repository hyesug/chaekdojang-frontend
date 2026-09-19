/**
 * blind-validate.mjs — 실제로 있었던 일과 맞춰 본다
 *
 *   node scripts/blind-validate.mjs
 *
 * 왜 필요한가.
 *   지금까지 쌓은 것은 전부 "여러 체계가 같은 시기를 가리키는가"다.
 *   그것이 **실제로 맞는가**는 아직 아무도 확인하지 않았다. 확인하지 않으면
 *   Tier 문턱도 가중치도 그냥 내가 정한 숫자일 뿐이다.
 *
 * ── 이 하네스가 정직하려고 하는 것 ─────────────────────────
 *
 * 1) **눈을 가린다.** 예측을 만드는 동안 실제 사건을 읽지 않는다. 사건은
 *    채점할 때만 연다. 코드에서 단계를 갈라 놓았다.
 *
 * 2) **무작위 기준선을 함께 잰다.** 이게 핵심이다. "엔진이 2027년을 짚었고
 *    실제로 2027년에 이직했다"는 그 자체로는 아무 뜻이 없다. 다섯 해 예순
 *    달 가운데 하나를 찍어도 가끔 맞는다. 그래서 **남의 사건과 섞어** 같은
 *    방식으로 채점해 보고, 제대로 짝지었을 때가 더 나은지 본다.
 *    더 낫지 않으면 신호가 없는 것이다.
 *
 * 3) **사후 해석을 막는다.** 채점은 기계가 한다. "이렇게 보면 맞은 셈"
 *    같은 여지를 남기지 않는다. 사건이 엔진 순위의 몇 번째에 있었는지,
 *    그 숫자만 본다.
 *
 * ── 넣을 자료 ──────────────────────────────────────────────
 *   validation/cases.json 에 실제 사례를 적는다. 보기는
 *   validation/cases.example.json 에 있다. 이 파일은 개인정보라
 *   .gitignore 에 넣어 두었다 — 저장소에 올라가지 않는다.
 *
 *   사례는 많을수록 좋지만 **셋만 있어도 기준선 비교는 돌아간다.**
 *   다만 셋으로는 우연과 구별하기 어렵다. 여덟 이상이면 말이 되기 시작한다.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readFortune } from '../public/unse-8f3k2m/src/engine.js';
import { buildGrid } from '../public/unse-8f3k2m/src/hires/grid.js';
import { inferEvents } from '../public/unse-8f3k2m/src/hires/events.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'validation');
const CASES = join(DIR, 'cases.json');

// ─────────────────────────────────────────────────────────────
// 1단계 — 눈을 가리고 예측한다
// ─────────────────────────────────────────────────────────────

/**
 * 이 함수는 **출생 정보만 받는다.** 사건을 인자로 받지 않는 것이 요점이다.
 * 실수로라도 답을 보고 예측을 만들 수 없게 하려는 것이다.
 */
/** buildGrid 는 한 번에 여섯 해까지만 만든다 (브라우저에서 도는 계산이라) */
const CHUNK = 6;

function predict(birth, domains, fromYear, years) {
  const r = readFortune(birth, { now: new Date(`${fromYear}-06-01T00:00:00Z`) });
  const out = {};

  for (const d of domains) {
    // 검증은 열 해 스무 해를 보는 일이 흔하다. 여섯 해씩 끊어 돌리고 잇는다.
    //
    // 이어 붙여도 되는 이유: scoreMonth 의 total 은 가중치를 그냥 더한 값이라
    // 구간 길이에 영향을 받지 않는다. 구간마다 다시 매기는 것은 등급(band)
    // 뿐인데, 채점은 등급이 아니라 순위를 쓰므로 상관이 없다.
    const rows = [];
    for (let y = fromYear; y <= fromYear + years - 1; y += CHUNK) {
      const span = Math.min(CHUNK, fromYear + years - y);
      const grid = buildGrid(r.input, r.chart, { fromYear: y, years: span, domain: d });
      rows.push(...inferEvents(grid, d).rows);
    }

    const ranked = rows.slice().sort((a, b) => b.total - a.total)
      .map((x, i) => ({ rank: i, year: x.year, month: x.from.m, y: x.from.y, total: x.total }));

    out[d] = {
      ranked,
      n: ranked.length,
      // 전체 기간에서 점수가 가장 높은 달
      best: ranked.length
        ? `${ranked[0].y}-${String(ranked[0].month).padStart(2, '0')}`
        : null,
    };
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// 2단계 — 채점
// ─────────────────────────────────────────────────────────────

/**
 * 사건 하나가 엔진 순위의 몇 번째였는가 → 백분위로.
 *
 * 0 이면 1등으로 짚었다는 뜻, 1 이면 꼴찌, **0.5 가 찍기와 같은 수준**이다.
 * 달을 모르는 사건은 그 해 열두 달 가운데 가장 좋은 순위를 준다 —
 * 엔진에게 유리한 쪽으로 봐 주는 것이다.
 */
function percentileOf(pred, ev) {
  const rows = pred.ranked;
  if (!rows.length) return null;
  const match = rows.filter((x) => x.y === ev.year && (ev.month == null || x.month === ev.month));
  if (!match.length) return null;                       // 예측 범위 밖의 사건
  const best = Math.min(...match.map((x) => x.rank));
  return best / (rows.length - 1);
}

/** 한 사람의 예측을 한 사람의 사건들로 채점한다 */
function score(pred, events) {
  const hits = [];
  for (const ev of events) {
    const p = pred[ev.domain];
    if (!p) continue;
    const pct = percentileOf(p, ev);
    if (pct == null) continue;
    hits.push({ ...ev, percentile: pct, top10: pct <= 0.1, top25: pct <= 0.25 });
  }
  if (!hits.length) return null;
  return {
    n: hits.length,
    mean: hits.reduce((t, h) => t + h.percentile, 0) / hits.length,
    top10: hits.filter((h) => h.top10).length / hits.length,
    top25: hits.filter((h) => h.top25).length / hits.length,
    hits,
  };
}

// ─────────────────────────────────────────────────────────────
// 3단계 — 무작위 기준선 (순열 검정)
// ─────────────────────────────────────────────────────────────

/**
 * 남의 사건과 섞어서 같은 방식으로 채점한다.
 *
 * 제대로 짝지었을 때가 섞었을 때보다 **뚜렷하게** 낫지 않으면
 * 엔진이 그 사람을 읽은 것이 아니다. 이 비교가 이 하네스의 전부다.
 */
function permutationNull(preds, eventSets, rounds = 500) {
  const scores = [];
  let seed = 20260920;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  for (let r = 0; r < rounds; r++) {
    // 사건 묶음을 섞는다 (자기 것과 짝지어지는 경우는 건너뛴다)
    const order = preds.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const all = [];
    for (let i = 0; i < preds.length; i++) {
      if (order[i] === i) continue;
      const s = score(preds[i], eventSets[order[i]]);
      if (s) all.push(...s.hits.map((h) => h.percentile));
    }
    if (all.length) scores.push(all.reduce((a, b) => a + b, 0) / all.length);
  }
  scores.sort((a, b) => a - b);
  return {
    rounds: scores.length,
    mean: scores.reduce((a, b) => a + b, 0) / scores.length,
    p05: scores[Math.floor(scores.length * 0.05)],
    p50: scores[Math.floor(scores.length * 0.50)],
    scores,
  };
}

// ─────────────────────────────────────────────────────────────
// 실행
// ─────────────────────────────────────────────────────────────

if (!existsSync(CASES)) {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  console.error(
    `실제 사례가 없습니다. ${'validation/cases.json'} 을 만들어 주세요.\n\n` +
    `보기: validation/cases.example.json\n` +
    `이 파일은 .gitignore 에 있어 저장소에 올라가지 않습니다.\n\n` +
    `한 사람당 필요한 것:\n` +
    `  · 생년월일시와 출생지 (시각을 알수록 정확합니다)\n` +
    `  · 실제로 있었던 일과 그 연도(가능하면 월)\n` +
    `    이직 / 이사 / 결혼 / 큰 지출이나 목돈 / 퇴사 같은 것\n\n` +
    `셋만 있어도 돌아가지만, 우연과 구별하려면 여덟 이상이 좋습니다.`
  );
  process.exit(1);
}

const cases = JSON.parse(readFileSync(CASES, 'utf8'));
const domains = [...new Set(cases.flatMap((c) => c.events.map((e) => e.domain)))];
const years = cases.flatMap((c) => c.events.map((e) => e.year));
const fromYear = Math.min(...years);
const span = Math.max(...years) - fromYear + 1;

console.log(`사례 ${cases.length}명 · 사건 ${cases.reduce((t, c) => t + c.events.length, 0)}건 · ` +
            `분야 ${domains.join('·')} · 기간 ${fromYear}~${fromYear + span - 1} (${span}년 ${span * 12}달)\n`);

// ── 1단계: 눈을 가리고 예측 ──
console.log('1단계 — 출생 정보만 보고 예측합니다 (사건은 읽지 않습니다)');
const preds = [];
for (const c of cases) {
  process.stdout.write(`  ${c.id} …`);
  preds.push(predict(c.birth, domains, fromYear, span));
  console.log(' 완료');
}

// ── 2단계: 채점 ──
console.log('\n2단계 — 실제 사건과 맞춰 봅니다');
const eventSets = cases.map((c) => c.events);
const realHits = [];
for (let i = 0; i < cases.length; i++) {
  const s = score(preds[i], eventSets[i]);
  if (!s) { console.log(`  ${cases[i].id}: 채점할 사건이 없습니다 (예측 기간 밖)`); continue; }
  realHits.push(...s.hits.map((h) => h.percentile));
  console.log(`  ${cases[i].id}: 사건 ${s.n}건 · 평균 백분위 ${(s.mean * 100).toFixed(0)}% · ` +
              `상위 10% 안 ${(s.top10 * 100).toFixed(0)}%`);
  for (const h of s.hits) {
    console.log(`      ${h.year}${h.month ? '.' + h.month : ''} ${h.domain} "${h.what}" → 상위 ${(h.percentile * 100).toFixed(0)}%`);
  }
}

if (!realHits.length) { console.error('\n채점된 사건이 없습니다.'); process.exit(1); }
const realMean = realHits.reduce((a, b) => a + b, 0) / realHits.length;

// ── 3단계: 무작위 기준선 ──
console.log('\n3단계 — 남의 사건과 섞어 같은 방식으로 채점합니다 (무작위 기준선)');
const nul = permutationNull(preds, eventSets);
const better = nul.scores.filter((s) => s <= realMean).length;
const p = (better + 1) / (nul.scores.length + 1);

console.log(`  섞었을 때 평균 백분위: ${(nul.mean * 100).toFixed(1)}% (중앙값 ${(nul.p50 * 100).toFixed(1)}%)`);
console.log(`  제대로 짝지었을 때  : ${(realMean * 100).toFixed(1)}%`);
console.log(`  섞은 ${nul.rounds}번 가운데 제대로 짝지은 것보다 좋았던 경우: ${better}번 (p ≈ ${p.toFixed(3)})`);

console.log('\n── 읽는 법 ──');
console.log('  백분위 50% = 찍기와 같다. 낮을수록 엔진이 실제 사건이 일어난 달을 위로 올렸다는 뜻.');
if (p <= 0.05) {
  console.log(`  p ≈ ${p.toFixed(3)} — 우연으로 보기 어렵다. 다만 사례가 ${cases.length}명뿐이면 아직 단정하지 말 것.`);
} else if (p <= 0.2) {
  console.log(`  p ≈ ${p.toFixed(3)} — 방향은 있어 보이나 우연과 구별되지 않는다. 사례를 더 모을 것.`);
} else {
  console.log(`  p ≈ ${p.toFixed(3)} — **섞은 것과 구별되지 않는다.** 이 결과로는 엔진이 그 사람을 읽었다고 말할 수 없다.`);
}
console.log('  사건을 고를 때 기억이 흐릿한 것, 시기를 나중에 끼워 맞춘 것은 빼는 편이 낫다.');

writeFileSync(join(DIR, 'last-run.json'), JSON.stringify({
  at: new Date().toISOString(), cases: cases.length, events: realHits.length,
  realMean, nullMean: nul.mean, p,
}, null, 1));
