/**
 * lineage.js — **같은 것을 두 번 세지 않기 위한 계보표**
 *
 * ── 왜 필요한가 (실측) ─────────────────────────────────────
 * 열다섯을 한 표씩 세면 같은 재료를 쓰는 체계가 여러 표를 갖는다.
 *
 *   주역·태을·토정   셋 다 팔괘로 말한다 — 같은 표를 세 번 읽는 것
 *   카발라·타로      둘 다 생년월일 숫자에서 나온다
 *   태국·마하보테    둘 다 출생 요일 행성에서 나온다
 *
 * 열한 명에서 재 보니 태을 0.717 · 마하보테 0.800(사람 사이 코사인,
 * 낮을수록 사람을 잘 구별함)으로 구별력이 낮은데도 각각 한 표씩 들고
 * 있었다. 같은 계보는 **표 하나를 나눠 갖게** 한다.
 *
 * ── 반대쪽 ────────────────────────────────────────────────
 * 계보가 전혀 다른 체계들이 같은 축을 가리키면 그건 값어치가 있다.
 * 사주(간지)·자미(성요)·점성(황도)·베딕(항성황도)은 계산 재료가 서로
 * 다르므로, 넷이 겹치면 `consensus` 로 센다.
 */

/** 체계 → 계보. 같은 계보끼리는 독립 증거가 아니다 */
export const LINEAGE = {
  saju: 'ganzhi',          // 간지 60갑자
  jamidusu: 'ziwei',       // 자미 성요 (음력 + 시지)
  astrology: 'tropical',   // 황도 12궁 + 하우스
  vedic: 'jyotish',        // 항성 황도 + 분할도
  juyeok: 'trigram',       // 팔괘
  taeeul: 'trigram',       // 팔괘
  tojeong: 'trigram',      // 팔괘
  hongguk: 'qimen',        // 기문 팔문
  yukim: 'liuren',         // 십이천장
  gujeong: 'jiuxing',      // 구성
  sukyo: 'nakshatra',      // 28수
  kabbalah: 'numerology',  // 생년월일 수
  tarot: 'numerology',     // 생일 카드 — 역시 생년월일 수에서 나온다
  mahabote: 'weekday',     // 출생 요일 행성
  thai: 'weekday',         // 출생 요일 행성
};

/** 계산 재료가 서로 충분히 다른 계보들 — 겹치면 consensus 로 센다 */
export const INDEPENDENT_LINEAGES = ['ganzhi', 'ziwei', 'tropical', 'jyotish'];

export const lineageOf = (systemId) => LINEAGE[systemId] ?? systemId;

/**
 * 같은 계보가 몇 개나 말했는지로 나눈다.
 *
 * 팔괘 셋이 같은 말을 하면 그건 한 번 말한 것이다. 1/n 로 나눈다 —
 * 1/√n 같은 완만한 감쇠도 생각했지만, 셋이 **문자 그대로 같은 표**를
 * 읽는 경우라 온전히 나누는 쪽이 맞다.
 */
export function independenceFactors(systemIds) {
  const count = {};
  for (const id of systemIds) {
    const L = lineageOf(id);
    count[L] = (count[L] ?? 0) + 1;
  }
  return Object.fromEntries(systemIds.map((id) => [id, 1 / count[lineageOf(id)]]));
}

/**
 * 독립 계보 몇 개가 이 축을 가리키는가.
 * `ensemble.js` 의 consensus 보정이 이 수를 쓴다.
 */
export function agreeingLineages(reads, axis, floor = 0.35) {
  const set = new Set();
  for (const r of reads) {
    if ((r.features?.[axis] ?? 0) < floor) continue;
    set.add(lineageOf(r.system));
  }
  return { count: set.size, lineages: [...set], independent: [...set].filter((L) => INDEPENDENT_LINEAGES.includes(L)) };
}
