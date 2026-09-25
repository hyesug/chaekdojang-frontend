/**
 * nabgap.js — 납갑(納甲)과 팔궁(八宮) 배속
 *
 * 주역으로 **분야를 가리려면** 효마다 육친이 붙어야 한다. 괘사만으로는
 * "앞이 막혔다"까지는 말해도 그것이 돈 이야기인지 관계 이야기인지 가릴 수 없다.
 *
 * 육친은 두 단계로 나온다.
 *   1. **납갑** — 효마다 지지를 붙인다 (팔괘별로 정해진 표)
 *   2. **팔궁** — 그 괘가 속한 궁의 오행을 '나'로 삼고, 효 지지의 오행과
 *      생극을 따져 부모·형제·자손·처재·관귀를 정한다
 *
 * ── 유파 고지 ──────────────────────────────────────────────
 * 경방(京房) 계열의 표준 납갑을 쓴다. 팔궁 배속도 경방 팔궁괘서를 따른다 —
 * 본궁괘에서 1효부터 5효까지 차례로 뒤집고, 다시 4효를 뒤집어 유혼,
 * 거기서 하괘를 본궁으로 되돌려 귀혼을 얻는 방식이다. 표를 외워 적지 않고
 * 그 규칙으로 만들어 낸다 — 64줄을 손으로 적으면 오타가 섞인다.
 */

/** 팔괘 비트 (아래 효부터) — juyeok.js 의 TRIGRAMS 와 같은 순서 */
const TRI_BITS = [
  [1, 1, 1], // 0 건 乾
  [1, 1, 0], // 1 태 兌
  [1, 0, 1], // 2 리 離
  [1, 0, 0], // 3 진 震
  [0, 1, 1], // 4 손 巽
  [0, 1, 0], // 5 감 坎
  [0, 0, 1], // 6 간 艮
  [0, 0, 0], // 7 곤 坤
];

/** 팔괘 오행 — 0목 1화 2토 3금 4수 */
const TRI_ELEMENT = [3, 3, 1, 0, 0, 4, 2, 2];

/**
 * 납갑 지지 — [내괘 세 효, 외괘 세 효]. 아래 효부터.
 *
 * 건·진은 양괘라 子에서 둘씩 건너뛰어 순행하고, 곤·손·리·태는 음괘라
 * 역행한다. 감·간은 건 계열에서 두 칸·네 칸 밀린 자리다.
 */
const NABGAP = [
  { inner: [0, 2, 4], outer: [6, 8, 10] },   // 건 子寅辰 / 午申戌
  { inner: [5, 3, 1], outer: [11, 9, 7] },   // 태 巳卯丑 / 亥酉未
  { inner: [3, 1, 11], outer: [9, 7, 5] },   // 리 卯丑亥 / 酉未巳
  { inner: [0, 2, 4], outer: [6, 8, 10] },   // 진 子寅辰 / 午申戌
  { inner: [1, 11, 9], outer: [7, 5, 3] },   // 손 丑亥酉 / 未巳卯
  { inner: [2, 4, 6], outer: [8, 10, 0] },   // 감 寅辰午 / 申戌子
  { inner: [4, 6, 8], outer: [10, 0, 2] },   // 간 辰午申 / 戌子寅
  { inner: [7, 5, 3], outer: [1, 11, 9] },   // 곤 未巳卯 / 丑亥酉
];

/** 지지 오행 — core/ganzhi.js 의 BRANCH_ELEMENT 와 같은 값 */
const BRANCH_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];

const bitsToTri = (b) => TRI_BITS.findIndex((t) => t.every((v, i) => v === b[i]));

/**
 * 팔궁 배속을 규칙으로 만든다.
 *
 * 각 궁은 여덟 괘를 갖는다 — 본궁괘, 1~5세괘(효를 차례로 뒤집음),
 * 유혼(5세에서 4효를 되돌림), 귀혼(유혼에서 하괘를 본궁으로).
 *
 * @returns {Map<string, {palace:number, rank:number}>} '상괘,하괘' → 궁
 */
function buildPalaces() {
  const map = new Map();
  for (let p = 0; p < 8; p++) {
    const base = [...TRI_BITS[p], ...TRI_BITS[p]];       // 아래 세 효 + 위 세 효
    const put = (lines, rank) => {
      const lower = bitsToTri(lines.slice(0, 3));
      const upper = bitsToTri(lines.slice(3, 6));
      const key = `${upper},${lower}`;
      if (!map.has(key)) map.set(key, { palace: p, rank });
    };
    let cur = [...base];
    put(cur, 0);                                         // 본궁괘
    for (let i = 0; i < 5; i++) {
      cur = [...cur];
      cur[i] = cur[i] ? 0 : 1;
      put(cur, i + 1);                                   // 1세~5세
    }
    const wander = [...cur];
    wander[3] = wander[3] ? 0 : 1;
    put(wander, 6);                                      // 유혼 — 4효를 되돌린다
    const home = [...wander.slice(0, 3).map((_, i) => TRI_BITS[p][i]), ...wander.slice(3)];
    put(home, 7);                                        // 귀혼 — 하괘를 본궁으로
  }
  return map;
}

const PALACE_MAP = buildPalaces();

/** 오행 생극으로 육친을 정한다. `me` 가 나(궁의 오행) */
function relation(me, other) {
  if (me === other) return '형제';
  if ((other + 1) % 5 === me) return '부모';   // 나를 생하는 것
  if ((me + 1) % 5 === other) return '자손';   // 내가 생하는 것
  if ((me + 2) % 5 === other) return '처재';   // 내가 극하는 것
  return '관귀';                                // 나를 극하는 것
}

/**
 * 한 괘의 여섯 효에 지지와 육친을 붙인다.
 *
 * @param {number} upper 상괘 번호 (0~7, TRIGRAMS 순서)
 * @param {number} lower 하괘 번호
 * @returns {{palace:number, palaceElement:number, rank:number,
 *            lines:{n:number, branch:number, element:number, yukchin:string}[]}}
 */
export function hexagramLines(upper, lower) {
  const hit = PALACE_MAP.get(`${upper},${lower}`);
  // 규칙으로 64괘가 전부 덮이지만, 못 찾으면 조용히 틀린 값을 내지 않는다
  if (!hit) return null;

  const me = TRI_ELEMENT[hit.palace];
  const lines = [];
  for (let i = 0; i < 3; i++) {
    const b = NABGAP[lower].inner[i];
    lines.push({ n: i + 1, branch: b, element: BRANCH_EL[b], yukchin: relation(me, BRANCH_EL[b]) });
  }
  for (let i = 0; i < 3; i++) {
    const b = NABGAP[upper].outer[i];
    lines.push({ n: i + 4, branch: b, element: BRANCH_EL[b], yukchin: relation(me, BRANCH_EL[b]) });
  }
  return { palace: hit.palace, palaceElement: me, rank: hit.rank, lines };
}

/** 세효(世爻) — 그 괘에서 '나'를 대표하는 효. 궁 안의 순번이 정한다 */
const SE_BY_RANK = [6, 1, 2, 3, 4, 5, 4, 3];
export const seLine = (rank) => SE_BY_RANK[rank] ?? null;

export { TRI_ELEMENT, PALACE_MAP };
