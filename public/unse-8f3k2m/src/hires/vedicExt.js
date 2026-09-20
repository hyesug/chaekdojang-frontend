/**
 * vedicExt.js — 베딕을 배우자·자녀·재물·주거까지 읽을 수 있게 넓힌다
 *
 * hires/vedic.js 는 다샤와 바르가 좌표까지만 만든다. 그걸로는 "언제"는
 * 좁혀도 "누구와" "어떤 모양으로"를 말할 수 없다. 그 자리를 채우는 층이다.
 *
 * 여기서 새로 계산하는 것
 *   · 하우스 주인(궁주)과 그 주인이 앉은 자리
 *   · 행성의 상태 — 고양·함몰·자기 자리·물라트리코나·조합(照合)·역행
 *   · 그라하 드리슈티 — 행성이 어느 자리를 보고 있는가
 *   · 차라 카라카 — 아트마카라카·다라카라카 (자이미니)
 *   · 아루다 — 아루다 라그나·A2·A10·우파파다 라그나(UL)와 UL2
 *   · 요가 탐지 — 다나 요가·라자 요가 (널리 쓰이는 조합만)
 *   · 분야별 묶음 — 결혼·자녀·재물·주거를 각각 한 벌로
 *
 * ── 유파 고지 ──────────────────────────────────────────────
 *   하우스        : 온별자리(whole sign). 사이트 전체와 같다
 *   아야남샤      : 라히리. 사이트 전체와 같다
 *   차라 카라카   : **일곱 카라카** (태양~토성). 라후를 넣는 여덟 카라카
 *                   방식을 쓰면 다라카라카가 달라진다 — 섞지 않는다
 *   아루다        : 파라샤라 표준. 아루다가 자기 자리나 그 7번째에 떨어지면
 *                   거기서 10번째로 옮긴다
 *   드리슈티      : 전 행성 7번째. 화성 4·8, 목성 5·9, 토성 3·10 (특수시)
 *   조합(照合) 궤 : 달 12° · 화성 17° · 수성 14°(역행 12°) · 목성 11° ·
 *                   금성 10°(역행 8°) · 토성 15°
 *   라후·케투     : 고양·함몰을 매기지 않는다. 유파마다 갈려 한쪽을 고를
 *                   근거가 없다 — 없는 값을 만들지 않는다
 *   요가          : 널리 합의된 조합만 잡는다. 수백 가지 요가를 다 넣으면
 *                   아무 명반에서나 몇 개씩 걸려 신호가 아니라 잡음이 된다
 */

import { planetPositions, toSidereal, houses, PLANET_ORDER } from '../core/planets.js';
import { j } from '../core/josa.js';
import { RASHI } from '../systems/vedic.js';
import { VARGA, DOMAIN_VARGA } from './vedic.js';

const mod12 = (n) => ((n % 12) + 12) % 12;

/** 일곱 행성. 카라카와 요가는 이쪽만 본다 */
export const SEVEN = ['태양', '달', '화성', '수성', '목성', '금성', '토성'];
/** 그림자 둘까지 포함한 아홉 */
export const NINE = [...SEVEN, '라후', '케투'];

/** 별자리의 주인 */
export const signLord = (sign) => RASHI[mod12(sign)].lord;

/** 활동·고정·변통 */
export const QUALITY = ['활동', '고정', '변통'];
export const qualityOf = (sign) => QUALITY[mod12(sign) % 3];

// ─────────────────────────────────────────────────────────────
// 행성의 상태
// ─────────────────────────────────────────────────────────────

/** 고양 / 함몰 — [고양 별자리, 최고도, 함몰 별자리] */
const EXALT = {
  태양: [0, 10, 6], 달: [1, 3, 7], 화성: [9, 28, 3], 수성: [5, 15, 11],
  목성: [3, 5, 9], 금성: [11, 27, 5], 토성: [6, 20, 0],
};
/** 자기 자리 */
const OWN = {
  태양: [4], 달: [3], 화성: [0, 7], 수성: [2, 5],
  목성: [8, 11], 금성: [1, 6], 토성: [9, 10],
};
/** 물라트리코나 — [별자리, 시작도, 끝도] */
const MOOLA = {
  태양: [4, 0, 20], 달: [1, 4, 20], 화성: [0, 0, 12], 수성: [5, 16, 20],
  목성: [8, 0, 10], 금성: [6, 0, 15], 토성: [10, 0, 20],
};
/** 조합(照合) 궤 — 태양에 이만큼 가까우면 빛에 묻힌다 */
const COMBUST = { 달: 12, 화성: 17, 수성: 14, 목성: 11, 금성: 10, 토성: 15 };
const COMBUST_RETRO = { 수성: 12, 금성: 8 };

/** 흉성과 길성 — 자연 길흉 (자연적 길성/흉성) */
export const NATURAL_BENEFIC = ['목성', '금성'];
export const NATURAL_MALEFIC = ['토성', '화성', '라후', '케투'];

/**
 * 한 행성의 상태를 한 벌로.
 * 라후·케투는 고양·함몰을 매기지 않는다 (위 유파 고지 참조).
 */
export function planetState(name, sidLon, sunLon, retrograde) {
  const sign = Math.floor(sidLon / 30);
  const deg = sidLon % 30;
  const out = {
    planet: name, sign, signName: RASHI[sign].kr, deg: Math.round(deg * 10) / 10,
    lord: signLord(sign), retrograde,
    dignity: null, combust: false, benefic: NATURAL_BENEFIC.includes(name),
    malefic: NATURAL_MALEFIC.includes(name),
  };

  const ex = EXALT[name];
  if (ex) {
    const moola = MOOLA[name];
    if (sign === ex[0]) out.dignity = '고양';
    else if (sign === ex[2]) out.dignity = '함몰';
    else if (moola && sign === moola[0] && deg >= moola[1] && deg <= moola[2]) out.dignity = '물라트리코나';
    else if (OWN[name]?.includes(sign)) out.dignity = '자기 자리';
    else out.dignity = '보통';
    // 고양·함몰의 세기는 최고도에서 얼마나 떨어졌느냐로 본다
    if (out.dignity === '고양' || out.dignity === '함몰') {
      out.exactness = Math.round((1 - Math.abs(deg - ex[1]) / 30) * 100) / 100;
    }
  }

  if (name !== '태양' && COMBUST[name] != null) {
    const sep = Math.abs(((sidLon - sunLon + 540) % 360) - 180);
    const orb = (retrograde && COMBUST_RETRO[name]) || COMBUST[name];
    out.combust = sep <= orb;
    out.fromSun = Math.round(sep * 10) / 10;
  }
  return out;
}

/** 그라하 드리슈티 — 그 행성이 몇 번째 자리를 보는가 (1 = 자기 자리) */
export function drishtiOf(planet) {
  if (planet === '화성') return [4, 7, 8];
  if (planet === '목성') return [5, 7, 9];
  if (planet === '토성') return [3, 7, 10];
  return [7];
}

// ─────────────────────────────────────────────────────────────
// 차트 한 벌
// ─────────────────────────────────────────────────────────────

/**
 * 항성 좌표로 세운 차트.
 * @param {object} input prepareInput 결과
 * @param {string} code  'D1' · 'D9' · 'D10' …
 */
export function chart(input, code = 'D1') {
  const f = VARGA[code];
  if (!f) return null;
  const trop = planetPositions(input.jdUT);

  const sid = {};
  for (const n of PLANET_ORDER) sid[n] = toSidereal(trop[n].lon, input.jdUT);

  let lagna = null;
  if (input.timeKnown) {
    const h = houses(input.jdUT, input.place.lat, input.place.lon);
    lagna = f(toSidereal(h.asc, input.jdUT));
  }

  const houseOf = (sign) => (lagna == null ? null : mod12(sign - lagna) + 1);
  const signOfHouse = (n) => (lagna == null ? null : mod12(lagna + n - 1));

  const planets = {};
  for (const n of NINE) {
    const sign = f(sid[n]);
    if (code === 'D1') {
      planets[n] = {
        ...planetState(n, sid[n], sid.태양, trop[n].retrograde),
        house: houseOf(sign),
      };
      continue;
    }
    // 분할 차트에서는 별자리 안의 도(度)가 원 차트의 그것이 아니다.
    // 고양·함몰·조합은 도에서 나오는 값이라 여기서는 매기지 않는다 —
    // 없는 값을 억지로 만들지 않는다. 자리와 하우스만 쓴다.
    planets[n] = {
      planet: n, sign, signName: RASHI[sign].kr, lord: signLord(sign),
      retrograde: trop[n].retrograde, house: houseOf(sign),
      dignity: null, combust: false,
      benefic: NATURAL_BENEFIC.includes(n), malefic: NATURAL_MALEFIC.includes(n),
    };
  }

  /** 그 하우스에 든 행성들 */
  const inHouse = (n) => {
    const s = signOfHouse(n);
    return s == null ? [] : NINE.filter((p) => planets[p].sign === s);
  };

  /** 그 하우스를 보고 있는 행성들 (드리슈티) */
  const aspecting = (n) => {
    if (lagna == null) return [];
    return NINE.filter((p) => {
      const from = planets[p].house;
      if (from == null) return false;
      return drishtiOf(p).some((d) => mod12(from - 1 + d - 1) + 1 === n);
    });
  };

  /** 하우스의 주인과 그 주인이 어디 앉았는가 */
  const lordOf = (n) => {
    const s = signOfHouse(n);
    if (s == null) return null;
    const lord = signLord(s);
    return {
      house: n, sign: s, signName: RASHI[s].kr, lord,
      lordIn: planets[lord]?.house ?? null,
      lordSign: planets[lord]?.signName ?? null,
      lordDignity: planets[lord]?.dignity ?? null,
      lordRetro: planets[lord]?.retrograde ?? false,
      lordCombust: planets[lord]?.combust ?? false,
    };
  };

  return { code, lagna, lagnaSign: lagna == null ? null : RASHI[lagna].kr,
           planets, sid, houseOf, signOfHouse, inHouse, aspecting, lordOf };
}

// ─────────────────────────────────────────────────────────────
// 자이미니 — 차라 카라카와 아루다
// ─────────────────────────────────────────────────────────────

const KARAKA_NAMES = ['아트마카라카', '아마탸카라카', '브라트리카라카', '마트리카라카',
                      '피트리카라카', '그냐티카라카', '다라카라카'];

/**
 * 행성 위치의 불확실 폭 (분각).
 *
 * core/planets.js 는 JPL 근사 궤도요소를 쓴다. 독립 구현(celestine)과
 * 1900~2050 을 대조해 실제로 벌어지는 폭을 쟀고, 거기에 여유를 둔 값이다.
 * 재는 방법과 결과는 tests/unse/ephemeris-accuracy.test.mjs 에 있다.
 *
 * 수성만 두 값이다. 태양에 붙으면(내합 근처) 지심 경도가 급변해 작은
 * 위치차가 각도로 크게 벌어진다. 기하학적 확대라 어느 구현을 써도 생긴다.
 */
const UNCERTAINTY = { 태양: 1, 달: 1, 금성: 2, 화성: 3, 목성: 11, 토성: 15, 수성: 5 };
const MERCURY_NEAR_SUN = 90;

/** 그 행성의 위치를 얼마나 믿을 수 있는가 (분각) */
function uncertaintyOf(planet, sidLon, sunLon) {
  if (planet !== '수성') return UNCERTAINTY[planet] ?? 5;
  const elong = Math.abs(((sidLon - sunLon + 540) % 360) - 180);
  return elong < 20 ? MERCURY_NEAR_SUN : UNCERTAINTY.수성;
}

/**
 * 차라 카라카 — 별자리 안에서 도(度)가 높은 순서로 일곱 자리를 준다.
 * 다라카라카(맨 아래)가 배우자를 가리킨다.
 *
 * **일곱 카라카 방식이다.** 라후를 넣는 여덟 방식에서는 다라카라카가
 * 달라진다. 한쪽만 쓴다.
 *
 * ── 순서가 흔들릴 수 있다는 것을 함께 돌려준다 ──────────────
 * 카라카는 **도수 순서**로만 정해진다. 그래서 두 행성의 도수가 가까우면
 * 계산 오차만으로 순서가 뒤집히고, 뒤집히면 다라카라카가 바뀌어 배우자
 * 해석이 통째로 달라진다. 그런 일이 조용히 일어나면 안 된다.
 *
 * 그래서 이웃한 두 카라카의 도수 차이가 두 행성의 불확실 폭을 합친 것보다
 * 작으면 `uncertain` 에 담아 내보낸다. 해석 층은 그때 단언을 낮춘다.
 */
export function charaKarakas(input) {
  const trop = planetPositions(input.jdUT);
  const sunSid = toSidereal(trop.태양.lon, input.jdUT);

  const rows = SEVEN.map((n) => {
    const sid = toSidereal(trop[n].lon, input.jdUT);
    return {
      planet: n, deg: sid % 30, sign: Math.floor(sid / 30),
      band: uncertaintyOf(n, sid, sunSid),
    };
  }).sort((a, b) => b.deg - a.deg);

  // 이웃끼리 도수 차이가 불확실 폭 안쪽이면 순서를 장담할 수 없다
  const uncertain = [];
  for (let i = 1; i < rows.length; i++) {
    const gapArcmin = (rows[i - 1].deg - rows[i].deg) * 60;
    const band = rows[i - 1].band + rows[i].band;
    if (gapArcmin <= band) {
      uncertain.push({
        between: [rows[i - 1].planet, rows[i].planet],
        roles: [KARAKA_NAMES[i - 1] ?? null, KARAKA_NAMES[i] ?? null].filter(Boolean),
        gapArcmin: Math.round(gapArcmin * 10) / 10,
        bandArcmin: band,
        why: `${j(rows[i - 1].planet, '과')} ${rows[i].planet}의 도수 차이가 ${gapArcmin.toFixed(1)}분각인데 ` +
             `위치 불확실 폭이 ${band}분각이다 — 순서가 뒤집힐 수 있다`,
      });
    }
  }

  const out = {};
  rows.forEach((r, i) => {
    if (i < KARAKA_NAMES.length) out[KARAKA_NAMES[i]] = { ...r, deg: Math.round(r.deg * 100) / 100 };
  });

  const shaky = (role) => uncertain.some((u) => u.roles.includes(role));
  return {
    list: rows.map((r, i) => ({ ...r, role: KARAKA_NAMES[i] ?? null })),
    atmakaraka: out['아트마카라카'] ?? null,
    darakaraka: out['다라카라카'] ?? null,
    all: out,
    uncertain,
    // 이 둘이 흔들리면 해석 층이 단언을 낮춘다
    darakarakaUncertain: shaky('다라카라카'),
    atmakarakaUncertain: shaky('아트마카라카'),
  };
}

/**
 * 아루다 — 그 하우스가 세상에 보이는 모습.
 *
 * 하우스에서 그 주인까지 센 만큼을 주인 자리에서 다시 센다. 결과가 원래
 * 자리이거나 그 7번째면 거기서 10번째로 옮긴다 (파라샤라 표준).
 */
export function arudhaOf(d1, houseNum) {
  if (d1.lagna == null) return null;
  const houseSign = d1.signOfHouse(houseNum);
  const lord = signLord(houseSign);
  const lordSign = d1.planets[lord]?.sign;
  if (lordSign == null) return null;

  const span = mod12(lordSign - houseSign) + 1;      // 1부터 센다
  let arudha = mod12(lordSign + span - 1);
  if (arudha === houseSign || mod12(arudha - houseSign) === 6) arudha = mod12(arudha + 9);

  return {
    house: houseNum, sign: arudha, signName: RASHI[arudha].kr,
    fromLagna: mod12(arudha - d1.lagna) + 1,
    occupants: NINE.filter((p) => d1.planets[p].sign === arudha),
  };
}

/** 자주 쓰는 아루다 넷 — 라그나·2·10, 그리고 우파파다(12의 아루다) */
export function arudhaPack(d1) {
  if (d1.lagna == null) return null;
  const AL = arudhaOf(d1, 1);
  const A2 = arudhaOf(d1, 2);
  const A10 = arudhaOf(d1, 10);
  const UL = arudhaOf(d1, 12);
  const UL2 = UL && {
    sign: mod12(UL.sign + 1), signName: RASHI[mod12(UL.sign + 1)].kr,
    occupants: NINE.filter((p) => d1.planets[p].sign === mod12(UL.sign + 1)),
    lord: signLord(mod12(UL.sign + 1)),
  };
  return { AL, A2, A10, UL, UL2 };
}

// ─────────────────────────────────────────────────────────────
// 요가 — 널리 쓰이는 것만
// ─────────────────────────────────────────────────────────────

const KENDRA = [1, 4, 7, 10];
const TRIKONA = [1, 5, 9];

/** 두 행성이 같은 자리인가 / 서로 자리를 바꿨는가 / 서로 보고 있는가 */
function relation(d1, a, b) {
  const A = d1.planets[a], B = d1.planets[b];
  if (!A || !B) return null;
  if (A.sign === B.sign) return '합좌';
  // 교환 — 서로의 자리에 들어가 있다
  if (signLord(A.sign) === b && signLord(B.sign) === a) return '교환';
  const sees = (x, y) => drishtiOf(x).some((d) => mod12(d1.planets[x].sign + d - 1) === d1.planets[y].sign);
  if (sees(a, b) && sees(b, a)) return '상호조견';
  if (sees(a, b) || sees(b, a)) return '편조견';
  return null;
}

/**
 * 라자 요가 — 켄드라(1·4·7·10)의 주인과 트리코나(1·5·9)의 주인이 맺어진 것.
 * 지위와 성취를 보는 가장 기본 조합이다.
 */
export function rajaYogas(d1) {
  if (d1.lagna == null) return [];
  const out = [];
  const seen = new Set();
  for (const k of KENDRA) {
    for (const t of TRIKONA) {
      if (k === t) continue;
      const lk = signLord(d1.signOfHouse(k));
      const lt = signLord(d1.signOfHouse(t));
      if (lk === lt) continue;
      const key = [lk, lt].sort().join('-');
      if (seen.has(key)) continue;
      const r = relation(d1, lk, lt);
      if (!r) continue;
      seen.add(key);
      out.push({ kind: '라자 요가', how: r, planets: [lk, lt], houses: [k, t],
        note: `${k}하우스 주인 ${j(lk, '과')} ${t}하우스 주인 ${j(lt, '이')} ${r}` });
    }
  }
  return out;
}

/**
 * 다나 요가 — 재물의 자리(2·11)와 복의 자리(5·9) 주인이 맺어진 것.
 * 여기에 2·11 주인이 서로의 자리에 든 경우를 더한다.
 */
export function dhanaYogas(d1) {
  if (d1.lagna == null) return [];
  const out = [];
  const seen = new Set();
  const wealth = [2, 11];
  const fortune = [5, 9, 1];
  for (const w of wealth) {
    for (const f of fortune) {
      const lw = signLord(d1.signOfHouse(w));
      const lf = signLord(d1.signOfHouse(f));
      if (lw === lf) continue;
      const key = [lw, lf].sort().join('-');
      if (seen.has(key)) continue;
      const r = relation(d1, lw, lf);
      if (!r) continue;
      seen.add(key);
      out.push({ kind: '다나 요가', how: r, planets: [lw, lf], houses: [w, f],
        note: `${w}하우스 주인 ${j(lw, '과')} ${f}하우스 주인 ${j(lf, '이')} ${r}` });
    }
  }
  // 2와 11의 주인이 서로 바꿔 들어간 경우
  const l2 = signLord(d1.signOfHouse(2));
  const l11 = signLord(d1.signOfHouse(11));
  if (d1.planets[l2]?.house === 11) {
    out.push({ kind: '다나 요가', how: '2주가 11에', planets: [l2], houses: [2, 11],
      note: `2하우스 주인 ${j(l2, '이')} 11하우스에 들었다` });
  }
  if (d1.planets[l11]?.house === 2) {
    out.push({ kind: '다나 요가', how: '11주가 2에', planets: [l11], houses: [11, 2],
      note: `11하우스 주인 ${j(l11, '이')} 2하우스에 들었다` });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// 분야별 묶음
// ─────────────────────────────────────────────────────────────

const pick = (d, n) => {
  const l = d.lordOf(n);
  return l && {
    house: n, sign: l.signName, signIndex: l.sign,
    quality: qualityOf(l.sign),
    lord: l.lord, lordIn: l.lordIn, lordSign: l.lordSign,
    lordDignity: l.lordDignity, lordRetro: l.lordRetro, lordCombust: l.lordCombust,
    occupants: d.inHouse(n), aspects: d.aspecting(n),
  };
};

/** 결혼 — D1 7궁 · D9 전체 · 우파파다 · 다라카라카 */
export function marriagePack(input) {
  const d1 = chart(input, 'D1');
  const d9 = chart(input, 'D9');
  if (!d1) return null;
  const k = charaKarakas(input);
  const ar = arudhaPack(d1);
  const dk = k.darakaraka?.planet ?? null;

  return {
    d1_7: pick(d1, 7),
    d9_7: d9 && pick(d9, 7),
    d9Lagna: d9?.lagnaSign ?? null,
    // D9 라그나의 주인이 D1 어디에 앉았는가 — 결혼 생활의 무게중심
    d9LagnaLordInD1: d9?.lagna != null ? d1.planets[signLord(d9.lagna)]?.house ?? null : null,
    venus: d1.planets.금성,
    jupiter: d1.planets.목성,
    venusInD9: d9?.planets.금성 ?? null,
    jupiterInD9: d9?.planets.목성 ?? null,
    darakaraka: dk && {
      planet: dk,
      d1: { sign: d1.planets[dk].signName, house: d1.planets[dk].house, dignity: d1.planets[dk].dignity },
      d9: d9 ? { sign: d9.planets[dk].signName, house: d9.planets[dk].house } : null,
      // 도수 순서가 흔들리면 다라카라카 자체가 바뀐다. 조용히 넘기지 않는다
      uncertain: k.darakarakaUncertain,
      uncertainWhy: k.uncertain.filter((u) => u.roles.includes('다라카라카')).map((u) => u.why),
    },
    atmakaraka: k.atmakaraka?.planet ?? null,
    karakaUncertain: k.uncertain,
    upapada: ar?.UL ?? null,
    upapada2: ar?.UL2 ?? null,
    // 7궁·7궁주를 건드리는 다샤 주인 후보
    activators: [...new Set([
      d1.lordOf(7)?.lord, dk, '금성', '목성',
      ...(d1.inHouse(7) ?? []),
    ].filter(Boolean))],
  };
}

/** 자녀 — D1 5궁 · D7 · 목성 */
export function childrenPack(input) {
  const d1 = chart(input, 'D1');
  const d7 = chart(input, 'D7');
  if (!d1) return null;
  return {
    d1_5: pick(d1, 5),
    d7Lagna: d7?.lagnaSign ?? null,
    d7_5: d7 && pick(d7, 5),
    jupiter: d1.planets.목성,
    jupiterInD7: d7?.planets.목성 ?? null,
    // 자녀를 보는 자리를 흔드는 흉성
    maleficsOn5: (d1.inHouse(5) ?? []).filter((p) => NATURAL_MALEFIC.includes(p)),
    activators: [...new Set([d1.lordOf(5)?.lord, '목성', ...(d1.inHouse(5) ?? [])].filter(Boolean))],
  };
}

/** 재물·사업 — D2 · D10 · 2/11/5/9궁 · 아루다 · 요가 */
export function wealthPack(input) {
  const d1 = chart(input, 'D1');
  const d2 = chart(input, 'D2');
  const d10 = chart(input, 'D10');
  if (!d1) return null;
  const ar = arudhaPack(d1);
  return {
    d1_2: pick(d1, 2), d1_11: pick(d1, 11),
    d1_10: pick(d1, 10), d1_6: pick(d1, 6),
    d1_5: pick(d1, 5), d1_9: pick(d1, 9),
    d10Lagna: d10?.lagnaSign ?? null,
    // D10(다샴샤)은 직업 전용 분할도다. 표준 독법에서 **라그나와 그 주인**이
    // 직업의 1순위 지표인데 여태 10하우스 거주 행성만 꺼내 쓰고 있었다.
    d10_1: d10 && pick(d10, 1),
    d10_10: d10 && pick(d10, 10),
    d10_7: d10 && pick(d10, 7),    // 사업·거래처를 보는 자리
    d10_6: d10 && pick(d10, 6),    // 고용·일상 노동
    hora: d2 && {
      sunHora: NINE.filter((p) => d2.planets[p].sign === 4).length,
      moonHora: NINE.filter((p) => d2.planets[p].sign === 3).length,
    },
    arudha: ar && { AL: ar.AL, A2: ar.A2, A10: ar.A10 },
    dhanaYogas: dhanaYogas(d1),
    rajaYogas: rajaYogas(d1),
    activators: [...new Set([
      d1.lordOf(2)?.lord, d1.lordOf(11)?.lord, d1.lordOf(10)?.lord,
      ...(d1.inHouse(2) ?? []), ...(d1.inHouse(11) ?? []),
    ].filter(Boolean))],
  };
}

/** 주거·부동산 — D1 4궁 · D4 · 화성·달·목성 */
export function homePack(input) {
  const d1 = chart(input, 'D1');
  const d4 = chart(input, 'D4');
  if (!d1) return null;
  return {
    d1_4: pick(d1, 4),
    d4Lagna: d4?.lagnaSign ?? null,
    d4_4: d4 && pick(d4, 4),
    mars: d1.planets.화성, moon: d1.planets.달, jupiter: d1.planets.목성,
    // 3·9·12는 이동·타향을 보는 자리다
    d1_3: pick(d1, 3), d1_9: pick(d1, 9), d1_12: pick(d1, 12),
    activators: [...new Set([d1.lordOf(4)?.lord, '화성', '달', ...(d1.inHouse(4) ?? [])].filter(Boolean))],
  };
}

/** 질문 분야에 맞는 묶음 하나 */
export function packFor(input, domain) {
  if (domain === '결혼' || domain === '관계') return { kind: '결혼', data: marriagePack(input) };
  if (domain === '자녀' || domain === '학업') return { kind: '자녀', data: childrenPack(input) };
  if (domain === '재물' || domain === '직업') return { kind: '재물', data: wealthPack(input) };
  if (domain === '주거' || domain === '이사') return { kind: '주거', data: homePack(input) };
  return null;
}

export { DOMAIN_VARGA };
