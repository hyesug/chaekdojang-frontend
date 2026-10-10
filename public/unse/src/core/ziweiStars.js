/**
 * ziweiStars.js — 자미두수 보조성 배치표
 *
 * 열네 주성 말고, 그 위에 얹혀 자리의 성격을 바꾸는 별들이다. 특히 **육살성**은
 * 같은 주성이라도 그 궁의 결을 크게 돌려놓아서, 주성만 읽으면 같은 별을 가진
 * 사람이 전부 같은 답을 받게 된다.
 *
 * ── 왜 core 에 있는가 ──────────────────────────────────────
 * `hires/ziweiExt.js` 에 있던 것을 내렸다. 그 파일은 `hires/ziwei.js` 를 거쳐
 * `systems/jamidusu.js` 에 기대고 있어서, 체계 모듈 쪽에서 보조성을 쓰려면
 * 순환 import 가 된다. 표와 배치 규칙은 **연간·연지·시지만 있으면** 나오는
 * 순수 계산이라 여기로 옮겼다.
 *
 * ── 유파 고지 ──────────────────────────────────────────────
 * 화성·영성의 기점은 연지 삼합으로 잡는 방식을 쓴다(시지를 더해 자리를 정함).
 * 시주 기준으로 잡는 유파도 있으나 섞지 않는다. 지공·지겁도 시지에서
 * 각각 역행·순행으로 세는 쪽 하나만 쓴다.
 */

const mod12 = (n) => ((n % 12) + 12) % 12;

/** 연간 → 녹존 자리 (甲乙丙丁戊己庚辛壬癸) */
export const LUCUN_BY_STEM = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];

/** 연지 삼합 → 천마 자리 */
export const HORSE_BY_TRINE = {
  0: 2, 4: 2, 8: 2, 2: 8, 6: 8, 10: 8,
  5: 11, 9: 11, 1: 11, 11: 5, 3: 5, 7: 5,
};

/** 연지 삼합 → [화성 기점, 영성 기점] */
export function fireBellStart(yearBranch) {
  if ([2, 6, 10].includes(yearBranch)) return [1, 3];    // 寅午戌
  if ([8, 0, 4].includes(yearBranch)) return [2, 10];    // 申子辰
  if ([5, 9, 1].includes(yearBranch)) return [3, 10];    // 巳酉丑
  return [9, 10];                                        // 亥卯未
}

/** 연간(한글) → [천괴, 천월] */
export const NOBLE_BY_STEM = {
  갑: [1, 7], 무: [1, 7], 경: [1, 7],
  을: [0, 8], 기: [0, 8],
  병: [11, 9], 정: [11, 9],
  신: [6, 2],
  임: [3, 5], 계: [3, 5],
};

/** 여섯 살성 — 이 별이 든 자리는 흔들린다 */
export const SIX_EVIL = ['경양', '타라', '화성', '영성', '지공', '지겁'];
/** 길성 — 이 별이 든 자리는 받쳐진다 */
export const LUCKY = ['녹존', '천마', '천괴', '천월', '문창', '문곡', '좌보', '우필'];

export const STAR_MEANING = {
  경양: '날이 서는 별. 밀어붙이는 힘이자 다치는 자리',
  타라: '끄는 별. 일이 늦어지고 매듭이 잘 안 풀린다',
  화성: '급한 불. 갑작스레 터지고 갑자기 식는다',
  영성: '속으로 타는 불. 오래 끌며 신경을 갉는다',
  지공: '비는 자리. 계획이 헛돌거나 방향이 바뀐다',
  지겁: '새는 자리. 돈과 힘이 빠져나간다',
  녹존: '녹(祿)의 별. 먹을 것과 자리가 붙는다',
  천마: '역마. 움직이고 옮기고 오간다',
  천괴: '귀인. 윗사람이 끌어 준다',
  천월: '귀인. 뜻밖의 도움이 온다',
  문창: '글과 시험의 별',
  문곡: '말과 재주의 별',
  좌보: '곁에서 돕는 별',
  우필: '곁에서 돕는 별',
};

/**
 * 살성·녹존·천마·귀인의 자리를 구한다.
 *
 * 문창·문곡·좌보·우필은 월지·시지로 따로 놓이므로 여기서 다루지 않는다
 * (`hires/ziwei.js` 의 `buildBoard` 가 `helpers` 로 준다).
 *
 * @param {number} yearStem   연간 0~9
 * @param {number} yearBranch 연지 0~11
 * @param {number} hourBranch 시지 0~11
 * @param {string} yearStemKr 연간 한글 ('갑'…)
 */
export function auxPlacements(yearStem, yearBranch, hourBranch, yearStemKr) {
  const lucun = LUCUN_BY_STEM[yearStem];
  const [fireFrom, bellFrom] = fireBellStart(yearBranch);
  const [gwae, weol] = NOBLE_BY_STEM[yearStemKr] ?? [null, null];
  return {
    녹존: lucun,
    경양: mod12(lucun + 1),
    타라: mod12(lucun - 1),
    천마: HORSE_BY_TRINE[yearBranch],
    화성: mod12(fireFrom + hourBranch),
    영성: mod12(bellFrom + hourBranch),
    지겁: mod12(11 + hourBranch),
    지공: mod12(11 - hourBranch),
    ...(gwae != null ? { 천괴: gwae, 천월: weol } : {}),
  };
}

/**
 * 보조 네 별 — 좌보·우필·문창·문곡.
 *
 * **사화표가 이 넷을 쓴다.** 병년생의 화과는 문창이고 신년생의 화기도 문창이라,
 * 이 넷이 판에 없으면 "화기가 어느 궁에 떨어졌나"를 말할 수 없다.
 *
 *   좌보 = 辰에서 정월 기산 순행   우필 = 戌에서 정월 기산 역행
 *   문창 = 戌에서 자시 기산 역행   문곡 = 辰에서 자시 기산 순행
 */
export function helperPlacements(lunarMonth, hourBranch) {
  return {
    좌보: mod12(4 + (lunarMonth - 1)),
    우필: mod12(10 - (lunarMonth - 1)),
    문창: mod12(10 - hourBranch),
    문곡: mod12(4 + hourBranch),
  };
}

/**
 * 삼방사정 — 그 궁과 삼합 둘, 마주 보는 대궁.
 *
 * 자미두수는 한 궁만 보지 않는다. **네 자리를 한 묶음으로 읽는 것이 기본**이고,
 * 명궁이 비어도 이 넷 안에 별이 있으면 그 별로 읽는다. `core/ganzhi.js` 의
 * 삼합(+4·+8)·충(+6) 정의와 같은 셈이다.
 */
export const trineSquare = (branch) => ({
  self: branch,
  trine: [mod12(branch + 4), mod12(branch + 8)],
  opposite: mod12(branch + 6),
  all: [branch, mod12(branch + 4), mod12(branch + 8), mod12(branch + 6)],
});

/** 양옆 두 궁 — 낀 별이 그 자리의 성격을 바꾼다 */
export const flanking = (branch) => [mod12(branch - 1), mod12(branch + 1)];
