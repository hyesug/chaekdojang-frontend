/**
 * analyze-career.mjs — **어느 체계가 어느 속성을 잘 읽는가**
 *
 *   node scripts/analyze-career.mjs                 실제 사례 (개인정보, 커밋 안 됨)
 *   node scripts/analyze-career.mjs --loo           한 명 빼고 배우기까지
 *   node scripts/analyze-career.mjs <파일>          다른 사례집으로
 *
 * 네 가지를 낸다.
 *   1. 사람별 — 실제 속성 vs 체계마다 읽은 속성, 맞힌 축·틀린 축
 *   2. 체계별 — 잘 읽는 속성 / 약한 속성
 *   3. 속성별 — 그 속성을 가장 잘 읽는 체계 순위
 *   4. 판정   — 합친 것이 무엇을 이겼고 무엇에 졌는가
 *
 * **"사람이 적다"는 결론을 내는 스크립트가 아니다.** 열한 명에서 반복되는
 * 패턴을 찾아 해석 사전을 고치는 데 쓴다. 고친 뒤에는 반드시 `--loo` 로
 * 그 사람을 빼고도 나아졌는지 확인한다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { natalFortune } from '../public/unse/src/semantic/index.js';
import { interpretCareer } from '../public/unse/src/semantic/systems.js';
import { poolCareer } from '../public/unse/src/semantic/ensemble.js';
import { measure, weightsFrom, compareOne, unitize, cosineOf } from '../public/unse/src/semantic/calibration.js';
import { categorizeCareer } from '../public/unse/src/semantic/categories.js';
import { labelFor, centered, OCCUPATION_MEAN } from '../public/unse/src/semantic/tables/occupations.js';
import { SYSTEM_NAME, SYSTEM_IDS } from '../public/unse/src/semantic/extract.js';
import { AXES, AXIS_LABEL } from '../public/unse/src/semantic/axes.js';

const args = process.argv.slice(2);
const doLoo = args.includes('--loo');
const file = args.find((a) => !a.startsWith('--')) ?? 'validation/people.json';

if (!existsSync(file)) {
  console.error(`${file} 이 없습니다. \`node validation/build-people.mjs\` 로 만들거나`);
  console.error('구조만 보려면 validation/people.example.json 을 주세요.');
  process.exit(1);
}
const people = JSON.parse(readFileSync(file, 'utf8'));

// 원국은 **태어난 순간** 기준으로 세운다 — 육임·태을처럼 '지금'을
// 재료로 쓰는 체계가 섞여 있어, 안 그러면 같은 사람의 답이 해마다 바뀐다
const run = (birth) => natalFortune({ ...birth, name: 'x' });

// ── 한 번만 돌린다. 체계별 벡터는 보정과 무관하다 ──
const rows = [];
for (const p of people) {
  const occ = p.labels?.career?.occupationKey
    ? labelFor(p.labels.career.occupationKey) : null;
  const truth = occ?.features ?? p.labels?.career?.features ?? null;
  if (!truth || p.labels?.career?.status !== 'known') continue;
  const { fortune, stack } = run(p.birth);
  rows.push({
    id: p.id, job: p.labels.career.occupationKey ?? p.labels.career.category,
    category: p.labels.career.category,
    truth, systems: interpretCareer(fortune, stack),
  });
}
if (!rows.length) { console.error('채점 가능한 사람이 없습니다.'); process.exit(1); }

const pad = (s, n) => String(s ?? '—').padEnd(n);
const num = (v, n = 6) => (v == null ? '—' : String(v)).padStart(n);
const bar = (v) => '█'.repeat(Math.round((v ?? 0) * 10)) + '·'.repeat(10 - Math.round((v ?? 0) * 10));

// ═════════════════════════════════════════════════════════════
console.log(`# 직업 해석 — 체계 × 속성 (${rows.length}명 · ${file})`);
console.log('');

// ── 1. 사람별 ──────────────────────────────────────────────
console.log('═'.repeat(78));
console.log('## 1. 사람별');
console.log('');
const measurement = measure(rows);
const fw = weightsFrom(measurement);

for (const r of rows) {
  const pooled = poolCareer(r.systems, fw);
  const cmp = pooled.features ? compareOne(r.truth, pooled.features) : null;
  const ct = centered(r.truth, AXES.career);
  const centSim = pooled.profile ? cosineOf(ct, pooled.profile, AXES.career) : 0;
  console.log(`### ${r.id}  ${r.job}`);
  const tv = unitize(r.truth);
  console.log('  실제 속성: ' + Object.entries(tv).filter(([, v]) => v >= 0.5)
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => `${AXIS_LABEL[k]} ${v.toFixed(2)}`).join(' · '));
  console.log('');
  const sims = r.systems.filter((s) => s.status === 'ok')
    .map((s) => ({ s, sim: cosineOf(tv, unitize(s.features), AXES.career) }))
    .sort((a, b) => b.sim - a.sim);
  for (const { s, sim } of sims) {
    const c = compareOne(r.truth, s.features);
    console.log(`    ${pad(s.systemName, 9)} ${sim.toFixed(2)} ${bar(sim)}  맞힘[${c.hit.map((x) => AXIS_LABEL[x]).join(',') || '—'}]  놓침[${c.missed.map((x) => AXIS_LABEL[x]).join(',') || '—'}]`);
  }
  const silent = r.systems.filter((s) => s.status !== 'ok');
  if (silent.length) console.log(`    (침묵: ${silent.map((s) => `${s.systemName}—${s.why}`).join(' · ')})`);
  console.log('');
  if (cmp) {
    const cats = categorizeCareer(pooled.features, pooled.profile);
    console.log(`    ▶ 합친 결과  치우침 일치 ${centSim.toFixed(3)}  |  절대 유사도 ${cmp.similarity}  |  맞힌 축 ${cmp.hit.length}  놓친 축 ${cmp.missed.length}`);
    console.log(`      일의 본질: ${cats.levelA.ranked.slice(0, 3).map((x) => `${x.label} ${x.p}`).join(' · ')}`);
    console.log(`      작업 환경: ${cats.levelB.ranked.slice(0, 3).map((x) => `${x.label} ${x.p}`).join(' · ')}`);
    console.log(`      산업군   : ${cats.levelC.ranked.slice(0, 3).map((x) => `${x.label} ${x.p}`).join(' · ')}   (정답 ${r.category} 순위 ${cats.levelC.ranked.findIndex((x) => x.key === r.category) + 1})`);
    if (cmp.missed.length) console.log(`      놓침: ${cmp.missed.map((x) => AXIS_LABEL[x]).join(', ')}`);
    if (cmp.over.length) console.log(`      과함: ${cmp.over.map((x) => AXIS_LABEL[x]).join(', ')}`);
  }
  console.log('');
}

// ── 2. 체계별 ──────────────────────────────────────────────
console.log('═'.repeat(78));
console.log('## 2. 체계별 — 무엇을 잘 읽는가');
console.log('');
const order = SYSTEM_IDS.filter((id) => measurement.bySystem[id]?.n)
  .sort((a, b) => measurement.bySystem[b].similarity - measurement.bySystem[a].similarity);
for (const id of order) {
  const m = measurement.bySystem[id];
  const feats = Object.entries(m.byFeature)
    .filter(([, v]) => v.spoke >= 0.3)
    .sort((a, b) => b[1].readScore - a[1].readScore);
  console.log(`### ${SYSTEM_NAME[id]}   평균 유사도 ${m.similarity}  (${m.similarityMin}~${m.similarityMax}, n=${m.n})`);
  console.log(`   잘 읽는 축 : ${feats.slice(0, 5).map(([k, v]) => `${AXIS_LABEL[k]} ${v.readScore}`).join(' · ') || '—'}`);
  console.log(`   약한 축   : ${feats.slice(-3).map(([k, v]) => `${AXIS_LABEL[k]} ${v.readScore}`).join(' · ') || '—'}`);
  console.log(`   말하지 않는 축: ${Object.entries(m.byFeature).filter(([, v]) => v.spoke < 0.3).map(([k]) => AXIS_LABEL[k]).join(', ') || '없음'}`);
  console.log('');
}

// ── 3. 속성별 ──────────────────────────────────────────────
console.log('═'.repeat(78));
console.log('## 3. 속성별 — 누가 이 축을 잘 읽는가');
console.log('');
for (const ax of AXES.career) {
  const top = (measurement.byFeature[ax] ?? []).filter((r) => r.spoke >= 0.3).slice(0, 4);
  if (!top.length) { console.log(`  ${pad(AXIS_LABEL[ax], 8)} — 아무 체계도 이 축을 말하지 않는다`); continue; }
  console.log(`  ${pad(AXIS_LABEL[ax], 8)} ${top.map((r) => `${SYSTEM_NAME[r.system]} ${r.readScore}${r.corr != null ? `(r=${r.corr})` : ''}`).join(' · ')}`);
}
console.log('');

// ── 4. 판정 ────────────────────────────────────────────────
console.log('═'.repeat(78));
console.log('## 4. 판정');
console.log('');

const centTruth = (r) => centered(r.truth, AXES.career);
const pooledSims = rows.map((r) => {
  const p = poolCareer(r.systems, fw);
  return p.profile ? cosineOf(centTruth(r), p.profile, AXES.career) : 0;
});
const rawSims = rows.map((r) => {
  const p = poolCareer(r.systems, null);
  return p.profile ? cosineOf(centTruth(r), p.profile, AXES.career) : 0;
});
const bestSingle = order[0];
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// 기준선 — 남의 명반, 그리고 '모두에게 같은 평균 벡터'
const shuffled = [];
for (const a of rows) for (const b of rows) {
  if (a.id === b.id) continue;
  const p = poolCareer(a.systems, fw);
  if (p.profile) shuffled.push(cosineOf(centTruth(b), p.profile, AXES.career));
}

console.log('  ※ "보통 직업"의 평균을 양쪽에서 빼고 잰다. 안 빼면 모두에게 평균 벡터를');
console.log('     주는 것이 최선이 되어(0.66) 무엇을 읽었는지 알 수 없다.');
console.log('');
console.log(`  합침 (속성별 보정)      ${avg(pooledSims).toFixed(3)}`);
console.log(`  합침 (보정 없음)        ${avg(rawSims).toFixed(3)}`);
console.log(`  남의 명반               ${avg(shuffled).toFixed(3)}   ← 이것보다 높아야 명반이 기여한 것`);
console.log(`  0 (평균만 말하기)       0.000   ← 치우침을 아예 안 읽는 경우`);
console.log('');

// 사람 사이 구별력
let s = 0, c = 0;
const pv = rows.map((r) => poolCareer(r.systems, fw).profile ?? {});
for (let i = 0; i < pv.length; i++) for (let j = i + 1; j < pv.length; j++) { s += cosineOf(pv[i], pv[j], AXES.career); c++; }
console.log(`  합친 벡터끼리 평균 코사인 ${(s / c).toFixed(3)}   ← 1에 가까우면 사람을 구별하지 못한다`);
console.log('');

// ── LOO ────────────────────────────────────────────────────
if (doLoo) {
  console.log('═'.repeat(78));
  console.log('## 5. 한 명 빼고 배우기 (사람 단위 LOO)');
  console.log('   속성별 보정값을 **그 사람을 뺀 나머지**로만 만들고 적용한다.');
  console.log('');
  const looSims = [];
  for (const r of rows) {
    const train = rows.filter((x) => x.id !== r.id);
    const w = weightsFrom(measure(train));
    const p = poolCareer(r.systems, w);
    const sim = p.profile ? cosineOf(centTruth(r), p.profile, AXES.career) : 0;
    looSims.push(sim);
    const c0 = poolCareer(r.systems, null);
    const sim0 = c0.profile ? cosineOf(centTruth(r), c0.profile, AXES.career) : 0;
    console.log(`  ${pad(r.id, 5)} ${pad(r.job, 12)} 보정 전 ${sim0.toFixed(3)} → 보정 후 ${sim.toFixed(3)}  ${sim > sim0 ? '↑' : sim < sim0 ? '↓' : '='}`);
  }
  console.log('');
  console.log(`  LOO 평균 ${avg(looSims).toFixed(3)}  (보정 없음 ${avg(rawSims).toFixed(3)} · 전체로 보정 ${avg(pooledSims).toFixed(3)})`);
  console.log('');
  console.log('  LOO 가 "보정 없음"보다 높아야 보정이 새 사람에게 넘어간 것이다.');
  console.log('  "전체로 보정"보다 낮은 것은 정상이다 — 그 차이가 과적합의 크기다.');
}
