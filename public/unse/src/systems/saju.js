/**
 * saju.js — 사주명리
 *
 * 태어난 순간의 연·월·일·시를 각각 간지로 세워 여덟 글자를 만든다.
 * 그중 일간(日干)이 그 사람 자신이고, 나머지 일곱 글자와의 관계로 읽는다.
 * 계산은 core/ganzhi.js가 이미 다 해두었다. 여기는 해석을 붙이는 층이다.
 */

import {
  computeFourPillars, elementDistribution, tenGodDistribution,
  computeDaeun, currentDaeun, yearPillar, tenGod,
  STEMS, STEMS_KR, BRANCHES, BRANCHES_KR, ELEMENTS, ELEMENT_HANJA,
  STEM_ELEMENT, TEN_GOD_GROUP, isClash, SIX_HARMONY,
  isStemCombine, isStemClash, branchRelations,
} from '../core/ganzhi.js';
import { result } from './_base.js';
import { j } from '../core/josa.js';

export const meta = {
  id: 'saju',
  name: '사주',
  hanja: '四柱',
  desc: '태어난 연·월·일·시를 여덟 글자로 세워 타고난 기질과 흐름을 본다',
  needsTime: true,
  needsPlace: true,
};

// ── 일간 열 가지 — 사주의 주인공 ─────────────────────────────
const DAY_STEM_READING = [
  {
    image: '큰 나무',
    text: '곧게 자라는 나무입니다. 방향이 정해지면 끝까지 밀고 가고, 남 밑에 오래 있는 걸 답답해합니다. 책임이 주어질 때 오히려 안정되는 유형이라 리더 자리가 어울립니다. 다만 한번 세운 뜻을 굽히기 어려워서, 꺾이기 전에 휘는 법을 익히면 손해가 줄어듭니다.',
    traits: { 주도: 0.8, 외향: 0.3, 감성: -0.2, 안정: 0.4, 실리: 0.0 },
    keywords: ['추진', '자립', '고집'],
  },
  {
    image: '덩굴과 화초',
    text: '어디에 놓여도 뿌리를 내리는 유연함이 있습니다. 사람 사이를 부드럽게 통과하고, 상황에 맞춰 자기 모양을 바꿀 줄 압니다. 겉으로는 순해 보여도 원하는 것은 끝내 얻어내는 끈기가 있습니다. 결정을 미루다 기회를 놓치는 것이 주된 손실 지점입니다.',
    traits: { 주도: -0.3, 외향: 0.5, 감성: 0.4, 안정: -0.2, 실리: 0.3 },
    keywords: ['유연', '사교', '끈기'],
  },
  {
    image: '태양',
    text: '숨기지 못하는 사람입니다. 감정도 의도도 밖으로 드러나고, 그래서 사람들이 편하게 다가옵니다. 판을 밝히고 분위기를 끌어올리는 역할을 자연스럽게 맡습니다. 시작할 때의 열이 끝까지 가지 않는 편이라, 마무리를 맡아줄 사람을 곁에 두면 크게 달라집니다.',
    traits: { 주도: 0.6, 외향: 0.9, 감성: 0.2, 안정: -0.3, 실리: -0.2 },
    keywords: ['열정', '개방', '주목'],
  },
  {
    image: '등불',
    text: '어두운 곳을 정확히 비추는 불입니다. 넓게 퍼지지는 않지만 한 곳을 오래 봅니다. 사람의 표정과 말끝에 담긴 것을 잘 읽어내고, 그래서 세심한 배려가 가능합니다. 그 예민함이 안으로 향하면 혼자 감정을 오래 앓습니다.',
    traits: { 주도: -0.1, 외향: -0.2, 감성: 0.8, 안정: 0.0, 실리: 0.1 },
    keywords: ['섬세', '집중', '통찰'],
  },
  {
    image: '큰 산',
    text: '쉽게 움직이지 않는 사람입니다. 그래서 주변이 흔들릴 때 기댈 곳이 됩니다. 말보다 자리로 신뢰를 주는 유형이고, 한번 맡은 것은 오래 지킵니다. 변화가 필요한 국면에서 늦게 반응하는 것이 약점이라, 결정 시점을 미리 정해두는 편이 낫습니다.',
    traits: { 주도: 0.5, 외향: -0.1, 감성: -0.3, 안정: 0.9, 실리: 0.2 },
    keywords: ['신뢰', '포용', '완고'],
  },
  {
    image: '밭의 흙',
    text: '무엇이든 심으면 길러내는 땅입니다. 화려하지 않지만 실속을 챙기고, 사람과 일을 오래 건사합니다. 현실 감각이 좋아 큰 실수를 잘 하지 않습니다. 대신 걱정이 앞서 시작을 미루는 일이 잦아, 작게라도 먼저 벌여놓는 습관이 도움이 됩니다.',
    traits: { 주도: -0.2, 외향: -0.3, 감성: 0.2, 안정: 0.6, 실리: 0.7 },
    keywords: ['실속', '양육', '신중'],
  },
  {
    image: '다듬지 않은 쇠',
    text: '맺고 끊는 것이 분명합니다. 옳고 그름을 빨리 판단하고 그대로 말합니다. 의리가 두터워 한번 사람을 들이면 오래 갑니다. 그 직선이 사람을 베는 경우가 있어서, 같은 말을 한 박자 늦게 하는 것만으로 관계 손실이 크게 줄어듭니다.',
    traits: { 주도: 0.7, 외향: 0.2, 감성: -0.5, 안정: 0.2, 실리: 0.4 },
    keywords: ['결단', '의리', '직설'],
  },
  {
    image: '보석',
    text: '다듬어진 것에 끌리는 사람입니다. 감각이 예민해서 어설픈 것을 그냥 지나치지 못합니다. 자기 기준이 높고 그 기준에 맞는 결과를 실제로 만들어냅니다. 남의 말 한마디가 오래 남는 편이라, 평가에 거리를 두는 연습이 필요합니다.',
    traits: { 주도: 0.1, 외향: 0.0, 감성: 0.5, 안정: -0.1, 실리: 0.5 },
    keywords: ['감각', '완성도', '예민'],
  },
  {
    image: '큰 물',
    text: '흘러야 사는 사람입니다. 한자리에 묶이면 힘을 잃고, 새로운 것과 만날 때 살아납니다. 머리 회전이 빠르고 사람을 넓게 품습니다. 관심이 여러 갈래로 흩어지는 것이 늘 문제라, 판을 줄이는 결정이 곧 성과로 이어집니다.',
    traits: { 주도: 0.4, 외향: 0.6, 감성: 0.3, 안정: -0.6, 실리: -0.1 },
    keywords: ['지혜', '자유', '확장'],
  },
  {
    image: '이슬과 비',
    text: '조용히 스며드는 물입니다. 직관이 앞서서, 설명하기 전에 먼저 알아차립니다. 작은 신호를 놓치지 않고 사람의 속을 잘 읽습니다. 생각이 많아 실행이 늦어지는 것이 반복되는 지점이라, 판단 기한을 정해두는 방식이 잘 맞습니다.',
    traits: { 주도: -0.4, 외향: -0.4, 감성: 0.9, 안정: -0.3, 실리: 0.0 },
    keywords: ['직관', '통찰', '내향'],
  },
];

/** 일간 열 가지를 공통 어휘로 옮긴 것. 종합은 이 태그만 본다 */
const DAY_STEM_TAGS = [
  ['주도', '독립'], ['사교', '인내'], ['표현', '사교'], ['감수성', '직관'], ['안정', '책임'],
  ['인내', '실행'], ['결단', '독립'], ['완벽', '감수성'], ['자유', '변화'], ['직관', '내향'],
];

const TEN_GOD_TAGS = {
  비겁: ['독립', '주도'],
  식상: ['표현', '자유'],
  재성: ['재물', '실행'],
  관성: ['책임', '명예'],
  인성: ['학습', '분석'],
};

// ── 오행 과다 / 부족 ─────────────────────────────────────────
const ELEMENT_EXCESS = [
  '목이 강합니다. 벌이는 힘이 좋아 일이 계속 늘어납니다. 정리하는 쪽에 의식적으로 힘을 써야 합니다.',
  '화가 강합니다. 표현과 속도가 빠른 대신 열이 쉽게 오릅니다. 식히는 시간을 일정에 넣어두세요.',
  '토가 강합니다. 버티는 힘이 좋지만 고여 있기 쉽습니다. 정기적으로 환경을 바꿔주는 것이 약입니다.',
  '금이 강합니다. 기준이 뚜렷하고 판단이 빠릅니다. 그 기준을 남에게 적용할 때 마찰이 납니다.',
  '수가 강합니다. 생각이 깊고 정보가 많이 모입니다. 결론을 내리는 시점을 따로 정해두어야 합니다.',
];

const ELEMENT_LACK = [
  '목이 약합니다. 새로 시작하는 힘이 달릴 때가 있습니다. 작게 시작하는 습관이 이 자리를 메웁니다.',
  '화가 약합니다. 드러내고 알리는 일이 어색할 수 있습니다. 표현은 성향이 아니라 기술이니 익히면 됩니다.',
  '토가 약합니다. 중심을 잡아줄 기반이 얇습니다. 루틴·거처·소속 같은 고정점을 하나 마련해두세요.',
  '금이 약합니다. 끊어내는 결단이 늦습니다. 그만둘 조건을 미리 문서로 정해두는 방식이 잘 듣습니다.',
  '수가 약합니다. 쉬는 법을 잘 모를 수 있습니다. 휴식은 회복이 아니라 준비라고 보는 편이 낫습니다.',
];

// ── 십신 무리 ────────────────────────────────────────────────
const TEN_GOD_READING = {
  비겁: {
    text: '자기 힘으로 서려는 기운이 두텁습니다. 남 밑에서 오래 못 견디고 결국 자기 판을 만듭니다. 동료와 어깨를 겯는 힘도 강하지만, 같은 이유로 이익을 나눌 때 마찰이 생기기 쉽습니다. 동업은 조건을 문서로 남기고 시작하세요.',
    domains: { 재물: -8, 관계: +6, 직업: +6 },
    traits: { 주도: 0.4, 실리: -0.2 },
  },
  식상: {
    text: '안에 있는 것을 밖으로 꺼내는 기운이 강합니다. 말·글·손재주·기획처럼 자기 것을 만들어 보이는 일에서 힘이 납니다. 규칙이 빡빡한 조직에서는 답답함을 크게 느낍니다. 재량이 있는 자리로 갈수록 성과가 커집니다.',
    domains: { 직업: +12, 학업: +8, 관계: +4 },
    traits: { 외향: 0.4, 감성: 0.3, 안정: -0.2 },
  },
  재성: {
    text: '현실을 다루는 감각이 좋습니다. 돈·자원·사람을 굴리는 일에 눈이 밝고, 손에 잡히는 결과를 중요하게 봅니다. 기회를 놓치지 않는 대신 늘 바쁩니다. 일을 늘리는 속도보다 정리하는 속도가 느려지면 그때부터 새기 시작합니다.',
    domains: { 재물: +16, 직업: +8, 건강: -6 },
    traits: { 실리: 0.6, 외향: 0.2 },
  },
  관성: {
    text: '틀과 책임을 견디는 힘이 있습니다. 조직·자격·직책처럼 형태가 분명한 것에서 안정을 얻고, 맡은 자리에서 신뢰를 쌓습니다. 그만큼 압박도 안으로 지고 갑니다. 성과가 아니라 소진으로 무너지는 경우가 많아, 쉬는 것을 일정에 넣어야 합니다.',
    domains: { 직업: +16, 학업: +6, 건강: -8 },
    traits: { 주도: 0.3, 안정: 0.4, 감성: -0.2 },
  },
  인성: {
    text: '받아들이고 쌓는 기운이 두텁습니다. 배우고 정리하고 문서로 남기는 일에 강하며, 자격이나 전문성으로 자리를 만듭니다. 다만 준비가 충분해질 때까지 움직이지 않으려는 경향이 있어, 실행 시점을 외부에서 정해주는 장치가 필요합니다.',
    domains: { 학업: +16, 건강: +6, 재물: -6 },
    traits: { 안정: 0.3, 감성: 0.3, 외향: -0.3 },
  },
};

// ── 일지 — 배우자 자리 ───────────────────────────────────────
const DAY_BRANCH_LOVE = [
  '총명하고 붙임성 있는 상대와 인연이 깊습니다. 대화가 끊기면 마음도 함께 식는 쪽입니다.',
  '묵묵히 곁을 지키는 인연입니다. 표현이 적어도 오래 갑니다. 말로 확인받고 싶은 시기가 옵니다.',
  '주도적이고 활동적인 상대를 만납니다. 둘 다 앞서려 하면 부딪치니 영역을 나누는 편이 낫습니다.',
  '부드럽고 감각이 예민한 인연입니다. 서로 배려하다 정작 할 말을 미루는 일이 생깁니다.',
  '속이 깊고 품이 넓은 상대입니다. 안정감이 큰 대신 변화가 필요한 시기에 답답할 수 있습니다.',
  '똑똑하고 판단이 빠른 인연입니다. 관계의 속도도 빠르니 초반에 속도를 늦추는 게 좋습니다.',
  '밝고 사람을 끄는 상대입니다. 함께 있으면 에너지가 올라가지만 소모도 함께 커집니다.',
  '온화하고 잘 맞춰주는 인연입니다. 그 배려에 익숙해지지 않도록 표현을 자주 해야 합니다.',
  '활달하고 추진력 있는 상대입니다. 함께 일을 벌이기 좋고, 쉬는 리듬은 따로 맞춰야 합니다.',
  '단정하고 기준이 분명한 인연입니다. 서로의 기준을 존중하는 선에서 편안해집니다.',
  '의리 있고 책임감 강한 상대입니다. 무겁게 지고 가는 편이라 덜어주는 말이 필요합니다.',
  '너그럽고 정이 많은 인연입니다. 경계가 흐려지기 쉬우니 각자의 영역을 정해두세요.',
];

// ── 건강 ─────────────────────────────────────────────────────
const ELEMENT_HEALTH = [
  '간·담과 근육, 눈',
  '심장과 혈압, 수면',
  '위장과 소화, 체중',
  '폐·대장과 피부, 호흡기',
  '신장·방광과 허리, 순환',
];

// ── 행운 요소 ────────────────────────────────────────────────
const LUCK = [
  { color: '초록·청색', dir: '동쪽', num: '3·8', time: '아침 5~7시' },
  { color: '빨강·자주', dir: '남쪽', num: '2·7', time: '낮 11~13시' },
  { color: '노랑·베이지', dir: '중앙', num: '5·10', time: '환절기' },
  { color: '흰색·은색', dir: '서쪽', num: '4·9', time: '저녁 17~19시' },
  { color: '검정·남색', dir: '북쪽', num: '1·6', time: '밤 21~23시' },
];

/**
 * @param {object} input  normalizeBirth 결과 + 사용자 입력
 */
/**
 * 지금 대운이 언제 다음으로 넘어가는지.
 *
 * 대운은 태어난 날로부터 startAgeExact 년 뒤에 시작해 열 해씩 간다.
 * 그 경계를 달력으로 환산해 준다. 절기 폭만큼 오차가 있어 '무렵'으로 쓴다.
 */
function daeunTurn(input, daeun, now) {
  const i = daeun.list.indexOf(now);
  if (i < 0) return `${now.fromAge}~${now.toAge}세`;
  const next = daeun.list[i + 1];
  // 판정에 쓴 경계(toExact)를 그대로 달력으로 옮긴다. 다른 값을 쓰면
  // 화면에 적힌 전환월과 실제로 바뀌는 시점이 어긋난다.
  const at = new Date(Date.UTC(input.year, input.month - 1, input.day));
  at.setUTCMonth(at.getUTCMonth() + Math.round(now.toExact * 12));
  const when = `${at.getUTCFullYear()}년 ${at.getUTCMonth() + 1}월`;
  return next
    ? `${now.fromAge}~${now.toAge}세 · ${when} 무렵까지, 이후 ${next.hanja}(${next.kr})`
    : `${now.fromAge}세 이후`;
}

export function analyze(input) {
  const { jdUT, jdTST, timeKnown, isMale, age, currentYear, elapsedYears } = input;

  const chart = computeFourPillars(jdUT, jdTST, { timeKnown });
  const { pillars, dayStem } = chart;
  const dist = elementDistribution(pillars);
  const gods = tenGodDistribution(pillars, dayStem);
  const daeun = computeDaeun(chart, isMale, jdUT);
  const now = currentDaeun(daeun, elapsedYears);
  const seun = yearPillar(currentYear);

  const me = DAY_STEM_READING[dayStem];
  const myElement = STEM_ELEMENT[dayStem];
  const weak = dist.weakest;
  const strong = dist.strongest;

  // ── 원본 결과 ──
  // 네 기둥 자체는 화면 위쪽 팔자판이 보여주므로 여기서는 되풀이하지 않는다
  const facts = [
    { label: '일간', value: STEMS[dayStem], note: `${STEMS_KR[dayStem]} · ${ELEMENTS[myElement]}(${ELEMENT_HANJA[myElement]}) · ${me.image}` },
    { label: '띠', value: chart.zodiac, note: `${chart.sajuYear}년생 (입춘 기준)` },
    { label: '오행', value: ELEMENTS.map((e, i) => `${e} ${dist.count[i]}`).join(' · '), note: `가장 강한 기운 ${ELEMENTS[strong]}, 가장 약한 기운 ${ELEMENTS[weak]}` },
    { label: '십신', value: Object.entries(gods.groups).map(([k, v]) => `${k} ${v}`).join(' · '), note: `우세: ${gods.dominant}` },
    // 지금 대운이 언제 끝나는지가 실제로 쓸모 있는 정보다. 나이만 적으면
    // 사람이 다시 세어야 한다. 대운은 태어난 날에서 startAgeExact 년 뒤부터
    // 열 해씩 가므로 달까지 환산할 수 있다.
    { label: '대운', value: `${daeun.forward ? '순행' : '역행'} · 약 ${daeun.startAge}세 시작`,
      note: now ? `현재 ${now.hanja}(${now.kr}) · ${daeunTurn(input, daeun, now)}` : '대운 시작 전' },
  ];

  // ── 해석 ──
  const readings = [];

  readings.push({
    title: `일간 ${STEMS_KR[dayStem]}${ELEMENTS[myElement]} — ${me.image}`,
    text: me.text,
  });

  // 오행 균형
  const balance = [];
  if (dist.pct[strong] >= 35) balance.push(ELEMENT_EXCESS[strong]);
  if (dist.missing.length) {
    balance.push(`사주에 ${dist.missing.map((i) => ELEMENTS[i]).join('·')}이(가) 거의 없습니다. ` + ELEMENT_LACK[dist.missing[0]]);
  } else if (dist.pct[weak] <= 12) {
    balance.push(ELEMENT_LACK[weak]);
  }
  if (!balance.length) balance.push('다섯 기운이 비교적 고르게 섞여 있습니다. 한쪽으로 크게 쏠리지 않아 상황에 따라 다른 얼굴을 쓸 수 있는 구조입니다.');
  readings.push({ title: '오행의 균형', text: balance.join(' ') });

  // 십신
  const g = TEN_GOD_READING[gods.dominant];
  readings.push({ title: `${j(gods.dominant, '이')} 우세합니다`, text: g.text });

  if (gods.groups[gods.weakest] === 0) {
    const lacking = {
      비겁: '자기 주장을 세우는 기운이 옅습니다. 남의 요청을 먼저 받아들이다 자기 몫을 놓치기 쉽습니다.',
      식상: '표현하는 기운이 옅습니다. 안에서 다 정리한 뒤 내놓으려다 시기를 놓칠 수 있습니다.',
      재성: '현실을 굴리는 기운이 옅습니다. 돈과 자원을 다루는 일은 구조를 만들어두고 움직이는 편이 안전합니다.',
      관성: '틀을 지우는 기운이 옅습니다. 스스로 규율을 만들지 않으면 흐트러지기 쉬운 구조입니다.',
      인성: '받아 쌓는 기운이 옅습니다. 실전으로 배우는 편이라, 기록을 남기는 습관이 특히 큰 차이를 만듭니다.',
    }[gods.weakest];
    readings.push({ title: `${j(gods.weakest, '이')} 비어 있습니다`, text: lacking });
  }

  // 배우자 자리
  readings.push({
    title: '인연의 자리 (일지)',
    text: `일지가 ${BRANCHES[pillars.day.branch]}(${BRANCHES_KR[pillars.day.branch]})입니다. ` + DAY_BRANCH_LOVE[pillars.day.branch],
  });

  // 건강
  readings.push({
    title: '몸에서 먼저 신호가 오는 곳',
    text: `가장 약한 기운이 ${j(ELEMENTS[weak], '이라')} ${ELEMENT_HEALTH[weak]} 쪽에 먼저 무리가 옵니다. ` +
      (dist.pct[strong] >= 38
        ? `동시에 ${j(ELEMENTS[strong], '이')} 강해 ${ELEMENT_HEALTH[strong]} 쪽도 과로에 취약합니다.`
        : '큰 편중은 없으니 생활 리듬만 지켜도 충분합니다.'),
  });

  // 대운
  if (now) {
    const flow = {
      비견: '스스로 판을 여는 시기입니다. 독립·이직·창업 같은 결정이 힘을 받습니다.',
      겁재: '경쟁과 협력이 동시에 커집니다. 돈이 걸린 관계는 조건을 분명히 해두어야 합니다.',
      식신: '만들어 내놓는 시기입니다. 하던 일이 결과물로 바뀌고 건강도 안정됩니다.',
      상관: '틀을 깨고 싶어지는 시기입니다. 재능이 드러나지만 윗선과 부딪칠 수 있습니다.',
      편재: '기회가 넓게 들어옵니다. 움직임이 많고 수입 경로도 늘지만 지출도 함께 늡니다.',
      정재: '쌓이는 시기입니다. 큰 변화보다 꾸준한 축적이 맞고, 자산을 정리하기 좋습니다.',
      편관: '압박이 커지는 시기입니다. 책임이 무겁지만 넘기면 급이 한 단계 올라갑니다.',
      정관: '자리를 얻는 시기입니다. 승진·자격·공적인 인정이 따르고 평판이 중요해집니다.',
      편인: '방향을 다시 잡는 시기입니다. 공부나 전환에 힘이 실리고 혼자 있는 시간이 늘어납니다.',
      정인: '배우고 정비하는 시기입니다. 문서·자격·귀인의 도움이 따릅니다.',
    }[now.god];
    readings.push({
      title: `지금의 대운 — ${now.hanja} (${now.fromAge}~${now.toAge}세, ${now.god})`,
      text: flow,
    });
  }

  // 세운
  const seunGod = tenGod(dayStem, seun.stem);
  const clash = isClash(pillars.day.branch, seun.branch);
  const harmony = SIX_HARMONY[pillars.day.branch] === seun.branch;
  const SEUN_TEXT = {
    비겁: '경쟁과 협력이 동시에 커지는 해입니다. 사람과 돈이 얽히지 않도록 선을 그어두세요.',
    식상: '표현하고 만들어내는 해입니다. 벌여둔 것을 결과물로 바꾸기 좋은 시기입니다.',
    재성: '기회와 지출이 함께 늘어나는 해입니다. 현실적인 성과가 나오는 대신 몸이 바빠집니다.',
    관성: '책임과 압박이 커지는 해입니다. 자리는 올라가지만 그만큼 소진되기 쉽습니다.',
    인성: '배우고 정비하는 해입니다. 속도를 내기보다 기반을 다지는 쪽이 남습니다.',
  };
  let seunText = `${currentYear}년은 ${seun.hanja}(${seun.kr})년입니다. 일간에서 보면 ${seunGod}에 해당합니다. ` +
    SEUN_TEXT[TEN_GOD_GROUP[seunGod]];
  if (clash) seunText += ' 일지와 충(沖)이 걸려 있어 이동·전환·환경 변화가 따르는 해입니다. 미루던 결정이 밖에서 밀려 들어옵니다.';
  if (harmony) seunText += ' 일지와 합(合)이 이루어져 사람과 기회가 붙는 해입니다. 관계에서 풀리는 일이 많습니다.';
  readings.push({ title: `${currentYear}년 세운`, text: seunText });

  // 행운
  const luck = LUCK[weak];
  readings.push({
    title: '보태면 좋은 것',
    text: `약한 ${j(ELEMENTS[weak], '을')} 채우는 쪽이 도움이 됩니다. 색은 ${luck.color}, 방향은 ${luck.dir}, 숫자는 ${luck.num}, 시간대는 ${luck.time}입니다. 미신처럼 쓰기보다 "내가 덜 쓰는 근육이 무엇인가"로 읽는 편이 실제로 쓸모가 있습니다.`,
  });

  // ── 종합용 지표 ──
  const traits = { ...me.traits };
  for (const [k, v] of Object.entries(g.traits ?? {})) {
    traits[k] = (traits[k] ?? 0) + v;
  }
  for (const k of Object.keys(traits)) traits[k] = Math.max(-1, Math.min(1, traits[k]));

  const domains = { 재물: 50, 관계: 50, 직업: 50, 건강: 50, 학업: 50 };
  for (const [group, n] of Object.entries(gods.groups)) {
    const d = TEN_GOD_READING[group].domains;
    for (const [k, v] of Object.entries(d)) domains[k] += v * (n / 3);
  }
  domains.건강 += (dist.pct[weak] - 12) * 0.8;
  for (const k of Object.keys(domains)) {
    domains[k] = Math.max(5, Math.min(95, Math.round(domains[k])));
  }

  return result({
    id: meta.id,
    name: meta.name,
    hanja: meta.hanja,
    headline: `${STEMS_KR[dayStem]}${ELEMENTS[myElement]} 일간 · ${gods.dominant} 우세 · ${j(ELEMENTS[strong], '이')} 강하고 ${j(ELEMENTS[weak], '이')} 약함`,
    facts,
    readings,
    confidence: timeKnown ? 1 : 0.7,
    signals: {
      elements: dist.count,
      traits,
      domains,
      tags: [...new Set([...DAY_STEM_TAGS[dayStem], ...TEN_GOD_TAGS[gods.dominant]])],
      keywords: [...me.keywords, gods.dominant, `${ELEMENTS[strong]}과다`],
    },
  });
}

// ─────────────────────────────────────────────────────────────
// 궁합
//
// 사주 궁합은 네 군데를 본다.
//   일간끼리  — 두 사람 자신이 서로에게 무엇인가 (십신·천간합)
//   일지끼리  — 배우자 자리끼리 맞물리는가 (합·충·형·해·파)
//   오행      — 내가 모자란 기운을 상대가 채워주는가
//   년지      — 흔히 말하는 띠 궁합
//
// 일간 관계는 방향에 따라 다르다. 내가 상대에게 정재인 것과
// 상대가 나에게 정재인 것은 전혀 다른 이야기다.
// ─────────────────────────────────────────────────────────────

/** 상대가 나에게 어떤 십신인가에 따른 점수와 풀이 */
const PAIR_GOD = {
  비견: [26, '동등한 친구 같은 사이입니다. 말이 잘 통하고 편한데, 같은 것을 원해서 부딪치기도 합니다.'],
  겁재: [18, '기운이 비슷해 가깝지만 경쟁이 붙습니다. 특히 돈이 걸린 일은 처음부터 선을 그어두는 편이 좋습니다.'],
  식신: [32, '상대에게 베풀고 표현하게 되는 사이입니다. 함께 있으면 여유가 생기고 즐거움이 늡니다.'],
  상관: [22, '상대 앞에서 재능이 드러나지만 말이 날카로워지기 쉽습니다. 조언이 잔소리로 넘어가는 선을 조심하세요.'],
  편재: [28, '상대를 챙기고 움직이게 되는 사이입니다. 활기가 돌지만 씀씀이도 함께 커집니다.'],
  정재: [36, '안정적으로 아끼고 건사하는 사이입니다. 사주에서 짝으로 가장 좋게 보는 관계 중 하나입니다.'],
  편관: [20, '상대가 부담이자 자극이 됩니다. 긴장 속에서 성장하지만 오래 누르면 지칩니다.'],
  정관: [36, '상대를 존중하고 따르게 되는 사이입니다. 질서가 잡히고 관계가 오래 갑니다.'],
  편인: [24, '상대에게 기대고 배우는 사이입니다. 깊이는 있지만 의존으로 기울기 쉽습니다.'],
  정인: [34, '상대가 든든한 버팀목이 되는 사이입니다. 위로와 도움을 실제로 주고받습니다.'],
};

const BRANCH_SCORE = { 육합: 30, 반합: 26, 파: 12, 해: 10, 삼형: 8, 상형: 8, 자형: 14, 충: 6 };

/**
 * 여덟 글자를 통째로 맞댄다.
 *
 * 예전에는 일간·일지·띠만 봤다. 그러면 나머지 글자들이 무슨 말을 하든
 * 등급이 움직이지 않는다. 실제로 甲庚충·乙辛충·丑戌형·未戌파가 잔뜩
 * 있는 짝이 '좋음'으로 나왔다. 일간이 합이라는 이유 하나로.
 *
 * 그래서 네 기둥 × 네 기둥, 열여섯 쌍을 전부 훑는다. 자리마다 무게가
 * 다르다 — 일주가 가장 무겁고 시주가 가장 가볍다.
 */
const POS = ['year', 'month', 'day', 'hour'];
const POS_KR = { year: '년', month: '월', day: '일', hour: '시' };
const POS_WEIGHT = { day: 3, month: 2, year: 1.5, hour: 1 };

function crossAll(A, B) {
  const stems = [];
  const branches = [];
  for (const pa of POS) {
    const pA = A.pillars[pa];
    if (!pA) continue;
    for (const pb of POS) {
      const pB = B.pillars[pb];
      if (!pB) continue;
      const w = (POS_WEIGHT[pa] + POS_WEIGHT[pb]) / 2;
      if (isStemCombine(pA.stem, pB.stem)) stems.push({ at: [pa, pb], kind: '합', good: true, w });
      else if (isStemClash(pA.stem, pB.stem)) stems.push({ at: [pa, pb], kind: '충', good: false, w });
      for (const r of branchRelations(pA.branch, pB.branch)) {
        // 원진은 보조 관계라 절반만 센다
        branches.push({ at: [pa, pb], kind: r.kind, good: r.good, w: r.minor ? w / 2 : w });
      }
    }
  }
  const all = [...stems, ...branches];
  const harmony = all.filter((x) => x.good).reduce((t, x) => t + x.w, 0);
  const friction = all.filter((x) => !x.good).reduce((t, x) => t + x.w, 0);
  return { stems, branches, all, harmony, friction, net: harmony - friction };
}

/** 어느 자리끼리 걸렸는지 사람 말로 */
const crossLine = (x, nameA, nameB) =>
  `${nameA} ${POS_KR[x.at[0]]}주 ↔ ${nameB} ${POS_KR[x.at[1]]}주 ${x.kind}`;

export function compare(a, b) {
  const A = computeFourPillars(a.jdUT, a.jdTST, { timeKnown: a.timeKnown });
  const B = computeFourPillars(b.jdUT, b.jdTST, { timeKnown: b.timeKnown });
  const dA = elementDistribution(A.pillars);
  const dB = elementDistribution(B.pillars);

  // ── 일간 ──
  const godAB = tenGod(A.dayStem, B.dayStem);   // 상대가 나(A)에게 무엇인가
  const godBA = tenGod(B.dayStem, A.dayStem);
  const combine = isStemCombine(A.dayStem, B.dayStem);
  const stemClash = isStemClash(A.dayStem, B.dayStem);

  let stemScore = (PAIR_GOD[godAB][0] + PAIR_GOD[godBA][0]) / 2;
  // 천간합을 만점으로 덮어쓰면 나머지가 무슨 말을 하든 등급이 안 바뀐다.
  // 재보니 천간합인 쌍의 82%가 '좋음' 이상으로 나왔다(전체는 54%).
  // 게다가 천간합은 열 가지 일간 관계 가운데 하나라 열 쌍에 한 번꼴로
  // 흔하다. 덮어쓰지 말고 얹는다.
  if (combine) stemScore = Math.min(40, stemScore + 12);
  if (stemClash) stemScore = Math.min(stemScore, 14);

  // ── 일지 ──
  const dayRel = branchRelations(A.pillars.day.branch, B.pillars.day.branch);
  const dayScore = dayRel.length
    ? Math.min(...dayRel.map((r) => BRANCH_SCORE[r.kind] ?? 18))
    : 18;

  // ── 오행 보완 ── 내 약한 곳을 상대가 채우는가
  const fill = (mine, theirs) => {
    const need = mine.weakest;
    return theirs.pct[need] >= 25 ? 10 : theirs.pct[need] >= 15 ? 7 : theirs.pct[need] >= 8 ? 4 : 1;
  };
  const fillAB = fill(dA, dB), fillBA = fill(dB, dA);
  const elemScore = fillAB + fillBA;

  // ── 년지 (띠) ──
  const yearRel = branchRelations(A.pillars.year.branch, B.pillars.year.branch);
  const yearGood = yearRel.some((r) => r.good);
  const yearBad = yearRel.some((r) => !r.good);
  const yearScore = yearGood ? 10 : yearBad ? 3 : 6;

  // ── 여덟 글자 전체 ──
  // 1,500쌍을 재보니 net 은 평균 −4.3, 표준편차 7.2 였다. 마찰이 합보다
  // 흔해서 중심이 음수다. 그 중심을 0 으로 옮기고 표준편차만큼을 7점으로
  // 환산한다. 순위는 그대로 두고 눈금만 맞추는 일이다.
  const cross = crossAll(A, B);
  const crossAdj = Math.max(-16, Math.min(16, Math.round((cross.net + 4.3) / 7.2 * 7)));

  // 눈금 맞추기. 800쌍을 재보니 중앙값이 63 이라 아무나 둘을 세워도 절반이
  // '좋음'(62 이상)으로 나왔다. 그러면 등급이 아무것도 알려주지 못한다.
  // 중앙값을 '무난' 한가운데로 옮긴다. 순위는 그대로다.
  const score = Math.max(6, Math.min(95,
    Math.round(stemScore + dayScore + elemScore + yearScore + crossAdj) - 7));

  const facts = [
    { label: '일주', value: `${A.pillars.day.hanja} / ${B.pillars.day.hanja}`, note: '두 사람 자신' },
    { label: '일간 관계', value: combine ? '천간합' : `${godAB} / ${godBA}`,
      note: combine ? `${STEMS[A.dayStem]}${STEMS[B.dayStem]} 합 — 서로 손을 잡는 짝` : '서로에게 무엇인가 (방향별)' },
    { label: '일지 관계', value: dayRel.length ? dayRel.map((r) => r.kind).join('·') : '무관',
      note: `${BRANCHES[A.pillars.day.branch]} / ${BRANCHES[B.pillars.day.branch]}` },
    { label: '띠', value: `${A.zodiac} / ${B.zodiac}`,
      note: yearRel.length ? yearRel.map((r) => r.kind).join('·') : '특별한 관계 없음' },
    { label: '오행 보완', value: `${fillAB} + ${fillBA} / 20`,
      note: `${a.name}의 약한 ${ELEMENTS[dA.weakest]}, ${b.name}의 약한 ${ELEMENTS[dB.weakest]}` },
    { label: '여덟 글자 전체',
      value: `합 ${cross.all.filter((x) => x.good).length} · 마찰 ${cross.all.filter((x) => !x.good).length}`,
      note: cross.all.length
        ? `네 기둥끼리 모두 맞댄 것 · ${crossAdj >= 0 ? '+' : ''}${crossAdj}점 반영`
        : '맞댈 글자가 부족합니다' },
  ];

  const readings = [
    {
      title: combine ? '일간이 천간합입니다' : `일간 관계 — ${godAB} / ${godBA}`,
      text: combine
        ? `${j(STEMS[A.dayStem], '과')} ${j(STEMS[B.dayStem], '이')} 합을 이룹니다. 甲己·乙庚·丙辛·丁壬·戊癸 다섯 쌍 가운데 하나입니다.\n\n` +
          `먼저 분명히 해둘 것이 있습니다. 드문 일이 아닙니다. 내 일간이 무엇이든 상대의 열 가지 일간 중 정확히 하나가 합이라, 아무나 둘을 세우면 열 번에 한 번꼴로 나옵니다. 일간 관계 열 가지가 전부 10%씩으로 똑같으니, 합이 정재나 정관보다 희귀한 것도 아닙니다.\n\n` +
          `그런데도 따로 세는 이유는 빈도가 아니라 성질입니다. 열 가지 관계 가운데 가장 순하게 보고, 사주에서 인연을 볼 때 가장 먼저 확인합니다. 서로에게 끌리고 상대의 부족한 데를 자연스럽게 메웁니다. 다만 합은 묶는 힘이라, 서로에게 붙들려 다른 일을 못 하게 되는 면도 함께 있습니다.`
        : `${j(b.name, '은')} ${a.name}에게 ${godAB}입니다. ${PAIR_GOD[godAB][1]}\n` +
          `반대로 ${j(a.name, '은')} ${b.name}에게 ${godBA}입니다. ${PAIR_GOD[godBA][1]}` +
          (stemClash ? '\n\n두 일간이 천간충이기도 합니다. 정면으로 마주 서는 배치라 의견이 자주 갈립니다.' : ''),
    },
    {
      title: `일지 — 배우자 자리끼리`,
      text: dayRel.length
        ? dayRel.map((r) => `${r.kind}: ${r.text}`).join('\n') +
          '\n\n일지는 사주에서 배우자가 앉는 자리입니다. 두 사람의 일지가 어떻게 만나는지가 실제 살림의 결을 좌우합니다.'
        : '두 일지 사이에 합도 충도 없습니다. 서로를 세게 끌어당기지도, 부딪치지도 않는 배치입니다. 밋밋해 보여도 오래 가는 데는 이런 조합이 오히려 편합니다.',
    },
    {
      title: '여덟 글자를 통째로 맞대면',
      text: (() => {
        const good = cross.all.filter((x) => x.good).sort((x, y) => y.w - x.w);
        const bad = cross.all.filter((x) => !x.good).sort((x, y) => y.w - x.w);
        const line = (arr) => arr.slice(0, 4).map((x) => crossLine(x, a.name, b.name)).join(', ');
        const parts = [];
        parts.push('일간과 일지만 보면 나머지 여섯 글자가 무슨 말을 하든 등급이 바뀌지 않습니다. ' +
          '그래서 네 기둥을 서로 다 맞대 봅니다. 일주끼리 걸린 것을 가장 무겁게, 시주끼리를 가장 가볍게 셉니다.');
        if (good.length) parts.push(`손을 잡는 자리 ${good.length}곳 — ${line(good)}${good.length > 4 ? ' 외' : ''}.`);
        if (bad.length) parts.push(`부딪치는 자리 ${bad.length}곳 — ${line(bad)}${bad.length > 4 ? ' 외' : ''}.`);
        parts.push(cross.net > 2
          ? '합이 마찰보다 두툼합니다. 큰 틀에서 서로를 편하게 하는 조합입니다.'
          : cross.net < -8
            ? '마찰이 합보다 두툼합니다. 못 만날 사이라는 뜻이 아니라, 맞춰야 할 자리가 많다는 뜻입니다. 어디가 걸리는지 알고 시작하는 편이 낫습니다.'
            : '합과 마찰이 비슷하게 섞여 있습니다. 잘 맞는 면과 계속 부딪치는 면이 함께 있는 조합입니다.');
        // 줄바꿈 문자를 직접 쓰지 않는다 - 편집 과정에서 실제 줄바꿈이 되어 깨진다
        return parts.join(String.fromCharCode(10, 10));
      })(),
    },
    {
      title: '서로의 빈 곳을 채우는가',
      text: `${j(a.name, '은')} ${j(ELEMENTS[dA.weakest], '이')} 가장 약한데, ${b.name}의 사주에 ${j(ELEMENTS[dA.weakest], '이')} ${dB.pct[dA.weakest]}% 있습니다. ` +
        (fillAB >= 7 ? '제대로 채워주는 쪽입니다. ' : fillAB >= 4 ? '조금 보탬이 됩니다. ' : '이 부분은 상대에게 기대기 어렵습니다. ') +
        `\n${j(b.name, '은')} ${j(ELEMENTS[dB.weakest], '이')} 가장 약한데, ${a.name}의 사주에 ${dA.pct[dB.weakest]}% 있습니다. ` +
        (fillBA >= 7 ? '제대로 채워주는 쪽입니다.' : fillBA >= 4 ? '조금 보탬이 됩니다.' : '이 부분은 상대에게 기대기 어렵습니다.'),
    },
  ];

  return {
    id: meta.id, name: meta.name, score,
    weight: 1.4,               // 한국에서 가장 많이 보는 잣대라 비중을 조금 더 준다
    headline: combine ? '일간 천간합' : `${godAB} / ${godBA} · 일지 ${dayRel.length ? dayRel[0].kind : '무관'}`,
    facts, readings,
  };
}

// ─────────────────────────────────────────────────────────────
// 시기 운세
// ─────────────────────────────────────────────────────────────
// 그 시기의 간지를 일간에 대보면 십신이 나온다. 그게 이 시기의 성격이다.
// 지지끼리 합이 걸리면 풀리고, 충이 걸리면 흔들린다.

const GOD_EFFECT = {
  비견: { 총운: 3, 애정운: -3, 금전운: -7, 직장운: 5, 학업운: 1, 건강운: 3 },
  겁재: { 총운: -5, 애정운: -7, 금전운: -14, 직장운: 0, 학업운: 0, 건강운: 0 },
  식신: { 총운: 9, 애정운: 7, 금전운: 7, 직장운: 6, 학업운: 9, 건강운: 10 },
  상관: { 총운: -2, 애정운: -5, 금전운: 5, 직장운: -8, 학업운: 8, 건강운: -5 },
  편재: { 총운: 6, 애정운: 9, 금전운: 15, 직장운: 4, 학업운: -5, 건강운: -5 },
  정재: { 총운: 9, 애정운: 7, 금전운: 17, 직장운: 6, 학업운: 0, 건강운: 1 },
  편관: { 총운: -6, 애정운: 0, 금전운: -4, 직장운: 9, 학업운: 3, 건강운: -12 },
  정관: { 총운: 9, 애정운: 9, 금전운: 4, 직장운: 17, 학업운: 7, 건강운: -2 },
  편인: { 총운: 0, 애정운: -5, 금전운: -7, 직장운: 0, 학업운: 11, 건강운: 4 },
  정인: { 총운: 8, 애정운: 3, 금전운: -2, 직장운: 6, 학업운: 17, 건강운: 9 },
};

const GOD_LINE = {
  비견: '스스로 밀고 나가는 결입니다. 남에게 기대기보다 자기 판을 챙기게 됩니다.',
  겁재: '경쟁이 붙습니다. 돈이 얽힌 일은 특히 조심할 때입니다.',
  식신: '표현하고 만들어내는 결입니다. 몸도 마음도 비교적 편안합니다.',
  상관: '재능이 드러나지만 말이 날카로워집니다. 윗선과 부딪치기 쉽습니다.',
  편재: '기회가 넓게 들어옵니다. 들어오는 만큼 나가는 것도 늘어납니다.',
  정재: '쌓이는 결입니다. 꾸준히 모으고 정리하기 좋습니다.',
  편관: '압박이 커집니다. 넘기면 한 단계 오르지만 소모가 큽니다.',
  정관: '자리를 얻는 결입니다. 인정과 책임이 함께 옵니다.',
  편인: '방향을 다시 잡는 결입니다. 혼자 있는 시간이 늘어납니다.',
  정인: '배우고 정비하는 결입니다. 문서와 귀인의 도움이 따릅니다.',
};

const BRANCH_MOD = { 육합: 7, 반합: 5, 충: -9, 삼형: -6, 상형: -6, 자형: -3, 해: -4, 파: -3 };

export function forecast(input, chart, period) {
  const r = period.ruling;
  const god = tenGod(chart.dayStem, r.stem);
  const eff = GOD_EFFECT[god];

  const rel = branchRelations(chart.pillars.day.branch, r.branch);
  const mod = rel.reduce((a, x) => a + (BRANCH_MOD[x.kind] ?? 0), 0);

  const areas = {};
  for (const a of Object.keys(eff)) {
    areas[a] = Math.max(8, Math.min(94, Math.round(50 + eff[a] + mod)));
  }

  const relText = rel.length
    ? ` 일지와 ${rel.map((x) => x.kind).join('·')}이(가) 걸려 ${rel.some((x) => x.good) ? '일이 풀리는' : '흔들리는'} 결이 더해집니다.`
    : '';

  return {
    id: meta.id, name: meta.name, weight: 1.5,
    headline: `${r.hanja}(${r.kr}) · ${god}`,
    text: GOD_LINE[god] + relText,
    areas,
  };
}

export default { meta, analyze, compare , forecast };
