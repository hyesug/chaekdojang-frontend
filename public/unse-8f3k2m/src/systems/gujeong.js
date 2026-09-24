/**
 * gujeong.js — 구성학 (九星氣學)
 *
 * 사람을 아홉 개의 별 중 하나로 본다. 별은 아홉 해마다 한 바퀴 돌고,
 * 해마다 아홉 방위를 옮겨 다닌다. 그래서 구성학은 "지금 어느 방향이
 * 나에게 열려 있는가"를 말하는 데 특히 쓰인다.
 *
 * 본명성은 태어난 해로, 월명성은 절기월로 정한다.
 * 양력 1~2월 초 출생자는 입춘 전이면 전년도 별이 된다.
 */

import { ELEMENTS as ELEM } from '../core/ganzhi.js';
import { j } from '../core/josa.js';
import { result } from './_base.js';

export const meta = {
  id: 'gujeong',
  name: '구성학',
  hanja: '九星氣學',
  desc: '아홉 별 중 어느 자리에서 났는지로 기질과 방위 운을 본다',
  needsTime: false,
  needsPlace: false,
};

const STARS = [
  null,
  { name: '일백수성', hanja: '一白水星', element: 4,
    text: '흐르는 물입니다. 상황에 맞춰 모양을 바꾸며 어디로든 스며듭니다. 겉으로 드러내지 않고 안에서 오래 견디는 힘이 있어, 당장의 승부보다 긴 싸움에서 이깁니다. 속을 잘 보이지 않아 오해를 사기도 합니다.',
    traits: { 주도: -0.2, 외향: -0.4, 감성: 0.5, 안정: -0.2, 실리: 0.2 },
    keywords: ['인내', '유연', '내면'], tags: ['인내', '내향'] },
  { name: '이흑토성', hanja: '二黑土星', element: 2,
    text: '밭의 흙입니다. 남이 벌인 일을 받아 완성하는 자리에서 가장 빛납니다. 묵묵히 오래 하는 힘이 탁월하고 주변의 신뢰가 두텁습니다. 앞에 나서기를 꺼려 공을 놓치는 일이 잦습니다.',
    traits: { 주도: -0.4, 외향: -0.3, 감성: 0.1, 안정: 0.8, 실리: 0.6 },
    keywords: ['성실', '보조', '지구력'], tags: ['인내', '돌봄'] },
  { name: '삼벽목성', hanja: '三碧木星', element: 0,
    text: '봄에 돋는 새싹이자 우레입니다. 시작하는 힘이 강하고 반응이 빠릅니다. 새로운 것에 먼저 뛰어들어 판을 엽니다. 열이 식는 것도 빨라서 마무리를 남에게 넘기는 일이 반복됩니다.',
    traits: { 주도: 0.6, 외향: 0.7, 감성: 0.2, 안정: -0.5, 실리: -0.2 },
    keywords: ['시작', '속도', '성급'], tags: ['실행', '변화'] },
  { name: '사록목성', hanja: '四綠木星', element: 0,
    text: '바람이자 다 자란 나무입니다. 사람과 사람 사이를 오가며 관계를 잇는 데 재능이 있습니다. 신용이 자산이 되는 유형이고 평판으로 일이 들어옵니다. 여러 쪽을 다 살피다 정작 자기 결정을 못 내립니다.',
    traits: { 주도: 0.1, 외향: 0.6, 감성: 0.3, 안정: 0.2, 실리: 0.3 },
    keywords: ['조화', '신용', '중재'], tags: ['사교', '안정'] },
  { name: '오황토성', hanja: '五黃土星', element: 2,
    text: '아홉 별의 한가운데입니다. 힘이 크고 존재감이 강해서, 중심에 서면 판이 그 사람을 따라 움직입니다. 다만 그 힘이 방향을 잃으면 자기 판부터 무너뜨립니다. 극단이 없는 별이라 크게 이루거나 크게 겪습니다.',
    traits: { 주도: 0.9, 외향: 0.2, 감성: -0.2, 안정: 0.4, 실리: 0.3 },
    keywords: ['중심', '강대', '극단'], tags: ['주도', '결단'] },
  { name: '육백금성', hanja: '六白金星', element: 3,
    text: '하늘이자 잘 벼린 쇠입니다. 원칙이 뚜렷하고 책임을 지는 자리에 잘 맞습니다. 윗사람으로서 신뢰를 얻고 조직에서 자리를 만듭니다. 자기 기준을 남에게도 적용하려 해서 마찰이 생깁니다.',
    traits: { 주도: 0.8, 외향: 0.1, 감성: -0.4, 안정: 0.5, 실리: 0.2 },
    keywords: ['권위', '책임', '원칙'], tags: ['책임', '명예'] },
  { name: '칠적금성', hanja: '七赤金星', element: 3,
    text: '연못이자 다듬어진 금붙이입니다. 말솜씨와 분위기를 읽는 감각이 뛰어나 사람이 모입니다. 즐거움을 아는 별이라 삶이 건조해지지 않습니다. 들어오는 만큼 나가는 구조라 돈의 흐름을 따로 관리해야 합니다.',
    traits: { 주도: 0.2, 외향: 0.9, 감성: 0.4, 안정: -0.3, 실리: 0.1 },
    keywords: ['화술', '사교', '소비'], tags: ['표현', '사교'] },
  { name: '팔백토성', hanja: '八白土星', element: 2,
    text: '산입니다. 쌓아 올리는 힘이 강하고 한번 자리를 잡으면 잘 움직이지 않습니다. 부동산·축적·가업처럼 시간이 쌓이는 영역과 인연이 깊습니다. 변화의 시기에 버티기만 하다 때를 놓치는 경우가 있습니다.',
    traits: { 주도: 0.4, 외향: -0.4, 감성: -0.1, 안정: 0.9, 실리: 0.7 },
    keywords: ['축적', '부동', '전환'], tags: ['안정', '재물'] },
  { name: '구자화성', hanja: '九紫火星', element: 1,
    text: '불이자 태양입니다. 드러나는 자리, 이름이 오르내리는 자리와 인연이 깊습니다. 직관이 빠르고 아름다운 것을 알아봅니다. 감정의 진폭이 커서 좋을 때와 나쁠 때의 낙차가 그대로 드러납니다.',
    traits: { 주도: 0.5, 외향: 0.8, 감성: 0.7, 안정: -0.5, 실리: -0.3 },
    keywords: ['명예', '직관', '기복'], tags: ['명예', '직관'] },
];

/** 방위 여덟 곳 + 중앙. 기본반(五黃이 중앙일 때)의 배치 */
const DIRECTIONS = [
  { name: '북', basic: 1 },
  { name: '북동', basic: 8 },
  { name: '동', basic: 3 },
  { name: '남동', basic: 4 },
  { name: '남', basic: 9 },
  { name: '남서', basic: 2 },
  { name: '서', basic: 7 },
  { name: '북서', basic: 6 },
];
const OPPOSITE = { 북: '남', 남: '북', 동: '서', 서: '동', 북동: '남서', 남서: '북동', 남동: '북서', 북서: '남동' };

/** 그 해(입춘 기준)의 중궁성 — 본명성과 같은 공식이다 */
export function starOfYear(year) {
  let s = String(year).split('').reduce((a, c) => a + Number(c), 0);
  while (s > 9) s = String(s).split('').reduce((a, c) => a + Number(c), 0);
  const v = 11 - s;
  return v > 9 ? v - 9 : v;
}

/** 중궁에 어떤 별이 들어왔을 때의 아홉 방위 배치 */
export function palaceChart(centerStar) {
  const map = {};
  for (const d of DIRECTIONS) {
    map[d.name] = ((d.basic - 5 + centerStar - 1) % 9 + 9) % 9 + 1;
  }
  map['중앙'] = centerStar;
  return map;
}

/** 오행 상생 — 나를 낳는 별과 내가 낳는 별이 길하다 */
const GENERATES = (a, b) => (a + 1) % 5 === b;

/**
 * 그 해 방위반에서 본명성에게 열린 방위와 막힌 방위.
 * 풀이 문장과 AI 문맥(길방 도시 후보)이 같은 판정을 쓰도록 한곳에 둔다.
 */
export function yearDirections(sajuYear, year) {
  const honmei = starOfYear(sajuYear);
  const center = starOfYear(year);
  const chart = palaceChart(center);

  const myDir = Object.keys(chart).find((d) => chart[d] === honmei);
  const fiveYellowDir = Object.keys(chart).find((d) => chart[d] === 5);

  const bad = [];
  if (fiveYellowDir && fiveYellowDir !== '중앙') {
    bad.push({ dir: fiveYellowDir, kind: '오황살' });
    if (OPPOSITE[fiveYellowDir]) bad.push({ dir: OPPOSITE[fiveYellowDir], kind: '암검살' });
  }
  if (myDir && myDir !== '중앙') {
    bad.push({ dir: myDir, kind: '본명살' });
    if (OPPOSITE[myDir]) bad.push({ dir: OPPOSITE[myDir], kind: '본명적살' });
  }

  const el = STARS[honmei].element;
  const good = DIRECTIONS
    .filter((d) => {
      const s = chart[d.name];
      if (s === 5 || s === honmei) return false;
      const e = STARS[s].element;
      return GENERATES(e, el) || GENERATES(el, e);
    })
    .map((d) => ({ dir: d.name, star: STARS[chart[d.name]].name }));

  return { center, myDir, good, bad };
}

export function analyze(input) {
  const { sajuYear, sectorIndex, currentYear, age } = input;

  const honmei = starOfYear(sajuYear);
  const star = STARS[honmei];

  // 월명성 — 본명성 무리에 따라 인월의 시작 별이 다르다
  const monthBase = { 1: 8, 4: 8, 7: 8, 2: 2, 5: 2, 8: 2, 3: 5, 6: 5, 9: 5 }[honmei];
  const getsumei = ((monthBase - sectorIndex - 1) % 9 + 9) % 9 + 1;

  // 올해의 방위반
  const dirs = yearDirections(sajuYear, currentYear);
  const centerThisYear = dirs.center;
  const myDir = dirs.myDir;
  const bad = new Set(dirs.bad.map((x) => `${x.dir} (${x.kind})`));
  const good = dirs.good.map((x) => `${x.dir} (${x.star})`);

  // 아홉 해 주기 안의 현재 위치 — 구성학의 연운
  const phase = ((currentYear - sajuYear) % 9 + 9) % 9;
  const PHASE_TEXT = [
    '씨를 뿌리는 해입니다. 결과가 눈에 보이지 않아도 지금 시작한 것이 아홉 해를 갑니다.',
    '싹이 트는 해입니다. 움직임이 생기고 사람이 붙기 시작합니다.',
    '자라는 해입니다. 일이 늘고 바빠집니다. 벌이는 쪽으로 힘이 실립니다.',
    '넓어지는 해입니다. 관계와 활동 반경이 커지고 평판이 만들어집니다.',
    '가장 높은 자리입니다. 드러나고 인정받는 해이며, 동시에 가장 소모되는 해입니다.',
    '거두는 해입니다. 벌여둔 것을 정리해 실제 결과로 바꾸는 시기입니다.',
    '나누는 해입니다. 성과가 손에 들어오고, 사람과 즐거움에 쓰게 됩니다.',
    '멈추는 해입니다. 변화의 압력이 큽니다. 무리하게 벌이기보다 방향을 다시 잡을 때입니다.',
    '비우는 해입니다. 끝나는 것들이 나옵니다. 다음 아홉 해를 준비하는 자리입니다.',
  ];

  const facts = [
    { label: '본명성', value: star.hanja, note: `${star.name} · ${sajuYear}년생 (입춘 기준)` },
    { label: '월명성', value: STARS[getsumei].hanja, note: STARS[getsumei].name },
    { label: `${currentYear}년 중궁`, value: STARS[centerThisYear].hanja, note: STARS[centerThisYear].name },
    { label: '내 별의 자리', value: myDir ?? '중앙', note: `${currentYear}년 기준` },
    // 별을 정하는 셈은 조견과 맞지만, 국면에 붙이는 이름은 해석 쪽이다
    { label: '9년 주기', value: `${phase + 1}번째 해`,
      note: `${PHASE_TEXT[phase].split('.')[0]} (국면 이름은 유파에 따른 해석)` },
  ];

  const readings = [
    { title: `본명성 ${star.name}`, text: star.text },
    {
      title: `월명성 ${STARS[getsumei].name}`,
      text: `태어난 달의 별입니다. 본명성이 타고난 바탕이라면 월명성은 겉으로 드러나는 태도에 가깝습니다. ${STARS[getsumei].text.split('.').slice(1).join('.').trim()}`,
    },
    {
      title: `${currentYear}년 — 9년 주기의 ${phase + 1}번째`,
      text: PHASE_TEXT[phase],
    },
    {
      title: '올해 열린 방위',
      text: good.length
        ? `${good.join(', ')} 쪽이 본명성과 상생합니다. 이사·출장·중요한 약속을 잡을 때 이 방향을 우선으로 보세요.`
        : '올해는 특별히 열린 방위가 없습니다. 큰 이동보다 자리를 지키는 편이 낫습니다.',
    },
    {
      title: '올해 피할 방위',
      text: bad.size
        ? `${[...bad].join(', ')}. 이 방향으로 거처를 옮기거나 큰돈이 걸린 일을 벌이는 것은 미루는 편이 좋습니다. 구성학에서 가장 무겁게 보는 금기입니다.`
        : '올해는 크게 막힌 방위가 없습니다.',
    },
  ];

  return result({
    id: meta.id,
    name: meta.name,
    hanja: meta.hanja,
    headline: `${star.name} · ${currentYear}년은 9년 주기의 ${phase + 1}번째 해`,
    facts,
    readings,
    signals: {
      elements: [0, 0, 0, 0, 0].map((_, i) =>
        (i === star.element ? 2 : 0) + (i === STARS[getsumei].element ? 1 : 0)),
      traits: star.traits,
      domains: {
        재물: 50 + (star.element === 2 ? 12 : 0) + (honmei === 8 ? 10 : 0),
        관계: 50 + Math.round(star.traits.외향 * 20),
        직업: 50 + Math.round(star.traits.주도 * 20),
        건강: null,
        학업: 50 + (star.element === 4 ? 12 : 0),
      },
      tags: star.tags,
      keywords: star.keywords,
    },
  });
}

// ── 궁합 ──
// 구성학 궁합은 단순하다. 두 본명성의 오행이 상생인지 상극인지만 본다.
// 대신 방향이 있다. 내가 상대를 낳아주는 것과 상대가 나를 낳아주는 것은
// 실제 관계에서 전혀 다르게 느껴진다.

const GEN = (a, b) => (a + 1) % 5 === b;   // a가 b를 낳는다
const OVC = (a, b) => (a + 2) % 5 === b;   // a가 b를 이긴다

export function compare(a, b) {
  const hA = starOfYear(a.sajuYear), hB = starOfYear(b.sajuYear);
  const sA = STARS[hA], sB = STARS[hB];
  const eA = sA.element, eB = sB.element;

  let score, kind, text;
  if (hA === hB) {
    score = 72; kind = '같은 별';
    text = '두 사람의 본명성이 같습니다. 말하지 않아도 통하고 세상을 보는 눈이 비슷합니다. 다만 약한 곳까지 똑같아서, 둘 다 못하는 일은 끝내 아무도 하지 않게 됩니다.';
  } else if (GEN(eA, eB)) {
    score = 86; kind = `${ELEM[eA]}생${ELEM[eB]}`;
    text = `${a.name}의 기운이 ${j(b.name, '을')} 키워주는 배치입니다. ${j(a.name, '이')} 내주고 ${j(b.name, '이')} 자라는 구조라 ${b.name} 쪽이 덕을 많이 봅니다. 오래 가려면 ${j(a.name, '이')} 소모되지 않도록 돌아오는 것이 있어야 합니다.`;
  } else if (GEN(eB, eA)) {
    score = 86; kind = `${ELEM[eB]}생${ELEM[eA]}`;
    text = `${b.name}의 기운이 ${j(a.name, '을')} 키워주는 배치입니다. ${j(a.name, '이')} 받는 쪽이라 편안함을 느끼고, ${j(b.name, '은')} 챙기는 역할을 맡게 됩니다.`;
  } else if (eA === eB) {
    score = 74; kind = '같은 오행';
    text = '별은 다르지만 오행이 같습니다. 결이 비슷해 편하고, 같은 방향을 보기 때문에 함께 일하기에도 좋습니다.';
  } else if (OVC(eA, eB)) {
    score = 42; kind = `${ELEM[eA]}극${ELEM[eB]}`;
    text = `${a.name}의 기운이 ${j(b.name, '을')} 누르는 배치입니다. ${j(a.name, '은')} 별생각 없이 한 말인데 ${b.name}에게는 세게 박히는 식입니다. ${a.name} 쪽에서 말의 온도를 낮추면 많은 것이 달라집니다.`;
  } else {
    score = 42; kind = `${ELEM[eB]}극${ELEM[eA]}`;
    text = `${b.name}의 기운이 ${j(a.name, '을')} 누르는 배치입니다. ${j(a.name, '이')} 상대 앞에서 위축되기 쉬우니, 눌린다고 느낄 때 그때그때 말하는 편이 낫습니다.`;
  }

  // 아홉 해 주기에서 지금 서로 어디쯤에 있는가
  const pA = ((a.currentYear - a.sajuYear) % 9 + 9) % 9;
  const pB = ((b.currentYear - b.sajuYear) % 9 + 9) % 9;

  return {
    id: meta.id, name: meta.name, score,
    headline: `${sA.name} / ${sB.name} · ${kind}`,
    facts: [
      { label: '본명성', value: `${sA.name} / ${sB.name}`, note: `${sA.hanja} / ${sB.hanja}` },
      { label: '오행 관계', value: kind, note: `${ELEM[eA]} / ${ELEM[eB]}` },
      { label: '9년 주기', value: `${pA + 1}번째 / ${pB + 1}번째`, note: '지금 각자 주기의 어디쯤인가' },
    ],
    readings: [
      { title: `${sA.name} × ${sB.name} — ${kind}`, text },
      {
        title: '두 사람의 주기가 지금',
        text: Math.abs(pA - pB) <= 1
          ? `아홉 해 주기에서 거의 같은 자리에 있습니다(${pA + 1}번째와 ${pB + 1}번째). 비슷한 국면을 함께 통과하고 있어 서로를 이해하기 쉽습니다. 반대로 둘 다 힘든 해에는 같이 무너질 수 있으니 그때는 바깥의 도움을 구하세요.`
          : `${j(a.name, '은')} ${pA + 1}번째 해, ${j(b.name, '은')} ${pB + 1}번째 해에 있습니다. 서로 다른 국면을 지나고 있어 관심사와 속도가 다를 수 있습니다. 한쪽이 벌일 때 다른 쪽은 정리하는 시기일 수 있으니, 속도가 안 맞는다고 상대를 탓하지 않는 편이 좋습니다.`,
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// 시기 운세
// ─────────────────────────────────────────────────────────────
// 그 해(또는 달)의 방위반에서 내 본명성이 아홉 궁 중 어디에 드는가.
// 구성학이 시기를 보는 본래 방식이다.

const PALACE_AREA = {
  1: { 총운: -10, 금전운: -8, 건강운: -8, 애정운: -4, 직장운: -5, 학업운: 4, name: '감궁 · 침체' },
  2: { 총운: -2, 금전운: 2, 건강운: -4, 애정운: 4, 직장운: 2, 학업운: 4, name: '곤궁 · 준비' },
  3: { 총운: 9, 직장운: 10, 금전운: 5, 애정운: 4, 학업운: 6, 건강운: 5, name: '진궁 · 발동' },
  4: { 총운: 10, 애정운: 12, 금전운: 6, 직장운: 7, 학업운: 5, 건강운: 5, name: '손궁 · 신용' },
  5: { 총운: -12, 금전운: -10, 건강운: -12, 애정운: -8, 직장운: -8, 학업운: -4, name: '중궁 · 정체' },
  6: { 총운: 10, 직장운: 13, 금전운: 8, 학업운: 5, 애정운: 2, 건강운: 4, name: '건궁 · 완성' },
  7: { 총운: 8, 금전운: 12, 애정운: 10, 건강운: 4, 직장운: 3, 학업운: 0, name: '태궁 · 결실' },
  8: { 총운: -3, 금전운: 4, 직장운: -4, 애정운: -4, 학업운: 4, 건강운: 0, name: '간궁 · 전환' },
  9: { 총운: 11, 직장운: 9, 학업운: 10, 애정운: 7, 금전운: 4, 건강운: -3, name: '이궁 · 절정' },
};

export function forecast(input, chart, period) {
  const honmei = starOfYear(chart.sajuYear);
  const center = starOfYear(period.sajuYear);
  const board = palaceChart(center);

  const DIRS = { 북: 1, 남서: 2, 동: 3, 남동: 4, 중앙: 5, 북서: 6, 서: 7, 북동: 8, 남: 9 };
  let where = 5;
  for (const [d, n] of Object.entries(DIRS)) {
    if ((d === '중앙' ? center : board[d]) === honmei) { where = n; break; }
  }

  const eff = PALACE_AREA[where];
  const areas = {};
  for (const a of ['총운', '애정운', '금전운', '직장운', '학업운', '건강운']) {
    areas[a] = Math.max(8, Math.min(94, Math.round(50 + (eff[a] ?? 0))));
  }

  const phase = ((period.sajuYear - chart.sajuYear) % 9 + 9) % 9;
  return {
    id: meta.id, name: meta.name, weight: 1.1,
    headline: eff.name,
    text: `${period.sajuYear}년 방위반에서 본명성 ${j(STARS[honmei].name, '이')} ${eff.name.split(' · ')[0]}에 듭니다. ` +
      `아홉 해 주기로는 ${phase + 1}번째 해입니다.`,
    areas,
  };
}

export default { meta, analyze, compare , forecast };
