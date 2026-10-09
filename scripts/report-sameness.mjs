/**
 * report-sameness.mjs — 리포트가 사람마다 얼마나 같은 문장을 내는가
 *
 *   node scripts/report-sameness.mjs [사람 수=60]
 *
 * 무작위 출생 정보로 개인 리포트를 만들고, 문장마다 몇 사람의 리포트에 나왔는지 센다.
 *   흔한 문장  = 20% 넘는 사람에게 똑같이 나온 문장
 *   고유 비율  = 한 사람 리포트에서 흔하지 않은 문장의 비율 (높을수록 그 사람만의 리포트)
 * 장(章)별로도 낸다 — 어디가 판에 박혔는지 보려고.
 */
import { readFortune } from '../public/unse/src/engine.js';
import { readForecast } from '../public/unse/src/forecast.js';
import { buildView } from '../public/unse/src/viewmodel.js';
import { renderReport } from '../public/unse/src/report.js';

const N = Number(process.argv[2] ?? 60);
let seed = 20261009;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const PLACES = ['서울', '부산', '대구', '대전', '광주', '인천', '수원', '구미', '창원', '여주'];

const people = [];
for (let i = 0; i < N; i++) {
  people.push({
    name: '', gender: rnd() < 0.5 ? 'female' : 'male',
    year: 1965 + Math.floor(rnd() * 40), month: 1 + Math.floor(rnd() * 12), day: 1 + Math.floor(rnd() * 28),
    hour: Math.floor(rnd() * 24), minute: Math.floor(rnd() * 60),
    birthPlace: PLACES[Math.floor(rnd() * PLACES.length)], homePlace: PLACES[Math.floor(rnd() * PLACES.length)],
  });
}

/** 장 제목 → 그 장의 문장들 */
function sentencesByPart(html) {
  const parts = {};
  let cur = '머리';
  const text = html
    .replace(/<(h3|h4|summary)[^>]*>/g, '\n§')
    .replace(/<\/(p|li|h3|h4|summary|td|th)>/g, '\n')
    .replace(/<[^>]+>/g, '');
  for (const line of text.split('\n').map((x) => x.trim()).filter(Boolean)) {
    if (line.startsWith('§')) { cur = line.slice(1).replace(/^\d+/, '').slice(0, 20); continue; }
    for (const s of line.split(/(?<=[.!?])\s+/)) {
      const k = s.replace(/\d{4}년|\d+세|\d+~\d+|\d+/g, '#').trim();
      if (k.length >= 12) (parts[cur] ??= new Set()).add(k);
    }
  }
  return parts;
}

const all = [];
for (const form of people) {
  const r = readFortune(form); const f = readForecast(form);
  all.push(sentencesByPart(renderReport(form, r, f, buildView(form, r, f))));
}
const count = new Map();
for (const parts of all) for (const set of Object.values(parts)) for (const s of set) count.set(s, (count.get(s) ?? 0) + 1);
const common = (s) => count.get(s) / N > 0.2;

let tot = 0, uniq = 0; const byPart = {};
for (const parts of all) {
  for (const [p, set] of Object.entries(parts)) {
    for (const s of set) {
      tot++; if (!common(s)) uniq++;
      const b = (byPart[p] ??= [0, 0]); b[0]++; if (!common(s)) b[1]++;
    }
  }
}
console.log(`사람 ${N}명 · 한 사람당 문장 ${Math.round(tot / N)}개 · 고유 비율 ${Math.round((uniq / tot) * 100)}%`);
console.log('\n장별 고유 비율 (문장 수가 많은 순):');
for (const [p, [t, u]] of Object.entries(byPart).sort((a, b) => b[1][0] - a[1][0]).slice(0, 25)) {
  console.log(`  ${p.padEnd(22)} ${String(Math.round(t / N)).padStart(3)}문장/사람 · 고유 ${Math.round((u / t) * 100)}%`);
}
console.log('\n가장 흔한 문장:');
for (const [s, c] of [...count].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${Math.round((c / N) * 100)}%  ${s.slice(0, 80)}`);
