/**
 * build-rarity.mjs — 체계별 풀이 항목이 사람들 사이에서 얼마나 흔한지 표를 만든다
 *
 *   node scripts/build-rarity.mjs [표본 수=2000]
 *
 * 리포트가 "그 사람에게만 있는 것"을 앞에 세우려면, 각 풀이(예: 자미 명궁 주성 — 천상)가
 * 전체 인구에서 몇 %에게 나오는지 알아야 한다. 무작위 출생(1960~2009, 시각·지역 무작위)으로
 * 풀이 제목을 모아 비율을 낸다. 해마다 바뀌는 항목(올해·대운·다샤)은 넣지 않는다.
 * 결과: public/unse/src/semantic/data/rarity.js
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { readFortune } from '../public/unse/src/engine.js';
import { rarityKey, sentenceKeys } from '../public/unse/src/semantic/distinct.js';

const N = Number(process.argv[2] ?? 2000);
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const PLACES = ['서울', '부산', '대구', '대전', '광주', '인천', '수원', '구미', '창원', '여주', '제주', '전주'];

const count = {};
const sentenceCount = {};   // 풀이 문장마다 몇 사람에게 나오는가 — 체계 정의처럼 누구에게나 붙는 문장을 거르려고
let done = 0;
for (let i = 0; i < N; i++) {
  const form = {
    gender: rnd() < 0.5 ? 'female' : 'male',
    year: 1960 + Math.floor(rnd() * 50), month: 1 + Math.floor(rnd() * 12), day: 1 + Math.floor(rnd() * 28),
    hour: Math.floor(rnd() * 24), minute: Math.floor(rnd() * 60),
    birthPlace: PLACES[Math.floor(rnd() * PLACES.length)], homePlace: '서울',
  };
  let r;
  try { r = readFortune(form, { now: new Date('2026-06-01T00:00:00Z') }); } catch { continue; }
  const seen = new Set();
  for (const s of r.results) for (const x of s.readings ?? []) {
    const k = rarityKey(s.name, x.title);
    if (k && !seen.has(k)) { seen.add(k); count[k] = (count[k] ?? 0) + 1; }
    for (const sen of sentenceKeys(x.text)) {
      if (seen.has(`s:${sen}`)) continue;
      seen.add(`s:${sen}`); sentenceCount[sen] = (sentenceCount[sen] ?? 0) + 1;
    }
  }
  done++;
  if (done % 250 === 0) process.stdout.write(`  ${done}/${N}\n`);
}
const table = Object.fromEntries(Object.entries(count).sort().map(([k, v]) => [k, Math.round((v / done) * 10000) / 10000]));
mkdirSync('public/unse/src/semantic/data', { recursive: true });
writeFileSync('public/unse/src/semantic/data/rarity.js',
  `/** 자동 생성 — scripts/build-rarity.mjs (표본 ${done}명). 풀이 항목이 나오는 사람의 비율 */\n`
  + `export const SAMPLE = ${done};\nexport const RARITY = ${JSON.stringify(table)};\n`
  // 표본의 15% 넘게 나온 문장 — 그 사람의 특징이 아니라 체계의 정의·설명이다
  + `export const COMMON_SENTENCES = new Set(${JSON.stringify(Object.entries(sentenceCount)
    .filter(([, c]) => c / done > 0.15).map(([s]) => s).sort())});\n`);
console.log(`표본 ${done}명 · 항목 ${Object.keys(table).length}개`);
