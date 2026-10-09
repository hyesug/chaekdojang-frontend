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
import { rarityKey, sentenceKeys, slotOf } from '../public/unse/src/semantic/distinct.js';
import { dictKeys } from '../public/unse/src/semantic/dict.js';

const N = Number(process.argv[2] ?? 2000);
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const PLACES = ['서울', '부산', '대구', '대전', '광주', '인천', '수원', '구미', '창원', '여주', '제주', '전주'];

const count = {};
// 같은 자리(예: 점성 '달')의 서로 다른 값(게자리·사자자리…)에 똑같이 붙는 문장 = 그 자리의 정의.
// 값마다 다른 문장(그 사람의 내용)과 가르려고 자리별로 값의 종류를 센다
const slotSentences = {};   // slot → sentence → Set(value)
const dictCount = {};       // 해석 사전 열쇠(묶음|열쇠)가 나오는 사람 수
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
    const [slot, value] = slotOf(s.name, x.title);
    for (const sen of sentenceKeys(x.text)) ((slotSentences[slot] ??= {})[sen] ??= new Set()).add(value);
  }
  for (const [g, k] of dictKeys(r)) dictCount[`${g}|${k}`] = (dictCount[`${g}|${k}`] ?? 0) + 1;
  done++;
  if (done % 250 === 0) process.stdout.write(`  ${done}/${N}\n`);
}
const table = Object.fromEntries(Object.entries(count).sort().map(([k, v]) => [k, Math.round((v / done) * 10000) / 10000]));
mkdirSync('public/unse/src/semantic/data', { recursive: true });
writeFileSync('public/unse/src/semantic/data/rarity.js',
  `/** 자동 생성 — scripts/build-rarity.mjs (표본 ${done}명). 풀이 항목이 나오는 사람의 비율 */\n`
  + `export const SAMPLE = ${done};\nexport const RARITY = ${JSON.stringify(table)};\n`
  // 같은 자리의 값 셋 이상에 똑같이 붙은 문장 — 그 사람의 내용이 아니라 자리의 정의다
  + `export const DEFINITIONS = new Set(${JSON.stringify([...new Set(Object.values(slotSentences)
    .flatMap((m) => Object.entries(m).filter(([, vals]) => vals.size >= 3).map(([sen]) => sen)))].sort())});\n`
  // 해석 사전 열쇠마다 나오는 사람의 비율 — 리포트가 드문 특징부터 쓰는 데 쓴다
  + `export const DICT_SHARE = ${JSON.stringify(Object.fromEntries(Object.entries(dictCount).sort()
    .map(([k, v]) => [k, Math.round((v / done) * 10000) / 10000])))};\n`);
console.log(`표본 ${done}명 · 항목 ${Object.keys(table).length}개`);
