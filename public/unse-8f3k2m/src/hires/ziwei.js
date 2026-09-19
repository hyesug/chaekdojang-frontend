/**
 * ziwei.js — 자미두수를 대한·유년·유월까지 내려 본다
 *
 * 기존 systems/jamidusu.js 는 원국 열두 궁과 생년사화까지만 세운다.
 * 시기 운세는 "그 해 지지가 원국의 어느 궁에 얹히는가" 한 줄이 전부다.
 * 그걸로는 "언제"를 못 좁힌다. 자미두수에서 시기를 보는 정통 방식은
 * 판을 층마다 다시 까는 것이기 때문이다.
 *
 *   원국(本命) → 대한(大限, 십 년) → 유년(流年, 한 해) → 유월(流月, 한 달)
 *
 * 각 층마다 명궁이 옮겨 가고, 열두 궁 이름이 통째로 다시 붙고,
 * 그 층의 천간으로 사화가 새로 떨어진다. 같은 자리에 여러 층의 사화가
 * 겹치면 그 영역이 실제로 움직인다고 본다.
 *
 * ── 유파 고지 ──────────────────────────────────────────────
 * 자미두수는 유파마다 계산법이 갈린다. 여기서는 아래 한 가지 기준을 골라
 * 처음부터 끝까지 일관되게 쓴다. 다른 기준을 섞지 않는다.
 *
 *   대한 시작 나이 : 오행국 수 (수2국→2세, 목3국→3세, 금4국→4세,
 *                    토5국→5세, 화6국→6세). 나이는 세는나이(허세).
 *   대한 진행 방향 : 양남음녀 순행, 음남양녀 역행 (원국 명궁에서 출발)
 *   유년 명궁      : 그 해 태세(太歲) 지지가 있는 궁. 해의 경계는 이 사이트가
 *                    쓰는 입춘 기준 사주 연도를 따른다
 *   유월 명궁      : 두군법(斗君法). 유년 태세궁에서 정월을 일으켜 생월까지
 *                    역행하고, 그 자리에서 자시를 일으켜 생시까지 순행한 궁이
 *                    그 해 정월 궁(두군)이다. 유월은 거기서 순행한다
 *   사화 기준 천간 : 생년사화=생년 천간 · 대한사화=대한 명궁의 궁간 ·
 *                    유년사화=태세 천간 · 유월사화=유월 명궁의 궁간
 *   보조 네 별      : 좌보=辰에서 정월 기산 순행, 우필=戌에서 정월 기산 역행,
 *                    문창=戌에서 자시 기산 역행, 문곡=辰에서 자시 기산 순행
 *
 * 보조 네 별을 새로 얹은 이유는 따로 있다. 사화표가 문창·문곡·좌보·우필을
 * 가리키는데 판에 그 별이 없으면 그 해 사화가 통째로 허공에 떨어진다.
 * 원래 있어야 할 별을 표준 배치로 놓은 것이지, 없던 규칙을 만든 것이 아니다.
 */

import { BRANCHES, BRANCHES_KR, STEMS, STEMS_KR, STEM_YIN } from '../core/ganzhi.js';
import { lunarToSolar } from '../core/lunar.js';
import {
  PALACES, NAYEUM, GUK, STARS, ZIWEI_GROUP, TIANFU_GROUP, SIHWA, SIHWA_LABEL,
} from '../systems/jamidusu.js';

const mod12 = (n) => ((n % 12) + 12) % 12;
const mod10 = (n) => ((n % 10) + 10) % 10;

/** 사화 네 가지의 짧은 이름 */
export const SIHWA_KIND = ['화록', '화권', '화과', '화기'];

/** 궁간 — 오호둔으로 인궁 천간을 잡고 거기서 순행한다 */
export function palaceStems(yearStem) {
  const inStem = mod10((yearStem % 5) * 2 + 2);   // 인궁(2번 지지)의 천간
  const out = new Array(12);
  for (let b = 0; b < 12; b++) out[b] = mod10(inStem + b - 2);
  return out;
}

/** 60갑자 순번 */
function sexagenary(stem, branch) {
  for (let i = 0; i < 60; i++) if (i % 10 === stem && i % 12 === branch) return i;
  return 0;
}

/**
 * 원국 판을 세운다.
 *
 * 별 배치 공식은 systems/jamidusu.js 와 같은 것을 쓴다. 숫자를 바꾸지 않았다.
 * 달라진 것은 보조 네 별을 함께 놓는 것과, 결과를 층 해석에 쓰기 좋게
 * 되돌려 준다는 점뿐이다.
 */
export function buildBoard(input) {
  const { lunar, hourBranch, sajuYear } = input;
  const lm = lunar.month;
  const ld = lunar.day;

  const myeong = mod12(2 + lm - 1 - hourBranch);
  const sin = mod12(2 + lm - 1 + hourBranch);

  const yearStem = mod10(sajuYear - 4);
  const stems = palaceStems(yearStem);
  const guk = GUK[NAYEUM[Math.floor(sexagenary(stems[myeong], myeong) / 2)]];

  const mok = Math.ceil(ld / guk.n);
  const rem = mok * guk.n - ld;
  const ziwei = mod12(2 + mok - 1 + (rem % 2 === 0 ? rem : -rem));
  const tianfu = mod12(4 - ziwei);

  const board = Array.from({ length: 12 }, () => []);
  for (const [n, o] of ZIWEI_GROUP) board[mod12(ziwei + o)].push(n);
  for (const [n, o] of TIANFU_GROUP) board[mod12(tianfu + o)].push(n);

  // 보조 네 별 — 사화가 가리키는 자리라서 판에 함께 놓아야 한다
  const helpers = {
    좌보: mod12(4 + (lm - 1)),
    우필: mod12(10 - (lm - 1)),
    문창: mod12(10 - hourBranch),
    문곡: mod12(4 + hourBranch),
  };
  for (const [n, b] of Object.entries(helpers)) board[b].push(n);

  return { myeong, sin, guk, ziwei, tianfu, board, helpers, stems, yearStem, mainStars: board[myeong] };
}

/** 어느 층의 명궁이 주어지면 그 층의 열두 궁 이름을 지지에 붙인다 */
export function palaceMap(myeongBranch) {
  const byBranch = new Array(12);
  PALACES.forEach(([kr], i) => { byBranch[mod12(myeongBranch - i)] = kr; });
  return byBranch;
}

/** 특정 궁 이름이 어느 지지에 있는가 */
export function palaceBranch(myeongBranch, name) {
  const i = PALACES.findIndex(([kr]) => kr === name);
  return i < 0 ? null : mod12(myeongBranch - i);
}

/**
 * 한 천간이 만드는 사화가 판의 어느 지지에 떨어지는가.
 * 별이 판에 없으면 (희귀하지만) 자리 없음으로 남긴다 — 지어내지 않는다.
 */
export function sihwaOn(board, stemIndex) {
  const list = SIHWA[STEMS_KR[stemIndex]] ?? [];
  return list.map((star, i) => {
    const at = board.findIndex((arr) => arr.includes(star));
    return {
      star, kind: SIHWA_KIND[i], label: SIHWA_LABEL[i],
      branch: at >= 0 ? at : null,
      branchName: at >= 0 ? BRANCHES[at] : null,
    };
  });
}

/**
 * 대한 열둘 — 십 년씩.
 * @returns {Array<{n, branch, fromAge, toAge, fromYear, toYear, palaceOfNatal, stem}>}
 */
export function decadeLimits(input, b) {
  const yangYear = STEM_YIN[b.yearStem] === 0;
  const forward = yangYear === input.isMale;      // 양남음녀 순행
  const natalMap = palaceMap(b.myeong);

  const out = [];
  for (let n = 1; n <= 12; n++) {
    const branch = mod12(b.myeong + (forward ? n - 1 : -(n - 1)));
    const fromAge = b.guk.n + 10 * (n - 1);       // 허세
    out.push({
      n, branch, forward,
      fromAge, toAge: fromAge + 9,
      // 허세 1 = 태어난 사주 연도. 달력 연도로 옮겨 둔다
      fromYear: input.sajuYear + fromAge - 1,
      toYear: input.sajuYear + fromAge + 8,
      palaceOfNatal: natalMap[branch],            // 원국에서는 무슨 궁이었나
      stem: b.stems[branch],
      stars: b.board[branch],
    });
  }
  return out;
}

/** 그 사주 연도에 걸린 대한 */
export function decadeAt(limits, sajuYear) {
  return limits.find((d) => sajuYear >= d.fromYear && sajuYear <= d.toYear) ?? null;
}

/** 유년 한 해 — 태세궁이 곧 유년 명궁 */
export function annualLayer(b, sajuYear) {
  const branch = mod12(sajuYear - 4);
  const stem = mod10(sajuYear - 4);
  return {
    sajuYear, branch, stem,
    gz: STEMS[stem] + BRANCHES[branch],
    map: palaceMap(branch),
    sihwa: sihwaOn(b.board, stem),               // 유년사화 — 태세 천간
    palaceOfNatal: palaceMap(b.myeong)[branch],
  };
}

/**
 * 유월 열둘 — 두군법.
 * 음력 달이 기준이라 각 달의 양력 구간을 함께 돌려준다.
 */
export function monthLayers(input, b, sajuYear) {
  const taesui = mod12(sajuYear - 4);
  const ducun = mod12(taesui - (input.lunar.month - 1) + input.hourBranch);

  const out = [];
  for (let m = 1; m <= 12; m++) {
    const branch = mod12(ducun + (m - 1));
    let from = null;
    try {
      from = lunarToSolar(sajuYear, m, 1);
    } catch {
      from = null;   // 그 해에 없는 달이면 구간을 비운다. 지어내지 않는다
    }
    out.push({
      lunarMonth: m, branch,
      from,
      stem: b.stems[branch],
      map: palaceMap(branch),
      stars: b.board[branch],
      sihwa: sihwaOn(b.board, b.stems[branch]),   // 유월사화 — 유월 명궁의 궁간
      palaceOfNatal: palaceMap(b.myeong)[branch],
    });
  }
  return { ducun, months: out };
}

/**
 * 질문 분야에 따라 볼 궁을 고른다.
 * 여기 없는 분야는 명궁만 본다 — 억지로 궁을 배정하지 않는다.
 */
export const DOMAIN_PALACES = {
  직업: ['명궁', '관록궁', '천이궁', '재백궁'],
  이직: ['명궁', '관록궁', '천이궁', '재백궁'],
  재물: ['재백궁', '관록궁', '전택궁', '복덕궁'],
  결혼: ['명궁', '부처궁', '복덕궁', '전택궁'],
  관계: ['명궁', '부처궁', '복덕궁', '노복궁'],
  이사: ['명궁', '전택궁', '천이궁'],
  주거: ['전택궁', '천이궁', '명궁'],
  건강: ['명궁', '질액궁', '복덕궁'],
  학업: ['명궁', '자녀궁', '관록궁'],
};

/**
 * 층을 겹쳐 본다 — 이 파일에서 제일 중요한 함수.
 *
 * 같은 궁(또는 같은 지지)이 원국·대한·유년·유월에서 되풀이해 켜지면
 * 그 영역이 실제로 움직인다고 본다. 여기서는 몇 겹이 겹쳤는지만 센다.
 * 사건의 모양을 짐작하는 일은 이 층에서 하지 않는다.
 */
export function overlapFor(b, domain, layers) {
  const names = DOMAIN_PALACES[domain] ?? ['명궁'];
  const natalMap = palaceMap(b.myeong);

  const rows = names.map((name) => {
    const hits = [];
    for (const L of layers) {
      const br = palaceBranch(L.myeongBranch, name);
      if (br == null) continue;
      const sihwaHere = (L.sihwa ?? []).filter((s) => s.branch === br);
      hits.push({
        layer: L.label,
        branch: br,
        branchName: BRANCHES[br],
        stars: b.board[br],
        natalPalace: natalMap[br],
        sihwa: sihwaHere.map((s) => `${s.star}${s.kind}`),
      });
    }
    // 같은 지지에 여러 층의 같은 이름 궁이 겹치면 무게가 커진다
    const counts = new Map();
    for (const h of hits) counts.set(h.branch, (counts.get(h.branch) ?? 0) + 1);
    const repeated = [...counts.entries()].filter(([, n]) => n >= 2)
      .map(([br, n]) => ({ branch: br, branchName: BRANCHES[br], layers: n }));
    const sihwaCount = hits.reduce((t, h) => t + h.sihwa.length, 0);
    const bad = hits.reduce((t, h) => t + h.sihwa.filter((x) => x.endsWith('화기')).length, 0);

    return { palace: name, hits, repeated, sihwaCount, hwagi: bad };
  });

  return {
    domain,
    rows,
    // 층을 넘나들며 같은 자리가 반복 활성화된 횟수 — 가중치의 근거
    repeatScore: rows.reduce((t, r) => t + r.repeated.reduce((u, x) => u + x.layers - 1, 0), 0),
    sihwaScore: rows.reduce((t, r) => t + r.sihwaCount, 0),
    hwagiCount: rows.reduce((t, r) => t + r.hwagi, 0),
  };
}

/**
 * 한 시점에 대해 네 층을 통째로 세운다.
 * @returns {{board, natal, decade, annual, month, layers}}
 */
export function stackAt(input, sajuYear, lunarMonth = null) {
  const b = buildBoard(input);
  const limits = decadeLimits(input, b);
  const decade = decadeAt(limits, sajuYear);
  const annual = annualLayer(b, sajuYear);
  const ml = monthLayers(input, b, sajuYear);
  const month = lunarMonth ? ml.months[lunarMonth - 1] : null;

  const layers = [
    {
      label: '원국', myeongBranch: b.myeong,
      sihwa: sihwaOn(b.board, b.yearStem),
    },
    ...(decade ? [{
      label: '대한', myeongBranch: decade.branch,
      sihwa: sihwaOn(b.board, decade.stem),
    }] : []),
    {
      label: '유년', myeongBranch: annual.branch,
      sihwa: annual.sihwa,
    },
    ...(month ? [{
      label: '유월', myeongBranch: month.branch,
      sihwa: month.sihwa,
    }] : []),
  ];

  return { board: b, limits, decade, annual, monthLayers: ml, month, layers };
}

/** 프롬프트용 한 줄 — 층마다 명궁 지지와 그 자리 별 */
export function formatLayers(b, layers) {
  return layers.map((L) =>
    `${L.label} 명궁 ${BRANCHES[L.myeongBranch]}(${BRANCHES_KR[L.myeongBranch]})` +
    `${b.board[L.myeongBranch].length ? ' ' + b.board[L.myeongBranch].join('·') : ' 공궁'}`
  ).join(' | ');
}

export { PALACES, STARS };
