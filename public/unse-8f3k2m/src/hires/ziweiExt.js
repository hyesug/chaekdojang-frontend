/**
 * ziweiExt.js — 자미두수를 살성·삼방사정·유일까지 넓힌다
 *
 * hires/ziwei.js 는 십사주성과 네 층(원국·대한·유년·유월)의 궁·사화까지
 * 세운다. 그것만으로는 "그 궁이 좋은가 나쁜가"를 가를 수 없다. 자미두수는
 * 주성 하나로 읽지 않고 **그 궁에 함께 든 길성·살성과 삼방사정을 얹어서**
 * 읽는 체계이기 때문이다.
 *
 * 여기서 더하는 것
 *   · 육살성 — 경양·타라·화성·영성·지공·지겁
 *   · 길성   — 녹존·천마·천괴·천월 (문창·문곡·좌보·우필은 ziwei.js 가 이미 놓았다)
 *   · 삼방사정 — 그 궁과 삼합으로 맺힌 둘, 그리고 마주 보는 대궁
 *   · 협궁   — 양옆 두 궁
 *   · 유일   — 하루 단위 궁과 그 사화 (날짜를 물을 때만)
 *
 * ── 유파 고지 ──────────────────────────────────────────────
 * 자미두수 보조성 배치는 유파마다 표가 갈린다. 널리 published 된 『자미두수
 * 전서』 계열 표 하나를 골라 그것만 쓴다. 섞지 않는다.
 *
 *   녹존   : 연간 — 甲寅 乙卯 丙戊巳 丁己午 庚申 辛酉 壬亥 癸子
 *   경양   : 녹존 바로 앞(순행 +1)      타라 : 녹존 바로 뒤(역행 −1)
 *   천마   : 연지 삼합 — 申子辰→寅 · 寅午戌→申 · 巳酉丑→亥 · 亥卯未→巳
 *   화성·영성 : 연지 삼합으로 기점을 잡고 생시만큼 순행
 *            寅午戌 화丑 영卯 · 申子辰 화寅 영戌 · 巳酉丑 화卯 영戌 · 亥卯未 화酉 영戌
 *   지겁   : 亥에서 자시 기산 순행      지공 : 亥에서 자시 기산 역행
 *   천괴·천월 : 연간 — 甲戊庚 丑未 · 乙己 子申 · 丙丁 亥酉 · 辛 午寅 · 壬癸 卯巳
 *   삼방사정 : 그 궁 + 4번째 + 8번째(삼합) + 7번째(대궁)
 *   유일   : 유월 명궁에서 음력 일수만큼 순행. 사화는 그 궁의 궁간 기준
 */

import { BRANCHES, BRANCHES_KR, STEMS_KR } from '../core/ganzhi.js';
import { buildBoard, palaceMap, palaceBranch, sihwaOn, DOMAIN_PALACES } from './ziwei.js';

const mod12 = (n) => ((n % 12) + 12) % 12;

// ── 보조성 배치표 ────────────────────────────────────────────

/** 연간 → 녹존 자리 */
const LUCUN_BY_STEM = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0]; // 甲乙丙丁戊己庚辛壬癸

/** 연지 삼합 → 천마 자리 */
const HORSE_BY_TRINE = { 0: 2, 4: 2, 8: 2, 2: 8, 6: 8, 10: 8, 5: 11, 9: 11, 1: 11, 11: 5, 3: 5, 7: 5 };

/** 연지 삼합 → [화성 기점, 영성 기점] */
function fireBellStart(yearBranch) {
  if ([2, 6, 10].includes(yearBranch)) return [1, 3];    // 寅午戌
  if ([8, 0, 4].includes(yearBranch)) return [2, 10];    // 申子辰
  if ([5, 9, 1].includes(yearBranch)) return [3, 10];    // 巳酉丑
  return [9, 10];                                        // 亥卯未
}

/** 연간 → [천괴, 천월] */
const NOBLE_BY_STEM = {
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
 * 원국 판에 보조성을 얹는다.
 * ziwei.js 의 buildBoard 를 건드리지 않고 따로 계산해 겹쳐 본다 —
 * 기존 화면과 테스트가 보는 판이 흔들리지 않게 하려는 것이다.
 */
export function auxStars(input) {
  const b = buildBoard(input);
  const yearStem = b.yearStem;
  const yearBranch = mod12(input.sajuYear - 4);
  const h = input.hourBranch;

  const lucun = LUCUN_BY_STEM[yearStem];
  const [fireFrom, bellFrom] = fireBellStart(yearBranch);
  const [gwae, weol] = NOBLE_BY_STEM[STEMS_KR[yearStem]] ?? [null, null];

  const at = {
    녹존: lucun,
    경양: mod12(lucun + 1),
    타라: mod12(lucun - 1),
    천마: HORSE_BY_TRINE[yearBranch],
    화성: mod12(fireFrom + h),
    영성: mod12(bellFrom + h),
    지겁: mod12(11 + h),
    지공: mod12(11 - h),
    ...(gwae != null ? { 천괴: gwae, 천월: weol } : {}),
    // ziwei.js 가 이미 놓은 넷
    ...b.helpers,
  };

  /** 지지 → 그 자리에 든 보조성들 */
  const byBranch = Array.from({ length: 12 }, () => []);
  for (const [name, br] of Object.entries(at)) byBranch[br].push(name);

  return { board: b, at, byBranch, yearBranch };
}

// ── 삼방사정 · 협궁 · 대궁 ───────────────────────────────────

/** 그 궁의 삼방사정 — 자기 자리, 삼합 둘, 마주 보는 대궁 */
export const trineSquare = (branch) => ({
  self: branch,
  trine: [mod12(branch + 4), mod12(branch + 8)],
  opposite: mod12(branch + 6),
  all: [branch, mod12(branch + 4), mod12(branch + 8), mod12(branch + 6)],
});

/** 양옆 두 궁 — 낀 별이 그 자리의 성격을 크게 바꾼다 */
export const flanking = (branch) => [mod12(branch - 1), mod12(branch + 1)];

/**
 * 한 궁을 삼방사정·협궁까지 펴서 읽는다.
 *
 * @param {object} aux  auxStars 결과
 * @param {number} branch 볼 궁의 지지
 * @param {Array} layers  ziwei.stackAt 의 layers (사화가 어디 떨어졌는지 본다)
 */
export function readPalace(aux, branch, layers = []) {
  const b = aux.board;
  const ts = trineSquare(branch);
  const flanks = flanking(branch);

  const cell = (br) => ({
    branch: br, name: BRANCHES[br],
    main: b.board[br].filter((s) => !LUCKY.includes(s)),
    aux: aux.byBranch[br],
    evil: aux.byBranch[br].filter((s) => SIX_EVIL.includes(s)),
    lucky: aux.byBranch[br].filter((s) => LUCKY.includes(s)),
    sihwa: layers.flatMap((L) => (L.sihwa ?? [])
      .filter((s) => s.branch === br)
      .map((s) => `${L.label}${s.star}${s.kind}`)),
  });

  const self = cell(branch);
  const trine = ts.trine.map(cell);
  const opposite = cell(ts.opposite);
  const flank = flanks.map(cell);

  // 삼방사정 전체에서 길성과 살성을 센다. 자미두수는 한 궁만 보지 않는다
  const group = [self, ...trine, opposite];
  const evilCount = group.reduce((t, c) => t + c.evil.length, 0);
  const luckyCount = group.reduce((t, c) => t + c.lucky.length, 0);
  const sihwaAll = group.flatMap((c) => c.sihwa);
  const hwagi = sihwaAll.filter((s) => s.endsWith('화기')).length;
  const hwarok = sihwaAll.filter((s) => s.endsWith('화록')).length;
  const hwagwon = sihwaAll.filter((s) => s.endsWith('화권')).length;

  // 협살(挾殺) — 양옆이 모두 살성이면 그 자리가 눌린다
  const squeezed = flank.every((c) => c.evil.length > 0);

  return {
    branch, self, trine, opposite, flank,
    evilCount, luckyCount, sihwaAll, hwagi, hwarok, hwagwon, squeezed,
    // 이 자리가 받쳐지는가 눌리는가 — 세기만 하고 좋고 나쁨을 단정하지 않는다
    tone: luckyCount + hwarok + hwagwon - evilCount - hwagi * 1.5,
  };
}

/** 질문 분야의 궁 하나를 층마다 펴 본다 */
export function domainPalaces(input, domain, layers) {
  const aux = auxStars(input);
  const names = DOMAIN_PALACES[domain] ?? ['명궁'];
  const natalMyeong = aux.board.myeong;

  return names.map((name) => {
    const rows = layers.map((L) => {
      const br = palaceBranch(L.myeongBranch, name);
      if (br == null) return null;
      const read = readPalace(aux, br, layers);
      return {
        layer: L.label, palace: name, branch: br, branchName: BRANCHES[br],
        natalPalace: palaceMap(natalMyeong)[br],
        main: read.self.main, evil: read.self.evil, lucky: read.self.lucky,
        sihwa: read.self.sihwa,
        trine: read.trine.map((c) => `${c.name}${c.main.join('') || '공'}`),
        opposite: `${read.opposite.name}${read.opposite.main.join('') || '공'}`,
        squeezed: read.squeezed,
        tone: Math.round(read.tone * 10) / 10,
      };
    }).filter(Boolean);

    // 같은 지지가 여러 층에서 되풀이되면 그만큼 무겁다
    const counts = new Map();
    for (const r of rows) counts.set(r.branch, (counts.get(r.branch) ?? 0) + 1);
    const repeated = [...counts.entries()].filter(([, n]) => n >= 2)
      .map(([br, n]) => ({ branch: br, branchName: BRANCHES[br], layers: n }));

    return { palace: name, rows, repeated,
      toneSum: Math.round(rows.reduce((t, r) => t + r.tone, 0) * 10) / 10 };
  });
}

// ── 유일 ─────────────────────────────────────────────────────

/**
 * 유일 — 하루 단위 궁.
 * 유월 명궁에서 음력 일수만큼 순행한 자리가 그 날의 명궁이다.
 * **날짜를 물을 때만 쓴다.** 기본 답변에 넣으면 잡음이 된다.
 *
 * @param {object} board buildBoard 결과
 * @param {number} monthBranch 그 달의 유월 명궁 지지
 * @param {number} lunarDay 음력 일
 */
export function dayLayer(board, monthBranch, lunarDay) {
  const branch = mod12(monthBranch + (lunarDay - 1));
  const stem = board.stems[branch];
  return {
    lunarDay, branch, branchName: BRANCHES[branch], krName: BRANCHES_KR[branch],
    stem,
    map: palaceMap(branch),
    stars: board.board[branch],
    sihwa: sihwaOn(board.board, stem),
    palaceOfNatal: palaceMap(board.myeong)[branch],
  };
}

/** 프롬프트용 한 줄 */
export function formatPalace(row) {
  const bits = [`${row.layer} ${row.palace} ${row.branchName}(원국 ${row.natalPalace})`];
  bits.push(row.main.length ? row.main.join('·') : '공궁');
  if (row.lucky.length) bits.push(`길성 ${row.lucky.join('·')}`);
  if (row.evil.length) bits.push(`살성 ${row.evil.join('·')}`);
  if (row.sihwa.length) bits.push(row.sihwa.join(' '));
  if (row.squeezed) bits.push('협살');
  bits.push(`삼방 ${row.trine.join('/')} 대궁 ${row.opposite}`);
  return bits.join(' · ');
}
