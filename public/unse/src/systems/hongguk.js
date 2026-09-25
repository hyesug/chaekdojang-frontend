/**
 * hongguk.js — 홍국기문 (洪局奇門)
 *
 * 기문둔갑은 중국에서 왔지만, 한국에서는 홍국(洪局)이라는 독자적인 갈래로 자리 잡았다.
 * 중국식이 천간 부호를 구궁에 배치하는 데 견줘, 홍국은 사주 여덟 글자를 전부 숫자로
 * 바꾼 뒤 그 합으로 판을 연다.
 *
 *   천반수 = 년간 + 월간 + 일간 + 시간 의 수를 더해 9로 나눈 나머지
 *   지반수 = 년지 + 월지 + 일지 + 시지 의 수를 더해 9로 나눈 나머지
 *
 * 이 두 수를 각각 중궁에 넣고 구궁을 돌린다. 동지에서 하지까지는 양둔이라
 * 순행으로, 하지에서 동지까지는 음둔이라 역행으로 배치한다.
 * 그 위에 팔문과 구성이 얹히면 판이 완성된다.
 */

import { STEMS, STEMS_KR, BRANCHES, BRANCHES_KR, ELEMENTS as ELEM } from '../core/ganzhi.js';
import { j } from '../core/josa.js';
import { sunLongitude, norm360 } from '../core/astro.js';
import { result, modFrom1 } from './_base.js';

export const meta = {
  id: 'hongguk',
  name: '홍국기문',
  hanja: '洪局奇門',
  desc: '사주 여덟 글자를 숫자로 바꿔 구궁에 펼쳐 놓고 본다',
  needsTime: true,
  requiresTime: true,   // 시각이 없으면 판 자체가 안 서는 체계
  needsPlace: false,
};

/** 구궁 — 낙서 배치 그대로 */
const PALACES = [
  null,
  { name: '감', hanja: '坎', dir: '북', el: 4, gate: '휴문', gateH: '休門', star: '천봉', starH: '天蓬' },
  { name: '곤', hanja: '坤', dir: '남서', el: 2, gate: '사문', gateH: '死門', star: '천예', starH: '天芮' },
  { name: '진', hanja: '震', dir: '동', el: 0, gate: '상문', gateH: '傷門', star: '천충', starH: '天沖' },
  { name: '손', hanja: '巽', dir: '남동', el: 0, gate: '두문', gateH: '杜門', star: '천보', starH: '天輔' },
  { name: '중', hanja: '中', dir: '중앙', el: 2, gate: '—', gateH: '', star: '천금', starH: '天禽' },
  { name: '건', hanja: '乾', dir: '북서', el: 3, gate: '개문', gateH: '開門', star: '천심', starH: '天心' },
  { name: '태', hanja: '兌', dir: '서', el: 3, gate: '경문', gateH: '驚門', star: '천주', starH: '天柱' },
  { name: '간', hanja: '艮', dir: '북동', el: 2, gate: '생문', gateH: '生門', star: '천임', starH: '天任' },
  { name: '리', hanja: '離', dir: '남', el: 1, gate: '경문', gateH: '景門', star: '천영', starH: '天英' },
];

const GATE_MEANING = {
  휴문: ['쉬어 가는 문', '무리하지 않을 때 오히려 풀립니다. 사람에게 기대고 도움을 청하기 좋은 자리입니다.', 1],
  생문: ['살리는 문', '팔문 가운데 가장 좋게 봅니다. 재물과 건강, 새로 시작하는 일이 모두 이 문을 탑니다.', 2],
  상문: ['다치는 문', '부딪치고 깨집니다. 다만 그 충돌로 낡은 것을 끊어내는 힘도 함께 있습니다.', -1],
  두문: ['막는 문', '감추고 물러서는 자리입니다. 드러내지 않고 준비할 때 힘이 됩니다.', 0],
  경문: ['드러나는 문', '밝게 보이고 이름이 오르내립니다. 문서와 소식이 오가지만 놀랄 일도 함께 옵니다.', 0],
  사문: ['멈추는 문', '끝나고 정리되는 자리입니다. 새로 벌이기에는 맞지 않고 마무리에 어울립니다.', -2],
  개문: ['여는 문', '길이 트이는 자리입니다. 공적인 일, 관청, 윗사람과 관련한 일이 잘 풀립니다.', 2],
};

/** 홍국수 — 천간은 갑1부터 열까지, 지지는 자1부터 열둘까지 */
const stemNum = (i) => i + 1;
const branchNum = (i) => i + 1;

/** 중궁에 N을 넣었을 때 각 궁에 들어가는 수 */
function layout(centerNum, forward) {
  const map = {};
  for (let p = 1; p <= 9; p++) {
    map[p] = forward
      ? ((p - 5 + centerNum - 1) % 9 + 9) % 9 + 1
      : ((5 - p + centerNum - 1) % 9 + 9) % 9 + 1;
  }
  return map;
}

export function analyze(input) {
  const { jdUT, timeKnown, yearStem, yearBranch, monthStem, monthBranch,
          dayStem, dayBranch, hourStem, hourBranch } = input;
  if (!timeKnown) throw new Error('홍국기문은 시주까지 있어야 판을 세울 수 있습니다');

  // 동지에서 하지까지가 양둔, 하지에서 동지까지가 음둔
  const lon = sunLongitude(jdUT);
  const yangdun = norm360(lon - 270) < 180;

  const heavenSum = stemNum(yearStem) + stemNum(monthStem) + stemNum(dayStem) + stemNum(hourStem);
  const earthSum = branchNum(yearBranch) + branchNum(monthBranch) + branchNum(dayBranch) + branchNum(hourBranch);

  const heavenCenter = modFrom1(heavenSum, 9);
  const earthCenter = modFrom1(earthSum, 9);

  const heaven = layout(heavenCenter, yangdun);
  const earth = layout(earthCenter, yangdun);

  // 나를 나타내는 자리 — 일간의 수가 지반에 떨어진 궁
  const myNum = modFrom1(stemNum(dayStem), 9);
  const myPalace = Number(Object.keys(earth).find((p) => earth[p] === myNum)) || 5;
  // 그 해를 나타내는 자리 — 년지의 수
  const yearNum = modFrom1(branchNum(yearBranch), 9);
  const yearPalace = Number(Object.keys(earth).find((p) => earth[p] === yearNum)) || 5;

  const P = PALACES[myPalace];
  const gate = GATE_MEANING[P.gate] ?? ['중앙', '가운데 자리라 문이 따로 붙지 않습니다. 판 전체를 아우르는 위치입니다.', 0];

  const facts = [
    { label: '천반수', value: String(heavenCenter), note: `${STEMS[yearStem]}${STEMS[monthStem]}${STEMS[dayStem]}${STEMS[hourStem]} 합 ${heavenSum} → ÷9` },
    { label: '지반수', value: String(earthCenter), note: `${BRANCHES[yearBranch]}${BRANCHES[monthBranch]}${BRANCHES[dayBranch]}${BRANCHES[hourBranch]} 합 ${earthSum} → ÷9` },
    { label: '둔', value: yangdun ? '양둔 (순행)' : '음둔 (역행)', note: yangdun ? '동지~하지 출생' : '하지~동지 출생' },
    { label: '내 궁', value: `${myPalace}궁 ${P.hanja}(${P.name})`, note: `${P.dir} · ${P.gate}${P.gateH ? `(${P.gateH})` : ''} · ${P.star}` },
    { label: '세궁', value: `${yearPalace}궁 ${PALACES[yearPalace].hanja}`, note: `${PALACES[yearPalace].dir} · 태어난 해의 자리` },
  ];

  const readings = [
    {
      title: `내 자리 — ${myPalace}궁 ${P.hanja}(${P.name}), ${P.dir}`,
      text: `일간 ${STEMS_KR[dayStem]}의 수가 ${myPalace}궁에 떨어졌습니다. 이 궁이 판 위에서 이 사람이 서 있는 자리입니다. ` +
        `${P.dir}쪽이 기본 방위가 되고, 이사나 중요한 결정에서 이 방향을 먼저 봅니다.`,
    },
    {
      title: `${P.gate}${P.gateH ? ` (${P.gateH})` : ''} — ${gate[0]}`,
      text: gate[1],
    },
    {
      title: `${P.star}(${P.starH})이 지키는 자리`,
      text: {
        천봉: '험한 것을 먼저 겪고 단단해지는 별입니다. 물처럼 낮은 데로 흘러 길을 찾습니다.',
        천예: '병과 근심을 다루는 별입니다. 남의 아픈 데를 잘 알아보아 돌보는 일과 인연이 깊습니다.',
        천충: '먼저 부딪치는 별입니다. 움직임이 빠르고 정면으로 밀어붙입니다.',
        천보: '기르고 가르치는 별입니다. 문(文)과 인연이 깊고 차분히 쌓아 올립니다.',
        천금: '가운데 자리의 별입니다. 어느 쪽으로도 치우치지 않고 중심을 잡습니다.',
        천심: '헤아리는 별입니다. 판단이 정확하고 고치고 다스리는 일에 밝습니다.',
        천주: '버티는 별입니다. 꺾이지 않고 원칙을 지키며 말로 자기를 세웁니다.',
        천임: '맡아 지키는 별입니다. 무겁고 성실해서 오래 가는 일에 강합니다.',
        천영: '드러나는 별입니다. 밝고 화려하며 이름이 나지만 그만큼 소모도 큽니다.',
      }[P.star],
    },
    {
      title: '구궁 전체 (위가 천반수, 아래가 지반수)', mono: true,
      text: [[4, 9, 2], [3, 5, 7], [8, 1, 6]].map((row) =>
        row.map((p) => {
          const mark = p === myPalace ? '*' : p === yearPalace ? '+' : ' ';
          return `${mark}${PALACES[p].hanja}${p} ${heaven[p]}/${earth[p]}`.padEnd(11);
        }).join('')
      ).join('\n') + '\n\n* 내 궁, + 세궁. 왼쪽 위가 남동, 가운데 위가 남입니다.',
    },
    {
      title: '천반과 지반이 만나는 곳',
      text: heaven[myPalace] === earth[myPalace]
        ? `내 궁에서 천반수와 지반수가 ${j(heaven[myPalace], '로')} 같습니다. 안과 밖이 일치하는 형국이라 생각한 대로 일이 진행되는 편입니다.`
        : `내 궁의 천반수는 ${heaven[myPalace]}, 지반수는 ${earth[myPalace]}입니다. ` +
          (heaven[myPalace] > earth[myPalace]
            ? '위가 아래보다 큽니다. 뜻이 현실보다 앞서 나가는 구조라, 생각을 땅에 내려놓는 과정이 늘 필요합니다.'
            : '아래가 위보다 큽니다. 실제 역량이 드러난 것보다 큰 구조라, 자기를 표현하는 쪽에 힘을 실으면 달라집니다.'),
    },
  ];

  const elements = [0, 0, 0, 0, 0];
  elements[P.el] += 2;
  elements[PALACES[yearPalace].el] += 1;

  const GATE_TAGS = {
    휴문: ['안정', '돌봄'], 생문: ['재물', '실행'], 상문: ['결단', '변화'],
    두문: ['내향', '완벽'], 경문: ['표현', '명예'], 사문: ['인내', '변화'], 개문: ['명예', '주도'],
  };

  return result({
    id: meta.id,
    name: meta.name,
    hanja: meta.hanja,
    headline: `${myPalace}궁 ${P.hanja} · ${P.gate} · ${P.dir} · ${yangdun ? '양둔' : '음둔'}`,
    facts,
    readings,
    signals: {
      elements,
      traits: {},
      domains: {
        재물: 50 + gate[2] * 8,
        관계: null,
        직업: 50 + gate[2] * 6,
        건강: 50 + (P.star === '천예' ? -10 : 0),
        학업: 50 + (P.star === '천보' ? 12 : 0),
      },
      tags: GATE_TAGS[P.gate] ?? ['안정'],
      keywords: [`${P.name}궁`, P.gate, P.star],
    },
  });
}

// ── 궁합 ──
// 두 사람이 구궁 위에서 각각 어느 자리에 섰는지를 보고,
// 그 두 궁의 오행과 방위 관계로 읽는다.

export function compare(a, b) {
  const palaceOf = (x) => {
    const lon = sunLongitude(x.jdUT);
    const yang = norm360(lon - 270) < 180;
    const es = branchNum(x.yearBranch) + branchNum(x.monthBranch) + branchNum(x.dayBranch) + branchNum(x.hourBranch);
    const earth = layout(modFrom1(es, 9), yang);
    const my = modFrom1(stemNum(x.dayStem), 9);
    const p = Number(Object.keys(earth).find((k) => earth[k] === my)) || 5;
    return { p, P: PALACES[p], yang };
  };
  const A = palaceOf(a), B = palaceOf(b);

  const gen = (x, y) => (x + 1) % 5 === y;
  const ovc = (x, y) => (x + 2) % 5 === y;
  const eA = A.P.el, eB = B.P.el;

  let score, kind, text;
  if (A.p === B.p) {
    score = 76; kind = '같은 궁';
    text = `두 사람이 구궁 위에서 같은 자리에 섰습니다. 세상을 같은 방향에서 보고 있다는 뜻이라 말이 잘 통합니다. 같은 문(${A.P.gate})을 쓰기 때문에 기회도 위험도 같은 얼굴로 찾아옵니다.`;
  } else if (gen(eA, eB) || gen(eB, eA)) {
    score = 84; kind = '상생';
    const giver = gen(eA, eB) ? a.name : b.name;
    text = `두 궁의 오행이 상생합니다. ${giver} 쪽의 기운이 상대를 키워주는 배치라, 함께 있을 때 일이 잘 풀립니다. 홍국기문에서 가장 반기는 조합입니다.`;
  } else if (eA === eB) {
    score = 70; kind = '같은 오행';
    text = '궁은 다르지만 오행이 같습니다. 방식은 달라도 지향하는 바가 비슷해 부딪칠 일이 적습니다.';
  } else if (ovc(eA, eB)) {
    score = 42; kind = '상극';
    text = `${a.name}의 궁이 ${b.name}의 궁을 누릅니다. ${j(a.name, '이')} 의도하지 않아도 상대가 위축되는 배치라, 결정 권한을 나눠 갖는 편이 좋습니다.`;
  } else {
    score = 42; kind = '상극';
    text = `${b.name}의 궁이 ${a.name}의 궁을 누릅니다. ${a.name} 쪽이 자기 자리를 분명히 하지 않으면 계속 밀리게 됩니다.`;
  }

  const opposite = { 북: '남', 남: '북', 동: '서', 서: '동', 북동: '남서', 남서: '북동', 남동: '북서', 북서: '남동', 중앙: null };
  const facing = opposite[A.P.dir] === B.P.dir;

  const gateTone = { 생문: 2, 개문: 2, 휴문: 1, 두문: 0, 경문: 0, 상문: -1, 사문: -2 };
  const tone = (gateTone[A.P.gate] ?? 0) + (gateTone[B.P.gate] ?? 0);
  score = Math.max(10, Math.min(94, score + tone * 3));

  return {
    id: meta.id, name: meta.name, score,
    weight: 0.9,
    headline: `${A.P.hanja}궁 × ${B.P.hanja}궁 · ${kind}`,
    facts: [
      { label: `${a.name}`, value: `${A.p}궁 ${A.P.hanja}`, note: `${A.P.dir} · ${A.P.gate}` },
      { label: `${b.name}`, value: `${B.p}궁 ${B.P.hanja}`, note: `${B.P.dir} · ${B.P.gate}` },
      { label: '오행 관계', value: kind, note: `${ELEM[eA]} / ${ELEM[eB]}` },
      { label: '방위', value: facing ? '정면으로 마주 봄' : `${A.P.dir} / ${B.P.dir}`, note: '' },
    ],
    readings: [
      { title: `${A.P.hanja}궁 × ${B.P.hanja}궁 — ${kind}`, text },
      {
        title: '두 사람의 문',
        text: `${j(a.name, '은')} ${A.P.gate}, ${j(b.name, '은')} ${j(B.P.gate, '을')} 씁니다. ` +
          (A.P.gate === B.P.gate
            ? '같은 문이라 기회가 들어오는 통로가 같습니다. 함께 움직일 때 효율이 좋습니다.'
            : '문이 달라 기회가 들어오는 통로가 다릅니다. 한쪽이 막혔을 때 다른 쪽이 뚫려 있는 경우가 많아, 서로 보완이 됩니다.') +
          (facing ? '\n\n두 궁이 정면으로 마주 보고 있습니다. 기문에서는 이 배치를 서로를 끌어당기면서 동시에 견제하는 형국으로 봅니다.' : ''),
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// 시기 운세
// ─────────────────────────────────────────────────────────────
// 그 시기의 수를 구궁에 넣고, 본명궁이 어떤 문을 만나는지 본다.

const GATE_AREA = {
  생문: { 총운: 14, 금전운: 15, 건강운: 12, 직장운: 8, 애정운: 6, 학업운: 5 },
  개문: { 총운: 13, 직장운: 15, 금전운: 8, 학업운: 7, 애정운: 4, 건강운: 5 },
  휴문: { 총운: 7, 건강운: 10, 애정운: 8, 금전운: 3, 직장운: 2, 학업운: 4 },
  두문: { 총운: -3, 학업운: 7, 직장운: -4, 금전운: -4, 애정운: -6, 건강운: 2 },
  경문: { 총운: 0, 학업운: 8, 직장운: 5, 애정운: -3, 금전운: 2, 건강운: -3 },
  상문: { 총운: -9, 건강운: -12, 직장운: -4, 애정운: -7, 금전운: -5, 학업운: 0 },
  사문: { 총운: -13, 금전운: -10, 건강운: -12, 직장운: -7, 애정운: -8, 학업운: -3 },
};

export function forecast(input, chart, period) {
  if (!input.timeKnown) return null;
  const yang = norm360(sunLongitude(period.jd) - 270) < 180;
  const es = branchNum(period.gz.year.branch) + branchNum(period.gz.month.branch)
    + branchNum(period.gz.day.branch) + branchNum(input.hourBranch) + 4;
  const earth = layout(modFrom1(es, 9), yang);
  const my = modFrom1(stemNum(chart.dayStem), 9);
  const p = Number(Object.keys(earth).find((k) => earth[k] === my)) || 5;
  const P = PALACES[p];

  const eff = GATE_AREA[P.gate] ?? {};
  const areas = {};
  for (const a of ['총운', '애정운', '금전운', '직장운', '학업운', '건강운']) {
    areas[a] = Math.max(8, Math.min(94, Math.round(50 + (eff[a] ?? 0))));
  }

  return {
    id: meta.id, name: meta.name, weight: 0.9,
    headline: `${p}궁 ${P.hanja} · ${P.gate}`,
    text: `이 시기 내 자리가 ${P.dir}쪽 ${P.hanja}궁에 떨어지고 ${j(P.gate, '을')} 씁니다. ` +
      (GATE_MEANING[P.gate] ? GATE_MEANING[P.gate][1] : '중앙이라 문이 붙지 않습니다.'),
    areas,
  };
}

export default { meta, analyze, compare , forecast };
