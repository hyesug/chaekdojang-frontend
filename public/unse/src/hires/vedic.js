/**
 * vedic.js — 베딕 다샤를 안탈·프라탼탈까지 쪼개고, 분할 차트를 붙인다
 *
 * 기존 systems/vedic.js 는 마하다샤(큰 시기)만 본다. 마하다샤는 6년에서
 * 20년까지 가는 구간이라 "언제"를 묻는 질문에 쓸 수가 없다. 그 아래를
 * 열어야 연·월이 나온다.
 *
 *   마하다샤(MD) → 안타르다샤(AD) → 프라탼타르다샤(PD) → 수크슈마(SD)
 *
 * 여기에 분할 차트(바르가)와 느린 행성의 항성 트랜싯을 더한다.
 * 직업은 D1+D10, 결혼은 D1+D9, 재물은 D1+D2, 주거는 D1+D4 를 본다.
 *
 * ── 유파 고지 ──────────────────────────────────────────────
 *   아야남샤   : 라히리 (기존과 같다)
 *   하우스     : 온별자리(whole sign) — 기존과 같다
 *   다샤 체계  : 빔쇼타리 120년. 하위 구간은 비례 배분
 *                (AD 길이 = MD년수 × AD년수 ÷ 120), 순서는 자기 자신부터
 *   한 해 길이 : 365.2425일. 사이트의 나머지 계산과 같은 값을 쓴다
 *                (일부 유파는 360일 또는 365.25일을 쓴다 — 섞지 않는다)
 *   바르가     : 파라샤라(Parāśara) 표준
 *                D2 호라   — 홀수 별자리 앞 15° 사자, 뒤 15° 게 / 짝수는 반대
 *                D4 차투르탐샤 — 7°30′ 씩, 자기 별자리에서 3칸씩 순행
 *                D9 나밤샤  — 3°20′ 씩, 황경을 9배 해 이어 세는 연속식
 *                D10 다샴샤 — 3° 씩, 홀수는 자기 자리부터 짝수는 9번째부터
 */

import { planetPositions, toSidereal, PLANET_ORDER, houses } from '../core/planets.js';
import { fromJD } from '../core/astro.js';
import { NAKSHATRA_LORDS, NAKSHATRA_NAMES } from '../systems/sukyo.js';
import { vimshottari, DASHA_YEARS, DASHA_ORDER, RASHI, BHAVA } from '../systems/vedic.js';

const YEAR_DAYS = 365.2425;

/** 나이(해 단위 소수) → 달력 날짜 */
const ageToDate = (jdBirth, age) => {
  const t = fromJD(jdBirth + age * YEAR_DAYS + 9 / 24);
  return { y: t.y, m: t.m, d: t.d };
};

/** 하위 구간을 만든다. 시작은 언제나 상위 구간의 주인 자신부터 */
function subPeriods(lordOfParent, parentStartAge, parentSpanYears) {
  const start = DASHA_ORDER.indexOf(lordOfParent);
  const out = [];
  let age = parentStartAge;
  for (let i = 0; i < 9; i++) {
    const L = DASHA_ORDER[(start + i) % 9];
    const span = parentSpanYears * (DASHA_YEARS[L] / 120);
    out.push({ lord: L, fromAge: age, toAge: age + span, span });
    age += span;
  }
  return out;
}

/**
 * 빔쇼타리 전체 — MD / AD / PD (필요하면 SD).
 *
 * @param {object} input prepareInput 결과
 * @param {number} depth 1=MD, 2=+AD, 3=+PD, 4=+SD. 기본 3
 */
export function dashaTree(input, depth = 3) {
  const moonSid = toSidereal(planetPositions(input.jdUT).달.lon, input.jdUT);
  const v = vimshottari(moonSid, 0);

  const withDates = (x) => ({
    ...x,
    from: ageToDate(input.jdUT, Math.max(0, x.fromAge)),
    to: ageToDate(input.jdUT, x.toAge),
  });

  const md = v.list.map((m) => {
    const node = withDates({ ...m, span: m.toAge - m.fromAge, level: 'MD' });
    if (depth >= 2) {
      node.sub = subPeriods(m.lord, m.fromAge, m.toAge - m.fromAge).map((a) => {
        const an = withDates({ ...a, level: 'AD' });
        if (depth >= 3) {
          an.sub = subPeriods(a.lord, a.fromAge, a.span).map((p) => {
            const pn = withDates({ ...p, level: 'PD' });
            if (depth >= 4) {
              pn.sub = subPeriods(p.lord, p.fromAge, p.span).map((s) =>
                withDates({ ...s, level: 'SD' }));
            }
            return pn;
          });
        }
        return an;
      });
    }
    return node;
  });

  return {
    nak: v.nak,
    nakName: NAKSHATRA_NAMES[v.nak]?.sanskrit ?? String(v.nak + 1),
    nakLord: NAKSHATRA_LORDS[v.nak],
    balance: Math.round(v.balance * 100) / 100,
    list: md,
  };
}

/** 그 시점에 걸린 MD/AD/PD 를 한 줄로 집어낸다 */
export function dashaAt(input, tree, jd) {
  const age = (jd - input.jdUT) / YEAR_DAYS;
  const pick = (arr) => arr?.find((x) => age >= x.fromAge && age < x.toAge) ?? null;
  const md = pick(tree.list);
  const ad = md ? pick(md.sub) : null;
  const pd = ad ? pick(ad.sub) : null;
  const sd = pd ? pick(pd.sub) : null;
  return {
    age: Math.round(age * 100) / 100,
    md, ad, pd, sd,
    label: [md?.lord, ad?.lord, pd?.lord].filter(Boolean).join('–'),
  };
}

/**
 * 어느 기간 안에 들어오는 AD/PD 전환일.
 * "언제 바뀌는가"가 곧 시기 후보라서, 구간이 아니라 전환점을 돌려준다.
 */
export function dashaChanges(tree, fromYear, toYear) {
  const out = [];
  const walk = (nodes) => {
    for (const n of nodes ?? []) {
      if (n.from.y >= fromYear - 1 && n.from.y <= toYear + 1) {
        out.push({ level: n.level, lord: n.lord, from: n.from, to: n.to });
      }
      if (n.level !== 'PD') walk(n.sub);
    }
  };
  walk(tree.list);
  return out
    .filter((x) => x.from.y >= fromYear && x.from.y <= toYear)
    .sort((a, b) => (a.from.y - b.from.y) || (a.from.m - b.from.m));
}

// ─────────────────────────────────────────────────────────────
// 분할 차트 (바르가)
// ─────────────────────────────────────────────────────────────

// 분할 함수는 `core/varga.js` 로 내렸다. 이 파일이 `systems/vedic.js` 에서
// RASHI 를 가져오는 탓에, systems 쪽에서 분할 차트를 쓰면 순환 import 가
// 되기 때문이다. 기존 import 경로가 깨지지 않게 여기서 그대로 다시 내보낸다.
// 재수출만 하면 이 파일 안에서는 못 쓴다 — 함께 들여온다.
import { navamsa, dasamsa, hora, chaturthamsa, saptamsa, VARGA } from '../core/varga.js';

export { navamsa, dasamsa, hora, chaturthamsa, saptamsa, VARGA };

/** 질문 분야에 따라 어느 분할 차트를 볼지 */
export const DOMAIN_VARGA = {
  직업: ['D1', 'D10'], 이직: ['D1', 'D10'],
  결혼: ['D1', 'D9'], 관계: ['D1', 'D9'],
  재물: ['D1', 'D2', 'D10'],
  이사: ['D1', 'D4'], 주거: ['D1', 'D4'],
  자녀: ['D1', 'D7'],
  건강: ['D1'], 학업: ['D1', 'D7'],
};

/**
 * 분할 차트 한 장.
 * 라그나도 같은 규칙으로 옮기고, 하우스는 그 라그나 기준 온별자리로 센다.
 */
export function vargaChart(input, code) {
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

  const placements = {};
  for (const n of PLANET_ORDER.slice(0, 10)) {
    const s = f(sid[n]);
    placements[n] = {
      sign: RASHI[s].kr,
      signIndex: s,
      house: lagna == null ? null : ((s - lagna + 12) % 12) + 1,
      retro: trop[n].retrograde,
    };
  }
  return {
    code, lagna,
    lagnaSign: lagna == null ? null : RASHI[lagna].kr,
    placements,
  };
}

// ─────────────────────────────────────────────────────────────
// 항성 트랜싯 (고차라)
// ─────────────────────────────────────────────────────────────

/** 느린 넷만 본다. 베딕에서 사건을 만드는 것은 이쪽이다 */
const SLOW_FOUR = ['목성', '토성', '라후', '케투'];

/**
 * 출생 달(찬드라 라그나)과 라그나에서 세어 몇 번째 자리를 지나는가.
 * 사데사티(토성이 달의 12·1·2번째를 지나는 일곱 해 반)도 함께 표시한다.
 */
export function gocharaAt(input, jd) {
  const natalTrop = planetPositions(input.jdUT);
  const moonSign = Math.floor(toSidereal(natalTrop.달.lon, input.jdUT) / 30);
  let lagnaSign = null;
  if (input.timeKnown) {
    const h = houses(input.jdUT, input.place.lat, input.place.lon);
    lagnaSign = Math.floor(toSidereal(h.asc, input.jdUT) / 30);
  }

  const now = planetPositions(jd);
  const rows = SLOW_FOUR.map((p) => {
    const s = Math.floor(toSidereal(now[p].lon, jd) / 30);
    return {
      planet: p,
      sign: RASHI[s].kr,
      fromMoon: ((s - moonSign + 12) % 12) + 1,
      fromLagna: lagnaSign == null ? null : ((s - lagnaSign + 12) % 12) + 1,
      retro: now[p].retrograde,
    };
  });

  const saturn = rows.find((r) => r.planet === '토성');
  const sadeSati = saturn ? [12, 1, 2].includes(saturn.fromMoon) : false;
  const jupiter = rows.find((r) => r.planet === '목성');

  return {
    moonSign: RASHI[moonSign].kr,
    lagnaSign: lagnaSign == null ? null : RASHI[lagnaSign].kr,
    rows,
    sadeSati,
    sadeSatiPhase: !sadeSati ? null
      : saturn.fromMoon === 12 ? '첫 국면(12번째)'
      : saturn.fromMoon === 1 ? '한가운데(1번째)' : '마지막 국면(2번째)',
    // 목성이 달에서 2·5·7·9·11번째를 지나면 전통적으로 순하게 본다
    jupiterFavorable: jupiter ? [2, 5, 7, 9, 11].includes(jupiter.fromMoon) : false,
  };
}

/** 프롬프트용 — 하우스 뜻을 붙인 한 줄 */
export const bhavaName = (n) => (BHAVA[n] ? `${n}하우스(${BHAVA[n][0]}·${BHAVA[n][1]})` : `${n}하우스`);

export function formatDasha(d) {
  if (!d.md) return '다샤 밖';
  const f = (x) => (x ? `${x.lord} ${x.from.y}.${x.from.m}~${x.to.y}.${x.to.m}` : '');
  return [f(d.md), f(d.ad), f(d.pd)].filter(Boolean).join(' / ');
}
