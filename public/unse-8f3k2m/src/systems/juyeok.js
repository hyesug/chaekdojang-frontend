/**
 * juyeok.js — 주역 (周易)
 *
 * 괘를 뽑는 방법은 여럿이다. 여기서는 매화역수(梅花易數)의 시간점을 쓴다.
 * 동전이나 산가지 대신 태어난 시각의 숫자로 괘를 세우는 방식이라,
 * 같은 사람에게는 언제 봐도 같은 괘가 나온다.
 *
 *   상괘 = (년지수 + 음력 월 + 음력 일) ÷ 8 의 나머지
 *   하괘 = 거기에 시지수까지 더해 ÷ 8 의 나머지
 *   동효 = 같은 합을 ÷ 6 의 나머지
 *
 * 동효가 뒤집힌 괘를 지괘(之卦)라 하고, 본괘에서 지괘로 가는 것이
 * 곧 "지금 어디에서 어디로 가는 중인가"에 대한 답이 된다.
 */

import { result, modFrom1 } from './_base.js';
import { j } from '../core/josa.js';

export const meta = {
  id: 'juyeok',
  name: '주역',
  hanja: '周易',
  desc: '태어난 시각으로 괘를 세워 지금 놓인 자리와 나아갈 방향을 본다',
  needsTime: false,   // 시지 없이도 돌아간다. 대신 신뢰도를 낮춘다
  needsPlace: false,
};

// 선천팔괘 순서. 숫자 1~8이 그대로 이 순서다.
const TRIGRAMS = [
  { name: '건', hanja: '乾', symbol: '☰', nature: '하늘', element: 3, bits: [1, 1, 1], tags: ['주도', '책임'] },
  { name: '태', hanja: '兌', symbol: '☱', nature: '못', element: 3, bits: [1, 1, 0], tags: ['표현', '사교'] },
  { name: '리', hanja: '離', symbol: '☲', nature: '불', element: 1, bits: [1, 0, 1], tags: ['명예', '직관'] },
  { name: '진', hanja: '震', symbol: '☳', nature: '우레', element: 0, bits: [1, 0, 0], tags: ['실행', '변화'] },
  { name: '손', hanja: '巽', symbol: '☴', nature: '바람', element: 0, bits: [0, 1, 1], tags: ['사교', '인내'] },
  { name: '감', hanja: '坎', symbol: '☵', nature: '물', element: 4, bits: [0, 1, 0], tags: ['내향', '직관'] },
  { name: '간', hanja: '艮', symbol: '☶', nature: '산', element: 2, bits: [0, 0, 1], tags: ['안정', '인내'] },
  { name: '곤', hanja: '坤', symbol: '☷', nature: '땅', element: 2, bits: [0, 0, 0], tags: ['돌봄', '안정'] },
];

/** [상괘][하괘] → 주역 64괘 번호 (문왕 순서) */
const HEXAGRAM_TABLE = [
  [1, 10, 13, 25, 44, 6, 33, 12],   // 상 건
  [43, 58, 49, 17, 28, 47, 31, 45], // 상 태
  [14, 38, 30, 21, 50, 64, 56, 35], // 상 리
  [34, 54, 55, 51, 32, 40, 62, 16], // 상 진
  [9, 61, 37, 42, 57, 59, 53, 20],  // 상 손
  [5, 60, 63, 3, 48, 29, 39, 8],    // 상 감
  [26, 41, 22, 27, 18, 4, 52, 23],  // 상 간
  [11, 19, 36, 24, 46, 7, 15, 2],   // 상 곤
];

const HEXAGRAMS = [
  null,
  ['乾爲天', '건위천', '하늘이 거듭됩니다. 힘이 가장 왕성한 자리라 나아가면 통합니다. 다만 끝까지 오른 용은 후회한다고 했습니다. 자만이 유일한 적입니다.'],
  ['坤爲地', '곤위지', '땅이 거듭됩니다. 앞서지 말고 따라가야 이롭습니다. 받아들이고 실어 나르는 힘으로 이루는 자리입니다.'],
  ['水雷屯', '수뢰둔', '싹이 흙을 뚫고 나오는 중입니다. 시작의 고비라 어지럽지만, 도와줄 사람을 찾으면 뚫립니다. 혼자 밀어붙일 국면이 아닙니다.'],
  ['山水蒙', '산수몽', '아직 어립니다. 모르는 것을 모른다고 하고 배울 때입니다. 묻는 쪽이 이롭고, 같은 것을 세 번 물으면 답이 흐려집니다.'],
  ['水天需', '수천수', '기다림입니다. 때가 아직 오지 않았습니다. 조급하게 건너면 빠집니다. 준비하며 기다리면 반드시 통합니다.'],
  ['天水訟', '천수송', '다툼입니다. 이겨도 남는 것이 적은 자리입니다. 중간에 멈추면 길하고, 끝까지 가면 흉합니다.'],
  ['地水師', '지수사', '군사를 움직입니다. 명분이 서야 사람이 따릅니다. 규율 있는 조직으로 움직일 때 이룹니다.'],
  ['水地比', '수지비', '가까이합니다. 사람과 손잡을 때입니다. 먼저 다가가는 쪽이 이롭고, 늦게 오면 자리가 없습니다.'],
  ['風天小畜', '풍천소축', '작게 쌓입니다. 아직 크게 움직일 힘이 없습니다. 구름은 모였으나 비는 오지 않았습니다. 조금씩 모을 때입니다.'],
  ['天澤履', '천택리', '호랑이 꼬리를 밟습니다. 아슬아슬한 자리지만 예를 지키면 물리지 않습니다. 처신이 전부인 국면입니다.'],
  ['地天泰', '지천태', '통합니다. 막혔던 것이 열리고 위아래가 서로 만납니다. 주역에서 가장 좋은 흐름 중 하나입니다.'],
  ['天地否', '천지비', '막혔습니다. 위아래가 서로 등을 돌린 자리입니다. 나서지 말고 물러나 지킬 때입니다.'],
  ['天火同人', '천화동인', '사람과 함께합니다. 뜻이 같은 이를 만나는 자리입니다. 숨기지 말고 드러내놓고 해야 통합니다.'],
  ['火天大有', '화천대유', '크게 가집니다. 풍요의 자리입니다. 넘칠수록 나눠야 지켜집니다.'],
  ['地山謙', '지산겸', '겸손입니다. 낮출수록 올라갑니다. 여섯 효가 모두 길한 유일한 괘입니다.'],
  ['雷地豫', '뇌지예', '미리 준비합니다. 즐거움과 대비가 함께 있는 자리입니다. 방심이 유일한 문제입니다.'],
  ['澤雷隨', '택뢰수', '따릅니다. 흐름에 맞출 때입니다. 고집을 내려놓는 순간 풀립니다.'],
  ['山風蠱', '산풍고', '그릇에 벌레가 슬었습니다. 오래 방치한 문제를 손볼 때입니다. 고치면 크게 이롭습니다.'],
  ['地澤臨', '지택림', '다가갑니다. 일이 커지는 국면입니다. 다만 여덟 달 뒤를 조심하라 했습니다.'],
  ['風地觀', '풍지관', '봅니다. 움직이기 전에 살필 때입니다. 보여주는 쪽도, 보는 쪽도 되는 자리입니다.'],
  ['火雷噬嗑', '화뢰서합', '씹어 끊습니다. 가로막은 것을 제거할 때입니다. 단호해야 통합니다.'],
  ['山火賁', '산화비', '꾸밉니다. 겉을 다듬는 시기입니다. 본질을 잊으면 빈 껍데기만 남습니다.'],
  ['山地剝', '산지박', '깎여 나갑니다. 무너지는 국면이라 나서면 다칩니다. 멈추고 지킬 때입니다.'],
  ['地雷復', '지뢰복', '돌아옵니다. 바닥을 치고 다시 시작하는 자리입니다. 이레면 돌아온다 했습니다.'],
  ['天雷无妄', '천뢰무망', '거짓이 없습니다. 자연스럽게 두면 통하고, 억지를 부리면 화가 됩니다.'],
  ['山天大畜', '산천대축', '크게 쌓습니다. 지금 모은 힘을 나중에 크게 씁니다. 집에서 먹지 말고 나가라 했습니다.'],
  ['山雷頤', '산뢰이', '기릅니다. 무엇을 먹고 무엇을 말하는지 살필 때입니다. 입으로 들어가고 나오는 것이 핵심입니다.'],
  ['澤風大過', '택풍대과', '지나칩니다. 대들보가 휘는 자리입니다. 감당 못 할 짐은 내려놓아야 합니다.'],
  ['坎爲水', '감위수', '구덩이가 거듭됩니다. 험난함이 이어지는 자리입니다. 성실함을 잃지 않는 것만이 빠져나오는 길입니다.'],
  ['離爲火', '이위화', '불이 거듭됩니다. 밝게 드러나는 자리이지만, 불은 붙을 곳이 있어야 탑니다. 의지할 데를 분명히 하세요.'],
  ['澤山咸', '택산함', '느낍니다. 감응하고 인연이 닿는 자리입니다. 머리보다 마음이 먼저 움직입니다.'],
  ['雷風恒', '뇌풍항', '항상합니다. 오래 지속할 때입니다. 바꾸려 들지 말고 지키는 것이 이롭습니다.'],
  ['天山遯', '천산돈', '물러납니다. 피하는 것이 이로운 자리입니다. 물러서는 것도 전략입니다.'],
  ['雷天大壯', '뇌천대장', '크게 강합니다. 힘이 넘치는 자리입니다. 예가 아니면 나아가지 말라 했습니다.'],
  ['火地晉', '화지진', '나아갑니다. 해가 땅 위로 떠오르는 자리입니다. 승진과 인정이 따릅니다.'],
  ['地火明夷', '지화명이', '빛이 상했습니다. 밝음을 감춰야 할 때입니다. 드러내면 다칩니다.'],
  ['風火家人', '풍화가인', '집안입니다. 안을 먼저 다스릴 때입니다. 안이 바르면 밖은 따라옵니다.'],
  ['火澤睽', '화택규', '어긋납니다. 뜻이 갈리는 자리입니다. 작은 일은 되지만 큰일은 어렵습니다.'],
  ['水山蹇', '수산건', '절뚝입니다. 앞이 막혔습니다. 방향을 바꾸고 도와줄 사람을 찾아야 합니다.'],
  ['雷水解', '뇌수해', '풀립니다. 얼었던 것이 녹는 자리입니다. 빨리 처리할수록 좋습니다.'],
  ['山澤損', '산택손', '덜어냅니다. 줄여서 보태는 때입니다. 아래를 덜어 위에 주는 구조입니다.'],
  ['風雷益', '풍뢰익', '더합니다. 보태지는 때입니다. 움직이면 이롭습니다.'],
  ['澤天夬', '택천쾌', '터집니다. 결단할 때입니다. 힘으로 밀지 말고 명분을 세워야 합니다.'],
  ['天風姤', '천풍구', '만납니다. 뜻밖의 만남이 있는 자리입니다. 오래 두면 커지니 초기에 다뤄야 합니다.'],
  ['澤地萃', '택지췌', '모입니다. 사람과 재물이 모이는 자리입니다. 중심을 세워야 흩어지지 않습니다.'],
  ['地風升', '지풍승', '올라갑니다. 차근차근 상승하는 자리입니다. 서두르지 않으면 크게 통합니다.'],
  ['澤水困', '택수곤', '곤궁합니다. 갇힌 자리입니다. 말이 통하지 않으니 행동으로 보여야 합니다.'],
  ['水風井', '수풍정', '우물입니다. 자리는 그대로인데 쓰는 사람이 바뀝니다. 본질을 지키는 것이 답입니다.'],
  ['澤火革', '택화혁', '바꿉니다. 개혁의 때입니다. 때가 무르익어야 사람이 믿습니다.'],
  ['火風鼎', '화풍정', '솥을 앉힙니다. 새로 세우는 때입니다. 사람을 길러야 이룹니다.'],
  ['震爲雷', '진위뢰', '우레가 거듭됩니다. 놀라는 자리입니다. 흔들려도 중심을 잃지 않으면 됩니다.'],
  ['艮爲山', '간위산', '산이 거듭됩니다. 멈추는 자리입니다. 멈출 곳에서 멈추는 것이 지혜입니다.'],
  ['風山漸', '풍산점', '차례로 나아갑니다. 순서를 밟아야 하는 자리입니다. 건너뛰면 무너집니다.'],
  ['雷澤歸妹', '뇌택귀매', '순서가 어긋난 결합입니다. 급히 맺으면 오래가기 어렵습니다.'],
  ['雷火豊', '뇌화풍', '풍성합니다. 절정의 자리입니다. 해가 중천이면 기울기 시작합니다.'],
  ['火山旅', '화산려', '나그네입니다. 떠도는 처지입니다. 작게 지키면 무사합니다.'],
  ['巽爲風', '손위풍', '바람이 거듭됩니다. 스며드는 자리입니다. 부드럽게 반복하면 통합니다.'],
  ['兌爲澤', '태위택', '못이 거듭됩니다. 기쁨과 말의 자리입니다. 즐거움이 지나치면 흐트러집니다.'],
  ['風水渙', '풍수환', '흩어집니다. 뭉친 것이 풀리는 자리입니다. 다시 모을 중심을 세워야 합니다.'],
  ['水澤節', '수택절', '마디를 둡니다. 절제할 때입니다. 다만 지나친 절제도 해롭습니다.'],
  ['風澤中孚', '풍택중부', '진실합니다. 믿음이 통하는 자리입니다. 속을 비워야 받아들일 수 있습니다.'],
  ['雷山小過', '뇌산소과', '조금 지나칩니다. 작은 일은 되고 큰일은 안 됩니다. 새는 높이 날지 말라 했습니다.'],
  ['水火既濟', '수화기제', '이미 건넜습니다. 완성의 자리입니다. 완성된 순간부터 흐트러지기 시작합니다.'],
  ['火水未濟', '화수미제', '아직 건너지 못했습니다. 마지막 고비입니다. 거의 다 왔으니 끝까지 가야 합니다.'],
];

const LINE_ROLE = [
  '초효 — 이제 막 시작한 자리입니다. 아직 힘이 없으니 서두르지 마세요.',
  '이효 — 아랫자리에서 중심을 잡은 자리입니다. 안정적이고 도움을 받습니다.',
  '삼효 — 아래와 위의 경계입니다. 가장 불안정하고 선택이 많은 자리입니다.',
  '사효 — 윗자리에 막 들어선 자리입니다. 조심스럽게 처신해야 합니다.',
  '오효 — 가장 좋은 자리입니다. 중심에서 일을 주도합니다.',
  '상효 — 끝까지 간 자리입니다. 물러날 때를 아는 것이 과제입니다.',
];

function trigramFromBits(bits) {
  return TRIGRAMS.findIndex((t) => t.bits.every((b, i) => b === bits[i]));
}

export function analyze(input) {
  const { lunar, yearBranch, hourBranch, timeKnown } = input;

  const yearNum = yearBranch + 1;               // 子=1 … 亥=12
  const hourNum = timeKnown ? hourBranch + 1 : 1;
  const base = yearNum + lunar.month + lunar.day;

  const upperNum = modFrom1(base, 8);
  const lowerNum = modFrom1(base + hourNum, 8);
  const movingLine = modFrom1(base + hourNum, 6);

  const upper = upperNum - 1;
  const lower = lowerNum - 1;
  const hexNum = HEXAGRAM_TABLE[upper][lower];
  const [hexName, hexKr, hexText] = HEXAGRAMS[hexNum];

  // 지괘 — 동효를 뒤집어 얻는 괘. 지금 향하고 있는 방향이다.
  const lines = [...TRIGRAMS[lower].bits, ...TRIGRAMS[upper].bits];
  lines[movingLine - 1] = lines[movingLine - 1] ? 0 : 1;
  const newLower = trigramFromBits(lines.slice(0, 3));
  const newUpper = trigramFromBits(lines.slice(3, 6));
  const changedNum = HEXAGRAM_TABLE[newUpper][newLower];
  const [chName, chKr, chText] = HEXAGRAMS[changedNum];

  const facts = [
    { label: '본괘', value: `${hexNum}. ${hexName}`, note: `${hexKr} · ${TRIGRAMS[upper].symbol}${TRIGRAMS[lower].symbol}` },
    { label: '상괘', value: TRIGRAMS[upper].hanja, note: `${TRIGRAMS[upper].name} · ${TRIGRAMS[upper].nature}` },
    { label: '하괘', value: TRIGRAMS[lower].hanja, note: `${TRIGRAMS[lower].name} · ${TRIGRAMS[lower].nature}` },
    { label: '동효', value: `제${movingLine}효`, note: LINE_ROLE[movingLine - 1].split('—')[0].trim() },
    { label: '지괘', value: `${changedNum}. ${chName}`, note: `${chKr} · 향하는 방향` },
  ];

  const readings = [
    { title: `본괘 — ${hexName} (${hexKr})`, text: hexText },
    { title: `동효 — 제${movingLine}효`, text: LINE_ROLE[movingLine - 1] },
    {
      title: `지괘 — ${chName} (${chKr})`,
      text: `${hexName}에서 ${j(chName, '으로')} 가고 있습니다. ${chText}`,
    },
    {
      title: '괘의 구조',
      text: `위는 ${TRIGRAMS[upper].nature}(${TRIGRAMS[upper].hanja}), 아래는 ${TRIGRAMS[lower].nature}(${TRIGRAMS[lower].hanja})입니다. ` +
        (upper === lower
          ? '같은 기운이 거듭된 순괘라 그 성질이 가장 짙게 드러납니다.'
          : `${TRIGRAMS[lower].nature} 위에 ${j(TRIGRAMS[upper].nature, '이')} 놓인 형국입니다. 아래가 바탕이고 위가 겉으로 드러나는 모습입니다.`),
    },
  ];

  const elements = [0, 0, 0, 0, 0];
  elements[TRIGRAMS[upper].element] += 1;
  elements[TRIGRAMS[lower].element] += 1;

  // 상승하는 괘와 막히는 괘를 대략 구분해 영역 점수에 반영한다
  const AUSPICIOUS = new Set([1, 11, 14, 15, 16, 19, 24, 26, 31, 32, 35, 37, 40, 42, 45, 46, 55, 58, 61, 63]);
  const DIFFICULT = new Set([3, 4, 6, 12, 23, 28, 29, 33, 36, 38, 39, 41, 44, 47, 49, 54, 56, 59, 62]);
  const tone = AUSPICIOUS.has(hexNum) ? 12 : DIFFICULT.has(hexNum) ? -12 : 0;

  return result({
    id: meta.id,
    name: meta.name,
    hanja: meta.hanja,
    headline: `${hexName}(${hexKr}) 제${movingLine}효 동 → ${chName}`,
    facts,
    readings,
    confidence: timeKnown ? 1 : 0.6,
    signals: {
      elements,
      traits: {
        주도: TRIGRAMS[upper].element === 3 ? 0.5 : 0,
        외향: TRIGRAMS[upper].element === 1 ? 0.5 : 0,
        감성: TRIGRAMS[upper].element === 4 ? 0.5 : 0,
        안정: TRIGRAMS[upper].element === 2 ? 0.5 : 0,
        실리: 0,
      },
      domains: {
        재물: 50 + tone, 관계: 50 + tone, 직업: 50 + tone,
        건강: null, 학업: null,
      },
      tags: [...new Set([...TRIGRAMS[upper].tags, ...TRIGRAMS[lower].tags])],
      keywords: [hexKr, TRIGRAMS[upper].nature, TRIGRAMS[lower].nature],
    },
  });
}

// ── 궁합 ──
// 두 사람의 괘를 하나로 합쳐 관계 자체의 괘를 뽑는다.
// 위는 먼저 묻는 쪽(A)의 상괘, 아래는 상대(B)의 하괘를 쓴다.
// 관계는 위아래가 만나 이루는 하나의 형국이라고 보는 것이다.

export function hexOf(x) {
  const yearNum = x.yearBranch + 1;
  const hourNum = x.timeKnown ? x.hourBranch + 1 : 1;
  const base = yearNum + x.lunar.month + x.lunar.day;
  const upper = modFrom1(base, 8) - 1;
  const lower = modFrom1(base + hourNum, 8) - 1;
  return { upper, lower, num: HEXAGRAM_TABLE[upper][lower] };
}

export function compare(a, b) {
  const hA = hexOf(a), hB = hexOf(b);
  const upper = hA.upper, lower = hB.lower;
  const num = HEXAGRAM_TABLE[upper][lower];
  const [name, kr, text] = HEXAGRAMS[num];

  const AUS = new Set([1, 11, 14, 15, 16, 19, 24, 26, 31, 32, 35, 37, 40, 42, 45, 46, 55, 58, 61, 63]);
  const DIF = new Set([3, 4, 6, 12, 23, 28, 29, 33, 36, 38, 39, 41, 44, 47, 49, 54, 56, 59, 62]);

  const eU = TRIGRAMS[upper].element, eL = TRIGRAMS[lower].element;
  const gen = (x, y) => (x + 1) % 5 === y;
  const ovc = (x, y) => (x + 2) % 5 === y;

  let score = AUS.has(num) ? 80 : DIF.has(num) ? 34 : 56;
  if (gen(eU, eL) || gen(eL, eU)) score += 10;
  if (ovc(eU, eL) || ovc(eL, eU)) score -= 10;
  score = Math.max(10, Math.min(94, score));

  return {
    id: meta.id, name: meta.name, score,
    headline: `관계괘 ${name}(${kr})`,
    facts: [
      { label: `${a.name}의 괘`, value: HEXAGRAMS[hA.num][0], note: HEXAGRAMS[hA.num][1] },
      { label: `${b.name}의 괘`, value: HEXAGRAMS[hB.num][0], note: HEXAGRAMS[hB.num][1] },
      { label: '관계괘', value: `${num}. ${name}`, note: `${kr} · ${TRIGRAMS[upper].symbol}${TRIGRAMS[lower].symbol}` },
      { label: '상괘 / 하괘', value: `${TRIGRAMS[upper].nature} / ${TRIGRAMS[lower].nature}`, note: `${TRIGRAMS[upper].hanja} / ${TRIGRAMS[lower].hanja}` },
    ],
    readings: [
      { title: `관계괘 — ${name} (${kr})`, text },
      {
        title: '두 기운이 만나는 방식',
        text: `위는 ${a.name}의 ${TRIGRAMS[upper].nature}, 아래는 ${b.name}의 ${TRIGRAMS[lower].nature}입니다. ` +
          (gen(eU, eL) ? '위가 아래를 낳아주는 배치라 관계가 순하게 흐릅니다.'
            : gen(eL, eU) ? '아래가 위를 받쳐주는 배치라 든든합니다.'
            : ovc(eU, eL) ? '위가 아래를 누르는 배치입니다. 한쪽이 주도하고 다른 쪽이 따르는 형태가 되기 쉽습니다.'
            : ovc(eL, eU) ? '아래가 위를 거스르는 배치입니다. 겉으로는 조용해도 속에서 밀고 당기는 힘이 있습니다.'
            : '두 기운이 같은 결이라 서로 간섭하지 않습니다. 편안하지만 밋밋할 수 있습니다.'),
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// 시기 운세
// ─────────────────────────────────────────────────────────────
// 그 시점으로 괘를 다시 뽑는다. 시간점이라 시기마다 괘가 달라진다.

export function forecast(input, chart, period) {
  const base = period.ruling.branch + 1 + period.gz.month.branch + 1 + period.jdn % 30;
  const upper = modFrom1(base, 8) - 1;
  const lower = modFrom1(base + input.yearBranch + 1, 8) - 1;
  const num = HEXAGRAM_TABLE[upper][lower];
  const [name, kr, text] = HEXAGRAMS[num];

  const AUS = new Set([1, 11, 14, 15, 16, 19, 24, 26, 31, 32, 35, 37, 40, 42, 45, 46, 55, 58, 61, 63]);
  const DIF = new Set([3, 4, 6, 12, 23, 28, 29, 33, 36, 38, 39, 41, 44, 47, 49, 54, 56, 59, 62]);
  const tone = AUS.has(num) ? 13 : DIF.has(num) ? -13 : 0;

  const el = TRIGRAMS[upper].element;
  const areas = {
    총운: 50 + tone,
    애정운: 50 + tone + (el === 4 ? 5 : 0),
    금전운: 50 + tone + (el === 3 ? 6 : 0),
    직장운: 50 + tone + (el === 0 ? 5 : 0),
    학업운: 50 + tone + (el === 1 ? 5 : 0),
    건강운: 50 + tone + (el === 2 ? 4 : 0),
  };
  for (const k of Object.keys(areas)) areas[k] = Math.max(8, Math.min(94, areas[k]));

  return {
    id: meta.id, name: meta.name, weight: 0.9,
    headline: `${name}(${kr})`,
    text: text.split('.')[0] + '.',
    areas,
  };
}

export default { meta, analyze, compare , forecast };
