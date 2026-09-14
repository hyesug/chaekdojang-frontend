/**
 * taeeul.js — 태을신수 (太乙神數)
 *
 * 삼식(三式) — 태을·기문·육임 — 가운데 가장 큰 판을 보는 체계다.
 * 원래는 나라의 운세와 전쟁의 승패를 점치던 것이라, 개인의 명(命)을 보는
 * 방식은 전승마다 차이가 크고 공개된 자료도 적다.
 *
 * 여기서는 태을 명법의 뼈대만 취했다.
 *   1. 태을은 중궁을 뺀 여덟 궁을 세 해에 한 칸씩 돈다 (24년에 한 바퀴)
 *   2. 계신(計神)은 태어난 달의 지지에서 거꾸로 짚어 나간다
 *   3. 태을과 계신 사이의 거리로 주산(主算)과 객산(客算)을 구한다
 *   4. 주산이 크면 내가 주도하는 판, 객산이 크면 흐름을 따르는 판
 *
 * 적년(積年)의 기준을 어디에 두느냐에 따라 궁이 통째로 밀리므로,
 * 아래에 쓴 기준을 그대로 드러낸다. 다른 전승과 결과가 다를 수 있다.
 */

import { BRANCHES, BRANCHES_KR, yearPillar } from '../core/ganzhi.js';
import { j } from '../core/josa.js';
import { result } from './_base.js';

export const meta = {
  id: 'taeeul',
  name: '태을신수',
  hanja: '太乙神數',
  desc: '삼식 중 가장 큰 판. 태을의 자리와 주객의 셈으로 흐름의 주도권을 본다',
  needsTime: false,
  needsPlace: false,
};

/** 태을이 도는 여덟 궁 — 중궁은 비운다 */
const EIGHT = [
  { n: 1, name: '건', hanja: '乾', dir: '북서', el: 3,
    text: '하늘의 자리입니다. 위에서 내려다보는 구도라 권한과 책임이 함께 주어집니다. 판을 여는 힘이 강한 대신 혼자 지고 가기 쉽습니다.' },
  { n: 2, name: '리', hanja: '離', dir: '남', el: 1,
    text: '불의 자리입니다. 드러나고 밝혀지는 구도라 이름이 오르내립니다. 감추는 것이 통하지 않으니 정면으로 가는 편이 낫습니다.' },
  { n: 3, name: '간', hanja: '艮', dir: '북동', el: 2,
    text: '산의 자리입니다. 멈추고 쌓는 구도라 서두르면 어긋납니다. 때를 기다렸다 한 번에 움직이는 방식이 맞습니다.' },
  { n: 4, name: '진', hanja: '震', dir: '동', el: 0,
    text: '우레의 자리입니다. 흔들고 깨우는 구도라 변동이 잦습니다. 먼저 움직이는 쪽이 주도권을 쥡니다.' },
  { n: 5, name: '손', hanja: '巽', dir: '남동', el: 0,
    text: '바람의 자리입니다. 스며들고 퍼지는 구도라 정면 돌파보다 에둘러 가는 편이 빠릅니다. 사람을 통해 일이 풀립니다.' },
  { n: 6, name: '곤', hanja: '坤', dir: '남서', el: 2,
    text: '땅의 자리입니다. 받아 싣는 구도라 앞서기보다 뒤에서 받치는 역할이 잘 맞습니다. 오래 가는 힘이 있습니다.' },
  { n: 7, name: '태', hanja: '兌', dir: '서', el: 3,
    text: '못의 자리입니다. 기쁨과 말의 구도라 사람과 교류에서 일이 생깁니다. 즐거움이 지나치면 새어 나갑니다.' },
  { n: 8, name: '감', hanja: '坎', dir: '북', el: 4,
    text: '물의 자리입니다. 험한 데를 건너는 구도라 고비가 잦습니다. 다만 그 고비를 지나면서 깊어지는 자리이기도 합니다.' },
];

/** 태을의 여덟 문 — 궁마다 하나씩 붙는다 */
const GATES = ['개문', '휴문', '생문', '상문', '두문', '경문', '사문', '경문'];
const GATE_NOTE = {
  개문: '열리는 문입니다. 공적인 일과 윗사람 쪽으로 길이 트입니다.',
  휴문: '쉬는 문입니다. 힘을 빼고 기다릴 때 오히려 풀립니다.',
  생문: '살리는 문입니다. 여덟 문 가운데 가장 좋게 보며 재물과 시작에 유리합니다.',
  상문: '다치는 문입니다. 부딪침이 잦지만 낡은 것을 끊어내는 힘이 됩니다.',
  두문: '막는 문입니다. 드러내지 않고 준비하는 데 어울립니다.',
  경문: '드러나는 문입니다. 소식과 문서가 오가고 놀랄 일도 함께 옵니다.',
  사문: '멈추는 문입니다. 새로 벌이기보다 정리하고 매듭짓는 데 맞습니다.',
};

export function analyze(input) {
  const { sajuYear, sectorIndex, currentYear, age } = input;

  // ── 적년 ──
  // 태을 상원 갑자의 실제 연대는 전승마다 다르고 수치도 현실적이지 않다.
  // 여기서는 육십갑자의 갑자년(서기 4년)을 기준으로 삼아 셈한다.
  const accYear = sajuYear - 4;
  const cycle = ((accYear % 24) + 24) % 24;
  const palaceIndex = Math.floor(cycle / 3);
  const palace = EIGHT[palaceIndex];
  const stayYear = (cycle % 3) + 1;          // 그 궁에 머문 지 몇 해째인가

  // ── 계신 ── 인월에 자(子)에서 시작해 달마다 거꾸로 간다
  const monthBranch = (sectorIndex + 2) % 12;
  const gyesin = ((2 - monthBranch) % 12 + 12) % 12;

  // ── 주산과 객산 ──
  // 태을이 앉은 궁의 수와 계신 사이의 거리로 셈한다.
  const juSan = ((palace.n + gyesin) % 12) + 1;
  const gaekSan = ((palace.n + 12 - gyesin) % 12) + 1;
  const juWins = juSan > gaekSan;
  const even = juSan === gaekSan;

  const gate = GATES[palaceIndex];

  // 올해 태을의 자리 — 개인의 판과 견준다
  const nowCycle = ((currentYear - 4) % 24 + 24) % 24;
  const nowPalace = EIGHT[Math.floor(nowCycle / 3)];
  const samePalace = nowPalace.n === palace.n;

  const facts = [
    { label: '적년', value: `${accYear}년`, note: `${sajuYear}년 − 4 (갑자년 기준)` },
    { label: '태을궁', value: `${palace.hanja}(${palace.name})`, note: `${palace.dir} · 24년 주기의 ${cycle + 1}번째 해` },
    { label: '머문 해', value: `${stayYear}년째`, note: '한 궁에 세 해를 머문다' },
    { label: '계신', value: `${BRANCHES[gyesin]}(${BRANCHES_KR[gyesin]})`, note: `${monthBranch === 2 ? '인' : BRANCHES_KR[monthBranch]}월 기준` },
    { label: '주산', value: String(juSan), note: '내가 쥔 몫' },
    { label: '객산', value: String(gaekSan), note: '상대·환경이 쥔 몫' },
    { label: '문', value: gate, note: GATE_NOTE[gate].split('.')[0] },
    { label: `${currentYear}년 태을`, value: `${nowPalace.hanja}(${nowPalace.name})`, note: samePalace ? '태어난 궁과 같다' : nowPalace.dir },
  ];

  const readings = [
    {
      title: `태을이 ${palace.hanja}궁에 있습니다`,
      text: palace.text,
    },
    {
      title: even ? '주산과 객산이 같습니다' : juWins ? '주산이 큽니다 — 내가 쥔 판' : '객산이 큽니다 — 흐름이 쥔 판',
      text: even
        ? `주산 ${juSan}, 객산 ${j(gaekSan, '로')} 팽팽합니다. 먼저 움직여도 따라가도 결과가 크게 다르지 않은 구도라, 판단의 근거를 밖이 아니라 자기 기준에서 찾아야 합니다.`
        : juWins
        ? `주산 ${juSan}, 객산 ${gaekSan}입니다. 태을에서 주(主)는 자리를 지키는 쪽, 객(客)은 움직여 오는 쪽입니다. 주산이 크다는 것은 이 사람이 자기 자리를 지키며 판을 끌고 갈 때 유리하다는 뜻입니다. 남을 쫓아가거나 급히 판을 바꾸려 할수록 힘이 빠집니다.`
        : `주산 ${juSan}, 객산 ${gaekSan}입니다. 객산이 크다는 것은 먼저 움직이고 밖으로 나가는 쪽이 유리하다는 뜻입니다. 한자리를 지키고 있으면 오히려 밀립니다. 이동·전환·객지에서 기회가 열리는 구도입니다.`,
    },
    {
      title: `${j(gate, '이')} 붙었습니다`,
      text: GATE_NOTE[gate],
    },
    {
      title: `${currentYear}년의 태을은 ${nowPalace.hanja}궁`,
      text: samePalace
        ? `올해 태을이 태어날 때와 같은 ${palace.hanja}궁에 들었습니다. 24년 만에 돌아온 자리라, 오래전에 시작했던 일이 다시 불려 나오거나 비슷한 국면이 반복됩니다. 그때 못 끝낸 것을 매듭짓기 좋은 해입니다.`
        : `올해 태을은 ${nowPalace.hanja}(${nowPalace.name})궁, ${nowPalace.dir}에 있습니다. 태어날 때의 ${palace.hanja}궁과 다르니 올해의 판은 이 사람의 기본 구도와 결이 다릅니다. ${nowPalace.text.split('.').slice(1).join('.').trim()}`,
    },
    {
      title: '태을의 큰 주기',
      text: `태을은 세 해에 한 궁씩, 24년에 여덟 궁을 한 바퀴 돕니다. 지금 ${age}세이니 ` +
        `태어난 뒤 ${Math.floor(age / 24)}바퀴를 돌았고, 다음 한 바퀴는 ${(Math.floor(age / 24) + 1) * 24}세에 마칩니다. ` +
        `24년·72년·360년으로 이어지는 이 주기가 태을이 나라의 운을 보던 틀이고, 개인에게도 같은 눈금을 대는 것입니다.`,
    },
    {
      title: '이 계산에 대하여',
      text: '태을신수는 본래 국운을 보던 체계라 개인 명법은 전승에 따라 차이가 큽니다. 특히 적년을 어디서부터 세느냐에 따라 궁이 통째로 밀립니다. 여기서는 갑자년(서기 4년)을 기준으로 삼았고, 계산 과정을 위에 전부 드러냈습니다. 다른 책과 결과가 다를 수 있으니 참고로만 보시기 바랍니다.',
    },
  ];

  const elements = [0, 0, 0, 0, 0];
  elements[palace.el] = 2;
  elements[nowPalace.el] += 1;

  return result({
    id: meta.id,
    name: meta.name,
    hanja: meta.hanja,
    headline: `태을 ${palace.hanja}궁 · ${juWins ? '주산 우세' : even ? '주객 대등' : '객산 우세'} · ${gate}`,
    facts,
    readings,
    // 전승 차이가 커서 종합에는 가볍게만 반영한다
    confidence: 0.6,
    signals: {
      elements,
      traits: {
        주도: juWins ? 0.5 : -0.3,
        안정: juWins ? 0.4 : -0.4,
      },
      domains: { 재물: null, 관계: null, 직업: null, 건강: null, 학업: null },
      tags: juWins ? ['주도', '안정'] : ['변화', '자유'],
      keywords: [`${palace.name}궁`, gate, juWins ? '주산 우세' : '객산 우세'],
    },
  });
}

// ── 궁합 ──
// 태을은 주(主)와 객(客)의 싸움을 보는 체계다. 두 사람을 주와 객으로 놓고
// 누가 판을 쥐는지, 아니면 팽팽한지를 본다.

export function compare(a, b) {
  const seatOf = (x) => {
    const acc = x.sajuYear - 4;
    const cycle = ((acc % 24) + 24) % 24;
    const idx = Math.floor(cycle / 3);
    const mb = (x.sectorIndex + 2) % 12;
    const gyesin = ((2 - mb) % 12 + 12) % 12;
    const p = EIGHT[idx];
    return {
      p, idx,
      ju: ((p.n + gyesin) % 12) + 1,
      gaek: ((p.n + 12 - gyesin) % 12) + 1,
    };
  };
  const A = seatOf(a), B = seatOf(b);

  const gen = (x, y) => (x + 1) % 5 === y;
  const ovc = (x, y) => (x + 2) % 5 === y;
  const eA = A.p.el, eB = B.p.el;

  // 한 사람을 주로, 다른 사람을 객으로 놓고 셈을 견준다
  const diff = A.ju - B.gaek;
  let score, label, text;

  if (A.idx === B.idx) {
    score = 74; label = '같은 궁';
    text = `두 사람의 태을이 같은 ${A.p.hanja}궁에 있습니다. 같은 스물네 해 주기의 같은 칸에서 났다는 뜻이라, 세상을 보는 틀이 거의 같습니다. 편한 대신 서로의 사각지대까지 겹칩니다.`;
  } else if (gen(eA, eB) || gen(eB, eA)) {
    score = 82; label = '상생';
    text = '두 궁의 기운이 서로를 낳아줍니다. 주와 객이 다투지 않고 손을 잡는 배치라, 함께 판을 키울 수 있습니다.';
  } else if (Math.abs(A.idx - B.idx) === 4) {
    score = 56; label = '마주 선 궁';
    text = '여덟 궁에서 정확히 맞은편에 놓였습니다. 태을에서 마주 선 궁은 주와 객이 정면으로 겨루는 형국입니다. 서로를 가장 잘 알아보면서 동시에 가장 세게 부딪칩니다.';
  } else if (ovc(eA, eB) || ovc(eB, eA)) {
    score = 46; label = '상극';
    text = '두 궁의 기운이 서로를 누릅니다. 주도권이 한쪽으로 쏠리기 쉬우니, 결정할 일을 영역별로 나눠두는 편이 낫습니다.';
  } else {
    score = 64; label = '무관';
    text = '두 궁이 서로를 낳지도 누르지도 않습니다. 각자의 판을 유지하며 나란히 가는 배치입니다.';
  }

  const balanced = Math.abs(diff) <= 2;

  return {
    id: meta.id, name: meta.name, score,
    weight: 0.6,
    headline: `${A.p.hanja}궁 × ${B.p.hanja}궁 · ${label}`,
    facts: [
      { label: `${a.name}`, value: `${A.p.hanja}(${A.p.name})궁`, note: `${A.p.dir} · 주산 ${A.ju}` },
      { label: `${b.name}`, value: `${B.p.hanja}(${B.p.name})궁`, note: `${B.p.dir} · 객산 ${B.gaek}` },
      { label: '궁 관계', value: label, note: '' },
      { label: '주객 셈', value: `${A.ju} vs ${B.gaek}`, note: balanced ? '팽팽함' : A.ju > B.gaek ? `${a.name} 우세` : `${b.name} 우세` },
    ],
    readings: [
      { title: `${A.p.hanja}궁 × ${B.p.hanja}궁 — ${label}`, text },
      {
        title: '주와 객',
        text: balanced
          ? `주산 ${A.ju}, 객산 ${j(B.gaek, '로')} 거의 팽팽합니다. 태을에서 이런 배치는 한쪽이 일방적으로 끌고 가지 않는다는 뜻입니다. 결정을 함께 내려야 하고, 그래서 느리지만 뒤탈이 적습니다.`
          : A.ju > B.gaek
          ? `주산 ${j(A.ju, '가')} 객산 ${B.gaek}보다 큽니다. ${a.name} 쪽이 자리를 지키며 판을 쥐는 구도입니다. ${j(b.name, '이')} 움직여 오는 형국이라, 두 사람의 역할이 자연스럽게 나뉩니다.`
          : `객산 ${j(B.gaek, '이')} 주산 ${A.ju}보다 큽니다. ${b.name} 쪽이 움직여 들어와 판을 흔드는 구도입니다. ${j(a.name, '은')} 그 변화를 받아들이는 자리에 서게 됩니다.`,
      },
      {
        title: '이 항목에 대하여',
        text: '태을신수는 본래 나라의 운과 전쟁의 승패를 보던 체계입니다. 사람 사이의 궁합으로 쓰는 법은 전승이 뚜렷하지 않아, 여기서는 태을의 주객 개념을 그대로 두 사람에게 적용했습니다. 계산 근거를 위에 드러냈으니 참고로만 보시기 바랍니다.',
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// 시기 운세
// ─────────────────────────────────────────────────────────────
// 태을이 그 해 어느 궁에 있는지, 그리고 본명 궁과의 관계를 본다.

export function forecast(input, chart, period) {
  const nowCycle = ((period.sajuYear - 4) % 24 + 24) % 24;
  const now = EIGHT[Math.floor(nowCycle / 3)];
  const mineCycle = ((chart.sajuYear - 4) % 24 + 24) % 24;
  const mine = EIGHT[Math.floor(mineCycle / 3)];

  const gen = (a, b) => (a + 1) % 5 === b;
  const ovc = (a, b) => (a + 2) % 5 === b;
  let base;
  if (now.n === mine.n) base = 8;
  else if (gen(now.el, mine.el)) base = 12;
  else if (gen(mine.el, now.el)) base = 4;
  else if (ovc(now.el, mine.el)) base = -12;
  else if (ovc(mine.el, now.el)) base = -4;
  else base = 0;

  const stay = (nowCycle % 3) + 1;
  const areas = {};
  for (const a of ['총운', '애정운', '금전운', '직장운', '학업운', '건강운']) {
    areas[a] = Math.max(8, Math.min(94, Math.round(50 + base + (a === '총운' ? 0 : -2))));
  }

  return {
    id: meta.id, name: meta.name, weight: 0.6,
    headline: `태을 ${now.hanja}궁 (${stay}년째)`,
    text: `${period.sajuYear}년의 태을은 ${now.hanja}(${now.name})궁, ${now.dir}에 있습니다. ` +
      (now.n === mine.n
        ? '태어날 때와 같은 궁이라 오래된 일이 다시 불려 나옵니다.'
        : base > 0 ? '내 궁과 상생하는 자리라 흐름이 순합니다.'
        : base < 0 ? '내 궁을 누르는 자리라 힘이 드는 구간입니다.'
        : '내 궁과 서로 간섭하지 않는 자리입니다.'),
    areas,
  };
}

export default { meta, analyze, compare , forecast };
