/**
 * learn-select.mjs — **고르는 규칙을 배울 수 있는가**
 *
 *   node scripts/learn-select.mjs
 *
 * 지금까지 시도한 것은 전부 **가중치**였다. 열다섯에 무게를 달리 줘서 합치는
 * 방식이고, 두 번 다 안 됐다.
 *
 *   축마다(300개) 최고 고르기   적합 0.316 / LOO 0.078   ← 학습 없음(0.098)보다 나쁨
 *   체계마다(15개) 가중치       적합 0.156 / LOO 0.146   ← p=0.035 이나 보정하면 0.385
 *   체계별 쏠림 빼기            LOO -0.029               ← 되레 나쁨
 *
 * 그런데 P01 에서 드러난 것은 무게 문제가 아니었다. **합치는 것 자체가
 * 신호를 죽인다** — 자미두수 단독이 정답과 0.649 인데 열다섯을 합치면
 * 0.248 로, 개별 체계 열다섯 중 열보다 낮다.
 *
 * 그렇다면 합치지 말고 **주제마다 한 체계를 골라 그 말만 쓰면** 어떤가.
 * "일 이야기는 자미 관록궁을 보라"는 전통이 원래 하는 말이기도 하다.
 *
 * ── 왜 이번에는 다를 수 있는가 ─────────────────────────────
 * 자유도가 다르다. 축마다 고르면 스무 번 고르지만, 주제마다 고르면
 * **다섯 번** 고른다. 열한 명으로 스무 개를 고르면 반드시 외우고,
 * 다섯 개면 외울 여지가 적다.
 *
 * 그래도 다섯 번의 선택에 열다섯 후보씩이면 15^5 가지다. 적합값은 당연히
 * 오른다. **LOO 와 라벨 섞기로만 읽는다.**
 */
import { readFileSync, existsSync } from 'node:fs';
import { natalFortune } from '../public/unse/src/semantic/index.js';
import { interpretCareer } from '../public/unse/src/semantic/systems.js';
import { poolCareer } from '../public/unse/src/semantic/ensemble.js';
import { unitize, cosineOf } from '../public/unse/src/semantic/calibration.js';
import { AXES, AXIS_LABEL } from '../public/unse/src/semantic/axes.js';
import { SYSTEM_NAME } from '../public/unse/src/semantic/extract.js';
import { seededRandom } from '../public/unse/src/semantic/timing/schema.js';

const AX = AXES.career;
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
const pad = (s, n) => {
  const t = String(s ?? '');
  const w = [...t].reduce((a, c) => a + (c.charCodeAt(0) > 0x1100 ? 2 : 1), 0);
  return t + ' '.repeat(Math.max(0, n - w));
};

/**
 * 주제 — **겹치지 않게** 스무 축을 다섯으로 나눈다.
 *
 * `detail.js` 의 `CAREER_FAMILIES` 는 축이 겹친다(analytical 이 두 군데).
 * 고르는 규칙을 배우려면 한 축이 한 주제에만 속해야 한다 — 안 그러면
 * 같은 축을 두 체계가 동시에 채워 다시 합치는 꼴이 된다.
 *
 * 나누는 기준은 전통이 어느 자리에서 그것을 보는가이지 성능이 아니다.
 * 성능을 보고 나눈 묶음은 그 열한 명에게만 맞는다.
 */
const TOPICS = [
  { key: '기술·분석', axes: ['technical', 'analytical', 'research', 'information', 'problemSolving', 'specialist'] },
  { key: '조직·제도', axes: ['management', 'organization', 'public', 'stability'] },
  { key: '대인·거래', axes: ['interpersonal', 'verbal', 'commercial', 'care'] },
  { key: '창작·감각', axes: ['creative', 'aesthetic'] },
  { key: '독립·현장', axes: ['independence', 'physical', 'competitive', 'change'] },
];
{
  const seen = new Set();
  for (const t of TOPICS) for (const a of t.axes) {
    if (seen.has(a)) throw new Error(`축이 겹칩니다: ${a}`);
    seen.add(a);
  }
  const missing = AX.filter((a) => !seen.has(a));
  if (missing.length) throw new Error(`빠진 축: ${missing.join(', ')}`);
}

// ── 자료 ──
const file = process.argv[2] ?? 'validation/people.json';
if (!existsSync(file)) { console.error(`${file} 이 없습니다.`); process.exit(1); }
const rows = [];
for (const p of JSON.parse(readFileSync(file, 'utf8'))) {
  const f = p.labels?.career?.features;
  if (!f) continue;
  let fortune = null; let stack = null;
  try { ({ fortune, stack } = natalFortune(p.birth)); } catch { continue; }
  rows.push({
    id: p.id, label: p.labels.career.occupationKey ?? p.id,
    truth: f, systems: interpretCareer(fortune, stack),
  });
}
if (rows.length < 4) { console.error('사람이 너무 적습니다.'); process.exit(1); }

/** 평균을 뺀 자리에서 잰다 — 안 빼면 모두에게 평균을 주는 것이 최선이 된다 */
const centre = Object.fromEntries(AX.map((ax) => [ax, mean(rows.map((r) => r.truth[ax] ?? 0))]));
const dev = (v) => Object.fromEntries(AX.map((ax) => [ax, (v?.[ax] ?? 0) - centre[ax]]));
const score = (truth, pred) => cosineOf(dev(unitize(truth)), dev(unitize(pred)), AX);

/** 한 체계가 이 주제의 축들에서 정답과 얼마나 같은 쪽을 보는가 */
function agreement(systems, truth, axes) {
  const t = unitize(truth);
  let n = 0; let a = 0; let b = 0;
  for (const ax of axes) {
    const v = systems.features?.[ax];
    if (v == null) continue;
    const tv = (t[ax] ?? 0) - centre[ax];
    n += v * tv; a += v * v; b += tv * tv;
  }
  return a && b ? n / Math.sqrt(a * b) : null;
}

/** 주제마다 한 체계를 고른다 — 훈련 사람들에게서 가장 자주 같은 쪽을 본 것 */
function learnPicks(train) {
  const picks = {};
  for (const t of TOPICS) {
    const per = {};
    for (const r of train) {
      for (const s of r.systems) {
        if (s.status !== 'ok') continue;
        const g = agreement(s, r.truth, t.axes);
        if (g == null) continue;
        (per[s.system] ??= []).push(g);
      }
    }
    const ranked = Object.entries(per)
      .filter(([, xs]) => xs.length >= Math.ceil(train.length * 0.6))   // 대부분에게 말한 것만
      .map(([sys, xs]) => ({ sys, s: mean(xs) }))
      .sort((a, b) => b.s - a.s);
    picks[t.key] = ranked[0] ?? null;
  }
  return picks;
}

/** 고른 체계의 말만 써서 벡터를 만든다 — **합치지 않는다** */
function predictBySelection(systems, picks) {
  const out = {};
  for (const t of TOPICS) {
    const pick = picks[t.key];
    const s = pick ? systems.find((x) => x.system === pick.sys && x.status === 'ok') : null;
    for (const ax of t.axes) out[ax] = s?.features?.[ax] ?? 0;
  }
  return out;
}

/** 사람 단위 LOO */
function loo(data, mode) {
  return mean(data.map((_, i) => {
    const train = data.filter((_, j) => j !== i);
    if (mode === 'none') return score(data[i].truth, poolCareer(data[i].systems, null).profile ?? {});
    const picks = learnPicks(train);
    return score(data[i].truth, predictBySelection(data[i].systems, picks));
  }));
}

console.log('# 주제마다 한 체계를 골라 그 말만 쓰면');
console.log('');
console.log(`사람 ${rows.length}명 · 주제 ${TOPICS.length}개 · 체계 15개.`);
console.log('**합치지 않습니다.** 주제마다 고른 체계의 값을 그대로 씁니다.');
console.log('');

// ── ① 적합값과 LOO ──
const picksAll = learnPicks(rows);
const fit = mean(rows.map((r) => score(r.truth, predictBySelection(r.systems, picksAll))));
const looSel = loo(rows, 'select');
const looNone = loo(rows, 'none');

console.log('## ① 배운 것이 새 사람에게 넘어가는가');
console.log('');
console.log(`  학습 없음 (열다섯 합침)   LOO ${r3(looNone)}`);
console.log(`  주제마다 하나 고르기      적합 ${r3(fit)} · LOO ${r3(looSel)}` +
  `  (과적합 ${r3(fit - looSel)})`);
console.log('');

// ── ② 열한 명 전체로 고르면 누가 뽑히나 ──
console.log('## ② 전체로 고르면 누가 뽑히나');
console.log('');
for (const t of TOPICS) {
  const p = picksAll[t.key];
  console.log(`  ${pad(t.key, 12)} ${p ? `${pad(SYSTEM_NAME[p.sys] ?? p.sys, 10)} (평균 일치 ${r3(p.s)})` : '— 아무도 말하지 않음'}`);
  console.log(`  ${' '.repeat(12)} ${t.axes.map((a) => AXIS_LABEL[a]).join(' · ')}`);
}
console.log('');

// ── ③ 고른 것이 사람마다 흔들리는가 ──
console.log('## ③ 사람 하나를 빼면 선택이 바뀌는가');
console.log('');
const votes = {};
for (let i = 0; i < rows.length; i++) {
  const p = learnPicks(rows.filter((_, j) => j !== i));
  for (const t of TOPICS) ((votes[t.key] ??= {})[p[t.key]?.sys ?? '없음'] ??= 0,
  votes[t.key][p[t.key]?.sys ?? '없음'] += 1);
}
let stable = 0;
for (const t of TOPICS) {
  const v = Object.entries(votes[t.key]).sort((a, b) => b[1] - a[1]);
  const top = v[0];
  if (top[1] === rows.length) stable += 1;
  console.log(`  ${pad(t.key, 12)} ${v.map(([s, n]) => `${SYSTEM_NAME[s] ?? s} ${n}번`).join(' · ')}`);
}
console.log('');
console.log(`  ${stable}/${TOPICS.length} 주제에서 선택이 한 번도 안 바뀌었습니다.`);
console.log('  ※ 사람 하나에 선택이 흔들리면 그 선택은 규칙이 아니라 그 사람에게 맞춘 것입니다.');
console.log('');

// ── ④ 라벨을 섞어도 같은 점수가 나오는가 ──
console.log('## ④ 정답을 뒤섞고 똑같이 배우면');
console.log('');
const rnd = seededRandom(20260925);
const nulls = [];
for (let t = 0; t < 200; t++) {
  const truths = rows.map((r) => r.truth);
  for (let i = truths.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [truths[i], truths[j]] = [truths[j], truths[i]];
  }
  nulls.push(loo(rows.map((r, i) => ({ ...r, truth: truths[i] })), 'select'));
}
nulls.sort((a, b) => a - b);
const p = (nulls.filter((v) => v >= looSel).length + 1) / (nulls.length + 1);
console.log(`  관측 ${r3(looSel)} · 섞었을 때 평균 ${r3(mean(nulls))}` +
  ` · 95% ${r3(nulls[Math.floor(nulls.length * 0.025)])}~${r3(nulls[Math.floor(nulls.length * 0.975)])}` +
  `   p=${r3(p)}`);
console.log('');

// ── ⑤ 사람마다 ──
console.log('## ⑤ 사람마다');
console.log('');
for (let i = 0; i < rows.length; i++) {
  const picks = learnPicks(rows.filter((_, j) => j !== i));
  const a = score(rows[i].truth, poolCareer(rows[i].systems, null).profile ?? {});
  const b = score(rows[i].truth, predictBySelection(rows[i].systems, picks));
  console.log(`  ${pad(rows[i].id, 5)} ${pad(rows[i].label, 14)}` +
    ` 합침 ${String(r3(a)).padStart(7)} → 골라 쓰기 ${String(r3(b)).padStart(7)}  ${b > a ? '↑' : b < a ? '↓' : '='}`);
}
console.log('');
console.log('## 읽는 법');
console.log('  · 적합값이 오르는 것은 아무 뜻이 없습니다. 고르면 반드시 오릅니다.');
console.log('  · LOO 가 "학습 없음"보다 높고 **섞었을 때보다도 높아야** 배운 것입니다.');
console.log('  · ③ 에서 선택이 흔들리면 LOO 가 높아도 규칙이라 부르지 않습니다.');
