/**
 * jamidusu.js — 자미두수 (紫微斗數)
 *
 * 사주가 여덟 글자로 기운을 보는 체계라면, 자미두수는 열두 칸짜리 판을 깔고
 * 별을 배치해 삶의 영역별로 나눠 보는 체계다. 같은 동양 명리지만 방식이 전혀 다르다.
 *
 * 판을 세우는 순서
 *   1. 명궁 — 인궁에서 음력 생월만큼 순행하고, 거기서 생시만큼 역행한 자리
 *   2. 십이궁 — 명궁부터 역행으로 형제·부처·자녀·재백·질액·천이·노복·관록·전택·복덕·부모
 *   3. 오행국 — 명궁의 간지를 납음오행으로 바꾼 것. 수2·목3·금4·토5·화6
 *   4. 자미성 — 생일을 국수로 나눈 몫과 나머지로 자리를 정한다
 *   5. 나머지 열세 주성 — 자미계 여섯과 천부계 여덟이 정해진 간격으로 따라 붙는다
 *   6. 사화 — 태어난 해의 천간에 따라 네 별에 녹·권·과·기가 붙는다
 *
 * 음력 생일을 쓰므로 윤달 출생은 결과가 갈릴 수 있다.
 */

import { BRANCHES, BRANCHES_KR, STEMS, STEMS_KR, branchRelations } from '../core/ganzhi.js';
import { j } from '../core/josa.js';
import {
  auxPlacements, helperPlacements, trineSquare, SIX_EVIL, STAR_MEANING,
} from '../core/ziweiStars.js';
import { result } from './_base.js';

export const meta = {
  id: 'jamidusu',
  name: '자미두수',
  hanja: '紫微斗數',
  desc: '열두 궁에 별을 배치해 삶의 영역별로 나눠 본다',
  needsTime: true,
  requiresTime: true,   // 시각이 없으면 판 자체가 안 서는 체계
  needsPlace: false,
};

/** 십이궁 — 명궁에서 역행으로 붙는다 */
export const PALACES = [
  ['명궁', '命宮', '나 자신 · 타고난 기질과 삶의 큰 방향'],
  ['형제궁', '兄弟宮', '형제와 가까운 동료, 협력 관계'],
  ['부처궁', '夫妻宮', '배우자와 깊은 인연'],
  ['자녀궁', '子女宮', '자식과 아랫사람, 창작물'],
  ['재백궁', '財帛宮', '돈이 들어오고 나가는 방식'],
  ['질액궁', '疾厄宮', '몸과 건강, 약한 곳'],
  ['천이궁', '遷移宮', '바깥에서의 나, 이동과 외지'],
  ['노복궁', '奴僕宮', '친구와 아랫사람, 사회적 인맥'],
  ['관록궁', '官祿宮', '직업과 사회적 성취'],
  ['전택궁', '田宅宮', '집과 부동산, 가정 환경'],
  ['복덕궁', '福德宮', '정신의 즐거움과 내면의 복'],
  ['부모궁', '父母宮', '부모와 윗사람, 물려받은 것'],
];

/** 60갑자 납음오행 — 두 갑자가 한 쌍을 이룬다. 0목 1화 2토 3금 4수 */
export const NAYEUM = [3, 1, 0, 2, 3, 1, 4, 2, 3, 0, 4, 2, 1, 0, 4, 3, 1, 0, 2, 3, 1, 4, 2, 3, 0, 4, 2, 1, 0, 4];
/** 납음오행 → 국수 */
export const GUK = { 4: { n: 2, name: '수이국', hanja: '水二局' }, 0: { n: 3, name: '목삼국', hanja: '木三局' },
              3: { n: 4, name: '금사국', hanja: '金四局' }, 2: { n: 5, name: '토오국', hanja: '土五局' },
              1: { n: 6, name: '화육국', hanja: '火六局' } };

/** 십사주성 */
export const STARS = {
  자미: { hanja: '紫微', el: 2, kind: '제왕',
    text: '판의 중심에 서는 별입니다. 존중받는 자리에 있을 때 안정되고, 아래에 놓이면 크게 답답해합니다. 품이 넓고 책임을 지지만 고고해서 외로울 수 있습니다.',
    traits: { 주도: 0.8, 안정: 0.4 }, tags: ['주도', '명예'] },
  천기: { hanja: '天機', el: 0, kind: '지혜',
    text: '머리가 빠르게 도는 별입니다. 기획하고 궁리하는 데 강하고 변화를 먼저 읽습니다. 생각이 많아 잠을 설치고, 한자리에 오래 못 있습니다.',
    traits: { 감성: 0.3, 안정: -0.5 }, tags: ['분석', '변화'] },
  태양: { hanja: '太陽', el: 1, kind: '귀',
    text: '베푸는 별입니다. 드러나는 자리와 인연이 깊고 남을 챙기느라 자기를 소모합니다. 명예는 따르되 실속은 뒤로 밀리기 쉽습니다.',
    traits: { 외향: 0.7, 주도: 0.5 }, tags: ['명예', '돌봄'] },
  무곡: { hanja: '武曲', el: 3, kind: '재',
    text: '맺고 끊는 재물의 별입니다. 결단이 빠르고 실행이 확실해서 돈을 만드는 힘이 강합니다. 정이 메마르게 보일 수 있어 관계에서 손해를 봅니다.',
    traits: { 주도: 0.6, 실리: 0.7, 감성: -0.4 }, tags: ['재물', '결단'] },
  천동: { hanja: '天同', el: 4, kind: '복',
    text: '복을 타고나는 별입니다. 모나지 않고 사람을 편하게 하며 큰 풍파를 비껴갑니다. 다만 편안함에 익어 스스로를 밀어붙이지 않습니다.',
    traits: { 감성: 0.5, 주도: -0.3, 안정: 0.5 }, tags: ['안정', '돌봄'] },
  염정: { hanja: '廉貞', el: 1, kind: '囚',
    text: '양면이 뚜렷한 별입니다. 원칙을 세우면 누구보다 엄격하고, 욕망 쪽으로 기울면 끝까지 갑니다. 그 진폭이 이 사람의 인생을 만듭니다.',
    traits: { 주도: 0.5, 감성: 0.4, 안정: -0.4 }, tags: ['변화', '결단'] },
  천부: { hanja: '天府', el: 2, kind: '庫',
    text: '곳간의 별입니다. 모으고 지키는 데 능하며 위기에도 잘 무너지지 않습니다. 안정을 우선하다 큰 기회를 흘려보내기도 합니다.',
    traits: { 안정: 0.8, 실리: 0.6 }, tags: ['안정', '재물'] },
  태음: { hanja: '太陰', el: 4, kind: '부',
    text: '안으로 쌓는 별입니다. 섬세하고 저축의 감각이 좋으며 조용히 자산을 불립니다. 감정을 드러내지 않아 오해를 삽니다.',
    traits: { 감성: 0.6, 외향: -0.4, 실리: 0.4 }, tags: ['재물', '내향'] },
  탐랑: { hanja: '貪狼', el: 4, kind: '욕망',
    text: '재주와 욕심이 함께 큰 별입니다. 배우는 것이 빠르고 사람을 끄는 매력이 있습니다. 손대는 것이 많아 하나를 끝까지 못 가는 것이 과제입니다.',
    traits: { 외향: 0.7, 실리: 0.4, 안정: -0.5 }, tags: ['사교', '변화'] },
  거문: { hanja: '巨門', el: 4, kind: '暗',
    text: '말의 별입니다. 따지고 파고드는 힘이 강해 전문 분야에서 빛납니다. 그 입이 시비를 부르기도 하니 말의 온도를 조절해야 합니다.',
    traits: { 감성: -0.2, 주도: 0.3 }, tags: ['분석', '표현'] },
  천상: { hanja: '天相', el: 4, kind: '印',
    text: '보좌하는 별입니다. 중재하고 조율하는 자리에서 가장 잘 쓰이며 신뢰가 두텁습니다. 스스로 판을 여는 힘은 약한 편입니다.',
    traits: { 안정: 0.5, 주도: -0.2, 감성: 0.3 }, tags: ['돌봄', '안정'] },
  천량: { hanja: '天梁', el: 2, kind: '蔭',
    text: '그늘을 드리우는 별입니다. 남을 보호하고 원칙을 세우며 어른 노릇을 하게 됩니다. 고집이 세고 잔소리가 많아지기 쉽습니다.',
    traits: { 안정: 0.6, 주도: 0.4 }, tags: ['책임', '돌봄'] },
  칠살: { hanja: '七殺', el: 3, kind: '장군',
    text: '개척하는 별입니다. 위험을 감수하고 앞으로 나가며 파란을 겪습니다. 안정된 자리에 두면 오히려 병이 나는 유형입니다.',
    traits: { 주도: 0.8, 안정: -0.6 }, tags: ['결단', '독립'] },
  파군: { hanja: '破軍', el: 4, kind: '耗',
    text: '부수고 다시 세우는 별입니다. 기존의 틀을 못 견디고 갈아엎습니다. 변동이 크지만 그 끝에 자기만의 것을 세웁니다.',
    traits: { 주도: 0.6, 안정: -0.8 }, tags: ['변화', '독립'] },
};

/** 자미계 — 자미에서 역행으로 붙는 간격 */
export const ZIWEI_GROUP = [['자미', 0], ['천기', -1], ['태양', -3], ['무곡', -4], ['천동', -5], ['염정', -8]];
/** 천부계 — 천부에서 순행으로 붙는 간격 */
export const TIANFU_GROUP = [['천부', 0], ['태음', 1], ['탐랑', 2], ['거문', 3], ['천상', 4], ['천량', 5], ['칠살', 6], ['파군', 10]];

/** 사화 — 태어난 해의 천간이 네 별에 녹·권·과·기를 붙인다 */
export const SIHWA = {
  갑: ['염정', '파군', '무곡', '태양'], 을: ['천기', '천량', '자미', '태음'],
  병: ['천동', '천기', '문창', '염정'], 정: ['태음', '천동', '천기', '거문'],
  무: ['탐랑', '태음', '우필', '천기'], 기: ['무곡', '탐랑', '천량', '문곡'],
  경: ['태양', '무곡', '태음', '천동'], 신: ['거문', '태양', '문곡', '문창'],
  임: ['천량', '자미', '좌보', '무곡'], 계: ['파군', '거문', '태음', '탐랑'],
};
export const SIHWA_LABEL = ['화록 (재물과 기회가 붙는다)', '화권 (권한과 주도권이 생긴다)',
                     '화과 (명예와 평판이 오른다)', '화기 (막히고 집착하게 된다)'];

/**
 * 재백궁에 든 별이 말하는 **돈의 결**.
 *
 * 위 `STARS` 의 설명과 같은 성질을 돈 쪽으로 옮긴 것이다. 새 뜻을 만들지
 * 않았다 — 무곡이 재성의 별, 천부가 곳간, 태음이 저축, 파군이 소모(耗)라는
 * 것은 `STARS` 표가 이미 적어 둔 그대로다.
 */
const WEALTH_STAR = {
  자미: '큰 판에서 도는 돈입니다. 규모가 커야 움직이고, 작은 돈에는 마음이 잘 안 갑니다.',
  천기: '머리로 버는 쪽입니다. 수입 경로가 자주 바뀌고, 한 갈래로 고정되지 않습니다.',
  태양: '명예는 따르되 실속이 뒤로 밀리기 쉽습니다. 이름값에 비해 손에 쥐는 것이 적습니다.',
  무곡: '재물의 별이 제자리에 앉았습니다. 맺고 끊음이 분명해 돈을 만드는 힘이 강합니다.',
  천동: '애써 좇지 않아도 굶지는 않는 자리입니다. 대신 스스로 밀어붙여 크게 불리지도 않습니다.',
  염정: '진폭이 큽니다. 원칙을 세우면 단단하고, 욕망 쪽으로 기울면 끝까지 갑니다.',
  천부: '곳간의 별입니다. 모으고 지키는 데 강해 위기에도 잘 무너지지 않습니다.',
  태음: '조용히 쌓는 쪽입니다. 저축의 감각이 좋고 티 내지 않고 불립니다.',
  탐랑: '들어오는 만큼 쓰는 쪽입니다. 손대는 것이 많아 한곳에 모이기 어렵습니다.',
  거문: '말과 전문성으로 버는 쪽입니다. 따져서 얻는 돈이라 시비도 함께 붙습니다.',
  천상: '중재하고 조율하는 자리에서 돈이 붙습니다. 스스로 판을 여는 힘은 약합니다.',
  천량: '늦게 자리 잡는 쪽입니다. 급히 불리려 하면 오히려 어긋납니다.',
  칠살: '크게 걸고 크게 얻거나 잃습니다. 안전한 자리에 두면 답답해합니다.',
  파군: '耗(소모)의 별입니다. 들어오는 것도 크고 나가는 것도 커서 남기기가 어렵습니다.',
};

export function analyze(input) {
  const { lunar, hourBranch, timeKnown, yearBranch, sajuYear } = input;
  if (!timeKnown) throw new Error('자미두수는 태어난 시각이 있어야 판을 세울 수 있습니다');

  const lm = lunar.month;
  const ld = lunar.day;

  // 1) 명궁 · 신궁
  const myeong = ((2 + lm - 1 - hourBranch) % 12 + 12) % 12;
  const sin = ((2 + lm - 1 + hourBranch) % 12 + 12) % 12;

  // 2) 오행국 — 명궁의 간지를 납음으로
  const yearStem = ((sajuYear - 4) % 10 + 10) % 10;
  const inStem = ((yearStem % 5) * 2 + 2) % 10;              // 오호둔: 인궁의 천간
  const myeongStem = ((inStem + myeong - 2) % 10 + 10) % 10;
  let sexa = -1;
  for (let i = 0; i < 60; i++) if (i % 10 === myeongStem && i % 12 === myeong) { sexa = i; break; }
  const guk = GUK[NAYEUM[Math.floor(sexa / 2)]];

  // 3) 자미성 위치
  const mok = Math.ceil(ld / guk.n);        // 상수
  const remainder = mok * guk.n - ld;       // 여수
  const ziwei = ((2 + mok - 1 + (remainder % 2 === 0 ? remainder : -remainder)) % 12 + 12) % 12;
  const tianfu = ((4 - ziwei) % 12 + 12) % 12;

  // 4) 십사주성 배치
  const board = Array.from({ length: 12 }, () => []);
  for (const [name, off] of ZIWEI_GROUP) board[((ziwei + off) % 12 + 12) % 12].push(name);
  for (const [name, off] of TIANFU_GROUP) board[((tianfu + off) % 12 + 12) % 12].push(name);

  // 5) 십이궁을 명궁부터 역행으로 얹는다
  const palaceAt = {};
  PALACES.forEach(([kr, hanja, mean], i) => {
    const pos = ((myeong - i) % 12 + 12) % 12;
    palaceAt[kr] = { pos, hanja, mean, stars: board[pos] };
  });

  // 6) 사화
  const stemKr = STEMS_KR[yearStem];
  const sihwa = (SIHWA[stemKr] ?? []).map((star, i) => ({ star, label: SIHWA_LABEL[i] }));

  const mainStars = palaceAt['명궁'].stars;
  const lead = mainStars.find((s) => STARS[s]) ?? null;

  const showPalace = (kr) => {
    const p = palaceAt[kr];
    const s = p.stars.length ? p.stars.join('·') : '공궁';
    return `${BRANCHES[p.pos]}(${BRANCHES_KR[p.pos]}) — ${s}`;
  };

  const facts = [
    { label: '명궁', value: `${BRANCHES[myeong]}궁`, note: mainStars.length ? mainStars.join('·') : '공궁 (대궁을 빌려 본다)' },
    { label: '신궁', value: `${BRANCHES[sin]}궁`, note: '후천적으로 드러나는 자리' },
    { label: '오행국', value: guk.hanja, note: `${guk.name} · 명궁 ${STEMS[myeongStem]}${BRANCHES[myeong]}의 납음` },
    { label: '자미성', value: `${BRANCHES[ziwei]}궁`, note: `음력 ${ld}일 ÷ ${guk.n} → 상수 ${mok}, 여수 ${remainder}` },
    { label: '천부성', value: `${BRANCHES[tianfu]}궁`, note: '자미와 인신축으로 마주 본다' },
    { label: '부처궁', value: showPalace('부처궁'), note: '' },
    { label: '재백궁', value: showPalace('재백궁'), note: '' },
    { label: '관록궁', value: showPalace('관록궁'), note: '' },
    { label: '질액궁', value: showPalace('질액궁'), note: '몸의 타고난 리듬과 약한 자리를 보는 궁' },
    { label: '천이궁', value: showPalace('천이궁'), note: '' },
    { label: '사화', value: sihwa.map((x) => x.star).join(' · '), note: `${stemKr}년생 기준 녹·권·과·기` },
  ];

  const readings = [];

  if (lead) {
    readings.push({
      title: `명궁 주성 — ${lead}(${STARS[lead].hanja})`,
      text: STARS[lead].text + (mainStars.length > 1
        ? ` 명궁에 ${mainStars.filter((s) => s !== lead).join('·')}이(가) 함께 들어 성격이 겹쳐 나타납니다.`
        : ''),
    });
  } else {
    const opposite = ((myeong + 6) % 12);
    readings.push({
      title: '명궁이 비어 있습니다 (공궁)',
      text: `명궁에 주성이 없습니다. 자미두수에서는 이를 흠으로 보지 않고, 맞은편 ${BRANCHES[opposite]}궁의 별(${board[opposite].join('·') || '역시 없음'})을 빌려 읽습니다. 정해진 색이 옅은 대신 환경과 사람에 따라 모습이 크게 달라지는 유형입니다.`,
    });
  }

  readings.push({
    title: `오행국 — ${guk.name}`,
    text: {
      2: '수이국입니다. 시작이 빠른 대신 기복이 있습니다. 흐르는 물처럼 상황에 맞춰 형태를 바꾸며 길을 냅니다.',
      3: '목삼국입니다. 자라나는 구조라 시간이 지날수록 자리가 잡힙니다. 꾸준히 뻗어 나가는 힘이 있습니다.',
      4: '금사국입니다. 단단하고 결이 분명합니다. 원칙을 세우고 지키는 데서 힘이 나옵니다.',
      5: '토오국입니다. 느리지만 두텁습니다. 중년 이후에 제자리를 찾는 경우가 많습니다.',
      6: '화육국입니다. 기세가 강하고 드러납니다. 타오를 때와 식을 때의 낙차가 큽니다.',
    }[guk.n],
  });

  const spouseStars = palaceAt['부처궁'].stars;
  readings.push({
    title: '부처궁 — 배우자의 자리',
    text: spouseStars.length
      // 별 설명은 "안으로 쌓는 별입니다" 처럼 **문장**이라, 명사 자리에 그대로
      // 끼우면 "…별입니다에 가까운 상대" 가 된다. 문장으로 끊어서 잇는다.
      ? `${j(spouseStars.join('·'), '이')} 들었습니다. ${STARS[spouseStars[0]]?.text.split('.')[0]}. `
        + '그런 결에 가까운 상대와 인연이 깊습니다. 이 별의 성질이 배우자의 기질이자, '
        + '이 사람이 관계에서 반복해서 마주치는 주제가 됩니다.'
      : '주성이 없는 공궁입니다. 특정한 상 없이, 시기와 환경에 따라 전혀 다른 인연이 들어옵니다.',
  });

  const careerStars = palaceAt['관록궁'].stars;
  const wealthStars = palaceAt['재백궁'].stars;
  const healthStars = palaceAt['질액궁'].stars;
  // 원래 관록궁과 재백궁을 한 읽기에 묶어 놓고 **해석은 전부 직업 이야기**만
  // 했다. 재백궁 별은 이름만 적히고 돈에 대해서는 한 마디도 안 나왔다.
  // 그래서 돈 칸이 이 읽기를 받으면 직업 이야기가 딸려 들어갔다. 갈랐다.
  readings.push({
    title: '관록궁 — 일의 자리',
    text: `일의 자리에 ${j(careerStars.join('·') || '주성 없음', '이')} 들었습니다. ` +
      (careerStars.includes('칠살') || careerStars.includes('파군')
        ? '직업에 변동이 큰 구조라, 한 조직에 오래 머무는 것보다 자기 판을 만드는 쪽이 맞습니다.'
        : careerStars.includes('자미') || careerStars.includes('천부')
        ? '조직 안에서 자리를 얻는 구조입니다. 책임이 커질수록 안정됩니다.'
        : '일의 성격이 한 갈래로 고정되지 않습니다. 환경에 맞춰 방향을 정하게 됩니다.'),
  });

  readings.push({
    title: '재백궁 — 돈의 자리',
    text: wealthStars.length
      ? `돈의 자리에 ${j(wealthStars.join('·'), '이')} 들었습니다. `
        + wealthStars.filter((s) => WEALTH_STAR[s]).map((s) => WEALTH_STAR[s]).join(' ')
      : '돈의 자리가 공궁입니다. 자미두수에서 공궁은 흠이 아니라 **정해진 색이 옅다**는 '
        + '뜻이라, 버는 방식이 타고나기보다 그때그때 환경과 하는 일을 따라갑니다.',
  });

  readings.push({
    title: '질액궁 — 몸의 리듬을 보는 자리',
    text: healthStars.length
      ? `몸의 자리에 ${healthStars.join('·')}이(가) 들었습니다. ` +
        (healthStars.some((s) => s === '칠살' || s === '파군')
          ? '한 번 무리한 뒤에 회복 시간을 놓치지 않는 것이 특히 중요합니다. 바쁠수록 수면과 식사 시간을 먼저 지키는 쪽이 맞습니다.'
          : healthStars.some((s) => s === '천동' || s === '천량' || s === '천부')
            ? '생활 리듬만 크게 흐트러뜨리지 않으면 회복하는 힘을 잘 쓰는 편입니다. 꾸준히 걷고 쉬는 습관이 가장 잘 맞습니다.'
            : '타고난 한 가지 약점보다 쌓인 피로와 생활 리듬의 영향을 더 크게 받는 편입니다. 무리한 날 뒤에 회복 시간을 비워두는 습관이 중요합니다.') +
        ' 이 자리는 병을 단정하는 곳이 아니라, 무리할 때 어떤 식으로 기운이 흔들리기 쉬운지를 읽는 자리입니다.'
      : '몸의 자리에 주성이 없는 공궁입니다. 타고난 한 가지 약점으로 단정하기보다, 생활 리듬과 그때그때 들어오는 흐름의 영향을 더 크게 받는 자리로 봅니다.',
  });

  // 사화는 네 별에 표시를 다는 것인데, **그 별이 어느 궁에 들었는지**까지
  // 말해야 쓸모가 있다. "화기가 붙은 별이 든 궁이 애를 먹는 영역"이라고
  // 적어 놓고 정작 그 궁을 안 알려 주고 있었다.
  //
  // 사화표는 주성 열넷 말고 **문창·문곡·좌보·우필**도 쓴다(신년생 화기가
  // 문창이다). 그 넷이 이 모듈의 판에 없어서 정작 화기의 자리를 못 찾고
  // 있었다. 판 자체는 건드리지 않고 — 화면과 테스트가 보는 판이라 —
  // 자리만 따로 구해 사화 조회에 쓴다.
  const helpers = helperPlacements(lm, hourBranch);
  const palaceOfStar = (star) => {
    if (helpers[star] != null) {
      const h = PALACES.find(([kr]) => palaceAt[kr].pos === helpers[star]);
      return h ? h[0] : null;
    }
    const hit = PALACES.find(([kr]) => palaceAt[kr].stars.includes(star));
    return hit ? hit[0] : null;
  };
  const sihwaWhere = sihwa
    .map((x) => ({ ...x, palace: palaceOfStar(x.star) }))
    .filter((x) => x.palace);

  readings.push({
    title: `사화 — ${stemKr}년생`,
    text: sihwa.map((x) => `${x.star} ${x.label}`).join('\n') +
      '\n사화는 태어난 해의 천간이 네 별에 표시를 다는 것입니다. 화기가 붙은 별이 든 궁이 그 사람이 가장 애를 먹는 영역이 됩니다.',
  });

  if (sihwaWhere.length) {
    const gi = sihwaWhere.find((x) => x.label.startsWith('화기'));
    const rok = sihwaWhere.find((x) => x.label.startsWith('화록'));
    readings.push({
      title: '사화가 떨어진 궁',
      // 목록 다음에 마침표를 찍는다 — 안 찍으면 마지막 항목과 뒷문장이 한 덩어리로
      // 붙어 조각을 갈라 낼 수 없다(`compose/slots.js` 의 `pick`).
      text: `${sihwaWhere.map((x) => `${x.star} ${x.label.split(' ')[0]} → ${x.palace}`).join(' · ')}.`
        + (gi ? ` 화기가 ${gi.palace}에 들었습니다. 그 자리가 이 사람이 가장 애를 먹고, 놓지 못해 되풀이해서 붙드는 영역입니다.` : '')
        + (rok ? ` 화록은 ${rok.palace}에 들어 그쪽에서 먹을 것과 기회가 열립니다.` : ''),
    });
  }

  // ── 삼방사정 — 한 궁만 보지 않는다 ──
  //
  // 자미두수는 명궁 하나로 읽지 않고 **삼합 둘과 대궁까지 네 자리를 한 묶음**
  // 으로 본다. 명궁 주성만 내면 같은 별을 가진 사람이 전부 같은 답을 받는다.
  const ts = trineSquare(myeong);
  const trineStars = ts.all.flatMap((b) => board[b]);
  if (trineStars.length > mainStars.length) {
    const others = ts.all.filter((b) => b !== myeong)
      .map((b) => ({ b, stars: board[b] })).filter((x) => x.stars.length);
    readings.push({
      title: '삼방사정 — 함께 보는 세 자리',
      text: `명궁만 보지 않고 삼합 두 자리와 마주 보는 대궁까지 넷을 한 묶음으로 읽습니다. `
        + others.map((x) => `${BRANCHES[x.b]}궁 ${x.stars.join('·')}`).join(' · ')
        + `이(가) 명궁을 함께 받칩니다. 명궁 주성이 밑그림이라면 이 별들은 그 밑그림이 실제로 어떻게 굴러가는지를 정합니다.`,
    });
  }

  // ── 육살성 — 주성만 보면 같은 별이 전부 같은 답을 받는다 ──
  if (timeKnown) {
    const at = auxPlacements(yearStem, yearBranch, hourBranch, stemKr);
    const evilHere = SIX_EVIL
      .map((s) => ({ star: s, pos: at[s] }))
      .filter((x) => x.pos != null);
    const inMyeong = evilHere.filter((x) => ts.all.includes(x.pos));
    if (inMyeong.length) {
      readings.push({
        title: '살성이 낀 자리',
        text: inMyeong.map((x) => `${x.star} — ${STAR_MEANING[x.star]}`).join('\n')
          + `\n이 별들이 명궁의 삼방사정 안에 들었습니다. 같은 주성이라도 살성이 끼면 결이 크게 달라집니다 — `
          + `밀어붙이는 힘이 세지는 대신 매듭이 잘 안 풀리고, 잘 풀리다가 갑자기 어긋나는 일이 섞입니다.`,
      });
    }
    const evilPalaces = PALACES
      .map(([kr]) => ({ kr, hit: evilHere.filter((x) => x.pos === palaceAt[kr].pos) }))
      .filter((x) => x.hit.length >= 2);
    if (evilPalaces.length) {
      readings.push({
        title: '살성이 몰린 궁',
        text: evilPalaces.map((x) => `${x.kr}에 ${x.hit.map((h) => h.star).join('·')}`).join(' · ')
          + `. 살성이 둘 이상 겹친 궁은 그 영역에서 유난히 굴곡이 큽니다. 없애야 할 것이 아니라 `
          + `그쪽에 힘이 몰려 있다는 뜻이라, 조심하면 오히려 그 자리가 특기가 되기도 합니다.`,
      });
    }
  }

  readings.push({
    title: '판 전체', mono: true,
    text: PALACES.map(([kr]) => {
      const p = palaceAt[kr];
      return `${kr.padEnd(4, ' ')} ${BRANCHES[p.pos]} ${p.stars.join('·') || '—'}`;
    }).join('\n'),
  });

  const elements = [0, 0, 0, 0, 0];
  for (const s of mainStars) if (STARS[s]) elements[STARS[s].el] += 1;
  if (!mainStars.length) elements[NAYEUM[Math.floor(sexa / 2)]] = 1;

  const traits = {};
  for (const s of mainStars) {
    if (!STARS[s]) continue;
    for (const [k, v] of Object.entries(STARS[s].traits)) traits[k] = (traits[k] ?? 0) + v;
  }
  for (const k of Object.keys(traits)) traits[k] = Math.max(-1, Math.min(1, traits[k]));

  const tags = [...new Set(mainStars.flatMap((s) => STARS[s]?.tags ?? []))];
  const healthTone = healthStars.reduce((sum, star) => sum + (STAR_AREA[star]?.건강운 ?? 0), 0);

  return result({
    id: meta.id,
    name: meta.name,
    hanja: meta.hanja,
    headline: `명궁 ${BRANCHES[myeong]} · ${mainStars.join('·') || '공궁'} · ${guk.name}`,
    facts,
    readings,
    signals: {
      elements,
      traits,
      domains: {
        재물: 50 + (wealthStars.includes('무곡') || wealthStars.includes('천부') || wealthStars.includes('태음') ? 18 : 0),
        관계: 50 + (spouseStars.length ? 8 : -6),
        직업: 50 + (careerStars.includes('자미') || careerStars.includes('태양') || careerStars.includes('천량') ? 16 : 0),
        // 질액궁은 위에서 실제로 배치했다. 비어 있다고 null을 주면 종합과
        // AI 문맥에서 이 핵심 자리가 통째로 빠진다.
        건강: Math.max(28, Math.min(72, 50 + healthTone)),
        학업: 50 + (mainStars.includes('천기') || mainStars.includes('거문') ? 14 : 0),
      },
      tags: tags.length ? tags : ['변화'],
      keywords: [mainStars.join('·') || '공궁', guk.name],
    },
  });
}

// ── 궁합 ──
// 자미두수 궁합은 한쪽의 부처궁(배우자 자리)에 든 별과
// 상대의 명궁에 든 별을 맞춰 보는 방식으로 본다.
// 내가 마음속에 그리는 짝의 모습이 상대의 실제 모습과 겹치는지를 보는 것이다.

function chartOf(x) {
  const lm = x.lunar.month, ld = x.lunar.day;
  const myeong = ((2 + lm - 1 - x.hourBranch) % 12 + 12) % 12;
  const yearStem = ((x.sajuYear - 4) % 10 + 10) % 10;
  const inStem = ((yearStem % 5) * 2 + 2) % 10;
  const myeongStem = ((inStem + myeong - 2) % 10 + 10) % 10;
  let sexa = 0;
  for (let i = 0; i < 60; i++) if (i % 10 === myeongStem && i % 12 === myeong) { sexa = i; break; }
  const guk = GUK[NAYEUM[Math.floor(sexa / 2)]];
  const mok = Math.ceil(ld / guk.n);
  const rem = mok * guk.n - ld;
  const ziwei = ((2 + mok - 1 + (rem % 2 === 0 ? rem : -rem)) % 12 + 12) % 12;
  const tianfu = ((4 - ziwei) % 12 + 12) % 12;
  const board = Array.from({ length: 12 }, () => []);
  for (const [n, o] of ZIWEI_GROUP) board[((ziwei + o) % 12 + 12) % 12].push(n);
  for (const [n, o] of TIANFU_GROUP) board[((tianfu + o) % 12 + 12) % 12].push(n);
  const spousePos = ((myeong - 2) % 12 + 12) % 12;
  return { myeong, guk, board, myeongStars: board[myeong], spouseStars: board[spousePos], spousePos };
}

export function compare(a, b) {
  const A = chartOf(a), B = chartOf(b);

  // 내가 그리는 짝(부처궁)과 상대의 실제 모습(명궁)이 겹치는가
  const matchAB = A.spouseStars.filter((s) => B.myeongStars.includes(s));
  const matchBA = B.spouseStars.filter((s) => A.myeongStars.includes(s));

  const rel = branchRelations(A.myeong, B.myeong);
  // 부처궁은 배우자를 보는 자리다. 명궁만 견주고 이쪽을 빼면 궁합에서
  // 가장 중요한 축 하나가 빠진다.
  const spouseRel = branchRelations(A.spousePos, B.spousePos);
  const relGood = rel.some((r) => r.good);
  const relBad = rel.some((r) => !r.good);

  let score = 50;
  score += matchAB.length * 14 + matchBA.length * 14;
  score += relGood ? 14 : relBad ? -12 : 0;
  score = Math.max(10, Math.min(94, score));

  const show = (arr) => arr.length ? arr.join('·') : '공궁';

  return {
    id: meta.id, name: meta.name, score,
    headline: `명궁 ${BRANCHES[A.myeong]} / ${BRANCHES[B.myeong]}${rel.length ? ' · ' + rel[0].kind : ''}`,
    facts: [
      { label: `${a.name} 명궁`, value: `${BRANCHES[A.myeong]} — ${show(A.myeongStars)}`, note: A.guk.name },
      { label: `${b.name} 명궁`, value: `${BRANCHES[B.myeong]} — ${show(B.myeongStars)}`, note: B.guk.name },
      { label: `${a.name} 부처궁`, value: `${BRANCHES[A.spousePos]} — ${show(A.spouseStars)}`, note: '그리는 짝의 모습' },
      { label: `${b.name} 부처궁`, value: `${BRANCHES[B.spousePos]} — ${show(B.spouseStars)}`, note: '그리는 짝의 모습' },
      { label: '명궁 관계', value: rel.length ? rel.map((r) => r.kind).join('·') : '무관', note: '두 명궁 지지 사이' },
      { label: '부처궁 관계', value: `${BRANCHES[A.spousePos]} / ${BRANCHES[B.spousePos]}${spouseRel.length ? ' · ' + spouseRel.map((r) => r.kind).join('·') : ''}`,
        note: spouseRel.length ? '두 배우자 자리 사이' : '두 배우자 자리 사이 · 뚜렷한 관계 없음' },
    ],
    readings: [
      {
        title: '부처궁과 상대의 명궁',
        text: (matchAB.length || matchBA.length)
          ? `${matchAB.length ? `${a.name}의 부처궁에 든 ${matchAB.join('·')}이(가) ${b.name}의 명궁에도 있습니다. ` : ''}` +
            `${matchBA.length ? `${b.name}의 부처궁에 든 ${matchBA.join('·')}이(가) ${a.name}의 명궁에도 있습니다. ` : ''}` +
            '자미두수에서 이 겹침을 중요하게 봅니다. 마음속에 그리던 상(像)과 상대의 실제 모습이 포개진다는 뜻이라, 처음부터 "이 사람이구나" 하는 느낌이 옵니다.'
          : '두 사람의 부처궁 별과 상대의 명궁 별이 겹치지 않습니다. 첫인상에서 확 끌리는 조합은 아니라는 뜻입니다. 다만 자미두수에서 부처궁은 평생 바뀌지 않는 이상형에 가깝고, 실제 인연은 겪으면서 만들어지는 쪽이 더 많습니다.',
      },
      {
        title: '두 명궁이 놓인 자리',
        text: rel.length
          ? rel.map((r) => `${r.kind}: ${r.text}`).join('\n')
          : `${j(BRANCHES[A.myeong], '과')} ${BRANCHES[B.myeong]} 사이에 합도 충도 없습니다. 서로의 중심이 간섭하지 않는 배치라, 각자의 영역을 지키며 지내기에 편합니다.`,
      },
      {
        title: '오행국',
        text: `${j(a.name, '은')} ${A.guk.name}, ${j(b.name, '은')} ${B.guk.name}입니다. ` +
          (A.guk.n === B.guk.n
            ? '같은 국이라 삶이 풀리는 속도와 리듬이 비슷합니다. 서로의 때를 이해하기 쉽습니다.'
            : '국이 달라 인생이 무르익는 속도가 다릅니다. 한쪽이 이미 자리를 잡았을 때 다른 쪽은 아직 오르는 중일 수 있으니, 그 시차를 알고 있는 편이 낫습니다.'),
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// 시기 운세
// ─────────────────────────────────────────────────────────────
// 그 시기의 지지가 열두 궁 중 어디에 떨어지는가를 본다.
// 그 궁에 든 별이 이 시기의 성격이 된다. 흘러가는 궁이라 유년·유월이라 부른다.

export const STAR_AREA = {
  자미: { 총운: 10, 직장운: 12, 명: 1 }, 천기: { 학업운: 12, 총운: 2 },
  태양: { 총운: 8, 직장운: 10, 애정운: 4 }, 무곡: { 금전운: 15, 직장운: 6 },
  천동: { 총운: 8, 건강운: 10, 애정운: 6 }, 염정: { 총운: -4, 직장운: 6 },
  천부: { 금전운: 12, 총운: 8, 건강운: 4 }, 태음: { 금전운: 10, 애정운: 8 },
  탐랑: { 애정운: 12, 총운: 4, 학업운: 4 }, 거문: { 총운: -5, 학업운: 8, 애정운: -6 },
  천상: { 총운: 6, 직장운: 8, 애정운: 6 }, 천량: { 건강운: 8, 학업운: 8, 총운: 4 },
  칠살: { 총운: -6, 직장운: 8, 건강운: -10 }, 파군: { 총운: -7, 금전운: -8, 건강운: -6 },
};

export function forecast(input, chart, period) {
  if (!input.timeKnown) return null;
  const lm = input.lunar.month;
  const myeong = ((2 + lm - 1 - input.hourBranch) % 12 + 12) % 12;

  // 흘러가는 궁 — 그 시기의 지지가 원국의 어느 궁에 얹히는가
  const flowing = period.ruling.branch;
  const idx = ((flowing - myeong) % 12 + 12) % 12;
  const palace = PALACES[idx][0];

  const yearStem = ((chart.sajuYear - 4) % 10 + 10) % 10;
  const inStem = ((yearStem % 5) * 2 + 2) % 10;
  const myeongStem = ((inStem + myeong - 2) % 10 + 10) % 10;
  let sexa = 0;
  for (let i = 0; i < 60; i++) if (i % 10 === myeongStem && i % 12 === myeong) { sexa = i; break; }
  const guk = GUK[NAYEUM[Math.floor(sexa / 2)]];

  const mok = Math.ceil(input.lunar.day / guk.n);
  const rem = mok * guk.n - input.lunar.day;
  const ziwei = ((2 + mok - 1 + (rem % 2 === 0 ? rem : -rem)) % 12 + 12) % 12;
  const tianfu = ((4 - ziwei) % 12 + 12) % 12;
  const board = Array.from({ length: 12 }, () => []);
  for (const [n, o] of ZIWEI_GROUP) board[((ziwei + o) % 12 + 12) % 12].push(n);
  for (const [n, o] of TIANFU_GROUP) board[((tianfu + o) % 12 + 12) % 12].push(n);

  const stars = board[flowing];
  const areas = { 총운: 50, 애정운: 50, 금전운: 50, 직장운: 50, 학업운: 50, 건강운: 50 };
  for (const s of stars) {
    for (const [k, v] of Object.entries(STAR_AREA[s] ?? {})) {
      if (k !== '명' && areas[k] != null) areas[k] += v;
    }
  }
  // 명궁·재백궁·관록궁에 얹히면 그 영역이 앞으로 나온다
  const BOOST = { 명궁: '총운', 부처궁: '애정운', 재백궁: '금전운', 관록궁: '직장운', 질액궁: '건강운', 자녀궁: '학업운' };
  if (BOOST[palace]) areas[BOOST[palace]] += 8;
  if (palace === '질액궁') areas.건강운 -= 14;

  for (const k of Object.keys(areas)) areas[k] = Math.max(8, Math.min(94, Math.round(areas[k])));

  return {
    id: meta.id, name: meta.name, weight: 1.2,
    headline: `${palace}에 얹힘${stars.length ? ' · ' + stars.join('·') : ' · 공궁'}`,
    text: `이 시기의 기운이 원국의 ${palace}에 떨어집니다. ` +
      (stars.length
        ? `${stars.join('·')}이(가) 든 자리라 그 별의 성질이 이 시기에 드러납니다.`
        : '주성이 없는 자리라 큰 사건 없이 지나갈 가능성이 높습니다.'),
    areas,
  };
}

export default { meta, analyze, compare , forecast };
