/**
 * horary.js — **질문한 그 순간으로 괘를 세운다 (점시·占時)**
 *
 * `juyeok.js` 는 **태어난 때**로 괘를 세운다. 그건 평생 한 벌뿐이라
 * "지금 이걸 해도 될까"에 답할 수가 없다 — 같은 사람이 언제 물어도 같은
 * 괘가 나오기 때문이다. 점(占)은 원래 **묻는 순간**에 세우는 것이다.
 *
 * ── 유파 고지 ──────────────────────────────────────────────
 * 매화역수(梅花易數)의 **시간기괘법(時間起卦法)** 하나만 쓴다.
 *
 *   상괘 = (년지수 + 음력월 + 음력일) mod 8
 *   하괘 = (년지수 + 음력월 + 음력일 + 시지수) mod 8
 *   동효 = (년지수 + 음력월 + 음력일 + 시지수) mod 6
 *
 * 산식 자체는 `juyeok.js` 와 같고 **넣는 시각만 다르다.** 그래서 괘 표도
 * 그쪽 것을 그대로 가져다 쓴다 — 표를 두 벌 두면 한쪽만 고쳐진다.
 *
 * ── 섞지 않는다 ────────────────────────────────────────────
 * 출생괘와 질문괘는 **서로 다른 물음에 답하는 다른 괘다.** 한 답 안에서
 * 둘을 섞어 쓰면 어느 쪽이 무엇을 말했는지 사라진다. 그래서 이 모듈은
 * `system: '주역(점시)'` 로 자기 이름을 달고 나가고, 출생괘는 건드리지 않는다.
 */
import { TRIGRAMS, HEXAGRAM_TABLE, HEXAGRAMS, LINE_ROLE } from './juyeok.js';
import { modFrom1 } from './_base.js';
import { solarToLunar } from '../core/lunar.js';
import { j } from '../core/josa.js';

/** 이 괘를 세울 만한 질문인가 — **현재 의사결정**을 묻는 말에만 쓴다 */
const NOW_WORDS = [
  '지금', '현재', '이번', '계속', '해도 될까', '해도 되나', '할까요', '할까',
  '계속할까', '접을까', '그만둘까', '진행', '추진', '선택', '결정',
  '어떤 상황', '상황이', '이대로',
];

/** 평생·시기를 묻는 말이면 점시가 아니다 — 그건 명반이 답할 자리다 */
const NOT_NOW = /평생|일생|언제|몇 년|몇 월|내년|작년|올해 전체|사주|타고난/;

export function isHoraryQuestion(question) {
  const q = String(question ?? '');
  if (!q.trim()) return false;
  if (NOT_NOW.test(q) && !/지금|현재|이번|이대로/.test(q)) return false;
  return NOW_WORDS.some((w) => q.includes(w));
}

/** 12지 시간대 — 자시는 23시에 시작한다 (정자시법, school.js 와 같은 기준) */
const hourBranchOf = (h) => Math.floor(((h + 1) % 24) / 2);

/**
 * 질문한 시각으로 괘를 세운다.
 *
 * @param {Date} at 질문한 순간 (KST 로 읽는다)
 * @returns {{hexNum, hexName, hexKr, hexText, upper, lower, movingLine,
 *            changedNum, changedName, changedKr, changedText, at, lunar, facts, readings}}
 */
export function horaryCast(at = new Date()) {
  // 브라우저·서버의 표준시가 무엇이든 한국 시각으로 읽는다. 점시는 묻는
  // 사람이 있는 곳의 시각이고, 이 서비스는 한국 기준이다.
  const kst = new Date(at.getTime() + (9 * 60 + at.getTimezoneOffset()) * 60000);
  const y = kst.getFullYear(), m = kst.getMonth() + 1, d = kst.getDate();
  const lunar = solarToLunar(y, m, d);

  const yearNum = ((y - 4) % 12 + 12) % 12 + 1;        // 子=1 … 亥=12
  const hourNum = hourBranchOf(kst.getHours()) + 1;
  const base = yearNum + lunar.month + lunar.day;

  const upper = modFrom1(base, 8) - 1;
  const lower = modFrom1(base + hourNum, 8) - 1;
  const movingLine = modFrom1(base + hourNum, 6);

  const hexNum = HEXAGRAM_TABLE[upper][lower];
  const [hexName, hexKr, hexText] = HEXAGRAMS[hexNum];

  // 지괘 — 동효를 뒤집는다. 지금 향하고 있는 방향이다
  const lines = [...TRIGRAMS[lower].bits, ...TRIGRAMS[upper].bits];
  lines[movingLine - 1] = lines[movingLine - 1] ? 0 : 1;
  const bitsTo = (b) => TRIGRAMS.findIndex((t) => t.bits.every((v, i) => v === b[i]));
  const changedNum = HEXAGRAM_TABLE[bitsTo(lines.slice(3, 6))][bitsTo(lines.slice(0, 3))];
  const [chName, chKr, chText] = HEXAGRAMS[changedNum];

  const stamp = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} `
    + `${String(kst.getHours()).padStart(2, '0')}:${String(kst.getMinutes()).padStart(2, '0')} KST`;

  return {
    at: stamp,
    lunar: `음력 ${lunar.year}.${lunar.isLeap ? '윤' : ''}${lunar.month}.${lunar.day}`,
    upper, lower, movingLine,
    hexNum, hexName, hexKr, hexText,
    changedNum, changedName: chName, changedKr: chKr, changedText: chText,
    facts: [
      { label: '점시', value: stamp, note: '질문한 순간으로 세운 괘다. 출생괘와 다르다' },
      { label: '본괘', value: `${hexNum}. ${hexName}`, note: `${hexKr} · ${TRIGRAMS[upper].symbol}${TRIGRAMS[lower].symbol}` },
      { label: '동효', value: `제${movingLine}효`, note: LINE_ROLE[movingLine - 1].split('—')[0].trim() },
      { label: '지괘', value: `${changedNum}. ${chName}`, note: `${chKr} · 향하는 방향` },
    ],
    readings: [
      { title: `본괘 — ${hexName} (${hexKr})`, text: hexText },
      { title: `동효 — 제${movingLine}효`, text: LINE_ROLE[movingLine - 1] },
      { title: `지괘 — ${chName} (${chKr})`,
        text: `${hexName}에서 ${j(chName, '으로')} 갑니다. ${chText}` },
    ],
  };
}

/** AI 문맥에 싣는 모양 */
export function formatHorary(h, question) {
  if (!h) return '';
  return [
    '## 질문시각 점시 (占時) — 이 질문을 받은 순간으로 세운 괘',
    `물음: ${String(question ?? '').slice(0, 120)}`,
    `세운 때: ${h.at} (${h.lunar}) · 매화역수 시간기괘법`,
    `본괘 ${h.hexNum}. ${h.hexName}(${h.hexKr}) — ${h.hexText}`,
    `동효 제${h.movingLine}효 — ${LINE_ROLE[h.movingLine - 1]}`,
    `지괘 ${h.changedNum}. ${h.changedName}(${h.changedKr}) — ${h.changedText}`,
    '',
    '**이 괘는 출생괘와 다른 괘다.** 지금 이 선택을 물었기 때문에 세운 것이고,',
    '다음에 같은 사람이 다른 것을 물으면 다른 괘가 나온다. 위 "주역(周易)" 구획의',
    '출생괘와 **섞어 쓰지 말 것** — 둘은 서로 다른 물음에 답한다.',
    '점시는 "지금 이 일이 어떤 형국인가"를 말하고, 시기·평생은 명반이 말한다.',
  ].join('\n');
}
