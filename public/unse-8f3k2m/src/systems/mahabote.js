/**
 * mahabote.js — 마하보테 (Mahabote)
 *
 * 미얀마의 전통 점법이다. 인도 점성술이 들어와 버마식으로 굳은 것으로,
 * 행성 위치를 쓰지 않고 태어난 요일과 태어난 해만 가지고 본다.
 *
 *   1. 태어난 요일 → 일곱 행성 중 하나. 수요일은 낮과 밤을 갈라
 *      밤에 태어나면 라후가 되어 여덟이 된다.
 *   2. 버마력 연도를 7로 나눈 나머지로 배치를 돌린다.
 *   3. 자기 행성이 여덟 자리 중 어디에 떨어지는지가 핵심이다.
 *
 * 배치 규칙은 전승마다 차이가 있어, 여기서는 가장 널리 소개된 방식을
 * 따랐고 계산 과정을 그대로 보여준다.
 */

import { toJDN } from '../core/astro.js';
import { j } from '../core/josa.js';
import { result, weekdayFromJDN, WEEKDAY_KR } from './_base.js';

export const meta = {
  id: 'mahabote',
  name: '마하보테',
  hanja: 'Mahabote',
  desc: '미얀마 점법. 태어난 요일과 해만으로 여덟 자리 중 내 자리를 찾는다',
  needsTime: false,
  needsPlace: false,
};

/** 여덟 행성 — 요일 순서에 수요일 밤의 라후가 더해진다 */
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

/** 여덟 자리 */
const HOUSES = [
  { name: '빙가', my: 'Binga', mean: '창의',
    text: '만들어내는 자리입니다. 손재주나 아이디어로 먹고살 길이 열리고, 남이 못 보는 방식을 찾아냅니다. 다만 꾸준함이 늘 과제로 남습니다.',
    tags: ['표현', '실행'], domains: { 직업: 66, 학업: 60 } },
  { name: '아툰', my: 'Ahtun', mean: '동반',
    text: '함께 가는 자리입니다. 배우자와 동업자가 삶의 방향을 크게 좌우합니다. 혼자 있을 때보다 짝이 있을 때 힘이 몇 배로 커집니다.',
    tags: ['사교', '돌봄'], domains: { 관계: 72 } },
  { name: '야자', my: 'Yaza', mean: '권위',
    text: '자리를 얻는 자리입니다. 윗사람의 눈에 들고 공적인 인정이 따릅니다. 권한이 커질수록 책임도 함께 커지니 처신이 중요해집니다.',
    tags: ['명예', '책임'], domains: { 직업: 74, 재물: 60 } },
  { name: '아디파티', my: 'Adipati', mean: '성취',
    text: '여덟 자리 가운데 가장 좋게 보는 자리입니다. 이끄는 힘이 있고 하는 일이 결국 모양을 갖춥니다. 순조로운 만큼 안주하지 않는 것이 관건입니다.',
    tags: ['주도', '명예'], domains: { 직업: 78, 재물: 68 } },
  { name: '마라나', my: 'Marana', mean: '상실',
    text: '가장 무겁게 보는 자리입니다. 잃는 경험이 반복되지만, 그 자리는 동시에 비워내고 다시 세우는 자리이기도 합니다. 붙들지 않는 법을 배우면 오히려 자유로워집니다.',
    tags: ['변화', '인내'], domains: { 건강: 40, 재물: 42 } },
  { name: '테케', my: 'Thike', mean: '안정',
    text: '버티는 자리입니다. 화려하지 않아도 무너지지 않고, 오래 하는 일에서 신뢰를 얻습니다. 큰 변화를 스스로 만들지는 않는 편입니다.',
    tags: ['안정', '인내'], domains: { 건강: 66, 재물: 58 } },
  { name: '푸티', my: 'Puti', mean: '결실',
    text: '이어지는 자리입니다. 자식·제자·후배처럼 뒤를 잇는 존재와 인연이 깊습니다. 심어둔 것이 시간이 지나 돌아옵니다.',
    tags: ['돌봄', '학습'], domains: { 관계: 66, 학업: 64 } },
  { name: '라후', my: 'Rahu', mean: '변수',
    text: '예측이 어려운 자리입니다. 정해진 길이 잘 안 맞고 뜻밖의 경로로 풀립니다. 남들이 안 가는 쪽에서 오히려 기회가 열립니다.',
    tags: ['변화', '자유'], domains: { 직업: 56, 재물: 52 } },
];

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

  // 수요일 밤(정오 이후)에 태어나면 라후가 된다
  const isWedNight = weekday === 3 && timeKnown && hour >= 12;
  const planetIndex = isWedNight ? 7 : weekday;
  const planet = PLANETS[planetIndex];

  const by = burmeseYear(year, month, day);
  const remainder = ((by % 7) + 7) % 7;

  // 나머지만큼 배치를 돌린다
  const houseIndex = (planetIndex + remainder) % 8;
  const house = HOUSES[houseIndex];

  // 여덟 자리 전체 배치 — 어느 행성이 어디에 떨어졌는지 보여준다
  const layout = PLANETS.map((p, i) => ({
    planet: p.name,
    house: HOUSES[(i + remainder) % 8].name,
    mine: i === planetIndex,
  }));

  const facts = [
    { label: '태어난 요일', value: `${WEEKDAY_KR[weekday]}요일`, note: isWedNight ? '수요일 오후 → 라후로 본다' : '' },
    { label: '내 행성', value: planet.name, note: planet.my },
    { label: '버마력', value: `${by}년`, note: `서기 ${year} − ${year - by} (버마 새해는 4월 중순)` },
    { label: '나머지', value: String(remainder), note: `${by} ÷ 7` },
    // 버마력과 나머지까지는 규칙이 분명한데, 그 나머지를 여덟 자리에
    // 어떻게 얹느냐는 자료마다 다르다. 어느 배치를 썼는지 밝혀 둔다.
    { label: '내 자리', value: house.name,
      note: `${house.my} · ${house.mean} · 요일 행성 자리에서 나머지만큼 나아가는 배치를 따랐다. 자리 배치는 유파마다 달라 다른 책과 결과가 다를 수 있다` },
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
      title: '여덟 자리 배치',
      text: layout.map((x) => `${x.planet} → ${x.house}${x.mine ? '  ← 나' : ''}`).join('\n'),
    },
    {
      title: '이 계산에 대하여',
      text: '마하보테는 전승마다 배치 규칙에 차이가 있습니다. 여기서는 가장 널리 소개된 방식을 따랐고, 위에 계산 과정을 전부 드러냈습니다. 다른 방식으로 본 결과와 다를 수 있습니다.',
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
// 두 사람의 자리가 여덟 칸 안에서 어떻게 놓였는지를 본다.
// 마주 보는 자리(넉 칸 차이)는 서로를 비추고, 붙어 있는 자리는 닮는다.

function seatOf(x) {
  const jdn = toJDN(x.year, x.month, x.day);
  const wd = weekdayFromJDN(jdn);
  const wedNight = wd === 3 && x.timeKnown && x.hour >= 12;
  const pi = wedNight ? 7 : wd;
  const rem = ((burmeseYear(x.year, x.month, x.day) % 7) + 7) % 7;
  return { planet: PLANETS[pi], house: HOUSES[(pi + rem) % 8], idx: (pi + rem) % 8, weekday: wd };
}

export function compare(a, b) {
  const A = seatOf(a), B = seatOf(b);
  const d = Math.min(Math.abs(A.idx - B.idx), 8 - Math.abs(A.idx - B.idx));

  const REL = {
    0: [78, '같은 자리', '두 사람이 여덟 칸 가운데 같은 자리에 들었습니다. 삶의 과제가 같아 서로를 바로 알아봅니다. 같은 약점도 공유합니다.'],
    1: [72, '이웃한 자리', '바로 옆 칸입니다. 결이 비슷해 편하고, 한쪽이 앞서고 한쪽이 뒤따르는 흐름이 자연스럽게 생깁니다.'],
    2: [64, '두 칸 떨어짐', '적당한 거리입니다. 관심사가 겹치지 않아 부딪칠 일이 적은 대신, 붙어 있게 할 이유도 따로 만들어야 합니다.'],
    3: [58, '세 칸 떨어짐', '삶을 대하는 방식이 꽤 다릅니다. 서로를 이해하려면 설명이 많이 필요합니다.'],
    4: [82, '마주 보는 자리', '여덟 칸에서 정확히 맞은편입니다. 마하보테에서는 이 배치를 서로를 비추는 거울로 봅니다. 정반대라서 오히려 상대에게서 자기에게 없는 것을 발견합니다.'],
  };
  let [score, label, text] = REL[d];

  // 마라나(상실)나 라후(변수)가 끼면 결이 달라진다
  const risky = [A, B].filter((x) => x.house.name === '마라나' || x.house.name === '라후');
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
      title: `${risky.map((x) => x.house.name).join('과 ')}이(가) 걸려 있습니다`,
      text: '마하보테에서 마라나는 잃는 자리, 라후는 예측이 어려운 자리입니다. 관계가 나쁘다는 뜻이 아니라, 이 사람의 삶 자체에 변동이 크다는 뜻입니다. 곁에 있는 쪽이 그 변동을 함께 겪게 되니 미리 알고 있는 편이 낫습니다.',
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
// 나이가 여덟 자리를 돌아 그 해 어느 자리에 서는지 본다.

const SEAT_AREA = {
  빙가: { 총운: 6, 학업운: 8, 직장운: 6, 애정운: 2, 금전운: 2, 건강운: 3 },
  아툰: { 총운: 6, 애정운: 14, 금전운: 3, 직장운: 2, 학업운: 0, 건강운: 3 },
  야자: { 총운: 10, 직장운: 14, 금전운: 7, 학업운: 4, 애정운: 2, 건강운: 2 },
  아디파티: { 총운: 14, 직장운: 12, 금전운: 10, 애정운: 6, 학업운: 6, 건강운: 6 },
  마라나: { 총운: -14, 건강운: -16, 금전운: -10, 애정운: -8, 직장운: -6, 학업운: -2 },
  테케: { 총운: 5, 건강운: 10, 금전운: 5, 직장운: 3, 애정운: 3, 학업운: 3 },
  푸티: { 총운: 6, 학업운: 10, 애정운: 7, 금전운: 3, 직장운: 2, 건강운: 4 },
  라후: { 총운: -5, 금전운: -4, 직장운: 3, 애정운: -6, 학업운: 2, 건강운: -6 },
};

export function forecast(input, chart, period) {
  const jdn = toJDN(input.year, input.month, input.day);
  const wd = weekdayFromJDN(jdn);
  const wedNight = wd === 3 && input.timeKnown && input.hour >= 12;
  const pi = wedNight ? 7 : wd;
  const age = period.sajuYear - input.year;
  const rem = (((burmeseYear(input.year, input.month, input.day) + age) % 7) + 7) % 7;
  const house = HOUSES[(pi + rem) % 8];
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
