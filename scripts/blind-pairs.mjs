/**
 * blind-pairs.mjs — 블라인드 비교용 리포트 쌍을 만든다 (리포트가 그 사람을 실제로 잡는가)
 *
 *   node scripts/blind-pairs.mjs                         validation/people.json 의 사람들로 만들기
 *   node scripts/blind-pairs.mjs 내파일.json              다른 사람 목록으로 (people.json 과 같은 모양 또는 birth 객체 배열)
 *   node scripts/blind-pairs.mjs --score 응답.json        응답을 채점 ({"P01": 1, "P02": 2, ...} — 고른 리포트 번호)
 *
 * 사람마다 HTML 한 장에 리포트 두 개를 이름 없이 나란히 싣는다. 하나는 본인, 하나는 **같은 해·같은
 * 성별·같은 출생지에 날짜와 시각만 다른 가상의 사람**이다. 그래서 나이·연도 같은 단서로는 고를 수
 * 없고 내용으로만 고르게 된다. 어느 쪽이 본인인지는 answers.json 에만 적는다(사람에게 보여 주지 말 것).
 *
 * 결과는 validation-data/blind/ (개인정보라 git 에 올라가지 않는다).
 * 채점: 본인 리포트를 고른 비율이 50% 보다 확실히 높아야 리포트가 그 사람을 잡고 있다는 뜻이다.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { readFortune } from '../public/unse/src/engine.js';
import { readForecast } from '../public/unse/src/forecast.js';
import { buildView } from '../public/unse/src/viewmodel.js';
import { renderReport } from '../public/unse/src/report.js';
import { loadDicts } from '../public/unse/src/semantic/dict.js';

const OUT = 'validation-data/blind';
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
  console.log(`응답 ${n}명 중 본인 리포트를 고른 사람 ${hit}명 (${n ? Math.round((hit / n) * 100) : 0}%)`);
  console.log(`찍어서 이 정도 이상 나올 확률 ${(p * 100).toFixed(1)}% — 5% 보다 작으면 우연이라 보기 어렵다`);
  for (const [id, pick] of rows) console.log(`  ${id}: 고른 번호 ${pick} · 본인 ${answers[id].own} → ${Number(pick) === answers[id].own ? '맞음' : '틀림'}`);
  process.exit(0);
}

// ── 만들기 ─────────────────────────────────────────────────
const input = args.find((a) => !a.startsWith('--')) ?? 'validation/people.json';
if (!existsSync(input)) { console.error(`${input} 이 없습니다.`); process.exit(1); }
const raw = JSON.parse(readFileSync(input, 'utf8'));
const people = raw.map((p, i) => ({ id: p.id ?? `사람${i + 1}`, birth: p.birth ?? p }));

let seed = Number(args[args.indexOf('--seed') + 1]) || 20261009;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

/** 같은 해·성별·출생지, 날짜와 시각만 다른 가상의 사람 */
function decoyOf(b) {
  let month, day;
  do { month = 1 + Math.floor(rnd() * 12); day = 1 + Math.floor(rnd() * 28); }
  while (month === b.month && Math.abs(day - b.day) < 15);
  const d = { gender: b.gender, year: b.year, month, day, birthPlace: b.birthPlace, homePlace: b.homePlace };
  if (b.hour != null) { d.hour = Math.floor(rnd() * 24); d.minute = Math.floor(rnd() * 60); }
  return d;
}

function reportOf(birth) {
  const form = { ...birth, name: '' };
  const r = readFortune(form); const f = readForecast(form);
  return renderReport(form, r, f, buildView(form, r, f))
    .replace(/<details class="rp-ch"(?! open)/g, '<details class="rp-ch" open');
}

await loadDicts();
mkdirSync(OUT, { recursive: true });
const css = readFileSync('public/unse/assets/style.css', 'utf8');
const answers = {};
for (const p of people) {
  const decoy = decoyOf(p.birth);
  const ownFirst = rnd() < 0.5;
  const [one, two] = ownFirst ? [p.birth, decoy] : [decoy, p.birth];
  answers[p.id] = { own: ownFirst ? 1 : 2, decoy };
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>리포트 비교 ${p.id}</title>
<style>${css}
body{padding:16px;max-width:1400px;margin:0 auto}
.ask{padding:16px;border:2px solid var(--gold,#b8902f);border-radius:10px;margin-bottom:20px;line-height:1.7}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.pair>section>h1{font-size:22px;margin:0 0 8px}
@media (max-width:900px){.pair{grid-template-columns:1fr}}
</style></head><body>
<div class="ask"><b>두 리포트 중 어느 쪽이 더 나 같나요?</b><br>
둘 중 하나는 내 출생 정보로, 다른 하나는 다른 사람의 출생 정보로 만든 리포트입니다. 나이와 연도는 같게 맞춰 두었으니
<b>내용만 읽고</b> 더 나 같은 쪽의 번호(1 또는 2)를 알려 주세요. 둘 다 비슷하면 그래도 하나를 골라 주세요.</div>
<div class="pair"><section><h1>리포트 1</h1>${reportOf(one)}</section><section><h1>리포트 2</h1>${reportOf(two)}</section></div>
</body></html>`;
  writeFileSync(`${OUT}/${p.id}.html`, html);
  console.log(`  ${p.id}.html`);
}
writeFileSync(`${OUT}/answers.json`, JSON.stringify(answers, null, 2));
console.log(`\n${people.length}쌍을 ${OUT}/ 에 만들었습니다. answers.json 은 응답자에게 보여 주지 마세요.`);
console.log('응답을 {"P01": 1, ...} 모양으로 저장한 뒤 node scripts/blind-pairs.mjs --score 응답.json 으로 채점합니다.');
