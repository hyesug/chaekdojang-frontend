/**
 * yukim.js — 육임 (大六壬)
 *
 * 원래 "지금 이 순간"을 두고 치는 점이다. 여기서는 태어난 순간을 점시로 삼아
 * 그 사람이 세상에 놓인 구도를 읽는다.
 *
 * 판 세우는 순서
 *   1. 월장 — 그때 태양이 머문 자리. 절기의 중기마다 한 칸씩 옮겨간다
 *   2. 천반 — 월장을 태어난 시각의 지지 위에 얹고 열둘을 돌린다
 *   3. 사과 — 일간의 기궁과 일지, 그리고 그 위에 올라탄 천반 넷
 *   4. 삼전 — 사과에서 극(剋)이 일어난 자리를 초전으로 삼아 셋을 뽑는다
 *   5. 십이천장 — 귀인의 자리에서 시작해 열둘을 배치한다
 *
 * 삼전을 뽑는 규칙은 아홉 가지가 있고 순서대로 적용한다.
 * 어느 규칙이 걸렸는지(과체)까지 함께 보여준다.
 */

import {
  BRANCHES, BRANCHES_KR, STEMS, STEMS_KR,
  BRANCH_ELEMENT, STEM_ELEMENT, STEM_YIN, isClash, branchRelations,
} from '../core/ganzhi.js';
import { sunLongitude, norm360 } from '../core/astro.js';
import { j } from '../core/josa.js';
import { result } from './_base.js';

export const meta = {
  id: 'yukim',
  name: '육임',
  hanja: '大六壬',
  desc: '태어난 순간을 점시로 삼아 천지반과 사과삼전으로 구도를 읽는다',
  needsTime: true,
  requiresTime: true,   // 시각이 없으면 판 자체가 안 서는 체계
  needsPlace: false,
};

/** 일간이 몸을 붙이는 지지 — 천간에는 자리가 없어 지지를 빌린다 */
const GIGUNG = [2, 4, 5, 7, 5, 7, 8, 10, 11, 1];  // 甲寅 乙辰 丙巳 丁未 戊巳 己未 庚申 辛戌 壬亥 癸丑

/** 십이천장 — 귀인에서 시작한다 */
const GENERALS = [
  ['귀인', '貴人', '도움과 윗사람. 일이 순조롭게 풀리는 자리'],
  ['등사', '螣蛇', '놀라움과 불안. 헛된 근심이 생기는 자리'],
  ['주작', '朱雀', '말과 문서. 소식이 오거나 구설이 이는 자리'],
  ['육합', '六合', '화합과 결합. 인연과 거래가 맺어지는 자리'],
  ['구진', '勾陳', '지체와 분쟁. 얽혀서 더뎌지는 자리'],
  ['청룡', '靑龍', '재물과 경사. 가장 반기는 자리'],
  ['천공', '天空', '허와 거짓. 기대가 비는 자리'],
  ['백호', '白虎', '질병과 사고. 급하고 험한 일의 자리'],
  ['태상', '太常', '의식과 안정. 먹고 입는 일의 자리'],
  ['현무', '玄武', '도둑과 은밀함. 잃어버리고 감춰지는 자리'],
  ['태음', '太陰', '숨음과 보호. 조용히 지켜지는 자리'],
  ['천후', '天后', '여인과 내밀함. 사적인 인연의 자리'],
];

/** 귀인이 앉는 자리 — 일간과 낮밤에 따라 다르다 */
const NOBLE = {
  0: [1, 7], 4: [1, 7], 6: [1, 7],      // 甲戊庚
  1: [0, 8], 5: [0, 8],                 // 乙己
  2: [11, 9], 3: [11, 9],               // 丙丁
  7: [6, 2],                            // 辛
  8: [5, 3], 9: [5, 3],                 // 壬癸
};

/** 오행 상극 — a가 b를 이기는가 */
const overcomes = (a, b) => (a + 2) % 5 === b;

/** 월장 — 태양이 든 자리. 우수(황경 330도)부터 해(亥)가 시작이다 */
export function monthGeneral(jd) {
  const lon = sunLongitude(jd);
  const step = Math.floor(norm360(lon - 330) / 30);
  return ((11 - step) % 12 + 12) % 12;
}

export function analyze(input) {
  const { jdUT, timeKnown, hourBranch } = input;
  if (!timeKnown) throw new Error('육임은 태어난 시각이 있어야 천반을 돌릴 수 있습니다');

  const dayStem = input.dayStem;
  const dayBranch = input.dayBranch;

  // 1) 월장을 점시 위에 얹는다
  const wolJang = monthGeneral(jdUT);
  const heaven = [];                       // heaven[지반] = 그 위에 올라탄 천반
  for (let i = 0; i < 12; i++) {
    heaven[i] = ((wolJang + (i - hourBranch)) % 12 + 12) % 12;
  }

  // 2) 사과
  const gi = GIGUNG[dayStem];
  const courses = [
    { label: '1과', lower: gi, upper: heaven[gi], note: `일간 ${STEMS[dayStem]}의 기궁` },
    { label: '2과', lower: heaven[gi], upper: heaven[heaven[gi]], note: '1과의 상신 위' },
    { label: '3과', lower: dayBranch, upper: heaven[dayBranch], note: '일지' },
    { label: '4과', lower: heaven[dayBranch], upper: heaven[heaven[dayBranch]], note: '3과의 상신 위' },
  ];

  // 3) 삼전 발용 — 규칙을 순서대로 적용한다
  const el = (b) => BRANCH_ELEMENT[b];
  const jeok = courses.filter((c) => overcomes(el(c.upper), el(c.lower)));   // 상이 하를 극함
  const geuk = courses.filter((c) => overcomes(el(c.lower), el(c.upper)));   // 하가 상을 극함

  let first = null;
  let style = '';

  const sameYin = (b) => (b % 2) === STEM_YIN[dayStem];

  if (jeok.length === 1) { first = jeok[0].upper; style = '적극법 (賊)'; }
  else if (jeok.length === 0 && geuk.length === 1) { first = geuk[0].upper; style = '적극법 (剋)'; }
  else if (jeok.length > 1 || geuk.length > 1) {
    const pool = jeok.length > 1 ? jeok : geuk;
    const matched = pool.filter((c) => sameYin(c.upper));
    if (matched.length === 1) { first = matched[0].upper; style = '비용법'; }
    else {
      // 섭해 — 지지의 극을 더 많이 받는 쪽을 취한다
      const score = (b) => BRANCHES.reduce((n, _, i) => n + (overcomes(el(i), el(b)) ? 1 : 0), 0);
      const best = (matched.length ? matched : pool).sort((a, b) => score(b.upper) - score(a.upper))[0];
      first = best.upper; style = '섭해법';
    }
  } else {
    // 요극 — 사과 안에 극이 없을 때 일간과의 관계로 찾는다
    const ups = courses.map((c) => c.upper);
    const toMe = ups.find((u) => overcomes(el(u), STEM_ELEMENT[dayStem]));
    const fromMe = ups.find((u) => overcomes(STEM_ELEMENT[dayStem], el(u)));
    if (toMe != null) { first = toMe; style = '요극법 (蒿矢)'; }
    else if (fromMe != null) { first = fromMe; style = '요극법 (彈射)'; }
    else {
      // 묘성 — 양일은 지반 유의 천반, 음일은 천반 유의 지반
      first = STEM_YIN[dayStem] === 0 ? heaven[9] : heaven.indexOf(9);
      style = '묘성법';
    }
  }

  const isBokeum = heaven.every((v, i) => v === i);
  const isBaneum = heaven.every((v, i) => isClash(i, v));
  if (isBokeum) style = '복음과 (천지반이 겹침)';
  if (isBaneum) style = '반음과 (천지반이 마주 봄)';

  const second = heaven[first];
  const third = heaven[second];

  // 4) 십이천장
  const isDay = hourBranch >= 3 && hourBranch <= 8;     // 卯시~申시를 낮으로 본다
  const nobleSeat = NOBLE[dayStem][isDay ? 0 : 1];
  const noblePos = heaven.indexOf(nobleSeat);            // 귀인이 올라탄 지반
  const forward = [11, 0, 1, 2, 3, 4].includes(noblePos);
  const generalAt = {};
  for (let i = 0; i < 12; i++) {
    const pos = ((noblePos + (forward ? i : -i)) % 12 + 12) % 12;
    generalAt[pos] = GENERALS[i];
  }

  const bn = (b) => `${BRANCHES[b]}(${BRANCHES_KR[b]})`;
  const gAt = (b) => generalAt[b] ? generalAt[b][0] : '';

  const facts = [
    { label: '월장', value: bn(wolJang), note: '태어날 때 태양이 머문 자리' },
    { label: '점시', value: bn(hourBranch), note: '태어난 시각의 지지' },
    { label: '일간 기궁', value: `${STEMS[dayStem]} → ${bn(gi)}`, note: '천간이 몸을 붙이는 자리' },
    { label: '과체', value: style, note: '삼전을 뽑을 때 걸린 규칙' },
    { label: '초전', value: `${bn(first)} ${gAt(first)}`, note: '일의 시작' },
    { label: '중전', value: `${bn(second)} ${gAt(second)}`, note: '과정' },
    { label: '말전', value: `${bn(third)} ${gAt(third)}`, note: '결말' },
    // 귀인은 일간이 정하는 글자이고, 그것이 어느 지반에 올라탔는지가 따로다.
    // 지반만 적어두면 그 자리가 귀인인 줄로 읽힌다.
    { label: '귀인', value: `${bn(nobleSeat)} → ${bn(noblePos)}`,
      note: `${isDay ? '주귀' : '야귀'} ${BRANCHES[nobleSeat]}가 지반 ${BRANCHES[noblePos]}에 임함 · ${forward ? '순행' : '역행'}` },
  ];

  const readings = [
    {
      title: '사과 — 지금 놓인 구도', mono: true,
      text: courses.map((c) =>
        `${c.label}  ${bn(c.upper)} / ${bn(c.lower)}  ${gAt(c.upper)}   (${c.note})`
      ).join('\n') +
      '\n위가 천반, 아래가 지반입니다. 1·2과는 이 사람 자신을, 3·4과는 그가 놓인 환경을 봅니다.',
    },
    {
      title: `삼전 — ${style}`,
      text: `초전 ${bn(first)}, 중전 ${bn(second)}, 말전 ${bn(third)}.\n` +
        `일이 ${bn(first)}에서 시작해 ${j(bn(second), '를')} 거쳐 ${j(bn(third), '로')} 끝나는 구조입니다. ` +
        (isBokeum
          ? '천반과 지반이 완전히 겹친 복음과입니다. 움직임이 막히고 안으로 눌리는 형국이라, 나아가기보다 자리를 지키는 쪽이 맞습니다.'
          : isBaneum
          ? '천반과 지반이 정면으로 마주 본 반음과입니다. 뒤집히고 오가는 형국이라 변동이 크고 왕래가 잦습니다.'
          : '사과 안에서 극이 일어난 자리를 초전으로 삼았습니다.'),
    },
    {
      title: `초전의 천장 — ${generalAt[first] ? generalAt[first][0] : '없음'}`,
      text: generalAt[first]
        ? `${generalAt[first][1]}. ${generalAt[first][2]}입니다. 일이 처음 움직일 때 이 성질이 따라붙습니다.`
        : '초전에 천장이 배치되지 않았습니다.',
    },
    {
      title: `말전의 천장 — ${generalAt[third] ? generalAt[third][0] : '없음'}`,
      text: generalAt[third]
        ? `${generalAt[third][1]}. ${generalAt[third][2]}입니다. 결말의 성격이 여기서 드러납니다.`
        : '말전에 천장이 배치되지 않았습니다.',
    },
    {
      title: '천지반', mono: true,
      text: BRANCHES.map((_, i) =>
        `지반 ${BRANCHES[i]} → 천반 ${BRANCHES[heaven[i]]} ${gAt(i)}`
      ).join('\n'),
    },
  ];

  const elements = [0, 0, 0, 0, 0];
  elements[el(first)] += 2;
  elements[el(second)] += 1;
  elements[el(third)] += 1;

  const GENERAL_TAGS = {
    귀인: ['명예', '돌봄'], 등사: ['감수성', '변화'], 주작: ['표현', '분석'],
    육합: ['사교', '돌봄'], 구진: ['인내', '책임'], 청룡: ['재물', '명예'],
    천공: ['변화', '자유'], 백호: ['결단', '실행'], 태상: ['안정', '인내'],
    현무: ['직관', '내향'], 태음: ['내향', '완벽'], 천후: ['감수성', '사교'],
  };
  const tag = GENERAL_TAGS[gAt(first)] ?? ['변화'];

  return result({
    id: meta.id,
    name: meta.name,
    hanja: meta.hanja,
    headline: `${style} · ${BRANCHES[first]}→${BRANCHES[second]}→${BRANCHES[third]}`,
    facts,
    readings,
    signals: {
      elements,
      traits: {},
      domains: { 재물: null, 관계: null, 직업: null, 건강: null, 학업: null },
      tags: tag,
      keywords: [style, gAt(first)],
    },
  });
}

// ── 궁합 ──
// 두 사람의 일간 기궁을 서로의 천반에 얹어 본다.
// 상대의 판 위에서 내가 어느 자리에 놓이는지 — 그게 육임이 보는 관계다.

export function compare(a, b) {
  const heavenOf = (x) => {
    const wj = monthGeneral(x.jdUT);
    const h = [];
    for (let i = 0; i < 12; i++) h[i] = ((wj + (i - x.hourBranch)) % 12 + 12) % 12;
    return h;
  };
  const hA = heavenOf(a), hB = heavenOf(b);
  const giA = GIGUNG[a.dayStem], giB = GIGUNG[b.dayStem];

  // 상대의 천반 위에서 내 기궁이 무엇을 만나는가
  const onB = hB[giA];     // B의 판 위에 놓인 A
  const onA = hA[giB];     // A의 판 위에 놓인 B

  const el = (x) => BRANCH_ELEMENT[x];
  const ovc = (x, y) => (x + 2) % 5 === y;
  const gen = (x, y) => (x + 1) % 5 === y;

  const judge = (me, over) => {
    if (gen(el(over), el(me))) return [22, '상대의 자리가 나를 낳아줍니다'];
    if (gen(el(me), el(over))) return [17, '내가 상대의 자리를 낳아줍니다'];
    if (el(me) === el(over)) return [19, '같은 기운이라 나란히 섭니다'];
    if (ovc(el(over), el(me))) return [8, '상대의 자리가 나를 누릅니다'];
    return [12, '내가 상대의 자리를 누릅니다'];
  };
  const [sA, tA] = judge(giA, onB);
  const [sB, tB] = judge(giB, onA);

  const rel = branchRelations(a.dayBranch, b.dayBranch);
  const relScore = rel.length ? (rel.some((r) => r.good) ? 20 : 6) : 13;

  const score = Math.max(10, Math.min(94, sA + sB + relScore + 22));
  const bn = (x) => `${BRANCHES[x]}(${BRANCHES_KR[x]})`;

  return {
    id: meta.id, name: meta.name, score,
    weight: 0.9,
    headline: `${bn(onB)} / ${bn(onA)} · 일지 ${rel.length ? rel[0].kind : '무관'}`,
    facts: [
      { label: `${a.name}의 기궁`, value: `${STEMS[a.dayStem]} → ${bn(giA)}`, note: '' },
      { label: `${b.name}의 기궁`, value: `${STEMS[b.dayStem]} → ${bn(giB)}`, note: '' },
      { label: `${b.name} 판 위의 ${a.name}`, value: bn(onB), note: tA },
      { label: `${a.name} 판 위의 ${b.name}`, value: bn(onA), note: tB },
      { label: '일지 관계', value: rel.length ? rel.map((r) => r.kind).join('·') : '무관', note: '' },
    ],
    readings: [
      {
        title: '상대의 판 위에 놓인 나',
        text: `${b.name}의 천반 위에서 ${a.name}의 자리는 ${bn(onB)}입니다. ${tA}.\n` +
          `${a.name}의 천반 위에서 ${b.name}의 자리는 ${bn(onA)}입니다. ${tB}.\n\n` +
          '육임은 원래 한 순간의 판을 읽는 점술입니다. 궁합으로 쓸 때는 서로의 판에 상대를 올려놓고 어느 자리에 떨어지는지를 봅니다. ' +
          '누르는 쪽과 눌리는 쪽이 갈리면 관계에서도 그 결이 나타납니다.',
      },
      {
        title: '일지끼리',
        text: rel.length
          ? rel.map((r) => `${r.kind}: ${r.text}`).join('\n')
          : '두 일지 사이에 합도 충도 걸리지 않습니다. 서로의 일상에 크게 간섭하지 않는 배치입니다.',
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// 시기 운세
// ─────────────────────────────────────────────────────────────
// 그 시점을 점시로 삼아 천반을 돌리고, 초전에 붙은 천장으로 본다.

const GENERAL_AREA = {
  귀인: { 총운: 14, 직장운: 12, 학업운: 8, 금전운: 5, 애정운: 5, 건강운: 4 },
  등사: { 총운: -8, 건강운: -8, 애정운: -4, 금전운: 0, 직장운: 0, 학업운: 0 },
  주작: { 총운: -3, 학업운: 10, 직장운: 4, 애정운: -6, 금전운: 0, 건강운: 0 },
  육합: { 총운: 10, 애정운: 15, 금전운: 6, 직장운: 4, 학업운: 2, 건강운: 3 },
  구진: { 총운: -7, 직장운: -6, 금전운: -5, 애정운: -3, 학업운: 0, 건강운: -3 },
  청룡: { 총운: 15, 금전운: 16, 직장운: 8, 애정운: 7, 학업운: 4, 건강운: 5 },
  천공: { 총운: -9, 금전운: -10, 직장운: -5, 애정운: -5, 학업운: 0, 건강운: 0 },
  백호: { 총운: -12, 건강운: -15, 직장운: 3, 금전운: -4, 애정운: -5, 학업운: 0 },
  태상: { 총운: 8, 금전운: 8, 건강운: 7, 애정운: 5, 직장운: 4, 학업운: 3 },
  현무: { 총운: -8, 금전운: -12, 애정운: -5, 직장운: -3, 학업운: 0, 건강운: -2 },
  태음: { 총운: 3, 학업운: 8, 건강운: 5, 애정운: 3, 금전운: 2, 직장운: 0 },
  천후: { 총운: 5, 애정운: 12, 금전운: 3, 건강운: 3, 직장운: 0, 학업운: 0 },
};

export function forecast(input, chart, period) {
  if (!input.timeKnown) return null;
  const wj = monthGeneral(period.jd);
  const hb = input.hourBranch;
  const heaven = [];
  for (let i = 0; i < 12; i++) heaven[i] = ((wj + (i - hb)) % 12 + 12) % 12;

  const gi = GIGUNG[chart.dayStem];
  const first = heaven[gi];

  const isDay = hb >= 3 && hb <= 8;
  const nobleSeat = NOBLE[chart.dayStem][isDay ? 0 : 1];
  const noblePos = heaven.indexOf(nobleSeat);
  const forward = [11, 0, 1, 2, 3, 4].includes(noblePos);
  let general = null;
  for (let i = 0; i < 12; i++) {
    const pos = ((noblePos + (forward ? i : -i)) % 12 + 12) % 12;
    if (pos === first) { general = GENERALS[i][0]; break; }
  }

  const eff = GENERAL_AREA[general] ?? {};
  const areas = {};
  for (const a of ['총운', '애정운', '금전운', '직장운', '학업운', '건강운']) {
    areas[a] = Math.max(8, Math.min(94, Math.round(50 + (eff[a] ?? 0))));
  }

  return {
    id: meta.id, name: meta.name, weight: 0.8,
    headline: `초전 ${BRANCHES[first]} · ${general ?? '천장 없음'}`,
    text: general
      ? `이 시기 초전에 ${j(general, '이')} 붙습니다. ${GENERALS.find((g) => g[0] === general)[2]}입니다.`
      : '이 시기 초전에 천장이 배치되지 않습니다.',
    areas,
  };
}

export default { meta, analyze, compare , forecast };
