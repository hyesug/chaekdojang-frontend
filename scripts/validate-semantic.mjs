/**
 * validate-semantic.mjs — 의미축 엔진을 **사람 단위 LOO** 로 잰다
 *
 *   node scripts/validate-semantic.mjs
 *   node scripts/validate-semantic.mjs validation/people.example.json   (지어낸 자료)
 *
 * ── 읽는 법 ────────────────────────────────────────────────
 * 숫자 하나만 보지 않는다. 보는 순서는 이렇다.
 *
 *   1. `한계분포` 를 넘었는가  — 못 넘으면 명반이 기여한 것이 없다
 *   2. `남의 명반` 과 다른가   — 같으면 그 사람의 명반일 필요가 없었다
 *   3. 순열검정 p             — 라벨을 섞어도 이만큼 나오는가
 *   4. 합친 것 vs 최고 단독    — 합치는 게 정말 나은가
 *
 * 1~3 을 못 넘으면 **표를 고쳐서 넘기려 들지 말 것.** 그것이 0/11 을
 * 만드는 길이다 (`scripts/validate-attribution.mjs` 주석 참조).
 */
import { readFileSync, existsSync } from 'node:fs';
import { readFortune } from '../public/unse-8f3k2m/src/engine.js';
import * as ZW from '../public/unse-8f3k2m/src/hires/ziwei.js';
import { precompute, leaveOnePersonOut } from '../public/unse-8f3k2m/src/validation/loo.js';
import { assertNoPersonalFields } from '../public/unse-8f3k2m/src/validation/labels.js';
import { SYSTEM_NAME } from '../public/unse-8f3k2m/src/semantic/extract.js';

const file = process.argv[2] ?? 'validation/people.json';
if (!existsSync(file)) {
  console.error(`${file} 이 없습니다.`);
  console.error('실제 자료는 개인정보라 저장소에 없습니다. `node validation/build-people.mjs` 로 만들거나,');
  console.error('구조만 보려면 `node scripts/validate-semantic.mjs validation/people.example.json` 을 치세요.');
  process.exit(1);
}
const people = JSON.parse(readFileSync(file, 'utf8'));
for (const p of people) assertNoPersonalFields(p);

/** 눈을 가린다 — 정답표는 엔진에 들어가지 않는다 */
const run = (birth) => {
  const fortune = readFortune({ ...birth, name: 'x' }, { now: new Date('2026-09-21T12:00:00+09:00') });
  const stack = fortune.input.timeKnown
    ? (() => { try { return ZW.stackAt(fortune.input, fortune.input.currentYear, null); } catch { return null; } })()
    : null;
  return { fortune, stack };
};

const TARGETS = [
  ['career', 'industry'],
  ['career', 'employmentForm'],
  ['children', 'count'],
  ['relationship', 'unionTiming'],
  ['education', 'path'],
  ['residence', 'mode'],
  ['wealth', 'shape'],
];

const rows = precompute(people, run);
const report = leaveOnePersonOut(rows, TARGETS, { shuffleRounds: 2000 });

const pad = (s, n) => String(s ?? '—').padEnd(n);
const num = (v, n = 6) => String(v ?? '—').padStart(n);

console.log(`# 의미축 엔진 — 사람 단위 LOO (${people.length}명 · ${file})`);
console.log('');

for (const [key, r] of Object.entries(report)) {
  if (!r.scorable) {
    console.log(`## ${key} — 채점 가능한 사람이 없습니다`);
    console.log('');
    continue;
  }
  console.log(`## ${key}  (범주 ${r.categories}개 · 채점 ${r.scorable}명)`);
  console.log('');
  console.log('                로그손실  브라이어   top1   top3    MRR   순위백분위');
  const line = (label, s) => console.log(
    `  ${pad(label, 12)} ${num(s.logLoss)} ${num(s.brier)} ${num(s.top1)} ${num(s.top3)} ${num(s.mrr)} ${num(s.rankPercentile)}`);
  line('합침', r.pooled);
  line('고르게', r.baselines.uniform);
  line('한계분포', r.baselines.marginal);
  line('남의 명반', r.baselines.shuffledChart);
  console.log('');

  const best = Object.entries(r.bySystem)
    .filter(([, s]) => s.n)
    .sort((a, b) => (a[1].logLoss ?? 9) - (b[1].logLoss ?? 9));
  console.log('  체계 단독 (로그손실 낮은 순)');
  for (const [id, s] of best.slice(0, 5)) {
    console.log(`    ${pad(SYSTEM_NAME[id], 10)} 로그 ${num(s.logLoss)} · top1 ${num(s.top1)} · 순위 ${num(s.rankPercentile)} (n=${s.n})`);
  }
  console.log('');
  console.log(`  순열검정 p = ${r.permutationP}  (라벨을 섞어도 이만큼 나오는 비율)`);
  console.log(`  [대조] '열다섯 중 하나라도 1위' = ${r.contrastAtLeastOneTop1} ← 이 숫자는 예측력이 아니다`);
  if (r.attributes) {
    console.log(`  속성(multi-label) precision ${r.attributes.precision} · recall ${r.attributes.recall}`
      + ` · F1 ${r.attributes.f1} · 브라이어 ${r.attributes.brier}`);
  }
  console.log('');
  console.log('  사람별');
  for (const p of r.perPerson) {
    console.log(`    ${pad(p.id, 5)} 정답 ${pad(p.truth, 22)} 순위 ${num(p.rank, 4)}/${p.n}  p=${p.p}`);
    console.log(`           예측: ${p.predicted.join(' · ')}`);
  }
  console.log('');
}

// ── 판정 ──
const career = report['career.industry'];
if (career?.scorable) {
  const beatsMarginal = career.pooled.logLoss < career.baselines.marginal.logLoss;
  const beatsShuffle = career.pooled.logLoss < career.baselines.shuffledChart.logLoss;
  console.log('## 판정 (직업 업종)');
  console.log(`  한계분포를 넘었나 : ${beatsMarginal ? 'O' : 'X'}`);
  console.log(`  남의 명반과 다른가 : ${beatsShuffle ? 'O' : 'X'}`);
  console.log(`  순열검정 p        : ${career.permutationP}`);
  if (!beatsMarginal || !beatsShuffle || (career.permutationP ?? 1) > 0.05) {
    console.log('');
    console.log('  → 아직 신호가 있다고 말할 수 없습니다. **표를 고쳐 이 숫자를 넘기려 하지 마세요.**');
    console.log('     사람을 더 모으는 것 말고는 이 숫자를 정직하게 올릴 방법이 없습니다.');
  }
}
