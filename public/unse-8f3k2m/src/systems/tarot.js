/**
 * tarot.js — 타로
 *
 * 타로는 원래 뽑는 점이라 이 사이트의 다른 체계와 성격이 다르다.
 * 볼 때마다 달라지면 종합이 성립하지 않으므로, 여기서는 카드를
 * 생년월일시로 섞는다. 같은 사람에게는 늘 같은 카드가 나온다.
 *
 * 두 가지를 낸다.
 *   생일 카드 — 생년월일을 더해 얻는 메이저 아르카나 한 장. 평생의 주제.
 *   세 장 배열 — 상황 · 과제 · 조언
 */

import { result, WESTERN_TO_OHAENG } from './_base.js';

export const meta = {
  id: 'tarot',
  name: '타로',
  hanja: 'Tarot',
  desc: '생년월일로 고정된 카드를 뽑아 평생의 주제와 지금의 국면을 본다',
  needsTime: false,
  needsPlace: false,
};

const MAJOR = [
  ['바보', 'The Fool', '아무것도 정해지지 않은 자리에서 출발합니다. 계산보다 뛰어드는 힘이 먼저인 사람이라, 남들이 무모하다고 할 때 오히려 길이 열립니다.'],
  ['마법사', 'The Magician', '가진 것을 실제로 쓰는 재주가 있습니다. 재료가 있으면 어떻게든 만들어냅니다. 무엇을 만들 것인지 정하는 쪽이 늘 과제입니다.'],
  ['여사제', 'The High Priestess', '말하지 않고 아는 사람입니다. 직관이 먼저 도착하고 설명은 나중에 붙습니다. 안에 담아두는 것이 많습니다.'],
  ['여황제', 'The Empress', '길러내는 자리입니다. 사람도 일도 품어서 키웁니다. 풍요와 인연이 깊고, 감각적인 것에 밝습니다.'],
  ['황제', 'The Emperor', '틀을 세우는 자리입니다. 질서와 책임에서 안정을 얻습니다. 통제가 지나치면 주변이 굳어버립니다.'],
  ['교황', 'The Hierophant', '전통과 배움의 자리입니다. 검증된 길을 따르고 그것을 남에게 전하는 역할이 붙습니다.'],
  ['연인', 'The Lovers', '선택의 자리입니다. 관계를 통해 자신을 알아갑니다. 둘 중 하나를 고르는 국면이 반복해서 찾아옵니다.'],
  ['전차', 'The Chariot', '밀고 나가는 자리입니다. 반대되는 힘을 한 방향으로 묶어 전진합니다. 속도가 무기이자 위험입니다.'],
  ['힘', 'Strength', '부드러움으로 이기는 자리입니다. 억누르지 않고 달래서 다룹니다. 인내가 곧 실력인 유형입니다.'],
  ['은둔자', 'The Hermit', '혼자 찾는 자리입니다. 물러나 생각하는 시간에서 답을 얻습니다. 남의 속도에 맞추면 길을 잃습니다.'],
  ['운명의 수레바퀴', 'Wheel of Fortune', '흐름이 크게 바뀌는 자리입니다. 통제 밖의 변화가 자주 찾아오고, 그 타이밍을 읽는 감각이 발달합니다.'],
  ['정의', 'Justice', '균형을 재는 자리입니다. 옳고 그름에 민감하고 그 기준으로 판단합니다. 원인과 결과를 분명히 봅니다.'],
  ['매달린 사람', 'The Hanged Man', '거꾸로 보는 자리입니다. 멈춰 있는 동안 관점이 바뀝니다. 기다림이 손해가 아닌 유형입니다.'],
  ['죽음', 'Death', '끝내야 시작되는 자리입니다. 한 시기를 완전히 닫는 경험이 반복됩니다. 무섭게 들리지만 변화의 카드입니다.'],
  ['절제', 'Temperance', '섞어서 새로 만드는 자리입니다. 극단을 조율해 중간을 찾습니다. 시간이 걸리는 일에 강합니다.'],
  ['악마', 'The Devil', '묶여 있는 자리입니다. 욕망·습관·관계에 매이는 경험을 통해 배웁니다. 사슬을 쥔 쪽이 자신임을 보는 게 관건입니다.'],
  ['탑', 'The Tower', '무너지고 다시 짓는 자리입니다. 예고 없는 붕괴를 겪지만 그 뒤가 훨씬 단단합니다.'],
  ['별', 'The Star', '회복의 자리입니다. 무너진 다음에 오는 조용한 희망입니다. 남에게 방향을 보여주는 역할이 붙습니다.'],
  ['달', 'The Moon', '불확실 속을 걷는 자리입니다. 보이지 않는 것을 다루고 상상력이 강합니다. 사실과 불안을 구분하는 게 과제입니다.'],
  ['태양', 'The Sun', '드러내는 자리입니다. 밝고 명료하며 있는 그대로 통합니다. 숨기려 하면 오히려 어긋납니다.'],
  ['심판', 'Judgement', '부름에 답하는 자리입니다. 과거를 정산하고 다시 일어서는 국면이 찾아옵니다.'],
  ['세계', 'The World', '완성의 자리입니다. 한 바퀴를 다 돌고 매듭짓습니다. 끝이 곧 다음 시작이 됩니다.'],
];

/** 메이저 아르카나를 공통 어휘로 옮긴 것. 순서는 0번 바보부터 */
const MAJOR_TAGS = [
  ['자유', '변화'], ['실행', '표현'], ['직관', '내향'], ['돌봄', '감수성'],
  ['책임', '주도'], ['학습', '안정'], ['사교', '감수성'], ['주도', '실행'],
  ['인내', '돌봄'], ['내향', '분석'], ['변화', '직관'], ['분석', '결단'],
  ['인내', '직관'], ['변화', '결단'], ['인내', '안정'], ['재물', '감수성'],
  ['변화', '결단'], ['직관', '돌봄'], ['직관', '감수성'], ['표현', '명예'],
  ['결단', '책임'], ['완벽', '안정'],
];

const SUITS = [
  { name: '완드', en: 'Wands', element: '불', theme: '의지와 행동' },
  { name: '컵', en: 'Cups', element: '물', theme: '감정과 관계' },
  { name: '소드', en: 'Swords', element: '공기', theme: '생각과 결단' },
  { name: '펜타클', en: 'Pentacles', element: '흙', theme: '현실과 재물' },
];

const RANKS = [
  { name: '에이스', mean: '막 씨앗이 놓인 상태' },
  { name: '2', mean: '둘 사이에서 저울질하는 상태' },
  { name: '3', mean: '첫 결실이 보이는 상태' },
  { name: '4', mean: '안정되었지만 멈춰 있는 상태' },
  { name: '5', mean: '부딪치고 모자란 상태' },
  { name: '6', mean: '회복하고 주고받는 상태' },
  { name: '7', mean: '시험받으며 버티는 상태' },
  { name: '8', mean: '빠르게 움직이는 상태' },
  { name: '9', mean: '거의 다 왔으나 아직인 상태' },
  { name: '10', mean: '가득 차서 무거워진 상태' },
  { name: '페이지', mean: '배우기 시작한 단계' },
  { name: '나이트', mean: '한 방향으로 돌진하는 단계' },
  { name: '퀸', mean: '품어서 길러내는 단계' },
  { name: '킹', mean: '완숙하게 다스리는 단계' },
];

function buildDeck() {
  const deck = MAJOR.map(([kr, en, text], i) => ({
    id: `major-${i}`, title: `${i}. ${kr}`, sub: en, text, element: null, major: true,
  }));
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({
        id: `${s.en}-${r.name}`,
        title: `${s.name} ${r.name}`,
        sub: `${s.en} · ${s.element}`,
        text: `${s.theme}의 영역에서 ${r.mean}입니다.`,
        element: s.element,
        major: false,
      });
    }
  }
  return deck;
}

/** 결정론적 난수 — 같은 씨앗이면 늘 같은 순서로 섞인다 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(deck, rng) {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const POSITIONS = [
  { label: '상황', hint: '지금 놓여 있는 자리' },
  { label: '과제', hint: '넘어야 할 지점' },
  { label: '조언', hint: '쥐고 가면 좋은 것' },
];

export function analyze(input) {
  const { year, month, day, hour, minute, timeKnown, currentYear } = input;

  // 생일 카드 — 월 + 일 + 연도를 더해 22 이하로 줄인다
  let sum = month + day + year;
  while (sum > 22) sum = String(sum).split('').reduce((a, c) => a + Number(c), 0);
  const birthIndex = sum === 22 ? 0 : sum;
  const [bKr, bEn, bText] = MAJOR[birthIndex];

  // 세 장 배열 — 생년월일시로 고정된 씨앗
  const seed = year * 100000 + month * 3000 + day * 100
             + (timeKnown ? hour * 60 + minute : 0) + currentYear;
  const drawn = shuffle(buildDeck(), mulberry32(seed)).slice(0, 3);

  const facts = [
    { label: '생일 카드', value: `${birthIndex}. ${bKr}`, note: bEn },
    // 씨앗에 올해가 들어간다. 즉 이 석 장은 생일 카드와 달리 평생 고정이
    // 아니라 해마다 바뀐다. 출생 고정 자료로 읽히면 곤란해서 밝혀 둔다.
    ...drawn.map((c, i) => ({
      label: POSITIONS[i].label, value: c.title,
      note: `${POSITIONS[i].hint} · ${currentYear}년 배열 (생년월일시로 고정한 씨앗에서 뽑음. 해가 바뀌면 달라진다)`,
    })),
  ];

  const readings = [
    { title: `생일 카드 — ${bKr} (${bEn})`, text: bText },
    ...drawn.map((c, i) => ({
      title: `${POSITIONS[i].label} — ${c.title}`,
      text: c.text,
    })),
    {
      title: '이 배열에 대하여',
      text: '타로는 원래 뽑을 때마다 달라지는 점입니다. 여기서는 다른 체계와 겹쳐 보기 위해 생년월일시를 씨앗으로 카드를 고정했습니다. 같은 사람이 다시 열어도 같은 카드가 나옵니다.',
    },
  ];

  // 뽑힌 카드의 원소를 오행으로 환산해 합친다
  const elements = [0, 0, 0, 0, 0];
  for (const c of drawn) {
    if (!c.element) continue;
    const mapped = WESTERN_TO_OHAENG[c.element];
    mapped.forEach((v, i) => { elements[i] += v; });
  }
  const majorCount = drawn.filter((c) => c.major).length;

  return result({
    id: meta.id,
    name: meta.name,
    hanja: meta.hanja,
    headline: `생일 카드 ${bKr} · ${drawn.map((c) => c.title).join(' / ')}`,
    facts,
    readings,
    // 메이저가 많을수록 큰 흐름, 적을수록 일상의 문제를 가리킨다
    confidence: 0.8,
    signals: {
      elements,
      traits: {
        주도: majorCount >= 2 ? 0.3 : 0,
        감성: elements[4] > 1 ? 0.4 : 0,
        실리: elements[2] > 1 ? 0.4 : 0,
        외향: 0, 안정: 0,
      },
      domains: { 재물: null, 관계: null, 직업: null, 건강: null, 학업: null },
      tags: MAJOR_TAGS[birthIndex],
      keywords: [bKr, ...drawn.filter((c) => c.major).map((c) => c.title.split('. ')[1] ?? c.title)],
    },
  });
}

// ── 궁합 ──
// 두 사람의 생일 카드를 나란히 놓고, 그 사이의 거리로 관계를 본다.
// 메이저 아르카나는 0번 바보에서 21번 세계까지 이어지는 하나의 여정이라,
// 두 카드가 그 길 위에서 얼마나 떨어져 있는지가 곧 관계의 성질이 된다.

function birthCard(x) {
  let sum = x.month + x.day + x.year;
  while (sum > 22) sum = String(sum).split('').reduce((a, c) => a + Number(c), 0);
  return sum === 22 ? 0 : sum;
}

const DISTANCE = {
  0: [80, '같은 카드', '두 사람이 같은 생일 카드를 가졌습니다. 평생의 주제가 같다는 뜻이라 깊이 이해하지만, 같은 함정에도 나란히 빠집니다.'],
  1: [74, '이웃한 카드', '여정에서 바로 옆에 선 카드입니다. 한 사람이 한 걸음 앞에 있어 자연스럽게 이끌고 따르는 구도가 됩니다.'],
  2: [70, '두 걸음', '적당한 거리입니다. 서로를 이해할 만큼 가깝고, 배울 것이 있을 만큼 다릅니다.'],
  3: [82, '세 걸음', '서로의 시야를 넓혀주는 거리입니다. 함께 있으면 혼자서는 못 갈 데까지 갑니다.'],
  4: [66, '네 걸음', '관심사가 갈립니다. 공통의 목표를 따로 만들어야 붙어 있게 됩니다.'],
  5: [72, '다섯 걸음', '서로에게 낯선 세계를 보여주는 거리입니다. 신선하지만 설명이 많이 필요합니다.'],
  6: [64, '여섯 걸음', '삶의 단계가 꽤 다릅니다. 한쪽이 답답해하거나 다른 쪽이 버거워할 수 있습니다.'],
  7: [78, '일곱 걸음', '한 주기만큼 떨어진 거리입니다. 서로를 거울처럼 비춰 보게 됩니다.'],
  8: [68, '여덟 걸음', '먼 거리입니다. 끌림이 강한 대신 이해하는 데 시간이 걸립니다.'],
  9: [62, '아홉 걸음', '접점을 일부러 만들어야 하는 거리입니다.'],
  10: [70, '열 걸음', '거의 반대편입니다. 정반대라 오히려 서로에게 없는 것을 채워줍니다.'],
  11: [76, '마주 선 카드', '스물둘의 여정에서 정확히 맞은편입니다. 정반대이면서 한 쌍이라, 끌림과 충돌이 함께 큽니다.'],
};

export function compare(a, b) {
  const cA = birthCard(a), cB = birthCard(b);
  const raw = Math.abs(cA - cB);
  const d = Math.min(raw, 22 - raw);
  const [score, label, text] = DISTANCE[d] ?? [65, `${d} 걸음`, '두 카드 사이의 거리가 큽니다.'];

  // 관계 카드 — 두 생일 카드를 더해 다시 줄인다
  let s = cA + cB;
  while (s > 21) s = String(s).split('').reduce((x, c) => x + Number(c), 0);
  const [rKr, rEn, rText] = MAJOR[s];

  return {
    id: meta.id, name: meta.name, score,
    weight: 0.8,
    headline: `${MAJOR[cA][0]} × ${MAJOR[cB][0]} · ${label}`,
    facts: [
      { label: `${a.name}의 카드`, value: `${cA}. ${MAJOR[cA][0]}`, note: MAJOR[cA][1] },
      { label: `${b.name}의 카드`, value: `${cB}. ${MAJOR[cB][0]}`, note: MAJOR[cB][1] },
      { label: '사이의 거리', value: label, note: `${d} 걸음` },
      { label: '관계 카드', value: `${s}. ${rKr}`, note: rEn },
    ],
    readings: [
      { title: `${MAJOR[cA][0]} × ${MAJOR[cB][0]} — ${label}`, text },
      { title: `관계 카드 — ${rKr} (${rEn})`, text: `두 생일 카드를 더해 얻은 카드입니다. 이 관계가 어떤 성질을 띠는지를 말해줍니다.\n\n${rText}` },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// 시기 운세
// ─────────────────────────────────────────────────────────────
// 그 시기를 씨앗으로 카드 한 장을 뽑는다. 같은 날에는 늘 같은 카드가 나온다.

const CARD_AREA = {
  0: 4, 1: 12, 2: 2, 3: 12, 4: 8, 5: 4, 6: 10, 7: 10, 8: 8, 9: -4, 10: 8,
  11: 2, 12: -8, 13: -10, 14: 6, 15: -12, 16: -16, 17: 12, 18: -8, 19: 16, 20: 6, 21: 14,
};

export function forecast(input, chart, period) {
  const seed = (period.jdn * 2654435761 + input.year * 40503 + input.month * 97 + input.day) >>> 0;
  let a = seed;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const idx = ((t ^ (t >>> 14)) >>> 0) % 22;
  const [kr, en, text] = MAJOR[idx];
  const base = CARD_AREA[idx] ?? 0;

  const areas = {};
  for (const x of ['총운', '애정운', '금전운', '직장운', '학업운', '건강운']) {
    areas[x] = Math.max(8, Math.min(94, Math.round(50 + base)));
  }
  if (idx === 6 || idx === 3) areas.애정운 += 8;
  if (idx === 19 || idx === 21) areas.직장운 += 6;

  return {
    id: meta.id, name: meta.name, weight: 0.7,
    headline: `${idx}. ${kr}`,
    text: text.split('.')[0] + '.',
    areas,
  };
}

export default { meta, analyze, compare , forecast };
