/**
 * mahabote.js — 마하보테 (Mahabote)
 *
 * 미얀마의 전통 점법이다. 인도 점성술이 들어와 버마식으로 굳은 것으로,
 * 행성 위치를 쓰지 않고 태어난 요일과 태어난 해만 가지고 본다.
 *
 *   1. 태어난 요일 → 일곱 행성 중 하나. 수요일 오후(정오 뒤)에 태어나면
 *      행성만 라후로 바뀌고 자리는 수성의 자리를 그대로 쓴다.
 *   2. 버마력 연도를 7로 나눈 나머지 행성을 1궁에 놓고, 요일을 세 칸씩
 *      건너뛰며(일→수→토→화→금→월→목) 2궁부터 7궁까지 채운다.
 *   3. 자기 요일 행성이 일곱 자리 중 어디에 떨어지는지가 핵심이다.
 *      한 줄로 줄이면 자리 = (버마력 − 요일) mod 7, 요일은 토=0·일=1 … 금=6.
 *      결과 0~6 이 빙가·아툰·야자·아디파티·마라나·테케·푸티이고, 궁 번호로는
 *      1·3·5·7·2·4·6궁이다(1 무상 · 2 극단 · 3 명성 · 4 재물 · 5 왕위 · 6 병 · 7 지도자).
 *
 * 예전에는 자리를 여덟 칸(라후 자리를 따로 둔)으로 놓고 (행성 + 나머지) mod 8 로
 * 돌렸다. 원 산법과 달라 대부분의 사람이 다른 자리를 받았다.
 */

import { toJDN } from '../core/astro.js';
import { j } from '../core/josa.js';
import { result, weekdayFromJDN, WEEKDAY_KR } from './_base.js';

export const meta = {
  id: 'mahabote',
  name: '마하보테',
  hanja: 'Mahabote',
  desc: '미얀마 점법. 태어난 요일과 해만으로 일곱 자리 중 내 자리를 찾는다',
  needsTime: false,
  needsPlace: false,
};

/** 여덟 행성 — 요일 순서에 수요일 오후의 라후가 더해진다 */
const PLANETS = [
  { name: '태양', my: 'Taninganway', el: 1 },
  { name: '달', my: 'Taninla', el: 4 },
  { name: '화성', my: 'Inga', el: 1 },
  { name: '수성', my: 'Boddahu', el: 4 },
  { name: '목성', my: 'Kyasapade', el: 0 },
  { name: '금성', my: 'Thaukkya', el: 3 },
  { name: '토성', my: 'Sanay', el: 2 },
  { name: '라후', my: 'Yahu', el: 2 },
];

/**
 * 일곱 자리 — (버마력 − 요일) mod 7 의 순서. `no` 는 전통 궁 번호.
 */
const HOUSES = [
  { name: '빙가', my: 'Binga', no: 1, mean: '무상',
    text: '오래 머물지 않는 자리입니다. 사는 곳·하는 일·곁의 사람이 자주 바뀌고, 한 번 자리 잡았다 싶을 때 판이 흔들립니다. 그 대신 바뀐 자리에 빨리 적응하고 새 판에서 다시 시작하는 힘이 있습니다.',
    tags: ['변화', '자유'], domains: { 직업: 52, 재물: 48 } },
  { name: '아툰', my: 'Ahtun', no: 3, mean: '명성',
    text: '이름이 드러나는 자리입니다. 하는 일이 남의 눈에 띄고 평판이 따라옵니다. 칭찬과 시선이 힘이 되는 만큼, 평가가 박해질 때 크게 흔들리지 않게 스스로의 기준을 세워 두는 편이 좋습니다.',
    tags: ['명예', '표현'], domains: { 직업: 70, 관계: 62 } },
  { name: '야자', my: 'Yaza', no: 5, mean: '왕위',
    text: '자리를 얻는 자리입니다. 윗사람의 눈에 들고 공적인 인정이 따릅니다. 권한이 커질수록 책임도 함께 커지니 처신이 중요합니다.',
    tags: ['명예', '책임'], domains: { 직업: 74, 재물: 60 } },
  { name: '아디파티', my: 'Adipati', no: 7, mean: '지도자',
    text: '앞에서 이끄는 자리입니다. 사람을 모으고 방향을 정하는 역할이 자연스럽게 맡겨지고, 하는 일이 결국 모양을 갖춥니다. 순조로운 만큼 안주하지 않는 것이 과제입니다.',
    tags: ['주도', '명예'], domains: { 직업: 78, 재물: 66 } },
  { name: '마라나', my: 'Marana', no: 2, mean: '극단',
    text: '가장 무겁게 보는 자리입니다. 모 아니면 도로 흐르기 쉬워 크게 얻고 크게 잃는 일이 반복됩니다. 그 자리는 동시에 비워내고 다시 세우는 자리이기도 해서, 붙잡기보다 정리할 때를 아는 사람이 잘 버팁니다.',
    tags: ['변화', '결단'], domains: { 건강: 42, 재물: 42 } },
  { name: '테케', my: 'Thike', no: 4, mean: '재물',
    text: '곳간의 자리입니다. 모으고 쌓는 데 감각이 있어 시간이 지날수록 손에 남는 것이 늘어납니다. 크게 벌기보다 새지 않게 지키는 쪽에서 힘이 나니, 한 번에 거는 승부는 피하는 편이 낫습니다.',
    tags: ['재물', '안정'], domains: { 재물: 72, 직업: 60 } },
  { name: '푸티', my: 'Puti', no: 6, mean: '병·변화',
    text: '몸과 형편이 자주 바뀌는 자리입니다. 무리하면 몸이 먼저 신호를 보내고, 계획한 일이 중간에 방향을 트는 일이 잦습니다. 건강을 먼저 챙기고 일정에 여유를 두면 이 자리의 기복이 크게 줄어듭니다.',
    tags: ['인내', '돌봄'], domains: { 건강: 40, 재물: 50 } },
];

/** 일요일=0 요일을 마하보테 요일 수(토=0·일=1 … 금=6)로 */
const mbDay = (weekday) => (weekday + 1) % 7;
/** 자리 = (버마력 − 요일) mod 7 */
export const seatIndex = (by, weekday) => (((by - mbDay(weekday)) % 7) + 7) % 7;

/**
 * 버마력.
 *
 * 버마의 새해(띤잔)는 1월 1일이 아니라 4월 중순이다. 그래서 서기에서
 * 빼는 값이 해의 앞뒤로 달라진다 — 새해 전이면 639, 뒤면 638을 뺀다.
 * 638만 쓰면 1~4월 출생자가 통째로 한 해씩 밀린다.
 *
 * 띤잔 날짜는 해마다 4월 13~17일 사이에서 움직이지만, 새해 첫날은
 * 대개 16~17일이다. 여기서는 4월 17일을 경계로 잡는다. 그 며칠 사이에
 * 태어난 사람은 전승을 따로 확인하는 편이 낫다.
 */
export function burmeseYear(y, m = 12, d = 31) {
  const beforeNewYear = m < 4 || (m === 4 && d < 17);
  return y - (beforeNewYear ? 639 : 638);
}

export function analyze(input) {
  const { year, month, day, hour, timeKnown } = input;

  const jdn = toJDN(year, month, day);
  const weekday = weekdayFromJDN(jdn);

  // 수요일 오후(정오 뒤)에 태어나면 행성만 라후가 된다 — 자리는 수성의 자리
  const isWedNight = weekday === 3 && timeKnown && hour >= 12;
  const planetIndex = isWedNight ? 7 : weekday;
  const planet = PLANETS[planetIndex];

  const by = burmeseYear(year, month, day);
  const remainder = ((by % 7) + 7) % 7;

  const houseIndex = seatIndex(by, weekday);
  const house = HOUSES[houseIndex];

  // 일곱 궁 배치 — 1궁부터 어느 행성이 놓였는지 보여준다
  const layout = [...HOUSES].sort((x, y) => x.no - y.no).map((h) => {
    const i = HOUSES.indexOf(h);
    const wd = (((by - i) % 7) + 7) % 7;          // 마하보테 요일 수
    const w = (wd + 6) % 7;                        // 일요일=0
    const name = w === 3 && isWedNight ? '라후' : PLANETS[w].name;
    return { planet: name, house: `${h.no}궁 ${h.name}`, mine: w === weekday };
  });

  const facts = [
    { label: '태어난 요일', value: `${WEEKDAY_KR[weekday]}요일`, note: isWedNight ? '수요일 오후 → 라후로 본다' : '' },
    { label: '내 행성', value: planet.name, note: planet.my },
    { label: '버마력', value: `${by}년`, note: `서기 ${year} − ${year - by} (버마 새해는 4월 중순)` },
    { label: '나머지', value: String(remainder), note: `${by} ÷ 7 → 1궁에 ${PLANETS[(remainder + 6) % 7].name}` },
    // 자리는 표준 산법 (버마력 − 요일) mod 7 로 구했다.
    { label: '내 자리', value: house.name,
      note: `${house.my} · ${house.no}궁 · ${house.mean} — 자리 = (버마력 − 요일) mod 7` },
  ];

  const readings = [
    { title: `${house.name} (${house.my}) — ${house.mean}의 자리`, text: house.text },
    {
      title: `내 행성은 ${planet.name}`,
      text: {
        태양: '드러나고 인정받는 쪽으로 기웁니다. 중심에 설 때 힘이 나고, 무시당한다고 느끼면 급격히 식습니다.',
        달: '주변 분위기에 민감합니다. 마음이 편한 환경을 고르는 것이 그대로 실력이 되는 유형입니다.',
        화성: '먼저 움직입니다. 추진력이 강하고 부딪치는 일도 잦으니, 속도를 늦출 장치가 필요합니다.',
        수성: '말과 셈이 빠릅니다. 정보를 옮기고 중개하는 자리에서 두각을 냅니다.',
        목성: '넓게 봅니다. 가르치고 이끄는 역할이 자연스럽게 맡겨집니다.',
        금성: '감각과 관계의 행성입니다. 사람과 아름다운 것을 다루는 일에 재능이 붙습니다.',
        토성: '느리지만 끝까지 갑니다. 시간이 쌓여야 결과가 나오니 조급함이 가장 큰 적입니다.',
        라후: '정해진 길에서 벗어난 자리입니다. 남들과 같은 방식으로는 잘 안 풀리고, 자기 경로를 만들어야 열립니다.',
      }[planet.name],
    },
    {
      title: '일곱 궁 배치',
      text: layout.map((x) => `${x.house} — ${x.planet}${x.mine ? '  ← 나' : ''}`).join('\n'),
    },
    {
      title: '이 계산에 대하여',
      text: '버마력 연도를 7로 나눈 나머지의 행성을 1궁에 놓고, 요일을 세 칸씩 건너뛰며 7궁까지 채우는 표준 산법을 따랐습니다. 버마 새해(띤잔)는 해마다 4월 13~17일 사이라, 그 며칠 사이에 태어났다면 연도가 한 해 갈릴 수 있습니다.',
    },
  ];

  const elements = [0, 0, 0, 0, 0];
  elements[planet.el] = 1;

  return result({
    id: meta.id,
    name: meta.name,
    hanja: meta.hanja,
    headline: `${planet.name} · ${house.name}(${house.mean})`,
    facts,
    readings,
    // 수요일생만 시간에 따라 갈린다
    confidence: weekday === 3 && !timeKnown ? 0.6 : 1,
    signals: {
      elements,
      traits: {},
      domains: { 재물: null, 관계: null, 직업: null, 건강: null, 학업: null, ...house.domains },
      tags: house.tags,
      keywords: [house.name, planet.name],
    },
  });
}

// ── 궁합 ──
// 두 사람의 자리가 일곱 칸 안에서 얼마나 떨어져 있는지를 본다.
// 마하보테에는 정해진 궁합 산법이 없어, 이 거리 풀이는 이 사이트의 것이다.

function seatOf(x) {
  const jdn = toJDN(x.year, x.month, x.day);
  const wd = weekdayFromJDN(jdn);
  const wedNight = wd === 3 && x.timeKnown && x.hour >= 12;
  const pi = wedNight ? 7 : wd;
  const idx = seatIndex(burmeseYear(x.year, x.month, x.day), wd);
  return { planet: PLANETS[pi], house: HOUSES[idx], idx, weekday: wd };
}

export function compare(a, b) {
  const A = seatOf(a), B = seatOf(b);
  const d = Math.min(Math.abs(A.idx - B.idx), 7 - Math.abs(A.idx - B.idx));

  const REL = {
    0: [78, '같은 자리', '두 사람이 일곱 칸 가운데 같은 자리에 들었습니다. 삶의 과제가 같아 서로를 바로 알아봅니다. 같은 약점도 공유합니다.'],
    1: [72, '이웃한 자리', '바로 옆 칸입니다. 결이 비슷해 편하고, 한쪽이 앞서고 한쪽이 뒤따르는 흐름이 자연스럽게 생깁니다.'],
    2: [64, '두 칸 떨어짐', '적당한 거리입니다. 관심사가 겹치지 않아 부딪칠 일이 적은 대신, 붙어 있게 할 이유도 따로 만들어야 합니다.'],
    3: [58, '세 칸 떨어짐', '삶을 대하는 방식이 꽤 다릅니다. 서로를 이해하려면 설명이 많이 필요합니다.'],
  };
  let [score, label, text] = REL[d];

  // 마라나(극단)나 푸티(병)가 끼면 결이 달라진다
  const risky = [A, B].filter((x) => x.house.name === '마라나' || x.house.name === '푸티');
  if (risky.length) score -= 8;

  const readings = [
    { title: `${A.house.name} × ${B.house.name} — ${label}`, text },
    {
      title: '두 행성',
      text: `${j(a.name, '은')} ${A.planet.name}, ${j(b.name, '은')} ${B.planet.name}의 사람입니다. ` +
        (A.planet.name === B.planet.name
          ? '같은 요일에 태어나 같은 행성을 받았습니다. 기질이 닮아 말이 잘 통합니다.'
          : `태어난 요일이 달라 다른 행성을 받았습니다. ${j(A.planet.name, '과')} ${j(B.planet.name, '은')} 움직이는 속도와 방식이 다르니, 상대의 리듬을 탓하지 않는 것이 관건입니다.`),
    },
  ];
  if (risky.length) {
    readings.push({
      title: `${j(risky.map((x) => x.house.name).join('과 '), '이')} 걸려 있습니다`,
      text: '마하보테에서 마라나는 크게 얻고 잃는 극단의 자리, 푸티는 몸과 형편이 자주 바뀌는 자리입니다. 관계가 나쁘다는 뜻이 아니라, 이 사람의 삶 자체에 변동이 크다는 뜻입니다. 곁에 있는 쪽이 그 변동을 함께 겪게 되니 미리 알고 있는 편이 낫습니다.',
    });
  }

  return {
    id: meta.id, name: meta.name, score: Math.max(10, score),
    weight: 0.7,
    headline: `${A.house.name} × ${B.house.name} · ${label}`,
    facts: [
      { label: `${a.name}`, value: `${A.planet.name} · ${A.house.name}`, note: `${WEEKDAY_KR[A.weekday]}요일생` },
      { label: `${b.name}`, value: `${B.planet.name} · ${B.house.name}`, note: `${WEEKDAY_KR[B.weekday]}요일생` },
      { label: '자리 사이', value: label, note: `${d} 칸` },
    ],
    readings,
  };
}

// ─────────────────────────────────────────────────────────────
// 시기 운세
// ─────────────────────────────────────────────────────────────
// 나이만큼 버마력을 더해 그 해 어느 자리에 서는지 본다(일곱 자리를 돈다).

const SEAT_AREA = {
  빙가: { 총운: -2, 직장운: -3, 금전운: -4, 애정운: -2, 학업운: 4, 건강운: 0 },
  아툰: { 총운: 8, 직장운: 12, 애정운: 6, 금전운: 4, 학업운: 6, 건강운: 2 },
  야자: { 총운: 10, 직장운: 14, 금전운: 7, 학업운: 4, 애정운: 2, 건강운: 2 },
  아디파티: { 총운: 14, 직장운: 12, 금전운: 10, 애정운: 6, 학업운: 6, 건강운: 6 },
  마라나: { 총운: -14, 건강운: -16, 금전운: -10, 애정운: -8, 직장운: -6, 학업운: -2 },
  테케: { 총운: 6, 금전운: 14, 직장운: 4, 건강운: 3, 애정운: 2, 학업운: 2 },
  푸티: { 총운: -6, 건강운: -14, 금전운: -3, 직장운: -2, 애정운: 0, 학업운: 2 },
};

export function forecast(input, chart, period) {
  const jdn = toJDN(input.year, input.month, input.day);
  const wd = weekdayFromJDN(jdn);
  const wedNight = wd === 3 && input.timeKnown && input.hour >= 12;
  const pi = wedNight ? 7 : wd;
  const age = period.sajuYear - input.year;
  const house = HOUSES[seatIndex(burmeseYear(input.year, input.month, input.day) + age, wd)];
  const eff = SEAT_AREA[house.name] ?? {};

  const areas = {};
  for (const a of ['총운', '애정운', '금전운', '직장운', '학업운', '건강운']) {
    areas[a] = Math.max(8, Math.min(94, Math.round(50 + (eff[a] ?? 0))));
  }

  return {
    id: meta.id, name: meta.name, weight: 0.6,
    headline: `${house.name} (${house.mean})`,
    text: `${period.sajuYear}년에는 ${house.name} 자리에 섭니다. ` + house.text.split('.')[0] + '.',
    areas,
  };
}

export default { meta, analyze, compare , forecast };
