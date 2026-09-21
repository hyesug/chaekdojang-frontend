/**
 * validate-attribution.mjs — **사람마다 어느 체계가 맞혔나** 를 칸으로 채운다
 *
 *   node scripts/validate-attribution.mjs
 *
 * 합계 점수가 아니라 표를 만든다. '개발자는 어느 체계가 맞혔나'에 답할 수
 * 있어야 버무리는 계산식을 세울 수 있기 때문이다.
 *
 * ── 이 하네스가 실제로 내놓은 답 ────────────────────────────
 * 표는 **만들어진다.** 열한 명 전원이 최소 한 체계에게는 맞았다(11/11).
 * 그런데 그 표를 **새 사람에게 적용하면 무너진다.**
 *
 *   한 명 빼고 배우기(LOO)      0/11
 *   명반을 남의 것과 섞었을 때   22%
 *   '적어도 한 체계는 맞힘'      제대로 100% · 남의 명반 90%
 *
 * 세 줄이 같은 것을 말한다. **열다섯이 저마다 넓은 범주를 하나씩 말하면
 * 누구에게든 하나는 걸린다.** 남의 명반을 줘도 90%가 걸린다. 그래서
 * '이 사람은 이 체계가 담당'이라고 뽑아 봐야 그 사람에게만 맞는 이름표이고,
 * 다음 사람에게는 넘어가지 않는다(0/11 — 무작위 22%보다도 나쁘다).
 *
 * 표를 보고 조금씩 고치면 11명에는 맞출 수 있다. 그게 바로 0/11 을 만드는
 * 길이다. **고칠 때마다 반드시 이 LOO 를 다시 돌릴 것.**
 *
 * 사람 자료는 validation/attribution.json 에 있고 .gitignore 에 걸려 있다.
 */
import { readFileSync } from 'node:fs';
const B = '../public/unse-8f3k2m/src/';
const { readFortune } = await import(B + 'engine.js');
const IN = await import(B + 'hires/interpret.js');
const ZW = await import(B + 'hires/ziwei.js');
const { solarToLunar } = await import(B + 'core/lunar.js');

function lunarToSolar(y, lm, ld) {
  for (let m = 1; m <= 12; m++) for (let d = 1; d <= 31; d++) {
    const L = solarToLunar(y, m, d);
    if (L && L.month === lm && L.day === ld && !L.leap) return { y, m, d };
  }
  return null;
}

// 실제 직업 → 채점용 낱말. 한국표준직업분류의 말을 빌려 쓴다.
const P = JSON.parse(readFileSync('validation/attribution.json', 'utf8'))
  .map((r) => (r.lunar ? { ...r, ...lunarToSolar(r.lunar[0], r.lunar[1], r.lunar[2]) } : r));

const SYSTEMS = ['사주', '자미두수', '점성술', '베딕', '주역', '태을신수', '토정비결',
  '구성학', '홍국기문', '육임', '마하보테', '태국 점성술', '숙요', '카발라', '타로'];

const hits = {};     // 체계 → 맞힌 사람 목록
for (const s of SYSTEMS) hits[s] = [];
const table = [];

for (const p of P) {
  const r = readFortune({ name: 'x', gender: p.g, year: p.y, month: p.m, day: p.d,
    hour: p.h ?? undefined, minute: p.mi ?? undefined, birthPlace: '대전', homePlace: '대전' });
  const st = r.input.timeKnown ? ZW.stackAt(r.input, 2026, null) : null;
  const reads = [...IN.readAll(r.input, r.chart, st), ...IN.auxReads(r.results ?? [])];
  const said = {};
  const who = [];
  for (const x of reads) {
    if (!x.직업) continue;
    said[x.system] = x.직업.value;
    if (p.kw.some((k) => x.직업.value.includes(k))) { who.push(x.system); hits[x.system].push(p.id); }
  }
  table.push({ id: p.id, job: p.job, who, said });
}

console.log('# 직업 — 사람마다 어느 체계가 맞혔나');
console.log('');
for (const t of table) {
  console.log(`${t.id}  ${t.job}`);
  console.log(`   맞힌 체계: ${t.who.length ? t.who.join(', ') : '없음'}`);
  if (!t.who.length) {
    for (const [s, v] of Object.entries(t.said).slice(0, 4)) console.log(`     (${s}: ${v})`);
  }
}

console.log('');
console.log('# 체계별 적중 — 열한 명 중');
const rank = SYSTEMS.map((s) => ({ s, n: hits[s].length, who: hits[s] }))
  .sort((x, y) => y.n - x.n);
for (const x of rank) console.log(`  ${x.s.padEnd(8)} ${x.n}/11  ${x.who.join(' ')}`);

console.log('');
console.log('# 아무도 못 맞힌 사람');
console.log('  ' + table.filter((t) => !t.who.length).map((t) => `${t.id}(${t.job})`).join(' · '));
console.log('# 한 체계만 맞힌 사람 — 그 체계가 그 직업의 담당 후보다');
for (const t of table) if (t.who.length === 1) console.log(`  ${t.id} ${t.job} → ${t.who[0]}`);

console.log('');
console.log('# 이 표를 계산식으로 쓸 수 있나 — 한 명 빼고 배우기 (LOO)');
console.log('  열 명에서 제일 잘 맞힌 체계를 뽑아, 남겨둔 한 명에게 그 체계의 답만 쓴다.');
console.log('');
let looHit = 0;
for (const target of table) {
  const others = table.filter((t) => t.id !== target.id);
  const cnt = {};
  for (const t of others) for (const s of t.who) cnt[s] = (cnt[s] ?? 0) + 1;
  const best = Object.entries(cnt).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
  const ok = best && target.who.includes(best);
  if (ok) looHit++;
  console.log(`  ${target.id} ${target.job.padEnd(12)} 배운 담당=${String(best).padEnd(6)} → ${ok ? 'O' : 'X'}` +
    (ok ? '' : `   (실제로 맞힌 건 ${target.who.join(',')})`));
}
console.log(`  → ${looHit}/${table.length}`);

console.log('');
console.log('# 기준선 — 명반을 남의 것과 섞으면');
const ROUNDS = 2000;
let shuffledAtLeastOne = 0, shuffledLoo = 0;
for (let i = 0; i < ROUNDS; i++) {
  const perm = table.map((t) => t.said);
  for (let j = perm.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1)); [perm[j], perm[k]] = [perm[k], perm[j]];
  }
  const fake = table.map((t, idx) => ({
    id: t.id,
    who: Object.entries(perm[idx])
      .filter(([, v]) => P[idx].kw.some((kw) => v.includes(kw))).map(([s]) => s),
  }));
  shuffledAtLeastOne += fake.filter((f) => f.who.length).length / fake.length;
  let h = 0;
  for (const tgt of fake) {
    const cnt = {};
    for (const f of fake) if (f.id !== tgt.id) for (const s of f.who) cnt[s] = (cnt[s] ?? 0) + 1;
    const best = Object.entries(cnt).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
    if (best && tgt.who.includes(best)) h++;
  }
  shuffledLoo += h / fake.length;
}
console.log(`  남의 명반이어도 '적어도 한 체계는 맞힘' 비율 : ${(shuffledAtLeastOne / ROUNDS * 100).toFixed(0)}%   (제대로: ${(table.filter((t) => t.who.length).length / table.length * 100).toFixed(0)}%)`);
console.log(`  남의 명반이어도 LOO 적중                : ${(shuffledLoo / ROUNDS * 100).toFixed(0)}%   (제대로: ${(looHit / table.length * 100).toFixed(0)}%)`);
