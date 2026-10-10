/**
 * life.js — **평생을 장(章)으로 자른다**
 *
 * 열다섯 체계 가운데 **평생 구간을 내는 것이 일곱**이다. 그리고 일곱의
 * 주기가 전부 다르다.
 *
 *   사주 대운      10년 고정
 *   자미 대한      10년 고정
 *   베딕 다샤      가변 — 120년을 아홉 행성이 저마다 다른 햇수로 나눈다
 *   고전 ZR        가변 — 별자리마다 8~30년, 한 바퀴 211년 (발렌스)
 *   구성 9년 주기   9년
 *   카발라 개인년   9년
 *   태을           24년 (한 궁에 세 해)
 *
 * **주기가 다르다는 것이 핵심이다.** 10·9·24·가변이 서로 어긋나며 돌기
 * 때문에, 둘 이상이 같은 해에 함께 바뀌는 지점이 드물게 생긴다. 그 지점은
 * 어느 한 체계만 봐서는 보이지 않는다 — 열다섯을 같이 놓는 값어치가
 * 여기에 있다.
 *
 * ── 이 층이 하는 일과 안 하는 일 ───────────────────────────
 * 한다   — 구간의 경계가 언제인지 계산하고, 그 구간에 무엇이 들어 있는지
 *          (십성·별·행성·궁) 적는다. **전부 확정 계산이다.**
 * 안 한다 — 어느 구간이 좋고 나쁜지 말하지 않는다. 그 판단은 유파가 갈리고
 *          이 저장소가 검증한 적이 없다. 점수도 매기지 않는다.
 *
 * 시계열이 없는 체계(주역·육임)는 여기 들어오지 않는다. 평생 고정인 것
 * (숙요 본명숙·마하보테·태국 요일·홍국 출생국)도 장을 가르지 못하므로
 * '바탕'으로 따로 뺀다.
 */
import { computeDaeun, STEMS_KR, BRANCHES_KR } from '../../core/ganzhi.js';
import { buildBoard, decadeLimits } from '../../hires/ziwei.js';
import { dashaTree } from '../../hires/vedic.js';
import { releasing } from '../../hires/zr.js';
import { classicalChart } from '../../hires/classical.js';

/** 대운 — 사주. 열 해마다 천간·지지가 함께 바뀐다 */
function sajuChapters(input, chart, isMale) {
  const d = computeDaeun(chart, isMale, input.jdUT, 10);
  return d.list.map((x) => ({
    system: '사주', what: '대운',
    fromAge: x.fromAge, toAge: x.toAge,
    fromYear: input.year + x.fromAge, toYear: input.year + x.toAge,
    label: `${x.kr}(${x.hanja})`,
    detail: `천간 ${x.god}`,
  }));
}

/** 대한 — 자미두수. 열 해마다 명궁이 한 칸씩 옮겨 간다 */
function ziweiChapters(input) {
  const b = buildBoard(input);
  return decadeLimits(input, b).map((x) => ({
    system: '자미두수', what: '대한',
    fromAge: x.fromAge, toAge: x.toAge,
    fromYear: x.fromYear, toYear: x.toYear,
    label: `${BRANCHES_KR[x.branch]}궁 — 원국의 ${x.palaceOfNatal}`,
    detail: x.stars?.length ? x.stars.join('·') : '주성 없음(공궁)',
  }));
}

/**
 * 마하다샤 — 베딕. 아홉 행성이 저마다 다른 햇수를 갖는다.
 *
 * 첫 구간은 **태어나기 전에 시작한다** — 달이 나크샤트라를 얼마나 지났느냐로
 * 남은 몫만 갖고 태어나기 때문이다(P01 은 −13.8세부터). 0 으로 자른다.
 */
function vedicChapters(input) {
  const tree = dashaTree(input, 1);
  return (tree.list ?? []).map((x) => {
    const a = Math.max(0, Math.round(x.fromAge));
    const b = Math.round(x.toAge);
    return {
      system: '베딕', what: '마하다샤',
      fromAge: a, toAge: b,
      fromYear: input.year + a, toYear: input.year + b,
      label: `${x.lord} 다샤`,
      detail: `${b - a}년` + (x.fromAge < 0 ? ' (태어날 때 이미 진행 중)' : ''),
    };
  });
}

/**
 * 조디어컬 릴리징 — 고전 서양. 스피릿 로트에서 출발한다.
 *
 * 포춘(몸·물질)과 스피릿(뜻·직업) 둘이 있는데 여기서는 **스피릿**만 쓴다.
 * 직업과 뜻의 장을 보는 것이 이 자리의 목적이고, 둘을 같이 깔면 축이
 * 두 줄로 늘어 읽을 수가 없다. 포춘은 재물 질문에서 따로 본다.
 */
function classicalChapters(input) {
  let c = null;
  try { c = classicalChart(input); } catch { return []; }
  const spirit = c?.lots?.spirit;
  if (spirit?.sign == null) return [];
  const rel = releasing(spirit.sign, '스피릿', 100);
  return (rel.periods ?? rel.list ?? []).map((x) => ({
    system: '고전 서양', what: 'ZR 1단계 (스피릿)',
    fromAge: Math.round(x.fromAge), toAge: Math.round(x.toAge),
    fromYear: input.year + Math.round(x.fromAge),
    toYear: input.year + Math.round(x.toAge),
    label: `${x.signName ?? x.sign} 구간`,
    detail: `${Math.round(x.toAge - x.fromAge)}년`,
  }));
}

/** 한 자리 수가 될 때까지 더한다 — 수비학의 기본 셈 */
const digitRoot = (n) => {
  let v = n;
  while (v > 9) v = String(v).split('').reduce((a, c) => a + Number(c), 0);
  return v;
};

/**
 * 셈으로 도는 주기들 — 구성 9년 · 카발라 개인년 9년 · 태을 24년.
 *
 * 구성과 카발라는 둘 다 아홉 해인데 **출발점이 다르다.** 구성은 태어난 해가
 * 주기의 어디냐로 잡히고, 카발라 개인년은 `월+일+그 해`의 수뿌리라 사람마다
 * 다른 해에 1번이 온다. 같은 9년이어도 어긋나며 도는 이유다.
 */
function cycleChapters(input) {
  const out = [];
  const by = input.year;

  // 구성학 9년 — 씨 뿌리는 해(1번)부터 매듭짓는 해(9번)까지
  for (let k = 0; k < 10; k++) {
    out.push({
      system: '구성학', what: '9년 주기',
      fromAge: k * 9, toAge: k * 9 + 8,
      fromYear: by + k * 9, toYear: by + k * 9 + 8,
      label: `${k + 1}번째 아홉 해`,
      detail: '1번째가 씨 뿌리는 해, 9번째가 매듭짓는 해',
    });
  }

  // 카발라 개인년 — 개인년이 1 이 되는 해가 그 사람의 주기 시작이다
  let first = null;
  for (let y = by; y < by + 9; y++) {
    if (digitRoot(input.month + input.day + y) === 1) { first = y; break; }
  }
  if (first != null) {
    for (let k = 0; k < 10; k++) {
      const from = first + k * 9;
      out.push({
        system: '카발라', what: '개인년 9년 주기',
        fromAge: from - by, toAge: from - by + 8,
        fromYear: from, toYear: from + 8,
        label: `개인년 1 에서 다시 시작`,
        detail: '1 이 시작, 9 가 비우는 해',
      });
    }
  }

  // 태을 24년 — 여덟 궁을 세 해씩 돈다. 궁이 바뀌는 세 해 단위는 장으로
  // 쓰기엔 너무 잘아서, **한 바퀴(24년)** 를 장으로 본다.
  for (let k = 0; k < 4; k++) {
    out.push({
      system: '태을신수', what: '24년 한 바퀴',
      fromAge: k * 24, toAge: k * 24 + 23,
      fromYear: by + k * 24, toYear: by + k * 24 + 23,
      label: `${k + 1}바퀴째`,
      detail: '여덟 궁을 세 해씩 돈다',
    });
  }

  return out;
}

/**
 * 장을 한 축에 놓는다.
 *
 * @param {object} input `readFortune(...).input`
 * @param {object} chart `readFortune(...).chart`
 * @param {boolean} isMale
 */
export function lifeChapters(input, chart, isMale) {
  const groups = [
    sajuChapters(input, chart, isMale),
    ziweiChapters(input),
    vedicChapters(input),
    classicalChapters(input),
    cycleChapters(input),
  ];
  return groups.flat().filter((x) => Number.isFinite(x.fromYear));
}

/**
 * 장이 바뀌는 해 — **둘 이상이 같은 해에 함께 바뀌는 자리.**
 *
 * 주기가 서로 어긋나므로 이런 해는 드물다. 드물다는 것이 요점이다 —
 * 흔하면 아무 뜻이 없다. 몇 개가 겹쳤는지만 세고, **그래서 무슨 일이
 * 일어난다고는 말하지 않는다.** 이 저장소는 시기 예측을 두 번 쟀고
 * 두 번 다 신호가 없었다(p=0.868 / p=0.196).
 *
 * @param {number} [minSystems] 몇 개 이상 겹칠 때만 셀지
 */
export function chapterTurns(chapters, { from, to, minSystems = 2, birthYear = null } = {}) {
  const byYear = {};
  for (const c of chapters) {
    if (c.fromYear < from || c.fromYear > to) continue;
    // 태어난 해는 모두가 함께 시작하니 전환점이 아니다
    if (birthYear != null && c.fromYear === birthYear) continue;
    (byYear[c.fromYear] ??= []).push(c);
  }
  return Object.entries(byYear)
    .map(([year, list]) => ({
      year: Number(year),
      // 체계마다 나이 세는 법이 다르다(자미 대한은 두 살부터). 섞어 쓰면
      // 2002 와 2004 가 둘 다 '12세'로 나온다. 연도에서 직접 센다.
      age: birthYear != null ? Number(year) - birthYear : null,
      systems: [...new Set(list.map((x) => x.system))],
      starts: list,
    }))
    .filter((x) => x.systems.length >= minSystems)
    .sort((a, b) => a.year - b.year);
}

/** 그 해에 어느 장 안에 있는가 */
export function chaptersAt(chapters, year) {
  return chapters.filter((c) => year >= c.fromYear && year <= c.toYear);
}
