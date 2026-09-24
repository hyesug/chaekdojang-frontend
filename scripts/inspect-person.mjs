/**
 * inspect-person.mjs — **한 사람에 대해 열다섯이 각각 뭐라고 하는가**
 *
 *   node scripts/inspect-person.mjs 1992-01-30 16:28 여주 대전 female
 *   node scripts/inspect-person.mjs --id P01          (정답표에서 불러오기)
 *
 * 합친 값만 보면 "왜 이 답이 나왔는지"를 알 수 없다. 체계마다 무엇을 읽어
 * 어느 축을 올렸는지 그대로 펼친다. 정답을 아는 사람이면 정답 벡터도 나란히
 * 놓아 **어디서 어긋나는지** 눈으로 볼 수 있게 한다.
 *
 * 여기서 값을 고치지 않는다. 보여 주기만 한다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { natalFortune } from '../public/unse-8f3k2m/src/semantic/index.js';
import { interpretCareer } from '../public/unse-8f3k2m/src/semantic/systems.js';
import { poolCareer } from '../public/unse-8f3k2m/src/semantic/ensemble.js';
import { unitize } from '../public/unse-8f3k2m/src/semantic/calibration.js';
import { AXES, AXIS_LABEL } from '../public/unse-8f3k2m/src/semantic/axes.js';
import { SYSTEM_NAME } from '../public/unse-8f3k2m/src/semantic/extract.js';

const AX = AXES.career;
const args = process.argv.slice(2);
const pad = (s, n) => {
  const t = String(s ?? '');
  // 한글은 두 칸으로 센다 (표가 어긋나지 않게)
  const w = [...t].reduce((a, c) => a + (c.charCodeAt(0) > 0x1100 ? 2 : 1), 0);
  return t + ' '.repeat(Math.max(0, n - w));
};
const r2 = (v) => (v == null ? '  ·  ' : (v >= 0 ? ' ' : '') + v.toFixed(2));

// ── 누구인가 ──
let birth = null; let truth = null; let who = null;
const idArg = args.indexOf('--id');
if (idArg >= 0) {
  const f = 'validation/people.json';
  if (!existsSync(f)) { console.error(`${f} 이 없습니다.`); process.exit(1); }
  const p = JSON.parse(readFileSync(f, 'utf8')).find((x) => x.id === args[idArg + 1]);
  if (!p) { console.error('그 id 가 없습니다.'); process.exit(1); }
  birth = p.birth; truth = p.labels?.career?.features ?? null;
  who = `${p.id} — ${p.labels?.career?.occupationKey ?? ''}`;
} else {
  const [date, time, bp, hp, gender] = args;
  if (!date) { console.error('사용법: node scripts/inspect-person.mjs 1992-01-30 16:28 여주 대전 female'); process.exit(1); }
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time ?? '').split(':').map(Number);
  birth = { name: '조회', gender: gender ?? 'female', year: y, month: m, day: d,
    ...(Number.isFinite(hh) ? { hour: hh, minute: mm ?? 0 } : {}),
    birthPlace: bp ?? '서울', homePlace: hp ?? bp ?? '서울' };
  who = `${date} ${time ?? '시각미상'} · ${bp} 출생 · ${hp} 거주`;
}

const { fortune, stack } = natalFortune(birth);
const reads = interpretCareer(fortune, stack);
const pooled = poolCareer(reads, null);

console.log(`# ${who}`);
console.log('');
console.log('열다섯 체계가 직업 축 스무 개에 대해 각각 내놓은 값입니다.');
console.log('`·` 은 그 체계가 그 축을 말하지 않는다는 뜻입니다 (0 이 아니라 **없음**).');
console.log('');

// ── ① 체계마다 무엇을 읽었나 ──
console.log('## ① 체계마다 무엇을 읽었나');
console.log('');
for (const r of reads) {
  const head = `${pad(SYSTEM_NAME[r.system] ?? r.system, 12)} ${pad(r.evidenceType ?? '—', 8)}`;
  if (r.status !== 'ok') { console.log(`  ${head} — ${r.why ?? '말하지 않음'}`); continue; }
  const top = Object.entries(r.features ?? {})
    .filter(([, v]) => Math.abs(v) >= 0.2)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5);
  console.log(`  ${head} ${top.map(([k, v]) => `${AXIS_LABEL[k] ?? k} ${v.toFixed(2)}`).join(' · ') || '(뚜렷한 축 없음)'}`);
  for (const e of (r.evidence ?? []).slice(0, 2)) {
    console.log(`  ${' '.repeat(21)}└ ${e.basis ?? e.rule ?? ''}`);
  }
}
console.log('');

// ── ② 축마다 누가 뭐라 했나 ──
console.log('## ② 축마다 — 누가 올리고 누가 내렸나');
console.log('');
const ok = reads.filter((r) => r.status === 'ok');
console.log(`  ${pad('축', 12)} ${pad('합친 값', 8)} ${truth ? pad('정답', 7) : ''} 올린 체계 / 내린 체계`);
const tv = truth ? unitize(truth) : null;
const pv = pooled.profile ?? {};
for (const ax of AX) {
  const up = ok.filter((r) => (r.features?.[ax] ?? 0) >= 0.3).map((r) => SYSTEM_NAME[r.system]);
  const dn = ok.filter((r) => (r.features?.[ax] ?? 0) <= -0.3).map((r) => SYSTEM_NAME[r.system]);
  const t = tv?.[ax];
  const gap = t != null && pv[ax] != null ? Math.abs(t - pv[ax]) : null;
  const mark = gap == null ? ' ' : gap >= 0.5 ? '✗' : gap >= 0.25 ? '△' : '✓';
  console.log(`  ${pad(AXIS_LABEL[ax] ?? ax, 12)} ${pad(r2(pv[ax]), 8)}` +
    `${truth ? pad(r2(t), 7) : ''}${mark} ${up.join(',') || '—'}` +
    `${dn.length ? `  ↓ ${dn.join(',')}` : ''}`);
}
console.log('');

if (!truth) {
  console.log('정답 라벨이 없어 어디서 어긋나는지는 잴 수 없습니다.');
  console.log('`--id P01` 처럼 부르면 정답표의 사람을 불러옵니다.');
  process.exit(0);
}

// ── ③ 어디서 어긋나나 ──
console.log('## ③ 어디서 어긋나나 (정답 − 합친 값)');
console.log('');
const gaps = AX.map((ax) => ({ ax, t: tv[ax] ?? 0, p: pv[ax] ?? 0, d: (tv[ax] ?? 0) - (pv[ax] ?? 0) }))
  .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
console.log('  더 올렸어야 하는 축');
for (const g of gaps.filter((x) => x.d > 0.2).slice(0, 6)) {
  const said = ok.filter((r) => (r.features?.[g.ax] ?? 0) >= 0.3).map((r) => SYSTEM_NAME[r.system]);
  console.log(`    ${pad(AXIS_LABEL[g.ax] ?? g.ax, 12)} 정답 ${r2(g.t)} 합침 ${r2(g.p)}` +
    `  → 맞게 말한 체계: ${said.join(', ') || '**없음**'}`);
}
console.log('');
console.log('  덜 올렸어야 하는 축');
for (const g of gaps.filter((x) => x.d < -0.2).slice(0, 6)) {
  const said = ok.filter((r) => (r.features?.[g.ax] ?? 0) >= 0.3).map((r) => SYSTEM_NAME[r.system]);
  console.log(`    ${pad(AXIS_LABEL[g.ax] ?? g.ax, 12)} 정답 ${r2(g.t)} 합침 ${r2(g.p)}` +
    `  → 잘못 올린 체계: ${said.join(', ') || '—'}`);
}
console.log('');

// ── ④ 그 사람만 놓고 보면 어느 체계가 제일 가까운가 ──
console.log('## ④ 이 사람에게는 어느 체계가 가장 가까웠나');
console.log('');
const cos = (a, b) => {
  let n = 0; let x = 0; let y = 0;
  for (const ax of AX) { const u = a[ax] ?? 0; const v = b[ax] ?? 0; n += u * v; x += u * u; y += v * v; }
  return x && y ? n / Math.sqrt(x * y) : 0;
};
const per = ok.map((r) => ({ name: SYSTEM_NAME[r.system], c: cos(tv, unitize(r.features ?? {})) }))
  .sort((a, b) => b.c - a.c);
for (const x of per) console.log(`  ${pad(x.name, 12)} ${x.c.toFixed(3)}`);
console.log(`  ${pad('합친 것', 12)} ${cos(tv, pv).toFixed(3)}`);
console.log('');
console.log('  ※ **이 줄을 보고 가중치를 정하면 안 됩니다.** 한 사람에게 가까운 체계를');
console.log('    고르는 것은 그 사람에게만 맞는 이름표입니다. 열한 명에서 그렇게 고른 것이');
console.log('    새 사람에게 넘어가는지는 `learn-combine.mjs` 가 따로 잽니다.');
