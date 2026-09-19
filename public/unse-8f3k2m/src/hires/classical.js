/**
 * classical.js — 고전(전통) 서양점성술 계산층
 *
 * 지금까지의 점성술 모듈은 현대식으로 읽었다. 행성이 어느 별자리 어느
 * 하우스에 있고 어떤 각을 맺는지까지다. 그런데 **재물을 구분해서 보려면
 * 그걸로 모자란다.** 고전은 "그 행성이 실제로 힘이 있는가"를 표로 따지고,
 * 돈을 2·5·8·10·11하우스로 나눠 보며, 로트(Lot)라는 별도의 점을 세운다.
 *
 * 여기서 계산하는 것
 *   · 섹트(sect)     — 낮 차트인가 밤 차트인가. 고전 해석의 첫 갈림길
 *   · 에센셜 디그니티 — 도미사일·엑절테이션·트리플리시티·텀·페이스·디트리먼트·폴
 *   · 액시덴털 컨디션 — 앵귤러/석시던트/케이던트·조합·태양광 아래·카지미·역행·속도·섹트
 *   · 아라빅 로트    — 포춘·스피릿·에로스·네세시티·서브스턴스
 *   · 재물 하우스    — 2·5·8·10·11의 커스프·주인·주인의 자리와 상태
 *
 * ── 유파 고지 ──────────────────────────────────────────────
 * 고전 표는 유파마다 갈린다. 한 벌을 골라 그것만 쓴다. 섞지 않는다.
 *
 *   지배성      : **전통 지배성만** (천왕·해왕·명왕을 쓰지 않는다).
 *                 화성=양자리·전갈, 금성=황소·천칭, 수성=쌍둥이·처녀,
 *                 목성=사수·물고기, 토성=염소·물병
 *   트리플리시티 : **도로테우스** 방식 (낮·밤·협동 셋). 프톨레마이오스
 *                 방식을 쓰면 값이 달라진다
 *   텀(바운드)  : **이집트 텀**. 프톨레마이오스 텀과 다르다
 *   페이스      : 칼데안 순서, 양자리 0도에서 화성부터
 *   엑절테이션  : 서양 전통 값 (태양 양자리 19도 등). 베딕의 고양 도수와
 *                 다르다 — vedicExt.js 의 표와 섞어 읽지 말 것
 *   조합 궤     : 카지미 17분 · 조합 8도30분 · 태양광 아래 15도.
 *                 베딕 조합 궤(행성마다 다름)와 다른 표다
 *   섹트 판정   : 태양이 지평선 위(7~12하우스)면 낮 차트. 경계에 도수
 *                 여유를 주는 방식을 쓰지 않는다
 *   로트        : 낮·밤에 따라 공식이 뒤집히는 것은 반드시 뒤집는다.
 *                 서브스턴스는 아랍 전통(알비루니) 공식이라 그렇게 표시한다
 */

import { planetPositions, houses, houseOf } from '../core/planets.js';
import { norm360 } from '../core/astro.js';
import { SIGNS, signOf, degInSign, findAspect } from '../systems/astrology.js';

/** 고전이 쓰는 일곱 행성. 천왕·해왕·명왕은 고전 표에 자리가 없다 */
export const SEVEN = ['태양', '달', '수성', '금성', '화성', '목성', '토성'];

/** 전통 지배성 — 별자리 순서대로 */
export const DOMICILE = ['화성', '금성', '수성', '달', '태양', '수성',
                         '금성', '화성', '목성', '토성', '토성', '목성'];

/** 엑절테이션 — 행성 → [별자리, 정확한 도수] */
const EXALT = {
  태양: [0, 19], 달: [1, 3], 수성: [5, 15], 금성: [11, 27],
  화성: [9, 28], 목성: [3, 15], 토성: [6, 21],
};

/** 도로테우스 트리플리시티 — 원소 → [낮 주인, 밤 주인, 협동] */
const TRIPLICITY = {
  불: ['태양', '목성', '토성'],
  흙: ['금성', '달', '화성'],
  공기: ['토성', '수성', '목성'],
  물: ['금성', '화성', '달'],
};

/**
 * 이집트 텀(바운드) — 별자리마다 [주인, 이 도수까지] 다섯 구간.
 * 프톨레마이오스 텀과 값이 다르다. 한쪽만 쓴다.
 */
const TERMS = [
  [['목성', 6], ['금성', 12], ['수성', 20], ['화성', 25], ['토성', 30]],   // 양자리
  [['금성', 8], ['수성', 14], ['목성', 22], ['토성', 27], ['화성', 30]],   // 황소
  [['수성', 6], ['목성', 12], ['금성', 17], ['화성', 24], ['토성', 30]],   // 쌍둥이
  [['화성', 7], ['금성', 13], ['수성', 19], ['목성', 26], ['토성', 30]],   // 게
  [['목성', 6], ['금성', 11], ['토성', 18], ['수성', 24], ['화성', 30]],   // 사자
  [['수성', 7], ['금성', 17], ['목성', 21], ['화성', 28], ['토성', 30]],   // 처녀
  [['토성', 6], ['수성', 14], ['목성', 21], ['금성', 28], ['화성', 30]],   // 천칭
  [['화성', 7], ['금성', 11], ['수성', 19], ['목성', 24], ['토성', 30]],   // 전갈
  [['목성', 12], ['금성', 17], ['수성', 21], ['토성', 26], ['화성', 30]],  // 사수
  [['수성', 7], ['목성', 14], ['금성', 22], ['토성', 26], ['화성', 30]],   // 염소
  [['수성', 7], ['금성', 13], ['목성', 20], ['화성', 25], ['토성', 30]],   // 물병
  [['금성', 12], ['목성', 16], ['수성', 19], ['화성', 28], ['토성', 30]],  // 물고기
];

/** 페이스(데칸) — 칼데안 순서. 양자리 0도에서 화성부터 열흘씩 */
const CHALDEAN = ['화성', '태양', '금성', '수성', '달', '토성', '목성'];

/** 조합 관련 궤 (도) */
const CAZIMI = 17 / 60;      // 태양 한가운데 — 오히려 힘을 얻는다고 본다
const COMBUST = 8.5;          // 태양에 타 버린다
const UNDER_BEAMS = 15;       // 태양빛에 가려 힘을 못 쓴다

/** 낮 행성과 밤 행성 */
const DIURNAL = ['태양', '목성', '토성'];
const NOCTURNAL = ['달', '금성', '화성'];

// ─────────────────────────────────────────────────────────────
// 섹트
// ─────────────────────────────────────────────────────────────

/**
 * 낮 차트인가 밤 차트인가.
 * 태양이 지평선 위(7~12하우스)에 있으면 낮 차트다. 고전 해석은 여기서 갈린다.
 */
export function sectOf(pos, h) {
  const sunHouse = houseOf(pos.태양.lon, h.cusps);
  const day = sunHouse >= 7 && sunHouse <= 12;
  return {
    day,
    label: day ? '낮 차트' : '밤 차트',
    sunHouse,
    // 섹트에 맞는 길성·흉성이 그 차트에서 제 몫을 한다
    benefic: day ? '목성' : '금성',
    malefic: day ? '토성' : '화성',
    // 섹트에 어긋난 흉성이 가장 거칠게 작동한다고 본다
    outOfSectMalefic: day ? '화성' : '토성',
    luminary: day ? '태양' : '달',
  };
}

/** 그 행성이 자기 섹트 안에 있는가 */
function inSect(planet, day, pos) {
  if (DIURNAL.includes(planet)) return day;
  if (NOCTURNAL.includes(planet)) return !day;
  if (planet === '수성') {
    // 수성은 태양보다 먼저 뜨면(동쪽) 낮 행성, 나중에 뜨면 밤 행성으로 본다
    const diff = ((pos.수성.lon - pos.태양.lon + 540) % 360) - 180;
    return diff < 0 ? day : !day;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// 에센셜 디그니티
// ─────────────────────────────────────────────────────────────

/** 텀의 주인 */
export function termLord(lon) {
  const s = signOf(lon), d = degInSign(lon);
  for (const [lord, upTo] of TERMS[s]) if (d < upTo) return lord;
  return TERMS[s][4][0];
}

/** 페이스의 주인 */
export function faceLord(lon) {
  const idx = Math.floor(lon / 10);          // 0~35
  return CHALDEAN[idx % 7];
}

/** 트리플리시티의 주인 셋 */
export function triplicityLords(sign) {
  return TRIPLICITY[SIGNS[sign].el];
}

/**
 * 한 행성의 에센셜 디그니티 한 벌.
 *
 * 고전은 "그 행성이 있다"가 아니라 "그 자리에서 힘이 있는가"를 본다.
 * 도미사일·엑절테이션이면 제 힘을 쓰고, 디트리먼트·폴이면 못 쓴다.
 * 그 사이는 트리플리시티·텀·페이스로 잔 점수를 준다.
 */
export function essentialDignity(planet, lon, day) {
  const sign = signOf(lon);
  const deg = degInSign(lon);
  const out = { planet, sign, signName: SIGNS[sign].name, deg: Math.round(deg * 10) / 10,
                domicile: false, exaltation: false, detriment: false, fall: false,
                triplicity: null, term: false, face: false, score: 0, labels: [] };

  if (DOMICILE[sign] === planet) { out.domicile = true; out.score += 5; out.labels.push('도미사일'); }
  if (DOMICILE[(sign + 6) % 12] === planet) { out.detriment = true; out.score -= 5; out.labels.push('디트리먼트'); }

  const ex = EXALT[planet];
  if (ex) {
    if (ex[0] === sign) { out.exaltation = true; out.score += 4; out.labels.push('엑절테이션'); }
    if ((ex[0] + 6) % 12 === sign) { out.fall = true; out.score -= 4; out.labels.push('폴'); }
  }

  const tri = triplicityLords(sign);
  const triRole = tri[0] === planet && day ? '낮 주인'
    : tri[1] === planet && !day ? '밤 주인'
    : tri[2] === planet ? '협동' : null;
  if (triRole) { out.triplicity = triRole; out.score += triRole === '협동' ? 1 : 3; out.labels.push(`트리플리시티(${triRole})`); }

  if (termLord(lon) === planet) { out.term = true; out.score += 2; out.labels.push('텀'); }
  if (faceLord(lon) === planet) { out.face = true; out.score += 1; out.labels.push('페이스'); }

  out.verdict = out.score >= 5 ? '강함' : out.score >= 2 ? '받쳐짐'
    : out.score >= 0 ? '보통' : out.score >= -4 ? '약함' : '아주 약함';
  return out;
}

/**
 * 액시덴털 컨디션 — 자리와 상태가 주는 힘.
 * 에센셜이 "본래 힘"이라면 이쪽은 "지금 쓸 수 있는 힘"이다.
 */
export function accidentalCondition(planet, pos, h, day) {
  const lon = pos[planet].lon;
  const house = houseOf(lon, h.cusps);
  const angular = [1, 4, 7, 10].includes(house);
  const succedent = [2, 5, 8, 11].includes(house);

  const sep = Math.abs(((lon - pos.태양.lon + 540) % 360) - 180);
  const cazimi = planet !== '태양' && sep <= CAZIMI;
  const combust = planet !== '태양' && !cazimi && sep <= COMBUST;
  const underBeams = planet !== '태양' && !cazimi && !combust && sep <= UNDER_BEAMS;

  const sect = inSect(planet, day, pos);

  return {
    planet, house,
    placement: angular ? '앵귤러' : succedent ? '석시던트' : '케이던트',
    angular, succedent,
    cazimi, combust, underBeams,
    fromSun: Math.round(sep * 10) / 10,
    retrograde: pos[planet].retrograde,
    speed: Math.round(pos[planet].speed * 1000) / 1000,
    inSect: sect,
    labels: [
      angular ? '앵귤러' : succedent ? '석시던트' : '케이던트',
      cazimi ? '카지미' : combust ? '조합' : underBeams ? '태양광 아래' : null,
      pos[planet].retrograde ? '역행' : null,
      sect === true ? '섹트 안' : sect === false ? '섹트 밖' : null,
    ].filter(Boolean),
  };
}

// ─────────────────────────────────────────────────────────────
// 아라빅 로트
// ─────────────────────────────────────────────────────────────

/**
 * 로트 — 세 점의 거리를 상승점에서 다시 재어 찍는 자리.
 *
 * 낮과 밤에 공식이 뒤집히는 것이 많다. 뒤집지 않으면 밤에 태어난 사람의
 * 포춘이 통째로 엉뚱한 자리에 찍힌다. 여기서는 섹트를 먼저 구하고 그에
 * 맞는 공식을 쓴다.
 */
export function lots(pos, h, sect) {
  const asc = h.asc;
  const D = sect.day;
  const L = (a, b, c) => norm360(a + b - c);

  // 포춘 — 물질·몸·환경. 낮: ASC + 달 − 태양
  const fortune = D ? L(asc, pos.달.lon, pos.태양.lon) : L(asc, pos.태양.lon, pos.달.lon);
  // 스피릿 — 뜻·직업·명성. 포춘과 정확히 뒤집힌다
  const spirit = D ? L(asc, pos.태양.lon, pos.달.lon) : L(asc, pos.달.lon, pos.태양.lon);
  // 에로스 — 욕망하는 것 (파울루스)
  const eros = D ? L(asc, pos.금성.lon, spirit) : L(asc, spirit, pos.금성.lon);
  // 네세시티 — 피할 수 없는 것 (파울루스)
  const necessity = D ? L(asc, fortune, pos.수성.lon) : L(asc, pos.수성.lon, fortune);
  // 베이시스 — 포춘과 스피릿의 바탕
  const basis = D ? L(asc, fortune, spirit) : L(asc, spirit, fortune);

  // 서브스턴스(재물) — 아랍 전통. 2하우스 커스프에서 2하우스 주인까지를
  // 상승점에서 다시 잰다. 헬레니즘 로트가 아니라 아랍 쪽 공식이다.
  const cusp2 = h.cusps[2];
  const lord2 = DOMICILE[signOf(cusp2)];
  const substance = L(asc, cusp2, pos[lord2].lon);

  return { fortune, spirit, eros, necessity, basis, substance,
           substanceNote: '아랍 전통(알비루니) 공식 — 헬레니즘 로트가 아니다' };
}

/**
 * 로트 하나를 자리·주인·주인의 상태까지 펴서 읽는다.
 *
 * **로트만 보고 결론 내리지 않는다.** 고전은 로트가 놓인 자리보다
 * 그 로트의 주인이 어떤 상태인가를 더 무겁게 본다.
 */
export function readLot(name, lon, pos, h, sect) {
  const sign = signOf(lon);
  const ruler = DOMICILE[sign];
  const rulerLon = pos[ruler].lon;
  const house = houseOf(lon, h.cusps);

  // 길성·흉성이 이 로트를 건드리는가
  const touches = [];
  for (const p of SEVEN) {
    const a = findAspect(pos[p].lon, lon);
    if (!a) continue;
    touches.push({ planet: p, aspect: a.name, orb: Math.round(a.orbUsed * 10) / 10,
      kind: p === '목성' || p === '금성' ? '길성' : p === '토성' || p === '화성' ? '흉성' : '중립' });
  }
  touches.sort((a, b) => a.orb - b.orb);

  return {
    name,
    lon: Math.round(lon * 100) / 100,
    sign, signName: SIGNS[sign].name, deg: Math.round(degInSign(lon) * 10) / 10,
    house,
    placement: [1, 4, 7, 10].includes(house) ? '앵귤러'
      : [2, 5, 8, 11].includes(house) ? '석시던트' : '케이던트',
    ruler,
    rulerSign: SIGNS[signOf(rulerLon)].name,
    rulerHouse: houseOf(rulerLon, h.cusps),
    rulerDignity: essentialDignity(ruler, rulerLon, sect.day),
    rulerCondition: accidentalCondition(ruler, pos, h, sect.day),
    touches: touches.slice(0, 4),
    benefics: touches.filter((t) => t.kind === '길성').map((t) => `${t.planet} ${t.aspect}`),
    malefics: touches.filter((t) => t.kind === '흉성').map((t) => `${t.planet} ${t.aspect}`),
  };
}

// ─────────────────────────────────────────────────────────────
// 재물 하우스
// ─────────────────────────────────────────────────────────────

/** 고전이 돈을 나눠 보는 다섯 자리 */
export const MONEY_HOUSES = {
  2: '내 돈 — 소득·재산·현금흐름',
  5: '위험을 건 돈 — 투기·게임·창작',
  8: '남의 돈 — 배우자 자산·상속·보험·공동재정',
  10: '일로 버는 돈 — 직업과 사회적 성취',
  11: '얻어지는 돈 — 성과·후원·이익',
};

/** 한 하우스를 커스프·주인·주인의 자리와 상태까지 */
export function readHouse(n, pos, h, sect) {
  const cusp = h.cusps[n];
  const sign = signOf(cusp);
  const ruler = DOMICILE[sign];
  const rulerLon = pos[ruler].lon;

  const occupants = SEVEN.filter((p) => houseOf(pos[p].lon, h.cusps) === n);
  const aspects = [];
  for (const p of SEVEN) {
    const a = findAspect(pos[p].lon, cusp);
    if (a) aspects.push({ planet: p, aspect: a.name, orb: Math.round(a.orbUsed * 10) / 10,
      kind: p === '목성' || p === '금성' ? '길성' : p === '토성' || p === '화성' ? '흉성' : '중립' });
  }

  return {
    house: n, topic: MONEY_HOUSES[n] ?? null,
    cuspSign: SIGNS[sign].name,
    ruler,
    rulerSign: SIGNS[signOf(rulerLon)].name,
    rulerHouse: houseOf(rulerLon, h.cusps),
    rulerDignity: essentialDignity(ruler, rulerLon, sect.day),
    rulerCondition: accidentalCondition(ruler, pos, h, sect.day),
    occupants,
    benefics: aspects.filter((a) => a.kind === '길성').map((a) => `${a.planet} ${a.aspect}`),
    malefics: aspects.filter((a) => a.kind === '흉성').map((a) => `${a.planet} ${a.aspect}`),
  };
}

// ─────────────────────────────────────────────────────────────
// 한 벌로
// ─────────────────────────────────────────────────────────────

/**
 * 고전 차트 한 벌 — 섹트·디그니티·로트·재물 하우스.
 * 출생 시각을 모르면 하우스와 로트가 서지 않으므로 그렇다고 말한다.
 */
export function classicalChart(input) {
  if (!input.timeKnown) {
    return { unavailable: '출생 시각을 알아야 상승점과 하우스가 서고, 로트도 거기서 나온다' };
  }
  const pos = planetPositions(input.jdUT);
  const h = houses(input.jdUT, input.place.lat, input.place.lon);
  const sect = sectOf(pos, h);

  const dignities = {};
  for (const p of SEVEN) {
    dignities[p] = {
      essential: essentialDignity(p, pos[p].lon, sect.day),
      accidental: accidentalCondition(p, pos, h, sect.day),
    };
  }

  const raw = lots(pos, h, sect);
  const lotPack = {};
  for (const [name, lon] of Object.entries(raw)) {
    if (typeof lon !== 'number') continue;
    lotPack[name] = readLot(name, lon, pos, h, sect);
  }

  const moneyHouses = {};
  for (const n of Object.keys(MONEY_HOUSES)) moneyHouses[n] = readHouse(Number(n), pos, h, sect);

  return {
    sect, dignities, lots: lotPack, moneyHouses,
    asc: h.asc, mc: h.mc, cusps: h.cusps, pos,
    substanceNote: raw.substanceNote,
  };
}

/** 프롬프트용 — 한 행성의 상태를 한 줄로 */
export const stateLine = (d) =>
  `${d.essential.planet} ${d.essential.signName} ${d.essential.deg}° ` +
  `[${d.essential.labels.join('·') || '무관'} ${d.essential.score >= 0 ? '+' : ''}${d.essential.score} ${d.essential.verdict}] ` +
  `${d.accidental.house}H ${d.accidental.labels.join('·')}`;

/** 프롬프트용 — 로트 한 줄 */
export const lotLine = (l) =>
  `${l.name} ${l.signName} ${l.deg}° ${l.house}H(${l.placement}) · 주인 ${l.ruler} ` +
  `${l.rulerSign} ${l.rulerHouse}H [${l.rulerDignity.labels.join('·') || '무관'} ${l.rulerDignity.verdict}]` +
  `${l.rulerCondition.labels.length ? ` ${l.rulerCondition.labels.join('·')}` : ''}` +
  `${l.benefics.length ? ` · 길성 ${l.benefics.join(',')}` : ''}` +
  `${l.malefics.length ? ` · 흉성 ${l.malefics.join(',')}` : ''}`;

/** 프롬프트용 — 재물 하우스 한 줄 */
export const houseLine = (x) =>
  `${x.house}H(${x.topic}) ${x.cuspSign} · 주인 ${x.ruler} ${x.rulerSign} ${x.rulerHouse}H ` +
  `[${x.rulerDignity.labels.join('·') || '무관'} ${x.rulerDignity.verdict}]` +
  `${x.rulerCondition.labels.length ? ` ${x.rulerCondition.labels.join('·')}` : ''}` +
  `${x.occupants.length ? ` · 내 ${x.occupants.join('·')}` : ''}` +
  `${x.benefics.length ? ` · 길성 ${x.benefics.join(',')}` : ''}` +
  `${x.malefics.length ? ` · 흉성 ${x.malefics.join(',')}` : ''}`;
