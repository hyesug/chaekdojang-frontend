/**
 * thai.js — 태국 점성술 (โหราศาสตร์ไทย)
 *
 * 태국에서는 태어난 요일이 사람의 색과 방위와 수호 불상을 정한다.
 * 요일마다 행성이 하나씩 붙고, 수요일만 낮과 밤을 갈라 여덟이 된다.
 * 왕궁의 요일 사원부터 사람들이 옷 색을 고르는 방식까지
 * 생활 전반에 이 체계가 깔려 있다.
 *
 * 연도는 불기(佛紀, 서기 + 543)를 쓰고, 띠는 십이지를 쓴다.
 */

import { toJDN } from '../core/astro.js';
import { j } from '../core/josa.js';
import { result, weekdayFromJDN, WEEKDAY_KR } from './_base.js';
import { ZODIAC, BRANCHES_KR } from '../core/ganzhi.js';

export const meta = {
  id: 'thai',
  name: '태국 점성술',
  hanja: 'โหราศาสตร์',
  desc: '태어난 요일로 색·방위·수호 불상과 기질을 본다',
  needsTime: false,
  needsPlace: false,
};

const DAYS = [
  { planet: '태양', color: '빨강', dir: '북동', el: 1,
    buddha: '파앙 타와이 넷', buddhaMean: '눈을 감지 않고 보리수를 바라보는 상',
    text: '드러나는 기질입니다. 자존심이 뚜렷하고 남에게 굽히는 것을 어려워합니다. 중심에 설 때 가장 자기답고, 사람들이 자연스럽게 시선을 줍니다.',
    traits: { 주도: 0.7, 외향: 0.6 }, tags: ['명예', '주도'] },
  { planet: '달', color: '노랑', dir: '동', el: 4,
    buddha: '파앙 함 얏', buddhaMean: '손을 들어 다툼을 막는 상',
    text: '부드럽게 가라앉히는 기질입니다. 갈등을 싫어하고 중간에서 조율합니다. 남의 기분을 빨리 알아채는 만큼 자기 감정은 뒤로 미룹니다.',
    traits: { 감성: 0.7, 주도: -0.2 }, tags: ['돌봄', '감수성'] },
  { planet: '화성', color: '분홍', dir: '남동', el: 1,
    buddha: '파앙 사이야', buddhaMean: '옆으로 누운 열반의 상',
    text: '단단한 기질입니다. 겉으로는 조용해도 한번 정하면 끝까지 갑니다. 참다가 한꺼번에 터뜨리는 쪽이라 중간에 덜어내는 법을 익혀야 합니다.',
    traits: { 주도: 0.5, 안정: 0.4 }, tags: ['인내', '결단'] },
  { planet: '수성', color: '초록', dir: '남', el: 4,
    buddha: '파앙 움 밧', buddhaMean: '발우를 들고 탁발하는 상',
    text: '말과 손이 빠른 기질입니다. 사람과 사람 사이를 오가며 일을 성사시키는 데 능합니다. 여러 갈래를 동시에 쥐다 놓치는 것이 흠입니다.',
    traits: { 외향: 0.6, 실리: 0.4 }, tags: ['표현', '사교'] },
  { planet: '목성', color: '주황', dir: '서', el: 0,
    buddha: '파앙 사마티', buddhaMean: '가부좌를 틀고 명상하는 상',
    text: '가라앉은 기질입니다. 넓게 보고 깊이 생각하며, 남을 가르치고 이끄는 자리가 잘 맞습니다. 결정이 느린 것이 유일한 약점입니다.',
    traits: { 안정: 0.5, 감성: 0.3 }, tags: ['학습', '안정'] },
  { planet: '금성', color: '파랑', dir: '북', el: 3,
    buddha: '파앙 람픙', buddhaMean: '두 손을 모으고 사색하는 상',
    text: '감각이 예민한 기질입니다. 아름다운 것을 알아보고 사람을 끌어당깁니다. 즐거움을 아는 대신 씀씀이가 커지기 쉽습니다.',
    traits: { 외향: 0.5, 감성: 0.5 }, tags: ['사교', '표현'] },
  { planet: '토성', color: '보라', dir: '남서', el: 2,
    buddha: '파앙 낙 쁘록', buddhaMean: '나가가 몸을 감싸 비를 막아주는 상',
    text: '견디는 기질입니다. 어려운 시기를 묵묵히 통과하고 그 경험으로 단단해집니다. 시간이 쌓여야 결과가 나오는 구조입니다.',
    traits: { 안정: 0.7, 외향: -0.3 }, tags: ['인내', '책임'] },
];

/** 수요일 밤 — 태국에서는 여덟 번째 요일처럼 따로 센다 */
const WED_NIGHT = {
  planet: '라후', color: '검정·진회색', dir: '북서', el: 2,
  buddha: '파앙 빠레라이', buddhaMean: '숲속에서 코끼리와 원숭이의 시중을 받는 상',
  text: '길이 남과 다른 기질입니다. 정해진 경로에서 자꾸 벗어나고, 오히려 그 벗어남에서 자기 자리를 찾습니다. 혼자 있는 시간이 반드시 필요합니다.',
  traits: { 외향: -0.4, 안정: -0.4 }, tags: ['자유', '변화'],
};

export function analyze(input) {
  const { year, month, day, hour, timeKnown, yearBranch } = input;

  const jdn = toJDN(year, month, day);
  const weekday = weekdayFromJDN(jdn);
  const isWedNight = weekday === 3 && timeKnown && hour >= 18;
  const d = isWedNight ? WED_NIGHT : DAYS[weekday];

  const buddhistYear = year + 543;

  const facts = [
    { label: '태어난 요일', value: `${WEEKDAY_KR[weekday]}요일`, note: isWedNight ? '수요일 밤 → 라후로 본다' : '' },
    { label: '수호 행성', value: d.planet, note: '' },
    { label: '행운의 색', value: d.color, note: '중요한 날에 걸치면 좋다고 본다' },
    { label: '방위', value: d.dir, note: '사원에서 이 방향의 불상에 참배한다' },
    { label: '수호 불상', value: d.buddha, note: d.buddhaMean },
    { label: '불기', value: `${buddhistYear}년`, note: `서기 ${year} + 543` },
    { label: '띠', value: ZODIAC[yearBranch], note: `${BRANCHES_KR[yearBranch]}년생` },
  ];

  const readings = [
    { title: `${WEEKDAY_KR[weekday]}요일생 — ${d.planet}의 사람`, text: d.text },
    {
      title: `수호 불상 — ${d.buddha}`,
      text: `${d.buddhaMean}입니다. 태국의 사원에는 요일마다 다른 자세의 불상이 놓여 있고, 사람들은 자기 요일의 불상 앞에서 기도합니다. 일곱 요일에 수요일 밤을 더해 여덟 자리가 되는데, 이 여덟은 방위와도 짝을 이룹니다.`,
    },
    {
      title: '색을 쓰는 법',
      text: `${j(d.color, '이')} 이 사람의 색입니다. 태국에서는 요일 색을 실제로 입습니다. 태국 국왕이 월요일생이라 왕실 행사에 노란색이 쓰이는 것도 같은 이유입니다. 면접이나 중요한 자리처럼 기운을 빌리고 싶은 날에 걸치는 용도로 쓰면 됩니다.`,
    },
  ];

  const elements = [0, 0, 0, 0, 0];
  elements[d.el] = 1;

  return result({
    id: meta.id,
    name: meta.name,
    hanja: meta.hanja,
    headline: `${WEEKDAY_KR[weekday]}요일생 · ${d.planet} · ${d.color}`,
    facts,
    readings,
    confidence: weekday === 3 && !timeKnown ? 0.7 : 0.9,
    signals: {
      elements,
      traits: d.traits,
      domains: { 재물: null, 관계: null, 직업: null, 건강: null, 학업: null },
      tags: d.tags,
      keywords: [`${WEEKDAY_KR[weekday]}요일`, d.color, d.planet],
    },
  });
}

// ── 궁합 ──
// 태국의 요일 체계는 인도 점성술에서 왔기 때문에, 요일에 붙은 행성끼리의
// 친소 관계가 그대로 사람 사이의 상성이 된다.

const PLANET_FRIEND = {
  태양: ['달', '화성', '목성'], 달: ['태양', '수성'],
  화성: ['태양', '달', '목성'], 수성: ['태양', '금성'],
  목성: ['태양', '달', '화성'], 금성: ['수성', '토성'],
  토성: ['수성', '금성'], 라후: ['토성', '금성'],
};
const PLANET_ENEMY = {
  태양: ['금성', '토성', '라후'], 달: ['라후'],
  화성: ['수성'], 수성: ['달'],
  목성: ['수성', '금성'], 금성: ['태양', '달'],
  토성: ['태양', '달', '화성'], 라후: ['태양', '달'],
};

export function compare(a, b) {
  const dayOf = (x) => {
    const wd = weekdayFromJDN(toJDN(x.year, x.month, x.day));
    const night = wd === 3 && x.timeKnown && x.hour >= 18;
    return { wd, d: night ? WED_NIGHT : DAYS[wd], night };
  };
  const A = dayOf(a), B = dayOf(b);
  const pA = A.d.planet, pB = B.d.planet;

  const f1 = PLANET_FRIEND[pA]?.includes(pB), f2 = PLANET_FRIEND[pB]?.includes(pA);
  const e1 = PLANET_ENEMY[pA]?.includes(pB), e2 = PLANET_ENEMY[pB]?.includes(pA);

  let score, label, text;
  if (pA === pB) {
    score = 74; label = '같은 행성';
    text = '같은 요일에 태어났습니다. 기질과 속도가 닮아 처음부터 편합니다. 태국에서는 같은 요일끼리를 나쁘게 보지 않지만, 색이 같아 서로를 돋보이게 하지는 못한다고도 합니다.';
  } else if (f1 && f2) {
    score = 88; label = '서로 벗';
    text = `${j(pA, '과')} ${j(pB, '은')} 서로를 벗으로 여기는 사이입니다. 태국식으로 보면 가장 좋은 조합으로, 함께 있을 때 두 사람 다 편안해집니다.`;
  } else if (f1 || f2) {
    score = 74; label = '한쪽이 벗';
    text = `${f1 ? `${j(pA, '이')} ${j(pB, '을')} 벗으로 여깁니다` : `${j(pB, '이')} ${j(pA, '을')} 벗으로 여깁니다`}. 한쪽이 먼저 마음을 여는 구도라, 그쪽이 관계를 끌고 가게 됩니다.`;
  } else if (e1 && e2) {
    score = 34; label = '서로 껄끄러움';
    text = `${j(pA, '과')} ${j(pB, '은')} 서로 껄끄럽게 보는 사이입니다. 성향이 정면으로 어긋나 사소한 것에서 계속 걸립니다. 태국에서는 이런 조합일수록 서로의 요일 색을 챙겨 입어 기운을 맞춘다고 합니다.`;
  } else if (e1 || e2) {
    score = 48; label = '한쪽이 껄끄러움';
    text = `${e1 ? `${j(pA, '이')} ${j(pB, '을')} 껄끄러워합니다` : `${j(pB, '이')} ${j(pA, '을')} 껄끄러워합니다`}. 한 방향으로만 걸리는 구도라, 그쪽에서 의식적으로 거리를 조절하면 크게 문제 되지 않습니다.`;
  } else {
    score = 62; label = '중립';
    text = `${j(pA, '과')} ${j(pB, '은')} 서로 벗도 적도 아닙니다. 특별히 끌리지도 부딪치지도 않는 담담한 조합입니다.`;
  }

  return {
    id: meta.id, name: meta.name, score,
    weight: 0.7,
    headline: `${WEEKDAY_KR[A.wd]}요일 × ${WEEKDAY_KR[B.wd]}요일 · ${label}`,
    facts: [
      { label: `${a.name}`, value: `${WEEKDAY_KR[A.wd]}요일 · ${pA}`, note: `${A.d.color} · ${A.d.dir}` },
      { label: `${b.name}`, value: `${WEEKDAY_KR[B.wd]}요일 · ${pB}`, note: `${B.d.color} · ${B.d.dir}` },
      { label: '행성 관계', value: label, note: '태국 전통의 요일 친구·적(คู่มิตร/คู่ศัตรู) 규칙과는 별개로, 인도식 행성 친소를 빌려 쓴 이 사이트의 보조 기준이다' },
    ],
    readings: [
      { title: `${pA} × ${pB} — ${label}`, text },
      {
        title: '색과 방위',
        text: `${a.name}의 색은 ${A.d.color}, ${b.name}의 색은 ${B.d.color}입니다. 태국에서는 둘이 함께 가는 자리에 서로의 색을 하나씩 걸치는 풍습이 있습니다. ` +
          `방위는 각각 ${j(A.d.dir, '과')} ${B.d.dir}이니, 사원에 함께 가면 두 곳을 다 들르면 됩니다.`,
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// 시기 운세
// ─────────────────────────────────────────────────────────────
// 그 시기의 요일 행성과 내 요일 행성 사이의 친소를 본다.

export function forecast(input, chart, period) {
  const myWd = weekdayFromJDN(toJDN(input.year, input.month, input.day));
  const myP = (myWd === 3 && input.timeKnown && input.hour >= 18 ? WED_NIGHT : DAYS[myWd]).planet;
  const nowWd = (period.jdn + 1) % 7;
  const nowP = DAYS[nowWd].planet;

  const f = PLANET_FRIEND[myP]?.includes(nowP);
  const e = PLANET_ENEMY[myP]?.includes(nowP);
  const base = myP === nowP ? 8 : f ? 12 : e ? -12 : 0;

  const areas = {};
  for (const a of ['총운', '애정운', '금전운', '직장운', '학업운', '건강운']) {
    areas[a] = Math.max(8, Math.min(94, Math.round(50 + base)));
  }
  areas.애정운 += nowP === '금성' ? 8 : 0;
  areas.직장운 += nowP === '태양' ? 6 : 0;

  return {
    id: meta.id, name: meta.name, weight: 0.6,
    headline: `${WEEKDAY_KR[nowWd]}요일 · ${nowP}`,
    text: `이 시기를 이끄는 행성은 ${nowP}입니다. 내 행성 ${j(myP, '과')} ` +
      (myP === nowP ? '같아 기운이 겹칩니다.' : f ? '벗이라 순하게 흐릅니다.' : e ? '껄끄러워 마찰이 생기기 쉽습니다.' : '특별한 관계가 없습니다.') +
      ` ${DAYS[nowWd].color} 계열을 걸치면 좋다고 봅니다.`,
    areas,
  };
}

export default { meta, analyze, compare , forecast };
