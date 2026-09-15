/**
 * tojeong.js — 토정비결 (土亭祕訣)
 *
 * 조선 후기부터 정초에 한 해 운을 보던 방식이다.
 * 상·중·하 세 개의 수를 뽑아 144괘 중 하나를 고른다.
 *
 *   상괘 = (세는나이 + 태세수) ÷ 8 의 나머지   … 그 해의 큰 흐름
 *   중괘 = (생월 + 그 달의 대소) ÷ 6 의 나머지  … 달의 결
 *   하괘 = (생일 + 일진수) ÷ 3 의 나머지        … 마무리
 *
 * 수는 선천수를 쓴다. 甲己子午 9, 乙庚丑未 8, 丙辛寅申 7, 丁壬卯酉 6,
 * 戊癸辰戌 5, 巳亥 4.
 *
 * 괘를 뽑는 산법은 전통 그대로지만, 괘사 본문은 원전을 옮긴 것이 아니라
 * 이 사이트에서 새로 쓴 것이다. 판본마다 문구가 다르고 한문 원문을
 * 그대로 싣는 것이 적절치 않아서다.
 */

import { yearPillar, STEMS, BRANCHES } from '../core/ganzhi.js';
import { j } from '../core/josa.js';
import { toJDN } from '../core/astro.js';
import { result, modFrom1 } from './_base.js';

export const meta = {
  id: 'tojeong',
  name: '토정비결',
  hanja: '土亭祕訣',
  desc: '세는나이와 생월·생일로 한 해의 괘를 뽑아 연운과 월운을 본다',
  needsTime: false,
  needsPlace: false,
};

/** 선천수 — 천간 */
const STEM_NUM = [9, 8, 7, 6, 5, 9, 8, 7, 6, 5];        // 甲乙丙丁戊己庚辛壬癸
/** 선천수 — 지지 */
const BRANCH_NUM = [9, 8, 7, 6, 5, 4, 9, 8, 7, 6, 5, 4]; // 子丑寅卯辰巳午未申酉戌亥

/** 상괘 여덟 — 그 해의 큰 흐름 */
const UPPER = [
  null,
  { title: '동풍에 얼음이 풀린다', text: '막혔던 것이 풀리기 시작하는 해입니다. 지난해까지 답답했던 일에 숨통이 트이고, 미뤄둔 일을 다시 꺼낼 만합니다. 다만 얼음이 녹는 초입이라 발밑이 무릅니다. 한꺼번에 밀어붙이지 말고 순서대로 가세요.', tone: 1 },
  { title: '나무에 꽃이 피나 열매는 아직이다', text: '겉으로 보기 좋은 일이 많은 해입니다. 사람이 모이고 말이 오가지만 손에 잡히는 결실은 뒤로 미뤄집니다. 지금 맺은 인연과 평판이 나중에 값을 하니, 당장의 성과가 없다고 조급해하지 마세요.', tone: 0 },
  { title: '용이 여의주를 얻는다', text: '오래 준비한 것이 제자리를 찾는 해입니다. 자리·자격·인정 가운데 하나가 들어옵니다. 기회가 왔을 때 주저하면 다음이 멀어지니, 결정해야 할 순간에 결정하세요.', tone: 2 },
  { title: '배가 나루를 떠난다', text: '움직임이 큰 해입니다. 이사·이직·전학처럼 자리를 옮기는 일이 생기고, 익숙한 것과 헤어집니다. 떠나는 것 자체는 나쁘지 않으나 목적지를 정하고 떠나야 합니다.', tone: 0 },
  { title: '길에서 귀인을 만난다', text: '사람으로 풀리는 해입니다. 뜻밖의 도움이 옆에서 옵니다. 혼자 해결하려 들면 오히려 길어지니, 먼저 청하고 먼저 묻는 편이 이득입니다.', tone: 2 },
  { title: '구름이 달을 가린다', text: '조심할 해입니다. 실력이 모자라서가 아니라 때가 흐려서 뜻대로 안 됩니다. 새 일을 벌이기보다 하던 것을 지키고, 문서와 보증에 특히 신경 쓰세요.', tone: -1 },
  { title: '우물을 깊이 판다', text: '안으로 쌓는 해입니다. 밖으로 드러나는 성과는 적지만 실력과 기반이 두터워집니다. 남과 견주지 말고 작년의 자기와 견주면 흐름이 보입니다.', tone: 0 },
  { title: '가을 들에 곡식이 익는다', text: '거두는 해입니다. 그동안 들인 것이 결과로 돌아옵니다. 재물과 명예가 함께 따르되, 거둘 때 나눌 몫을 미리 정해두어야 뒤탈이 없습니다.', tone: 2 },
];

/** 중괘 여섯 — 그 해의 결 */
const MIDDLE = [
  null,
  '흐름이 빠릅니다. 일이 예상보다 일찍 닥치니 미리 준비해두는 쪽이 유리합니다.',
  '사람이 얽힙니다. 좋은 인연도 성가신 인연도 늘어나니 거리를 조절하는 것이 과제입니다.',
  '돈이 오갑니다. 들어오는 것도 나가는 것도 커지니 장부를 따로 적어두세요.',
  '말이 많아집니다. 오해와 소문이 생기기 쉬우니 중요한 약속은 반드시 글로 남기세요.',
  '몸이 먼저 신호를 보냅니다. 무리하면 그 자리에서 바로 값을 치르는 해입니다.',
  '안이 조용합니다. 큰 사건 없이 지나가니 이 틈에 미뤄둔 정비를 하기 좋습니다.',
];

/** 하괘 셋 — 마무리의 방향 */
const LOWER = [
  null,
  '끝이 처음보다 낫습니다. 초반에 더디더라도 놓지 마세요.',
  '중간이 고비입니다. 그 고비만 넘기면 나머지는 순합니다.',
  '처음이 좋고 뒤가 헐겁습니다. 잘될 때 마무리를 미리 챙겨두세요.',
];

const MONTH_TONE = [
  '순조롭습니다. 벌여도 좋은 달입니다.',
  '분주합니다. 일은 많은데 결과가 늦습니다.',
  '막힙니다. 새로 벌이지 말고 지키세요.',
  '풀립니다. 미뤄둔 일을 꺼내기 좋습니다.',
  '사람이 옵니다. 관계에서 기회가 생깁니다.',
  '지출이 있습니다. 큰돈 쓸 일을 미리 잡아두세요.',
];

export function analyze(input) {
  const { year, month, day, lunar, currentYear, jdUT } = input;

  // 토정비결은 음력과 세는나이를 쓴다
  const koreanAge = currentYear - year + 1;
  const taeSe = yearPillar(currentYear);
  const taeSeNum = STEM_NUM[taeSe.stem] + BRANCH_NUM[taeSe.branch];

  // 일진 — 생일의 간지
  const jdn = toJDN(year, month, day);
  const dayStem = (jdn + 9) % 10;
  const dayBranch = (jdn + 1) % 12;
  const iljinNum = STEM_NUM[dayStem] + BRANCH_NUM[dayBranch];

  const upper = modFrom1(koreanAge + taeSeNum, 8);
  const middle = modFrom1(lunar.month + (lunar.isBigMonth ? 30 : 29), 6);
  const lower = modFrom1(lunar.day + iljinNum, 3);

  const gwaeNo = upper * 100 + middle * 10 + lower;
  const U = UPPER[upper];

  // 월운 — 열두 달을 한 번에
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const idx = (upper + middle + lower + m) % 6;
    months.push({ month: m, text: MONTH_TONE[idx] });
  }

  const facts = [
    // 괘 번호는 산법대로 나온 값이고, 그 옆의 문구는 이 사이트에서 쓴 것이다.
    // 원전의 표제처럼 보이면 곤란해서 밝혀 둔다.
    { label: '괘', value: `${upper}·${middle}·${lower}`,
      note: `제${gwaeNo}괘 · ${U.title} (문구는 원전을 옮긴 것이 아니라 이 사이트에서 새로 쓴 것)` },
    { label: '상괘', value: String(upper), note: `세는나이 ${koreanAge} + 태세수 ${taeSeNum} → ÷8` },
    { label: '중괘', value: String(middle), note: `음력 ${lunar.month}월 + 월대소 ${lunar.isBigMonth ? 30 : 29} → ÷6` },
    { label: '하괘', value: String(lower),
      note: `음력 ${lunar.day}일 + 일진수 ${iljinNum} → ÷3 (일진수는 선천수 ${STEMS[dayStem]}+${BRANCHES[dayBranch]})` },
    { label: '태세', value: taeSe.hanja, note: `${currentYear}년 · ${taeSe.kr}` },
    { label: '일진', value: STEMS[dayStem] + BRANCHES[dayBranch], note: '태어난 날의 간지' },
  ];

  const readings = [
    { title: `${currentYear}년 — ${U.title}`, text: U.text },
    { title: '올해의 결', text: MIDDLE[middle] },
    { title: '마무리', text: LOWER[lower] },
    {
      title: '달별 흐름',
      text: months.map((m) => `${m.month}월 — ${m.text}`).join('\n'),
    },
    {
      title: '괘사에 대하여',
      text: '괘를 뽑는 산법은 전통 방식 그대로입니다. 다만 위의 괘사는 원전을 옮긴 것이 아니라 이 사이트에서 새로 쓴 문장입니다. 토정비결은 판본마다 문구가 달라, 원문을 그대로 싣기보다 뜻을 풀어 쓰는 편이 정직하다고 보았습니다.',
    },
  ];

  const elements = [0, 0, 0, 0, 0];
  elements[(upper - 1) % 5] = 1;

  return result({
    id: meta.id,
    name: meta.name,
    hanja: meta.hanja,
    headline: `제${gwaeNo}괘 · ${U.title}`,
    facts,
    readings,
    signals: {
      elements,
      traits: {},
      domains: {
        재물: 50 + U.tone * 10 + (middle === 3 ? 8 : 0),
        관계: 50 + U.tone * 6 + (middle === 2 ? 10 : 0),
        직업: 50 + U.tone * 10,
        건강: 50 - (middle === 5 ? 14 : 0),
        학업: null,
      },
      tags: U.tone >= 2 ? ['명예', '재물'] : U.tone <= -1 ? ['인내', '안정'] : ['변화', '인내'],
      keywords: [U.title, `제${gwaeNo}괘`],
    },
  });
}

// ── 궁합 ──
// 토정비결은 본래 한 사람의 한 해를 보는 것이라 궁합 산법이 따로 없다.
// 여기서는 두 사람의 올해 상괘를 나란히 놓고 흐름이 맞물리는지를 본다.
// 타고난 인연이 아니라 "올해 두 사람의 운이 같은 방향인가"를 보는 것이다.

export function compare(a, b) {
  const upperOf = (x) => {
    const age = x.currentYear - x.year + 1;
    const ts = yearPillar(x.currentYear);
    return modFrom1(age + STEM_NUM[ts.stem] + BRANCH_NUM[ts.branch], 8);
  };
  const uA = upperOf(a), uB = upperOf(b);
  const A = UPPER[uA], B = UPPER[uB];

  const sum = A.tone + B.tone;
  let score, text;
  if (A.tone >= 1 && B.tone >= 1) {
    score = 84;
    text = '올해 두 사람의 운이 모두 오르는 흐름입니다. 함께 벌이는 일이 잘 풀리는 해이니, 미뤄둔 결정이 있다면 올해 안에 움직이는 편이 좋습니다.';
  } else if (A.tone <= -1 && B.tone <= -1) {
    score = 40;
    text = '올해는 두 사람 다 조심할 해입니다. 서로 예민해져 사소한 일로 부딪치기 쉽습니다. 큰 결정을 미루고 서로를 다그치지 않는 것만으로도 많은 것이 지나갑니다.';
  } else if (sum === 0 && A.tone !== B.tone) {
    score = 58;
    const up = A.tone > B.tone ? a.name : b.name;
    const down = A.tone > B.tone ? b.name : a.name;
    text = `${j(up, '은')} 오르는 해, ${j(down, '은')} 조심할 해입니다. 흐름이 엇갈리는 해라 한쪽이 신날 때 다른 쪽은 처져 있을 수 있습니다. ${up} 쪽에서 속도를 조금 늦춰주면 어긋나지 않습니다.`;
  } else {
    score = 66;
    text = '한쪽은 평탄하고 한쪽은 움직임이 있는 해입니다. 크게 어긋나지는 않으니 각자의 리듬을 존중하면 됩니다.';
  }

  return {
    id: meta.id, name: meta.name, score,
    weight: 0.7,
    headline: `${A.title} / ${B.title}`,
    facts: [
      { label: `${a.name} 상괘`, value: String(uA), note: A.title },
      { label: `${b.name} 상괘`, value: String(uB), note: B.title },
      { label: '올해', value: `${a.currentYear}년`, note: '토정비결은 그해 운을 본다' },
    ],
    readings: [
      { title: `${a.currentYear}년 두 사람의 흐름`, text },
      {
        title: '이 항목에 대하여',
        text: '토정비결에는 원래 두 사람을 견주는 산법이 없습니다. 한 사람의 한 해를 보는 체계이기 때문입니다. 여기서는 두 사람의 올해 상괘를 나란히 놓아 흐름이 맞물리는지만 봤습니다. 타고난 인연을 말하는 것이 아니라 올해에 한정된 이야기입니다.',
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// 시기 운세
// ─────────────────────────────────────────────────────────────
// 토정비결은 원래 해와 달의 운을 보는 체계라 그대로 쓴다.

export function forecast(input, chart, period) {
  const age = period.sajuYear - input.year + 1;
  const ts = yearPillar(period.sajuYear);
  const upper = modFrom1(age + STEM_NUM[ts.stem] + BRANCH_NUM[ts.branch], 8);
  const U = UPPER[upper];

  // 달 운은 월지를 한 번 더 섞는다
  const mIdx = period.kind === 'day'
    ? (upper + period.gz.day.branch) % 6
    : (upper + period.gz.month.branch) % 6;

  const base = U.tone * 9;
  const areas = {
    총운: 50 + base,
    애정운: 50 + base + (mIdx === 4 ? 8 : 0),
    금전운: 50 + base + (mIdx === 2 ? 8 : mIdx === 5 ? -8 : 0),
    직장운: 50 + base,
    학업운: 50 + base,
    건강운: 50 + base + (mIdx === 4 ? -10 : 0),
  };
  for (const k of Object.keys(areas)) areas[k] = Math.max(8, Math.min(94, areas[k]));

  return {
    id: meta.id, name: meta.name, weight: 1.0,
    headline: U.title,
    text: U.text.split('.')[0] + '.',
    areas,
  };
}

export default { meta, analyze, compare , forecast };
