/**
 * astrology.js — 서양 점성술
 *
 * 태어난 순간 하늘의 열 천체가 어느 별자리 어느 하우스에 있었는지,
 * 그리고 서로 어떤 각을 이루었는지로 읽는다.
 *
 * 회귀(트로피컬) 황도를 쓴다. 춘분점이 늘 양자리 0도다.
 * 하우스는 플라시두스, 고위도에서만 등분으로 물러선다.
 */

import { planetPositions, houses, houseOf, PLANET_ORDER } from '../core/planets.js';
import { j } from '../core/josa.js';
import { result, WESTERN_TO_OHAENG } from './_base.js';

export const meta = {
  id: 'astrology',
  name: '점성술',
  hanja: 'Astrology',
  desc: '태어난 순간의 하늘을 그려 기질과 삶의 무대를 본다',
  needsTime: true,
  needsPlace: true,
};

export const SIGNS = [
  { name: '양자리', en: 'Aries', el: '불', mode: '활동', ruler: '화성',
    text: '먼저 움직이고 나중에 생각하는 자리입니다. 시작하는 힘이 강하고 경쟁에서 살아납니다. 오래 끄는 일에는 금세 흥미를 잃습니다.',
    traits: { 주도: 0.8, 외향: 0.5, 안정: -0.4 }, tags: ['주도', '실행'] },
  { name: '황소자리', en: 'Taurus', el: '흙', mode: '고정', ruler: '금성',
    text: '감각이 확실한 것을 신뢰합니다. 한번 자리를 잡으면 잘 움직이지 않고, 그 뚝심으로 쌓아 올립니다. 변화를 강요받을 때 가장 크게 저항합니다.',
    traits: { 안정: 0.8, 실리: 0.7, 감성: 0.2 }, tags: ['안정', '재물'] },
  { name: '쌍둥이자리', en: 'Gemini', el: '공기', mode: '변통', ruler: '수성',
    text: '말과 정보로 사는 자리입니다. 습득이 빠르고 여러 갈래를 동시에 다룹니다. 깊이보다 넓이로 가는 대신 지루함을 못 견딥니다.',
    traits: { 외향: 0.7, 감성: -0.2, 안정: -0.6 }, tags: ['표현', '학습'] },
  { name: '게자리', en: 'Cancer', el: '물', mode: '활동', ruler: '달',
    text: '안쪽을 지키는 자리입니다. 내 사람과 바깥 사람의 경계가 뚜렷하고, 안에 들인 쪽은 끝까지 챙깁니다. 상처를 오래 기억합니다.',
    traits: { 감성: 0.8, 안정: 0.4, 외향: -0.3 }, tags: ['돌봄', '감수성'] },
  { name: '사자자리', en: 'Leo', el: '불', mode: '고정', ruler: '태양',
    text: '드러나는 자리입니다. 무대에 섰을 때 가장 자기답고, 인정이 곧 연료입니다. 관대하지만 자존심이 판단을 가릴 때가 있습니다.',
    traits: { 주도: 0.7, 외향: 0.8, 감성: 0.3 }, tags: ['명예', '표현'] },
  { name: '처녀자리', en: 'Virgo', el: '흙', mode: '변통', ruler: '수성',
    text: '다듬는 자리입니다. 어긋난 것이 먼저 눈에 들어오고 그냥 지나치지 못합니다. 실무에서 가장 믿음직하지만 자기 기준으로 스스로를 깎습니다.',
    traits: { 실리: 0.7, 감성: -0.3, 안정: 0.3 }, tags: ['분석', '완벽'] },
  { name: '천칭자리', en: 'Libra', el: '공기', mode: '활동', ruler: '금성',
    text: '균형을 재는 자리입니다. 관계 속에서 자기를 확인하고 조율에 능합니다. 모두를 맞추다 정작 자기 결정을 미룹니다.',
    traits: { 외향: 0.6, 감성: 0.3, 주도: -0.2 }, tags: ['사교', '분석'] },
  { name: '전갈자리', en: 'Scorpio', el: '물', mode: '고정', ruler: '명왕성',
    text: '끝까지 파고드는 자리입니다. 표면에 만족하지 않고 밑바닥을 봅니다. 한번 집중하면 무섭게 가지만 놓아주는 법을 배워야 합니다.',
    traits: { 감성: 0.8, 주도: 0.5, 외향: -0.4 }, tags: ['직관', '결단'] },
  { name: '사수자리', en: 'Sagittarius', el: '불', mode: '변통', ruler: '목성',
    text: '넓히는 자리입니다. 멀리 가고 크게 봅니다. 낙천적이고 사람을 끌지만 세부를 놓치고 약속을 가볍게 볼 때가 있습니다.',
    traits: { 외향: 0.7, 주도: 0.4, 안정: -0.6 }, tags: ['자유', '학습'] },
  { name: '염소자리', en: 'Capricorn', el: '흙', mode: '활동', ruler: '토성',
    text: '올라가는 자리입니다. 목표와 시간표가 분명하고 오래 참습니다. 결과로 말하는 대신 스스로에게 가혹합니다.',
    traits: { 주도: 0.6, 실리: 0.7, 안정: 0.5, 감성: -0.3 }, tags: ['책임', '인내'] },
  { name: '물병자리', en: 'Aquarius', el: '공기', mode: '고정', ruler: '천왕성',
    text: '거리를 두고 보는 자리입니다. 통념을 의심하고 자기 방식을 고집합니다. 무리 안에 있어도 혼자인 감각이 있습니다.',
    traits: { 주도: 0.3, 감성: -0.4, 안정: -0.3 }, tags: ['독립', '변화'] },
  { name: '물고기자리', en: 'Pisces', el: '물', mode: '변통', ruler: '해왕성',
    text: '경계가 옅은 자리입니다. 남의 감정이 그대로 넘어와 잘 알아채고 잘 지칩니다. 상상과 공감이 재능이자 소모입니다.',
    traits: { 감성: 0.9, 외향: -0.2, 안정: -0.4 }, tags: ['감수성', '직관'] },
];

export const HOUSES = [
  null,
  ['1하우스 · 자기', '겉으로 드러나는 모습과 첫인상, 몸을 쓰는 방식'],
  ['2하우스 · 소유', '돈을 버는 방식과 스스로 가치 있다고 여기는 것'],
  ['3하우스 · 소통', '말·글·이동, 가까운 사람들과 주고받는 일'],
  ['4하우스 · 뿌리', '집과 가족, 마음이 돌아가 쉬는 자리'],
  ['5하우스 · 표현', '창작·연애·자식, 재미로 하는 일'],
  ['6하우스 · 일상', '매일의 노동과 건강, 몸을 굴리는 방식'],
  ['7하우스 · 관계', '짝과 동업자, 일대일로 마주 서는 사람'],
  ['8하우스 · 공유', '남의 돈과 깊은 결속, 위기와 변형'],
  ['9하우스 · 확장', '멀리 가는 것 — 유학·종교·철학·장거리'],
  ['10하우스 · 사회', '직업과 평판, 세상이 부르는 이름'],
  ['11하우스 · 동료', '친구와 집단, 앞으로 이루고 싶은 것'],
  ['12하우스 · 이면', '혼자만의 자리, 무의식과 놓아주는 일'],
];

const PLANET_MEANING = {
  태양: '핵심 자아 — 내가 되려는 것',
  달: '감정과 본능 — 편안해지는 조건',
  수성: '생각과 말 — 정보를 다루는 방식',
  금성: '애정과 취향 — 끌리는 것',
  화성: '의지와 충동 — 싸우는 방식',
  목성: '확장과 행운 — 넉넉해지는 자리',
  토성: '제약과 책임 — 시간을 들여야 얻는 것',
  천왕성: '독립과 급변 — 틀을 깨는 지점',
  해왕성: '이상과 용해 — 경계가 흐려지는 곳',
  명왕성: '심층과 재생 — 무너지고 다시 나는 힘',
  라후: '이번 생의 과제 — 낯설지만 가야 할 방향',
  케투: '이미 익숙한 것 — 놓아야 할 관성',
};

export const ASPECTS = [
  { name: '합', en: 'conjunction', angle: 0, orb: 8, tone: 0,
    text: '두 힘이 한 몸처럼 붙어 있습니다. 구분되지 않아 늘 함께 작동합니다.' },
  { name: '육각', en: 'sextile', angle: 60, orb: 4, tone: 1,
    text: '서로 도와주는 사이입니다. 쓰려고 마음먹으면 쉽게 열립니다.' },
  { name: '사각', en: 'square', angle: 90, orb: 7, tone: -1,
    text: '서로 부딪칩니다. 긴장이 있는 만큼 실제로 무언가를 만들어내는 각입니다.' },
  { name: '삼각', en: 'trine', angle: 120, orb: 7, tone: 1,
    text: '가장 매끄럽게 흐르는 각입니다. 타고난 재능이지만 너무 쉬워 게을러지기도 합니다.' },
  { name: '대각', en: 'opposition', angle: 180, orb: 8, tone: -1,
    text: '정면으로 마주 봅니다. 둘 중 하나를 버리는 게 아니라 오가는 법을 익혀야 합니다.' },
];

const MAJOR = ['태양', '달', '수성', '금성', '화성', '목성', '토성'];

export const signOf = (lon) => Math.floor(lon / 30);
export const degInSign = (lon) => lon % 30;

/** 두 천체 사이에 성립하는 각을 찾는다 */
export function findAspect(a, b) {
  const sep = Math.abs(((a - b + 540) % 360) - 180);
  for (const asp of ASPECTS) {
    const diff = Math.abs(sep - asp.angle);
    if (diff <= asp.orb) return { ...asp, orbUsed: diff, exact: diff < 1 };
  }
  return null;
}

export function analyze(input) {
  const { jdUT, place, timeKnown } = input;

  const pos = planetPositions(jdUT);
  const h = houses(jdUT, place.lat, place.lon);

  const sun = signOf(pos.태양.lon);
  const moon = signOf(pos.달.lon);
  const asc = signOf(h.asc);

  // 원소·성질 균형 — 주요 천체 일곱에 상승점을 더해 센다
  const elCount = { 불: 0, 흙: 0, 공기: 0, 물: 0 };
  const modeCount = { 활동: 0, 고정: 0, 변통: 0 };
  for (const n of MAJOR) {
    const s = SIGNS[signOf(pos[n].lon)];
    elCount[s.el]++; modeCount[s.mode]++;
  }
  if (timeKnown) { elCount[SIGNS[asc].el]++; modeCount[SIGNS[asc].mode]++; }

  // 동률을 그냥 정렬해서 첫 번째만 집으면 "흙3 공기3 → 흙 우세"처럼
  // 바로 옆의 숫자와 어긋나는 문장이 나온다. 같은 값은 같이 말한다.
  const tops = (obj) => {
    const max = Math.max(...Object.values(obj));
    return Object.keys(obj).filter((k) => obj[k] === max);
  };
  const lows = (obj) => {
    const min = Math.min(...Object.values(obj));
    return { names: Object.keys(obj).filter((k) => obj[k] === min), value: min };
  };
  const topEls = tops(elCount);
  const lowEl = lows(elCount);
  const topModes = tops(modeCount);
  const word = (names) => `${names.join('·')} ${names.length > 1 ? '공동 우세' : '우세'}`;

  // 각 — 주요 천체끼리만, 오차가 작은 순서로
  const aspects = [];
  for (let i = 0; i < MAJOR.length; i++) {
    for (let j = i + 1; j < MAJOR.length; j++) {
      const a = findAspect(pos[MAJOR[i]].lon, pos[MAJOR[j]].lon);
      if (a) aspects.push({ from: MAJOR[i], to: MAJOR[j], ...a });
    }
  }
  aspects.sort((a, b) => a.orbUsed - b.orbUsed);

  const facts = [
    { label: '태양', value: `${SIGNS[sun].name} ${degInSign(pos.태양.lon).toFixed(1)}°`,
      note: timeKnown ? `${houseOf(pos.태양.lon, h.cusps)}하우스` : '하우스는 시간 필요' },
    { label: '달', value: `${SIGNS[moon].name} ${degInSign(pos.달.lon).toFixed(1)}°`,
      note: timeKnown ? `${houseOf(pos.달.lon, h.cusps)}하우스` : '하우스는 시간 필요' },
    ...(timeKnown ? [
      { label: '상승점', value: `${SIGNS[asc].name} ${degInSign(h.asc).toFixed(1)}°`, note: '겉으로 드러나는 나' },
      { label: '중천', value: `${SIGNS[signOf(h.mc)].name} ${degInSign(h.mc).toFixed(1)}°`, note: '사회적 목표점' },
    ] : []),
    { label: timeKnown ? '원소 (7행성+상승점)' : '원소 (7행성)', value: Object.entries(elCount).map(([k, v]) => `${k}${v}`).join(' '),
      note: `${word(topEls)}${lowEl.value === 0 ? ` · ${lowEl.names.join('·')} 없음` : ''}` },
    { label: timeKnown ? '성질 (7행성+상승점)' : '성질 (7행성)', value: Object.entries(modeCount).map(([k, v]) => `${k}${v}`).join(' '),
      note: `${word(topModes)}` },
    { label: '하우스 방식', value: h.system, note: timeKnown ? '' : '출생 시간 미상이라 참고용' },
  ];

  // 나머지 행성은 한 줄로 묶어 보여준다
  for (const n of PLANET_ORDER.slice(2)) {
    facts.push({
      label: n,
      value: `${SIGNS[signOf(pos[n].lon)].name} ${degInSign(pos[n].lon).toFixed(1)}°${pos[n].retrograde ? ' ℞' : ''}`,
      note: timeKnown ? `${houseOf(pos[n].lon, h.cusps)}하우스 · ${PLANET_MEANING[n]}` : PLANET_MEANING[n],
    });
  }

  const readings = [
    { title: `태양 — ${SIGNS[sun].name}`, text: `평생 되어 가려는 방향입니다. ${SIGNS[sun].text}` },
    { title: `달 — ${SIGNS[moon].name}`, text: `아무도 안 볼 때의 모습이자 편안해지는 조건입니다. ${SIGNS[moon].text}` },
  ];

  if (timeKnown) {
    readings.push({
      title: `상승점 — ${SIGNS[asc].name}`,
      text: `처음 만난 사람이 보는 얼굴입니다. 태양이 속이라면 상승점은 겉입니다. ${SIGNS[asc].text}`,
    });
    const sunHouse = houseOf(pos.태양.lon, h.cusps);
    readings.push({
      title: `삶의 주 무대 — ${HOUSES[sunHouse][0]}`,
      text: `태양이 ${sunHouse}하우스에 있습니다. 이 사람의 힘이 가장 잘 드러나는 영역은 ${HOUSES[sunHouse][1]}입니다.`,
    });
  }

  readings.push({
    title: `${topEls.join('·')}의 기운이 두텁습니다`,
    text: {
      불: '움직이고 나서 생각하는 쪽입니다. 열이 빨리 오르고 빨리 식으니 판을 벌인 뒤 지켜줄 사람이 필요합니다.',
      흙: '손에 잡히는 것으로 확인해야 하는 쪽입니다. 착실하게 쌓지만 변화가 필요한 국면에서 늦습니다.',
      공기: '생각과 말이 먼저인 쪽입니다. 연결하고 설명하는 데 강하고, 감정을 다루는 일은 뒤로 미룹니다.',
      물: '느낌으로 먼저 아는 쪽입니다. 공감이 깊은 만큼 남의 감정까지 떠안아 소진되기 쉽습니다.',
    }[topEls[0]] + (lowEl.value === 0
      ? ` 반대로 ${j(lowEl.names[0], '이')} 하나도 없습니다. ` + {
          불: '스스로 불을 붙이는 계기가 잘 안 생기니, 시작할 이유를 밖에서 빌려오는 편이 낫습니다.',
          흙: '현실로 내려앉히는 힘이 약합니다. 숫자와 마감으로 묶어두는 장치가 필요합니다.',
          공기: '한발 물러서서 보는 눈이 약합니다. 말로 꺼내 남에게 설명해보는 과정이 그 자리를 메웁니다.',
          물: '감정을 읽고 다루는 훈련이 덜 되어 있습니다. 논리로 안 풀리는 문제에서 막힙니다.',
        }[lowEl.names[0]]
      : ''),
  });

  readings.push({
    title: `${topModes.join('·')}의 성질이 강합니다`,
    text: {
      활동: '판을 여는 쪽입니다. 시작은 잘하는데 남이 시작한 일에 얹혀 가는 것을 답답해합니다.',
      고정: '붙들고 가는 쪽입니다. 지구력이 무기이고, 방향이 틀렸을 때 갈아타는 것이 가장 어렵습니다.',
      변통: '맞춰 가는 쪽입니다. 적응이 빠른 대신 중심을 어디에 둘지가 평생의 질문이 됩니다.',
    }[topModes[0]],
  });

  if (aspects.length) {
    readings.push({
      title: '가장 팽팽한 각들',
      text: aspects.slice(0, 4).map((a) =>
        `${a.from}–${a.to} ${a.name}(${a.orbUsed.toFixed(1)}°${a.exact ? ', 정각' : ''}): ${a.text}`
      ).join('\n'),
    });
  }

  // ── 종합용 지표 ──
  const elements = [0, 0, 0, 0, 0];
  for (const [el, n] of Object.entries(elCount)) {
    WESTERN_TO_OHAENG[el].forEach((v, i) => { elements[i] += v * n; });
  }

  const traits = {};
  for (const [k, v] of Object.entries(SIGNS[sun].traits)) traits[k] = (traits[k] ?? 0) + v * 0.5;
  for (const [k, v] of Object.entries(SIGNS[moon].traits)) traits[k] = (traits[k] ?? 0) + v * 0.3;
  if (timeKnown) for (const [k, v] of Object.entries(SIGNS[asc].traits)) traits[k] = (traits[k] ?? 0) + v * 0.2;

  // 하우스에 몇 개의 천체가 들었는지로 영역 점수를 매긴다
  const domains = { 재물: 50, 관계: 50, 직업: 50, 건강: 50, 학업: 50 };
  if (timeKnown) {
    const HOUSE_DOMAIN = { 2: '재물', 8: '재물', 7: '관계', 5: '관계', 10: '직업', 6: '건강', 9: '학업', 3: '학업' };
    for (const n of MAJOR) {
      const d = HOUSE_DOMAIN[houseOf(pos[n].lon, h.cusps)];
      if (d) domains[d] += 7;
    }
    for (const k of Object.keys(domains)) domains[k] = Math.min(92, domains[k]);
  }

  return result({
    id: meta.id,
    name: meta.name,
    hanja: meta.hanja,
    headline: `태양 ${SIGNS[sun].name} · 달 ${SIGNS[moon].name}${timeKnown ? ` · 상승 ${SIGNS[asc].name}` : ''}`,
    facts,
    readings,
    // 하우스와 상승점은 출생 시간이 없으면 아예 못 쓴다
    confidence: timeKnown ? 1 : 0.5,
    signals: {
      elements,
      traits,
      domains: timeKnown ? domains : { 재물: null, 관계: null, 직업: null, 건강: null, 학업: null },
      tags: [...new Set([...SIGNS[sun].tags, ...(timeKnown ? SIGNS[asc].tags : SIGNS[moon].tags)])],
      keywords: [SIGNS[sun].name, SIGNS[moon].name, topEls[0], topModes[0]],
    },
  });
}

// ─────────────────────────────────────────────────────────────
// 궁합 — 시너스트리 (Synastry)
//
// 두 사람의 차트를 겹쳐 놓고, 한쪽 천체가 다른 쪽 천체와 어떤 각을 이루는지 본다.
// 각이 붙은 자리마다 관계의 성질이 하나씩 정해진다.
//
// 짝마다 무게가 다르다. 태양–달은 오래 가는 관계에서 가장 중요하게 보고,
// 금성–화성은 끌림을, 토성이 얽힌 각은 무겁지만 잘 안 끊어지는 결속을 만든다.
// 사각과 대각이 무조건 나쁜 것은 아니다 — 긴장이 있어야 관계가 굴러가기도 한다.
// ─────────────────────────────────────────────────────────────

/** 볼 만한 짝과 그 무게 */
const SYNASTRY_PAIRS = [
  ['태양', '달', 3.0, '삶의 방향과 감정이 맞물리는가. 오래 가는 관계에서 가장 중요하게 보는 짝'],
  ['달', '달', 2.2, '감정의 리듬과 편안함의 기준이 비슷한가'],
  ['금성', '화성', 2.5, '서로 끌리는 힘. 연애의 온도를 만드는 짝'],
  ['태양', '금성', 2.0, '상대를 아끼고 좋아하는 방식'],
  ['달', '금성', 1.8, '다정함이 오가는 통로'],
  ['태양', '태양', 1.5, '기본 기질이 닮았는가'],
  ['금성', '금성', 1.3, '취향과 미감'],
  ['화성', '화성', 1.0, '싸우는 방식과 속도'],
  ['토성', '달', 1.5, '책임과 무게. 답답하지만 잘 안 끊어지게 만드는 자리'],
  ['토성', '태양', 1.2, '현실의 무게를 함께 지는 방식'],
];

/** 각의 성질 — 합은 붙은 천체가 무엇이냐에 따라 갈린다 */
function aspectTone(aspName, p1, p2) {
  if (aspName === '삼각' || aspName === '육각') return 1;
  if (aspName === '사각' || aspName === '대각') return -1;
  // 합
  if (p1 === '토성' || p2 === '토성') return -0.4;
  if (p1 === '화성' && p2 === '화성') return -0.2;
  return 1;
}

export function compare(a, b) {
  const pa = planetPositions(a.jdUT);
  const pb = planetPositions(b.jdUT);

  const hits = [];
  let weighted = 0, totalWeight = 0;

  for (const [p1, p2, w, why] of SYNASTRY_PAIRS) {
    // 방향이 두 가지다. A의 태양–B의 달, 그리고 A의 달–B의 태양.
    const dirs = p1 === p2
      ? [[a, b, pa[p1].lon, pb[p2].lon]]
      : [[a, b, pa[p1].lon, pb[p2].lon], [b, a, pb[p1].lon, pa[p2].lon]];

    for (const [x, y, l1, l2] of dirs) {
      totalWeight += w;
      const asp = findAspect(l1, l2);
      if (!asp) continue;
      const tone = aspectTone(asp.name, p1, p2);
      // 오차가 작을수록 세게 작동한다
      const tightness = 1 - asp.orbUsed / (asp.orb + 1);
      weighted += tone * w * tightness;
      hits.push({
        label: `${x.name}의 ${p1} — ${y.name}의 ${p2}`,
        asp: asp.name, orb: asp.orbUsed, tone, weight: w, why,
        strength: Math.abs(tone) * w * tightness,
      });
    }
  }

  hits.sort((x, y) => y.strength - x.strength);
  const score = Math.max(5, Math.min(95, Math.round(52 + (weighted / totalWeight) * 130)));

  const good = hits.filter((h) => h.tone > 0);
  const hard = hits.filter((h) => h.tone < 0);

  const sunA = SIGNS[signOf(pa.태양.lon)].name, moonA = SIGNS[signOf(pa.달.lon)].name;
  const sunB = SIGNS[signOf(pb.태양.lon)].name, moonB = SIGNS[signOf(pb.달.lon)].name;

  const facts = [
    { label: '태양', value: `${sunA} / ${sunB}`, note: '두 사람의 기본 기질' },
    { label: '달', value: `${moonA} / ${moonB}`, note: '감정이 놓이는 자리' },
    { label: '금성', value: `${SIGNS[signOf(pa.금성.lon)].name} / ${SIGNS[signOf(pb.금성.lon)].name}`, note: '애정 방식' },
    { label: '화성', value: `${SIGNS[signOf(pa.화성.lon)].name} / ${SIGNS[signOf(pb.화성.lon)].name}`, note: '추진과 충돌' },
    { label: '맞물린 각', value: `${hits.length}개`, note: `순한 각 ${good.length} · 팽팽한 각 ${hard.length}` },
  ];

  const readings = [];

  if (hits.length) {
    readings.push({
      title: '가장 세게 작동하는 각',
      text: hits.slice(0, 5).map((h) =>
        `${h.label}  ${h.asp} (오차 ${h.orb.toFixed(1)}°)\n   ${h.why}`
      ).join('\n\n'),
    });
  } else {
    readings.push({
      title: '주요 각이 거의 없습니다',
      text: '두 차트의 주요 천체 사이에 뚜렷한 각이 잡히지 않습니다. 서로를 강하게 끌어당기지도, 세게 부딪치지도 않는 배치입니다. 시너스트리에서는 이런 조합을 "각자 자기 삶을 살면서 나란히 가는 관계"로 읽습니다.',
    });
  }

  if (good.length && hard.length) {
    readings.push({
      title: '순한 각과 팽팽한 각이 함께 있습니다',
      text: `순하게 흐르는 각이 ${good.length}개, 긴장을 만드는 각이 ${hard.length}개입니다.\n\n` +
        '시너스트리에서 사각과 대각을 무조건 나쁘게 보지는 않습니다. 순한 각만 있는 관계는 편하지만 심심해서 오래 못 가는 경우가 많고, 긴장이 있어야 서로를 계속 의식하게 됩니다. ' +
        '문제는 긴장의 종류입니다. 토성이나 화성이 얽힌 각은 실제로 부딪치는 힘이라 반복해서 같은 문제로 다투게 됩니다.',
    });
  }

  const saturn = hits.filter((h) => h.label.includes('토성'));
  if (saturn.length) {
    readings.push({
      title: '토성이 걸려 있습니다',
      text: '토성이 상대의 태양이나 달에 각을 이루고 있습니다. 시너스트리에서 토성 각은 답답함과 책임감을 동시에 가져옵니다. 관계가 무겁게 느껴지지만 그만큼 쉽게 끊어지지 않습니다. 오래 가는 부부 차트에서 자주 발견되는 배치이기도 합니다.',
    });
  }

  return {
    id: meta.id, name: meta.name, score,
    weight: 1.2,
    headline: `순한 각 ${good.length} · 팽팽한 각 ${hard.length}`,
    facts, readings,
  };
}

// ─────────────────────────────────────────────────────────────
// 시기 운세
// ─────────────────────────────────────────────────────────────
// 트랜싯 — 지금 하늘의 행성이 출생 차트의 어디를 건드리는가.
// 서양 점성술에서 시기를 보는 정통 방식이다.

const TRANSIT_WEIGHT = {
  목성: { 총운: 10, 금전운: 10, 직장운: 6, 학업운: 6, 애정운: 4, 건강운: 4 },
  토성: { 총운: -8, 금전운: -5, 직장운: 4, 학업운: 3, 애정운: -5, 건강운: -10 },
  화성: { 총운: -2, 직장운: 8, 건강운: -8, 애정운: 3, 금전운: 0, 학업운: 0 },
  금성: { 애정운: 12, 총운: 5, 금전운: 6, 건강운: 2, 직장운: 2, 학업운: 0 },
  수성: { 학업운: 9, 직장운: 5, 총운: 2, 금전운: 3, 애정운: 0, 건강운: 0 },
  태양: { 총운: 7, 직장운: 6, 건강운: 5, 애정운: 2, 금전운: 2, 학업운: 2 },
  달: { 애정운: 6, 총운: 3, 건강운: 3, 금전운: 0, 직장운: 0, 학업운: 0 },
};

export function forecast(input, chart, period) {
  const natal = planetPositions(input.jdUT);
  const now = planetPositions(period.jd);

  // 출생 차트의 핵심 세 점을 지금 행성이 어떻게 건드리는가
  const targets = [['태양', natal.태양.lon], ['달', natal.달.lon]];
  if (input.timeKnown) targets.push(['상승점', houses(input.jdUT, input.place.lat, input.place.lon).asc]);

  const areas = { 총운: 50, 애정운: 50, 금전운: 50, 직장운: 50, 학업운: 50, 건강운: 50 };
  const hits = [];

  // 일운은 빠른 천체, 연운은 느린 천체가 의미 있다
  const movers = period.kind === 'day'
    ? ['달', '수성', '금성', '태양', '화성']
    : period.kind === 'month'
    ? ['태양', '금성', '화성', '수성', '목성']
    : ['목성', '토성', '화성'];

  for (const p of movers) {
    for (const [tn, tl] of targets) {
      const a = findAspect(now[p].lon, tl);
      if (!a) continue;
      const tone = a.name === '삼각' || a.name === '육각' ? 1
        : a.name === '사각' || a.name === '대각' ? -1
        : (p === '토성' || p === '화성') ? -0.5 : 1;
      const tight = 1 - a.orbUsed / (a.orb + 1);
      for (const [k, v] of Object.entries(TRANSIT_WEIGHT[p] ?? {})) {
        areas[k] += v * tone * tight * 0.9;
      }
      hits.push(`${p}–출생 ${tn} ${a.name}`);
    }
  }

  for (const k of Object.keys(areas)) areas[k] = Math.max(8, Math.min(94, Math.round(areas[k])));

  return {
    id: meta.id, name: meta.name, weight: 1.2,
    headline: hits.length ? hits.slice(0, 2).join(' · ') : '뚜렷한 트랜싯 없음',
    text: hits.length
      ? `지금 하늘의 행성이 출생 차트를 건드리는 자리입니다. ${hits.slice(0, 3).join(', ')}.`
      : '이 시기에는 주요 트랜싯이 걸리지 않습니다. 큰 파도 없이 지나가는 구간입니다.',
    areas,
  };
}

export default { meta, analyze, compare , forecast };
