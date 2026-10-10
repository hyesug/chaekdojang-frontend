/**
 * blind-pairs-compat.mjs — 궁합 리포트 블라인드 비교 쌍 (궁합 리포트가 그 커플을 실제로 잡는가)
 *
 *   node scripts/blind-pairs-compat.mjs                        validation/couples.json 의 커플로 만들기
 *   node scripts/blind-pairs-compat.mjs 내파일.json             다른 커플 목록으로 (모양은 validation/couples.example.json)
 *   node scripts/blind-pairs-compat.mjs --score 응답.json       응답을 채점 ({"C01": 1, "C02": 2, ...} — 고른 리포트 번호)
 *
 * 커플마다 HTML 한 장에 궁합 리포트 두 개를 나란히 싣는다. 하나는 **실제 두 사람**, 하나는 b 자리에
 * **같은 해·같은 성별·같은 출생지에 날짜와 시각만 다른 가상의 상대**를 넣은 것이다. 나이·띠 같은
 * 단서로는 고를 수 없고 내용으로만 고르게 된다. 두 리포트 모두 a 는 "A", b 는 "B"로 적는다.
 * 어느 쪽이 실제 커플인지는 answers.json 에만 적는다(응답자에게 보여 주지 말 것).
 *
 * 결과는 validation-data/blind-compat/ (개인정보라 git 에 올라가지 않는다).
 * 채점: 실제 커플 리포트를 고른 비율이 50% 보다 확실히 높아야 궁합 리포트가 관계를 잡고 있다는 뜻이다.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { readFortune } from '../public/unse/src/engine.js';
import { compareFortune } from '../public/unse/src/compat.js';
import { buildCompatView } from '../public/unse/src/viewmodel.js';
import { renderPairReport } from '../public/unse/src/report.js';
import { loadDicts } from '../public/unse/src/semantic/dict.js';
import { elementDistribution } from '../public/unse/src/core/ganzhi.js';

const OUT = 'validation-data/blind-compat';
const args = process.argv.slice(2);

// ── 채점 ───────────────────────────────────────────────────
if (args[0] === '--score') {
  const answers = JSON.parse(readFileSync(`${OUT}/answers.json`, 'utf8'));
  const picks = JSON.parse(readFileSync(args[1], 'utf8'));
  const rows = Object.entries(picks).filter(([id]) => answers[id]);
  const hit = rows.filter(([id, n]) => Number(n) === answers[id].own).length;
  const n = rows.length;
  // 찍어서 이만큼 이상 맞힐 확률 (이항, p=0.5)
  const choose = (a, b) => { let r = 1; for (let i = 1; i <= b; i++) r = (r * (a - b + i)) / i; return r; };
  let p = 0; for (let k = hit; k <= n; k++) p += choose(n, k) / 2 ** n;
  console.log(`응답 ${n}쌍 중 실제 커플 리포트를 고른 쌍 ${hit}쌍 (${n ? Math.round((hit / n) * 100) : 0}%)`);
  console.log(`찍어서 이 정도 이상 나올 확률 ${(p * 100).toFixed(1)}% — 5% 보다 작으면 우연이라 보기 어렵다`);
  for (const [id, pick] of rows) console.log(`  ${id}: 고른 번호 ${pick} · 실제 ${answers[id].own} → ${Number(pick) === answers[id].own ? '맞음' : '틀림'}`);
  process.exit(0);
}

// ── 만들기 ─────────────────────────────────────────────────
const input = args.find((a) => !a.startsWith('--')) ?? 'validation/couples.json';
if (!existsSync(input)) {
  console.error(`${input} 이 없습니다. validation/couples.example.json 모양으로 커플마다 두 사람의 출생 정보를 적어 주세요.`);
  process.exit(1);
}
const couples = JSON.parse(readFileSync(input, 'utf8')).map((x, i) => ({ id: x.id ?? `C${String(i + 1).padStart(2, '0')}`, a: x.a, b: x.b }));

let seed = Number(args[args.indexOf('--seed') + 1]) || 20261010;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

/** 같은 해·성별·출생지, 날짜와 시각만 다른 가상의 상대 */
function decoyOf(b) {
  let month, day;
  do { month = 1 + Math.floor(rnd() * 12); day = 1 + Math.floor(rnd() * 28); }
  while (month === b.month && Math.abs(day - b.day) < 15);
  const d = { gender: b.gender, year: b.year, month, day, birthPlace: b.birthPlace, homePlace: b.homePlace, hour: null, minute: null };
  if (b.hour != null) { d.hour = Math.floor(rnd() * 24); d.minute = Math.floor(rnd() * 60); }
  return d;
}

function reportOf(a, b) {
  const fa = { ...a, name: 'A' }, fb = { ...b, name: 'B' };
  const c = compareFortune(fa, fb);
  return renderPairReport(fa, fb, c, buildCompatView(fa, fb, c), {
    a: elementDistribution(c.A.chart.pillars).count,
    b: elementDistribution(c.B.chart.pillars).count,
  }, { a: readFortune(fa), b: readFortune(fb) })
    // 날짜 도장은 두 장이 같으니 지운다
    .replace(/<p class="rp-kicker">[^<]*<\/p>/, '')
    .replace(/<details class="rp-ch"(?! open)/g, '<details class="rp-ch" open');
}

await loadDicts();
mkdirSync(OUT, { recursive: true });
const css = readFileSync('public/unse/assets/style.css', 'utf8');
const answers = {};
for (const x of couples) {
  const decoy = decoyOf(x.b);
  const ownFirst = rnd() < 0.5;
  const [one, two] = ownFirst ? [x.b, decoy] : [decoy, x.b];
  answers[x.id] = { own: ownFirst ? 1 : 2, decoy };
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>궁합 리포트 비교 ${x.id}</title>
<style>${css}
body{padding:16px;max-width:1400px;margin:0 auto}
.ask{padding:16px;border:2px solid var(--gold,#b8902f);border-radius:10px;margin-bottom:20px;line-height:1.7}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.pair>section>h1{font-size:22px;margin:0 0 8px}
@media (max-width:900px){.pair{grid-template-columns:1fr}}
</style></head><body>
<div class="ask"><b>두 궁합 리포트 중 어느 쪽이 우리 관계와 더 비슷한가요?</b><br>
둘 중 하나는 두 사람의 실제 출생 정보로, 다른 하나는 상대 자리에 다른 사람의 출생 정보를 넣어 만든 리포트입니다.
리포트의 <b>A</b>는 첫 번째 사람, <b>B</b>는 그 상대입니다. 상대의 나이·띠는 같게 맞춰 두었으니 <b>내용만 읽고</b> 우리 관계에 더 가까운 쪽의 번호(1 또는 2)를 알려 주세요.
둘 다 비슷하면 그래도 하나를 골라 주세요. 두 사람이 따로 골라도 좋습니다.</div>
<div class="pair"><section><h1>리포트 1</h1>${reportOf(x.a, one)}</section><section><h1>리포트 2</h1>${reportOf(x.a, two)}</section></div>
</body></html>`;
  writeFileSync(`${OUT}/${x.id}.html`, html);
  console.log(`  ${x.id}.html`);
}
writeFileSync(`${OUT}/answers.json`, JSON.stringify(answers, null, 2));
console.log(`\n${couples.length}쌍을 ${OUT}/ 에 만들었습니다. answers.json 은 응답자에게 보여 주지 마세요.`);
console.log('응답을 {"C01": 1, ...} 모양으로 저장한 뒤 node scripts/blind-pairs-compat.mjs --score 응답.json 으로 채점합니다.');
