/**
 * vedic.js — 베딕 점성술 (Jyotiṣa)
 *
 * 서양 점성술과 같은 하늘을 보지만 좌표계가 다르다.
 * 서양은 춘분점을 양자리 0도로 고정하는 회귀 황도를,
 * 베딕은 실제 별자리에 붙박은 항성 황도를 쓴다.
 * 세차 때문에 지금은 두 좌표가 약 24도 어긋나 있어서,
 * 같은 사람도 태양 별자리가 대개 한 칸 앞으로 밀린다.
 *
 * 하우스는 전통대로 온별자리(whole sign) — 라그나가 든 별자리 전체가 1하우스다.
 * 시기 운은 빔쇼타리 다샤로 본다. 달이 든 나크샤트라의 지배 행성에서 시작해
 * 120년을 아홉 행성이 나눠 갖는다.
 */

import { planetPositions, houses, toSidereal, PLANET_ORDER } from '../core/planets.js';
import { j } from '../core/josa.js';
import { norm360, lahiriAyanamsa } from '../core/astro.js';
import { NAKSHATRA_LORDS, NAKSHATRA_NAMES } from './sukyo.js';
import { result, WESTERN_TO_OHAENG } from './_base.js';

export const meta = {
  id: 'vedic',
  name: '베딕',
  hanja: 'Jyotiṣa',
  desc: '항성 황도로 본 인도 점성술. 달의 자리와 다샤 주기를 중심으로 읽는다',
  needsTime: true,
  needsPlace: true,
};

const RASHI = [
  { name: '메샤', kr: '양', el: '불', lord: '화성', text: '앞장서고 부딪치며 배웁니다. 에너지가 밖으로 터져 나오는 자리입니다.' },
  { name: '브리샤바', kr: '황소', el: '흙', lord: '금성', text: '모으고 누리는 자리입니다. 느리지만 한번 쌓은 것은 잘 무너지지 않습니다.' },
  { name: '미투나', kr: '쌍둥이', el: '공기', lord: '수성', text: '말과 정보의 자리입니다. 배우고 옮기고 연결하는 데 재능이 있습니다.' },
  { name: '카르카', kr: '게', el: '물', lord: '달', text: '품는 자리입니다. 가족과 뿌리에 민감하고 감정의 기억이 깁니다.' },
  { name: '심하', kr: '사자', el: '불', lord: '태양', text: '드러나는 자리입니다. 권위와 자부심이 있고 중심에 설 때 편안합니다.' },
  { name: '칸야', kr: '처녀', el: '흙', lord: '수성', text: '가려내는 자리입니다. 세밀하게 다듬고 실무로 증명합니다.' },
  { name: '툴라', kr: '천칭', el: '공기', lord: '금성', text: '균형의 자리입니다. 관계와 거래, 조율에서 힘이 납니다.' },
  { name: '브리시카', kr: '전갈', el: '물', lord: '화성', text: '깊이 들어가는 자리입니다. 감춰진 것을 다루고 변형을 겪습니다.' },
  { name: '다누', kr: '사수', el: '불', lord: '목성', text: '넓히는 자리입니다. 배움·신념·먼 길과 인연이 깊습니다.' },
  { name: '마카라', kr: '염소', el: '흙', lord: '토성', text: '오르는 자리입니다. 인내로 쌓고 시간이 지나야 결과가 나옵니다.' },
  { name: '쿰바', kr: '물병', el: '공기', lord: '토성', text: '떨어져 보는 자리입니다. 무리 속에서도 자기 방식을 지킵니다.' },
  { name: '미나', kr: '물고기', el: '물', lord: '목성', text: '풀어지는 자리입니다. 경계가 옅고 직관과 연민이 깊습니다.' },
];

const BHAVA = [
  null,
  ['탄누', '몸과 성격, 삶 전체의 바탕'],
  ['다나', '재물과 가족, 말'],
  ['사하자', '형제·용기·짧은 여행'],
  ['수카', '집·어머니·마음의 평안'],
  ['푸트라', '자식·창작·지성'],
  ['리푸', '질병·빚·경쟁'],
  ['자야', '배우자·동업·공개된 적'],
  ['아유', '수명·위기·물려받는 것'],
  ['다르마', '행운·스승·신념·먼 길'],
  ['카르마', '직업·명예·사회적 지위'],
  ['라바', '수입·친구·소망'],
  ['브야야', '손실·해방·이면'],
];

/** 빔쇼타리 다샤 — 아홉 행성이 120년을 나눠 갖는다 */
const DASHA_YEARS = {
  케투: 7, 금성: 20, 태양: 6, 달: 10, 화성: 7,
  라후: 18, 목성: 16, 토성: 19, 수성: 17,
};
const DASHA_ORDER = ['케투', '금성', '태양', '달', '화성', '라후', '목성', '토성', '수성'];

const DASHA_TEXT = {
  케투: '덜어내는 시기입니다. 세속적인 성취보다 정리와 해방이 주제가 됩니다. 갑작스러운 이탈이나 방향 전환이 일어납니다.',
  금성: '누리는 시기입니다. 관계·예술·풍요와 인연이 깊어지고 삶이 부드러워집니다. 안락함에 젖는 것이 유일한 위험입니다.',
  태양: '드러나는 시기입니다. 책임 있는 자리가 주어지고 이름이 오르내립니다. 아버지·권위와 얽힌 주제가 나옵니다.',
  달: '마음이 주제가 되는 시기입니다. 감정의 기복과 함께 사람·집·어머니에 관한 일이 전면에 나옵니다.',
  화성: '밀어붙이는 시기입니다. 경쟁과 충돌이 늘고 그만큼 실행력도 커집니다. 다치거나 무리하기 쉽습니다.',
  라후: '낯선 쪽으로 끌려가는 시기입니다. 외국·신기술·비정통에서 기회가 열리고, 욕망이 커져 과속하기 쉽습니다.',
  목성: '넓어지는 시기입니다. 스승과 기회가 나타나고 배움·자식·신념이 주제가 됩니다. 가장 너그러운 구간입니다.',
  토성: '깎이는 시기입니다. 느리고 무겁지만 여기서 버틴 것만 평생 남습니다. 조급함이 가장 큰 적입니다.',
  수성: '굴리는 시기입니다. 학습·거래·소통이 활발해지고 머리 쓰는 일에서 성과가 납니다.',
};

const EL_TAGS = {
  불: ['주도', '실행'], 흙: ['안정', '재물'],
  공기: ['표현', '분석'], 물: ['감수성', '직관'],
};

const NAK_SPAN = 360 / 27;

/** 달의 나크샤트라 진행도에서 다샤 순서를 만든다 */
function vimshottari(moonSidereal, birthYearFraction) {
  const nak = Math.floor(moonSidereal / NAK_SPAN);
  const lord = NAKSHATRA_LORDS[nak];
  const progressed = (moonSidereal % NAK_SPAN) / NAK_SPAN;

  const start = DASHA_ORDER.indexOf(lord);
  const list = [];
  // 태어날 때 이미 지나간 몫을 뺀 나머지부터 시작한다
  let age = -progressed * DASHA_YEARS[lord];
  for (let i = 0; i < 10; i++) {
    const L = DASHA_ORDER[(start + i) % 9];
    const span = DASHA_YEARS[L];
    list.push({ lord: L, fromAge: age, toAge: age + span });
    age += span;
  }
  return { nak, lord, progressed, balance: (1 - progressed) * DASHA_YEARS[lord], list };
}

export function analyze(input) {
  const { jdUT, place, timeKnown, age } = input;

  const trop = planetPositions(jdUT);
  const ayan = lahiriAyanamsa(jdUT);

  // 모든 천체를 항성 좌표로 옮긴다
  const sid = {};
  for (const n of PLANET_ORDER) {
    sid[n] = { ...trop[n], lon: toSidereal(trop[n].lon, jdUT) };
  }

  const h = houses(jdUT, place.lat, place.lon);
  const lagnaLon = toSidereal(h.asc, jdUT);
  const lagna = Math.floor(lagnaLon / 30);

  // 온별자리 하우스 — 라그나가 든 별자리가 통째로 1하우스
  const bhavaOf = (lon) => ((Math.floor(lon / 30) - lagna + 12) % 12) + 1;

  const moonSign = Math.floor(sid.달.lon / 30);
  const sunSign = Math.floor(sid.태양.lon / 30);

  const d = vimshottari(sid.달.lon, 0);
  const current = d.list.find((x) => age >= x.fromAge && age < x.toAge) ?? d.list[0];
  const next = d.list[d.list.indexOf(current) + 1];

  const facts = [
    { label: '찬드라 라시', value: `${RASHI[moonSign].name} (${RASHI[moonSign].kr})`,
      note: '달의 자리 — 베딕에서 가장 중요하게 본다' },
    { label: '수르야 라시', value: `${RASHI[sunSign].name} (${RASHI[sunSign].kr})`,
      note: '태양의 자리' },
    ...(timeKnown ? [{
      label: '라그나', value: `${RASHI[lagna].name} (${RASHI[lagna].kr})`,
      note: `상승점 ${(lagnaLon % 30).toFixed(1)}° · 1하우스`,
    }] : []),
    // 값 자리에 지배 행성이 들어가 있어서 '나크샤트라 — 수성'처럼 읽혔다.
    // 수성은 칸의 이름이 아니라 그 칸을 다스리는 별이다.
    // 한자 이름을 괄호로 붙이면 같은 것의 다른 표기처럼 읽힌다. 27수와
    // 나크샤트라는 서로 대응시키는 별개 체계라 여기서는 베딕 이름만 쓴다.
    { label: '나크샤트라', value: NAKSHATRA_NAMES[d.nak].sanskrit,
      note: `제${d.nak + 1} 나크샤트라 · 지배 행성 ${NAKSHATRA_LORDS[d.nak]} · 제${Math.floor(d.progressed * 4) + 1}파다` },
    { label: '아야남샤', value: `${ayan.toFixed(3)}°`, note: '라히리 · 회귀 좌표와의 차이' },
    { label: '현재 다샤', value: `${current.lord} 다샤`,
      note: `${Math.max(0, current.fromAge).toFixed(1)}세 ~ ${current.toAge.toFixed(1)}세` },
  ];

  for (const n of PLANET_ORDER.slice(0, 10)) {
    const s = Math.floor(sid[n].lon / 30);
    facts.push({
      label: n,
      value: `${RASHI[s].name} ${(sid[n].lon % 30).toFixed(1)}°${sid[n].retrograde ? ' ℞' : ''}`,
      note: timeKnown ? `${bhavaOf(sid[n].lon)}하우스 (${BHAVA[bhavaOf(sid[n].lon)][0]})` : '',
    });
  }

  const readings = [
    {
      title: `찬드라 라시 — ${RASHI[moonSign].name}`,
      text: `베딕은 태양보다 달을 앞세웁니다. 달이 든 자리가 그 사람의 마음이 놓이는 곳이기 때문입니다. ${RASHI[moonSign].text}`,
    },
    {
      title: `수르야 라시 — ${RASHI[sunSign].name}`,
      text: `서양 점성술로 보던 태양 별자리와 다를 겁니다. 세차 때문에 두 좌표가 ${ayan.toFixed(1)}도 어긋나 있어서, 대부분 한 칸 앞 별자리로 밀립니다. 틀린 게 아니라 기준이 다른 것입니다. ${RASHI[sunSign].text}`,
    },
  ];

  if (timeKnown) {
    readings.push({
      title: `라그나 — ${RASHI[lagna].name}`,
      text: `태어난 순간 동쪽 지평선에 떠오르던 별자리입니다. 몸과 기질, 삶 전체의 바탕이 여기서 정해집니다. ${RASHI[lagna].text} 이 별자리의 주인인 ${j(RASHI[lagna].lord, '이')} 이 사람 차트의 열쇠가 됩니다.`,
    });
  }

  readings.push({
    title: `지금은 ${current.lord} 다샤`,
    text: `${DASHA_TEXT[current.lord]}` +
      (next ? ` ${next.toAge > 0 ? `${next.fromAge.toFixed(0)}세부터는 ${next.lord} 다샤로 넘어갑니다.` : ''}` : ''),
  });

  readings.push({
    title: '다가올 흐름',
    text: d.list
      .filter((x) => x.toAge > age && x.fromAge < age + 45)
      .slice(0, 4)
      .map((x) => `${Math.max(0, x.fromAge).toFixed(0)}~${x.toAge.toFixed(0)}세 ${x.lord}`)
      .join('  ·  ') + '\n빔쇼타리는 120년을 아홉 행성이 나눠 갖는 구조라, 한 사람이 평생 겪는 순서가 태어날 때 이미 정해집니다.',
  });

  // ── 종합용 지표 ──
  const elCount = { 불: 0, 흙: 0, 공기: 0, 물: 0 };
  for (const n of ['태양', '달', '수성', '금성', '화성', '목성', '토성']) {
    elCount[RASHI[Math.floor(sid[n].lon / 30)].el]++;
  }
  const elements = [0, 0, 0, 0, 0];
  for (const [el, n] of Object.entries(elCount)) {
    WESTERN_TO_OHAENG[el].forEach((v, i) => { elements[i] += v * n; });
  }

  const base = timeKnown ? lagna : moonSign;
  return result({
    id: meta.id,
    name: meta.name,
    hanja: meta.hanja,
    headline: `찬드라 ${RASHI[moonSign].name} · ${timeKnown ? `라그나 ${RASHI[lagna].name} · ` : ''}${current.lord} 다샤`,
    facts,
    readings,
    confidence: timeKnown ? 1 : 0.6,
    signals: {
      elements,
      traits: {
        주도: RASHI[base].el === '불' ? 0.5 : 0,
        외향: RASHI[base].el === '공기' ? 0.5 : 0,
        감성: RASHI[base].el === '물' ? 0.6 : 0,
        안정: RASHI[base].el === '흙' ? 0.6 : 0,
        실리: RASHI[base].el === '흙' ? 0.4 : 0,
      },
      domains: { 재물: null, 관계: null, 직업: null, 건강: null, 학업: null },
      tags: [...new Set([...EL_TAGS[RASHI[moonSign].el], ...EL_TAGS[RASHI[base].el]])],
      keywords: [RASHI[moonSign].name, `${current.lord} 다샤`],
    },
  });
}

// ─────────────────────────────────────────────────────────────
// 궁합 — 아쉬타쿠타 (Ashtakoota)
//
// 인도에서 혼담이 오갈 때 실제로 맞춰보는 방식이다. 여덟 항목에
// 배점이 다르게 매겨져 있고 합이 36점이다. 18점이 기준선, 24점 이상이면
// 좋게 보고, 나디가 0점이면 다른 점수가 높아도 따로 짚고 넘어간다.
//
// 두 사람의 달이 어느 별자리 어느 나크샤트라에 있었는지만 있으면
// 나머지는 전부 표에서 나온다. 그래서 출생 시각을 몰라도 대체로 성립한다.
// ─────────────────────────────────────────────────────────────

/** 나크샤트라별 요니(동물)와 성별 */
const YONI = [
  ['말', 'M'], ['코끼리', 'M'], ['양', 'F'], ['뱀', 'M'], ['뱀', 'F'],
  ['개', 'F'], ['고양이', 'F'], ['양', 'M'], ['고양이', 'M'], ['쥐', 'M'],
  ['쥐', 'F'], ['소', 'M'], ['물소', 'F'], ['호랑이', 'F'], ['물소', 'M'],
  ['호랑이', 'M'], ['사슴', 'F'], ['사슴', 'M'], ['개', 'M'], ['원숭이', 'M'],
  ['몽구스', 'F'], ['원숭이', 'F'], ['사자', 'F'], ['말', 'F'], ['사자', 'M'],
  ['소', 'F'], ['코끼리', 'F'],
];
/** 천적 — 마주치면 요니 점수가 바닥난다 */
const YONI_ENEMY = [
  ['소', '호랑이'], ['코끼리', '사자'], ['말', '물소'],
  ['개', '사슴'], ['뱀', '몽구스'], ['고양이', '쥐'], ['원숭이', '양'],
];

/** 가나 — 신족·인간족·나찰족의 기질 */
const GANA = [
  '데바', '마누샤', '락샤사', '마누샤', '데바', '마누샤', '데바', '데바', '락샤사',
  '락샤사', '마누샤', '마누샤', '데바', '락샤사', '데바', '락샤사', '데바', '락샤사',
  '락샤사', '마누샤', '마누샤', '데바', '락샤사', '락샤사', '마누샤', '마누샤', '데바',
];

/** 나디 — 체질. 같으면 0점이라 여덟 중 가장 무겁다 */
const NADI = [
  '아디', '마드야', '안트야', '안트야', '마드야', '아디', '아디', '마드야', '안트야',
  '안트야', '마드야', '아디', '아디', '마드야', '안트야', '안트야', '마드야', '아디',
  '아디', '마드야', '안트야', '안트야', '마드야', '아디', '아디', '마드야', '안트야',
];

/** 라시의 주인 행성 */
const RASHI_LORD = ['화성', '금성', '수성', '달', '태양', '수성',
                    '금성', '화성', '목성', '토성', '토성', '목성'];

const FRIENDS = {
  태양: ['달', '화성', '목성'], 달: ['태양', '수성'],
  화성: ['태양', '달', '목성'], 수성: ['태양', '금성'],
  목성: ['태양', '달', '화성'], 금성: ['수성', '토성'], 토성: ['수성', '금성'],
};
const ENEMIES = {
  태양: ['금성', '토성'], 달: [],
  화성: ['수성'], 수성: ['달'],
  목성: ['수성', '금성'], 금성: ['태양', '달'], 토성: ['태양', '달', '화성'],
};
const planetRelation = (a, b) =>
  FRIENDS[a]?.includes(b) ? 1 : ENEMIES[a]?.includes(b) ? -1 : 0;

/** 바르나 — 라시의 원소에서 나온다 */
const VARNA_RANK = { 물: 4, 불: 3, 흙: 2, 공기: 1 };
const VARNA_NAME = { 4: '브라흐민', 3: '크샤트리아', 2: '바이샤', 1: '수드라' };
/** 바샤 — 서로 끌어당기는 힘의 무리 */
const VASHYA_GROUP = ['사족', '사족', '인간', '수생', '야생', '인간',
                      '인간', '곤충', '사족', '사족', '인간', '수생'];

const NAK = 360 / 27;

/**
 * @param {number} moonA 첫 번째 사람의 항성 달 황경
 * @param {number} moonB 두 번째 사람
 * @param {boolean} aIsGroom 첫 번째 사람이 남자 쪽인가.
 *   바르나와 가나는 방향이 있는 항목이라 누가 신랑 자리인지에 따라 점수가 달라진다.
 */
function ashtakoota(moonA, moonB, aIsGroom) {
  const nA = Math.floor(moonA / NAK), nB = Math.floor(moonB / NAK);
  const rA = Math.floor(moonA / 30), rB = Math.floor(moonB / 30);
  // 방향이 있는 항목을 위해 신랑·신부 자리를 따로 잡아둔다
  const [nG, nBr] = aIsGroom ? [nA, nB] : [nB, nA];
  const [rG, rBr] = aIsGroom ? [rA, rB] : [rB, rA];
  const items = [];

  // 1. 바르나 (1점) — 신랑의 바르나가 신부보다 낮지 않아야 한다
  const vG = VARNA_RANK[RASHI[rG].el], vBr = VARNA_RANK[RASHI[rBr].el];
  items.push({ name: '바르나', max: 1, score: vG >= vBr ? 1 : 0,
    detail: `${VARNA_NAME[VARNA_RANK[RASHI[rA].el]]} / ${VARNA_NAME[VARNA_RANK[RASHI[rB].el]]}`,
    note: '삶을 대하는 기본 결. 신랑 쪽이 낮으면 점수가 없다' });

  // 2. 바샤 (2점)
  const gA = VASHYA_GROUP[rA], gB = VASHYA_GROUP[rB];
  const tame = ['사족', '인간', '수생'];
  items.push({ name: '바샤', max: 2,
    score: gA === gB ? 2 : (tame.includes(gA) && tame.includes(gB)) ? 1 : 0,
    detail: `${gA} / ${gB}`, note: '서로를 끌어당기고 기꺼이 맞춰주는 힘' });

  // 3. 타라 (3점) — 방향마다 따로 본다
  const bad = [3, 5, 7];
  const t1 = (((nB - nA + 27) % 27) + 1) % 9;
  const t2 = (((nA - nB + 27) % 27) + 1) % 9;
  const ok1 = !bad.includes(t1), ok2 = !bad.includes(t2);
  items.push({ name: '타라', max: 3, score: (ok1 ? 1.5 : 0) + (ok2 ? 1.5 : 0),
    detail: `${ok1 ? '순' : '역'} / ${ok2 ? '순' : '역'}`,
    note: '상대의 별이 나에게 순한가 거친가' });

  // 4. 요니 (4점)
  const [yA, sA] = YONI[nA], [yB, sB] = YONI[nB];
  const enemy = YONI_ENEMY.some(([x, y]) => (x === yA && y === yB) || (y === yA && x === yB));
  items.push({ name: '요니', max: 4,
    score: yA === yB ? (sA === sB ? 3 : 4) : enemy ? 0 : 2,
    detail: `${yA} / ${yB}`, note: '몸의 결과 본능. 천적끼리면 점수가 없다' });

  // 5. 그라하 마이트리 (5점)
  const lA = RASHI_LORD[rA], lB = RASHI_LORD[rB];
  const sum = planetRelation(lA, lB) + planetRelation(lB, lA);
  items.push({ name: '그라하 마이트리', max: 5,
    score: lA === lB || sum === 2 ? 5 : sum === 1 ? 4 : sum === 0 ? 3 : sum === -1 ? 1 : 0,
    detail: `${lA} / ${lB}`, note: '두 사람을 다스리는 행성끼리의 사이. 정신적 궁합' });

  // 6. 가나 (6점) — 신랑 기질 → 신부 기질 방향으로 본다
  const gnG = GANA[nG], gnBr = GANA[nBr];
  let gana;
  if (gnG === gnBr) gana = 6;
  else if (gnG === '데바' && gnBr === '락샤사') gana = 1;
  else if (gnG === '락샤사' && gnBr === '데바') gana = 0;
  else if (gnG === '마누샤' && gnBr === '락샤사') gana = 0;
  else if (gnG === '락샤사' && gnBr === '마누샤') gana = 3;
  else gana = 5;
  items.push({ name: '가나', max: 6, score: gana, detail: `${GANA[nA]} / ${GANA[nB]}`,
    note: '타고난 기질. 신랑에서 신부 방향으로 보기 때문에 순서가 바뀌면 점수도 바뀐다' });

  // 7. 바쿠트 (7점)
  const d1 = ((rB - rA + 12) % 12) + 1;
  const d2 = ((rA - rB + 12) % 12) + 1;
  const pair = [d1, d2].sort((x, y) => x - y).join('-');
  items.push({ name: '바쿠트', max: 7, score: ['6-8', '5-9', '2-12'].includes(pair) ? 0 : 7,
    detail: `${d1}–${d2}`, note: '두 달자리 사이의 거리. 6-8·5-9·2-12는 살림이 고단해진다고 본다' });

  // 8. 나디 (8점)
  items.push({ name: '나디', max: 8, score: NADI[nA] === NADI[nB] ? 0 : 8,
    detail: `${NADI[nA]} / ${NADI[nB]}`,
    note: '체질. 같으면 0점이고 여덟 중 가장 무겁게 본다' });

  return { items, total: items.reduce((a, x) => a + x.score, 0), nA, nB, rA, rB };
}

/** 두 사람의 베딕 궁합 */
export function compare(a, b) {
  const moonA = toSidereal(planetPositions(a.jdUT).달.lon, a.jdUT);
  const moonB = toSidereal(planetPositions(b.jdUT).달.lon, b.jdUT);
  // 성별이 갈리면 남자 쪽을 신랑 자리로 놓는다. 같으면 입력 순서를 따른다.
  const sameGender = a.isMale === b.isMale;
  const aIsGroom = sameGender ? true : a.isMale;
  const k = ashtakoota(moonA, moonB, aIsGroom);

  const verdict = k.total >= 28 ? '아주 좋음'
    : k.total >= 24 ? '좋음'
    : k.total >= 18 ? '무난'
    : k.total >= 12 ? '주의' : '어려움';

  const nadi = k.items.find((x) => x.name === '나디');
  const bhakoot = k.items.find((x) => x.name === '바쿠트');
  const strong = k.items.filter((x) => x.score === x.max);
  const weak = k.items.filter((x) => x.score < x.max * 0.5);

  const readings = [
    {
      title: `아쉬타쿠타 ${k.total} / 36점 — ${verdict}`,
      text: '인도에서 혼담이 오갈 때 실제로 맞춰보는 여덟 항목입니다. 18점이 기준선이고 24점 이상이면 좋게 봅니다. ' +
        (k.total >= 24
          ? '항목 대부분이 맞물려 있습니다. 크게 어긋나는 지점 없이 오래 갈 수 있는 조합입니다.'
          : k.total >= 18
          ? '기준선은 넘었습니다. 맞는 부분과 안 맞는 부분이 섞여 있으니 아래에서 어디가 약한지 보세요.'
          : '점수가 낮게 나왔습니다. 다만 아쉬타쿠타는 결혼을 전제로 만든 잣대라 항목이 까다롭습니다. 다른 체계의 결과와 함께 보시는 편이 낫습니다.'),
    },
    {
      title: '항목별 점수', mono: true,
      text: k.items.map((x) =>
        `${x.name.padEnd(9, ' ')}${String(x.score).padStart(5)} / ${x.max}   ${x.detail}`
      ).join('\n'),
    },
  ];

  if (strong.length) {
    readings.push({ title: '가장 잘 맞는 지점',
      text: strong.map((x) => `${x.name} — ${x.note}`).join('\n') });
  }
  if (weak.length) {
    readings.push({ title: '약한 지점',
      text: weak.map((x) => `${x.name} (${x.score}/${x.max}) — ${x.note}`).join('\n') });
  }
  if (nadi.score === 0) {
    readings.push({
      title: '나디가 0점입니다',
      text: '두 사람의 체질(나디)이 같습니다. 아쉬타쿠타에서 가장 무겁게 보는 항목이라 전통적으로는 다른 점수가 높아도 따로 짚고 넘어갑니다. 기질이 너무 닮아 서로의 약점까지 겹친다는 뜻으로 읽으면 실용적입니다.',
    });
  }
  if (bhakoot.score === 0) {
    readings.push({
      title: '바쿠트가 0점입니다',
      text: `두 사람의 달자리가 ${bhakoot.detail} 관계에 놓였습니다. 서로를 싫어한다는 뜻이 아니라, 생활의 리듬과 돈이 도는 속도가 어긋나기 쉽다는 쪽에 가깝습니다.`,
    });
  }

  readings.push({
    title: '이 점수를 어떻게 읽을 것인가',
    text: '아쉬타쿠타는 여덟 항목 가운데 셋(나디 8점, 바쿠트 7점, 가나 6점)이 전체의 절반을 넘게 차지합니다. ' +
      '이 셋은 조건을 못 맞추면 부분 점수 없이 0점이라, 한 번 걸리면 총점이 뚝 떨어지는 구조입니다. ' +
      '점수가 낮게 나왔다고 해서 나머지 일곱 항목이 다 나쁘다는 뜻은 아니니, 총점보다 항목별 표를 보시는 편이 실제로 쓸모가 있습니다.\n\n' +
      (sameGender
        ? '바르나와 가나는 원래 신랑에서 신부 방향으로 보는 항목입니다. 두 분의 성별이 같아 입력하신 순서를 그대로 썼습니다.'
        : '바르나와 가나는 방향이 있는 항목이라, 남자 쪽을 신랑 자리에 놓고 계산했습니다.'),
  });

  return {
    id: meta.id, name: meta.name,
    score: Math.round((k.total / 36) * 100),
    verdict,
    headline: `아쉬타쿠타 ${k.total}/36 · ${verdict}`,
    facts: [
      { label: '달자리', value: `${RASHI[k.rA].name} / ${RASHI[k.rB].name}`, note: '두 사람의 찬드라 라시' },
      ...k.items.map((x) => ({ label: x.name, value: `${x.score} / ${x.max}`, note: x.detail })),
    ],
    readings,
  };
}

// ─────────────────────────────────────────────────────────────
// 시기 운세
// ─────────────────────────────────────────────────────────────
// 다샤(큰 시기)와 타라(그날 달의 자리)를 함께 본다.

const DASHA_AREA = {
  케투: { 총운: -4, 금전운: -6, 학업운: 6, 건강운: -4, 애정운: -6, 직장운: 0 },
  금성: { 총운: 8, 애정운: 14, 금전운: 8, 건강운: 4, 직장운: 2, 학업운: 2 },
  태양: { 총운: 6, 직장운: 12, 건강운: 4, 애정운: 0, 금전운: 2, 학업운: 4 },
  달: { 총운: 4, 애정운: 8, 건강운: 6, 금전운: 2, 직장운: 0, 학업운: 2 },
  화성: { 총운: -2, 직장운: 9, 건강운: -9, 금전운: 4, 애정운: -2, 학업운: 0 },
  라후: { 총운: 0, 금전운: 7, 직장운: 6, 건강운: -6, 애정운: -4, 학업운: 4 },
  목성: { 총운: 11, 금전운: 9, 학업운: 12, 애정운: 6, 직장운: 6, 건강운: 6 },
  토성: { 총운: -7, 금전운: -4, 직장운: 5, 건강운: -8, 애정운: -5, 학업운: 3 },
  수성: { 총운: 5, 학업운: 12, 직장운: 7, 금전운: 6, 애정운: 2, 건강운: 2 },
};

export function forecast(input, chart, period) {
  const natalMoon = toSidereal(planetPositions(input.jdUT).달.lon, input.jdUT);
  const nowMoon = toSidereal(planetPositions(period.jd).달.lon, period.jd);
  const nA = Math.floor(natalMoon / (360 / 27));
  const nB = Math.floor(nowMoon / (360 / 27));

  const d = vimshottari(natalMoon, 0);
  const cur = d.list.find((x) => input.age >= x.fromAge && input.age < x.toAge) ?? d.list[0];
  const eff = DASHA_AREA[cur.lord] ?? {};

  // 타라 — 본명 나크샤트라에서 오늘 달까지 세어 아홉으로 나눈 나머지
  const tara = (((nB - nA + 27) % 27) + 1) % 9;
  const TARA_NAME = ['파라마 미트라', '잔마', '삼파트', '비파트', '크셰마', '프라티아리', '사다카', '바다', '미트라'];
  const badTara = [3, 5, 7].includes(tara);

  const areas = {};
  for (const a of ['총운', '애정운', '금전운', '직장운', '학업운', '건강운']) {
    areas[a] = Math.max(8, Math.min(94, Math.round(50 + (eff[a] ?? 0) + (badTara ? -7 : 5))));
  }

  return {
    id: meta.id, name: meta.name, weight: 1.1,
    headline: `${cur.lord} 다샤 · 타라 ${TARA_NAME[tara]}`,
    text: `큰 시기로는 ${cur.lord} 다샤 안에 있습니다. ` +
      (badTara
        ? `이 시기 달의 자리가 본명 나크샤트라에서 거친 쪽(${TARA_NAME[tara]})에 떨어져, 무리한 시도는 미루는 편이 낫습니다.`
        : `이 시기 달의 자리가 본명 나크샤트라에서 순한 쪽(${TARA_NAME[tara]})에 떨어집니다.`),
    areas,
  };
}

export default { meta, analyze, compare , forecast };
