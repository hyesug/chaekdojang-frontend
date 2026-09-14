/**
 * sinsal.js — 신살(神煞)
 *
 * 일자별 운세에 붙는 '양인', '도화', '천을' 같은 표시다. 사주에서 특정
 * 날이 왜 특별한지를 한 낱말로 알려주는 오래된 장치이고, 사람들이 실제로
 * 기대하는 표기이기도 하다.
 *
 * 다른 체계와 달리 이건 해석이 아니라 표 조회라서 규칙이 분명하다.
 * 기준이 되는 글자(일간이냐 일지냐 월지냐)가 신살마다 다른 것만 주의하면 된다.
 */

/** 양인(羊刃) — 일간이 가장 왕성한 자리. 힘이 넘쳐 도리어 다치는 날 */
const YANGIN = { 0: 3, 1: 4, 2: 6, 3: 7, 4: 6, 5: 7, 6: 9, 7: 10, 8: 0, 9: 1 };

/** 삼합 묶음. 도화·역마는 이 묶음을 기준으로 돈다 */
const GROUP = [
  { members: [2, 6, 10], dohwa: 3, yeokma: 8, wolduk: 2 },  // 寅午戌 → 卯 申 丙
  { members: [8, 0, 4], dohwa: 9, yeokma: 2, wolduk: 8 },   // 申子辰 → 酉 寅 壬
  { members: [5, 9, 1], dohwa: 6, yeokma: 11, wolduk: 6 },  // 巳酉丑 → 午 亥 庚
  { members: [11, 3, 7], dohwa: 0, yeokma: 5, wolduk: 0 },  // 亥卯未 → 子 巳 甲
];
const groupOf = (branch) => GROUP.find((g) => g.members.includes(branch));

/** 천을귀인(天乙貴人) — 어려울 때 사람이 돕는 자리 */
const CHEONEUL = [
  [1, 7], [0, 8], [11, 9], [11, 9], [1, 7],
  [0, 8], [1, 7], [2, 6], [5, 3], [5, 3],
];

/** 천덕귀인(天德貴人) — 월지로 본다. 하늘이 덜어주는 자리 */
const CHEONDUK = { 2: 's7', 3: 'b8', 4: 's8', 5: 's1', 6: 'b11', 7: 's0',
                   8: 's3', 9: 'b2', 10: 's2', 11: 's5', 0: 'b5', 1: 's6' };

/**
 * 그 날에 붙는 신살을 고른다.
 *
 * @param {object} me   본인 사주 — { dayStem, dayBranch, yearBranch, monthBranch }
 * @param {object} day  그 날의 간지 — { stem, branch }
 */
export function sinsalOf(me, day) {
  const out = [];

  if (YANGIN[me.dayStem] === day.branch) out.push('양인');

  // 도화·역마는 일지를 기준으로 본다. 년지까지 함께 쓰면 한 달에 절반이
  // 표시가 붙어서 표가 아무 말도 안 하게 된다.
  const g = groupOf(me.dayBranch);
  if (g) {
    if (g.dohwa === day.branch) out.push('도화');
    if (g.yeokma === day.branch) out.push('역마');
  }

  if (CHEONEUL[me.dayStem]?.includes(day.branch)) out.push('천을');

  const gm = groupOf(me.monthBranch);
  if (gm && gm.wolduk === day.stem) out.push('월덕');

  const cd = CHEONDUK[me.monthBranch];
  if (cd) {
    const kind = cd[0], n = Number(cd.slice(1));
    if ((kind === 's' && day.stem === n) || (kind === 'b' && day.branch === n)) out.push('천덕');
  }

  return out;
}

/** 신살이 그 날을 좋게 보는가 나쁘게 보는가. 일자별 등급을 매길 때 쓴다 */
export const SINSAL_TONE = {
  천을: 1, 월덕: 1, 천덕: 1,
  역마: 0, 도화: 0,
  양인: -1,
};

/** 신살 한 줄 설명 — 표에 마우스를 올리거나 아래에 붙일 때 */
export const SINSAL_TEXT = {
  양인: '기운이 넘쳐 도리어 다치기 쉬운 날입니다. 고집을 세우지 마세요.',
  도화: '사람 눈에 띄는 날입니다. 관계에서 일이 생깁니다.',
  역마: '움직임이 있는 날입니다. 이동·출장·연락이 늘어납니다.',
  천을: '어려울 때 돕는 사람이 붙는 날입니다.',
  월덕: '탈이 나도 크게 번지지 않는 날입니다.',
  천덕: '하늘이 한 겹 덜어주는 날입니다.',
};
