/**
 * 질문 유형별 회귀 — **묻는 말이 올바른 계산으로 가는가**
 *
 * 이 파일은 "답이 맞는가"를 재지 않는다. 그건 이 저장소가 여러 번 실패한
 * 일이고 여기서 할 수 있는 것도 아니다. 여기서 고정하는 것은 그 앞 단계다 —
 * **물어본 것에 필요한 계산이 실제로 켜지고, 문맥에 그 값이 실리는가.**
 *
 * 특히 네 가지를 본다.
 *   1. 질문시각 점시가 **출생괘를 재사용하지 않는가**
 *   2. 계산에 없는 것을 사실처럼 쓰지 못하게 막아 두었는가
 *   3. 근거가 셀 때 답이 흐려지지 않게 되어 있는가
 *   4. 합격·당첨 질문에서 **확정은 않되 최우선 시나리오를 먼저** 내게 되어 있는가
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { readFortune } from '../../public/unse/src/engine.js';
import { readForecast } from '../../public/unse/src/forecast.js';
import { buildContext, domainSections, monthSection } from '../../public/unse/src/aiContext.js';
import { routeQuestion, scopeLockOf } from '../../public/unse/src/hires/router.js';
import { buildHiRes } from '../../public/unse/src/hires/context.js';
import { modernHouse } from '../../public/unse/src/semantic/structure/western.js';
import { horaryCast, isHoraryQuestion, formatHorary } from '../../public/unse/src/systems/horary.js';
import juyeok from '../../public/unse/src/systems/juyeok.js';
import jamidusu from '../../public/unse/src/systems/jamidusu.js';
import { yearDirections } from '../../public/unse/src/systems/gujeong.js';
import kabbalah from '../../public/unse/src/systems/kabbalah.js';

const BIRTH = {
  name: '테스트', gender: 'female', year: 1992, month: 1, day: 30,
  hour: 16, minute: 28, birthPlace: '여주', homePlace: '서울',
};
const NOW = new Date('2026-09-25T03:00:00Z');

let ctxCache = null;
const context = () => (ctxCache ??= buildContext(
  BIRTH, readFortune(BIRTH, { now: NOW }), readForecast(BIRTH, NOW)));

const route = (q) => routeQuestion(q, 2026);

/**
 * 모델이 실제로 받는 전부 — 캐시에 태우는 명반 문맥 + 그 질문에만 붙는 focus.
 *
 * 분야 구획·절기월은 **질문에 걸릴 때만** 온다(캐시 덩어리를 줄이려고 뺐다).
 * 그래서 "문맥에 있는가"가 아니라 **"그 질문에서 모델이 받는가"** 를 봐야 한다.
 */
function payload(q) {
  const r = readFortune(BIRTH, { now: NOW });
  const fc = readForecast(BIRTH, NOW);
  const plan = route(q);
  const parts = [
    buildContext(BIRTH, r, fc),
    buildHiRes(r, fc, plan).text,
    domainSections(r, plan.domains),
  ];
  if (plan.needsDay || /몇 ?월|달별|월별/.test(q)) parts.push(monthSection(r));
  return parts.filter(Boolean).join('\n\n');
}

/* ── 1. 질문 유형마다 맞는 계산이 켜지는가 ──────────────────── */

test('대운으로 이직·재물 시기를 물으면 직업·재물이 켜진다', () => {
  const r = route('대운 흐름으로 볼 때 언제 이직하고 언제 재물이 들어올까요');
  assert.ok(r.domains.includes('직업'), '직업이 켜져야 한다');
  assert.ok(r.domains.includes('재물'), '재물이 켜져야 한다');
  assert.equal(r.needsHorary, false, '시기 질문은 점시가 아니다');
});

test('"직업"·"적성"이 낱말로 걸린다 — 폴백에 기대지 않는다', () => {
  // 예전에는 규칙에 '직업'이 없어서 "직업 어때"가 폴백(마침 직업)으로 갔고,
  // 그래서 "직업이랑 재물 어때"는 재물만 잡히고 직업이 통째로 빠졌다
  for (const q of ['직업 어때?', '내 직업 적성이 뭐야?']) {
    const r = route(q);
    assert.ok(r.domains.includes('직업'), q);
    assert.equal(r.fallback, false, `폴백이 아니라 낱말로 걸려야 한다: ${q}`);
  }
  assert.deepEqual(route('직업이랑 재물 어때?').domains.slice(0, 2).sort(), ['재물', '직업']);
});

test('분야 구획은 걸린 분야만 온다 (캐시 덩어리를 줄인 자리)', () => {
  const r = readFortune(BIRTH, { now: NOW });
  const only자녀 = domainSections(r, ['자녀']);
  assert.match(only자녀, /## 자녀 — 체계마다/);
  for (const other of ['재물', '주거', '건강', '학업', '배우자']) {
    assert.ok(!only자녀.includes(`## ${other} — 체계마다`), `${other}가 따라오면 안 된다`);
  }
  // 명반 문맥(캐시에 태우는 덩이)에는 분야 구획이 없어야 한다
  assert.ok(!context().includes('## 자녀 — 체계마다'), '캐시 덩이에 분야가 남아 있으면 안 된다');
});

test('절기월 표는 달을 물었을 때만 온다', () => {
  // '시기 교집합 — 올해 열두 절기월 가운데…' 라는 다른 줄이 있으므로
  // 새 표의 제목(## 2026년 열두 절기월)만 가리켜 본다
  const TABLE = /## \d{4}년 열두 절기월/;
  assert.ok(!TABLE.test(context()), '캐시 덩이에 있으면 안 된다');
  assert.ok(!TABLE.test(payload('자녀운 어때?')), '안 물으면 안 온다');
  assert.ok(TABLE.test(payload('올해 몇 월이 좋아?')), '물으면 와야 한다');
});

test('태양·MC 직업 적성 — 직업을 물으면 10하우스 고전·현대 읽기가 함께 온다', () => {
  const c = payload('내 직업 적성이 뭐야?');
  assert.match(c, /## 직업 — 체계마다 무엇이라 하는가/);
  assert.match(c, /고전 서양.*10하우스/s, '고전 10하우스 룰러 읽기');
  assert.match(c, /점성술\(현대\).*10하우스/s, '현대 10하우스 거주 행성');
});

test('자미 관록궁·재백궁이 성향까지 함께 나온다', () => {
  const c = payload('직업이랑 재물 어때?');
  assert.match(c, /관록궁 [^)]*\): 일할 때의 본인의 결은/, '관록궁 = 본인');
  assert.match(c, /## 재물 — 체계마다 무엇이라 하는가/);
  assert.match(c, /재백궁/, '재백궁을 읽어야 한다');
});

test('프로젝트를 계속할지 물으면 점시가 켜진다', () => {
  for (const q of ['이 프로젝트 계속할까요', '지금 이걸 계속 추진해도 될까요',
    '이대로 가는 게 맞나요', '이번 선택을 어떻게 할까요']) {
    assert.equal(route(q).needsHorary, true, `점시가 켜져야 한다: ${q}`);
  }
});

test('서비스·사업 방향 질문은 직업·재물로 간다', () => {
  const r = route('지금 만드는 서비스를 어느 방향으로 끌고 가면 사업이 될까요');
  assert.ok(r.domains.includes('직업') || r.domains.includes('재물'));
});

test('횡재·예상 밖 목돈은 재물을 맨 앞에 올리고 횡재 계산을 켠다', () => {
  const r = route('예상하지 못한 목돈이 들어올까요');
  assert.equal(r.domains[0], '재물');
  assert.equal(r.needsWindfall, true);
  assert.equal(r.needsWealth, true);
});

test('숙요 관계가 문맥에 실린다', () => {
  assert.match(context(), /### 숙요 \(宿曜\)/);
});

test('현재 다샤가 날짜와 함께 실린다', () => {
  const c = payload('언제 이직해?');
  assert.match(c, /다샤|MD |Mahadasha/i);
  assert.match(c, /(MD|AD) \S+ 시작 \(\d{4}년 \d{1,2}월/, '다샤 전환에 날짜가 붙어야 한다');
});

test('홍국기문 수리가 문맥에 실린다', () => {
  const c = context();
  assert.match(c, /### 홍국기문 \(洪局奇門\)/);
  assert.match(c, /천수|지수/, '천수·지수가 있어야 한다');
});

test('카발라가 실리고 개인년이 나온다', () => {
  const c = context();
  assert.match(c, /### 카발라 \(Kabbalah\)/);
  assert.match(c, /개인년/);
});

test('태국 요일·색·방위가 문맥에 실린다', () => {
  assert.match(context(), /### 태국 점성술/);
});

test('월별 강약 — 달을 물으면 열두 절기월이 간지와 함께 온다', () => {
  const c = payload('올해 몇 월이 좋아?');
  assert.match(c, /## \d{4}년 열두 절기월/);
  // 달마다 간지가 붙어야 "9월 丁酉" 같은 말을 할 수 있다
  const months = c.match(/^\d{4}\.\d{1,2}\/\d{1,2}~ [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] /gm) ?? [];
  assert.ok(months.length >= 12, `열두 달이 모두 간지와 함께 나와야 한다 (실제 ${months.length})`);
});

test('이사 길흉방 — 세파가 다른 흉살과 함께 나온다', () => {
  const d = yearDirections(1992, 2026);
  const kinds = d.bad.map((b) => b.kind);
  for (const k of ['오황살', '암검살', '본명살', '본명적살', '세파']) {
    assert.ok(kinds.includes(k), `${k}이 있어야 한다`);
  }
});

test('연간 신수 — 연도별 표에 간지와 부딪친 지지가 실린다', () => {
  const c = context();
  assert.match(c, /## 연도별/);
  assert.match(c, /\(원국 (일|월|년|시)지 [子丑寅卯辰巳午未申酉戌亥] · 세운 [子丑寅卯辰巳午未申酉戌亥] → \S+\)/);
});

/* ── 2. 세파 — 계산이 맞는가 ────────────────────────────────── */

test('세파는 그 해 태세의 정반대 방위다', () => {
  // 2026년은 丙午년 — 태세 午(남)의 정반대인 북이 세파
  const sepa = yearDirections(1992, 2026).bad.find((b) => b.kind === '세파');
  assert.equal(sepa.dir, '북');
  // 2027년은 丁未년 — 未(남서)의 정반대인 북동
  assert.equal(yearDirections(1992, 2027).bad.find((b) => b.kind === '세파').dir, '북동');
});

test('흉방이 겹치면 겹쳤다는 사실만 표시한다 (점수를 곱하지 않는다)', () => {
  for (const y of [2024, 2025, 2026, 2027, 2028, 2029, 2030]) {
    for (const b of yearDirections(1992, y).bad) {
      if (b.overlap !== undefined) {
        assert.ok(b.overlap >= 2, '겹침 표시는 개수여야 한다');
        assert.ok(!('score' in b) && !('weight' in b), '겹쳤다고 점수를 매기지 않는다');
      }
    }
  }
});

/* ── 3. 점시가 출생괘를 재사용하지 않는가 (핵심) ─────────────── */

test('점시는 질문한 시각으로 세우므로 시각이 다르면 괘가 달라진다', () => {
  const seen = new Set();
  // 같은 날 여러 시각 — 시지가 바뀌면 하괘와 동효가 바뀐다
  for (const h of [1, 5, 9, 13, 17, 21]) {
    const c = horaryCast(new Date(Date.UTC(2026, 8, 25, h - 9, 0)));
    seen.add(`${c.hexNum}-${c.movingLine}`);
  }
  assert.ok(seen.size >= 3, `시각마다 괘가 갈려야 한다 (나온 가짓수 ${seen.size})`);
});

test('점시는 출생괘와 다른 괘다 — 출생 정보를 쓰지 않는다', () => {
  const birthHex = juyeok.analyze(readFortune(BIRTH, { now: NOW }).input).facts
    .find((f) => f.label === '본괘').value;
  // 서로 다른 날에 물으면 출생괘와 같아지는 날이 있을 수는 있으나,
  // **출생 정보를 입력으로 받지 않는다**는 것이 요점이다. 같은 시각이면
  // 누가 묻든 같은 괘가 나오는 것으로 그것을 확인한다
  const at = new Date(Date.UTC(2026, 8, 25, 3, 0));
  assert.equal(horaryCast(at).hexNum, horaryCast(at).hexNum);
  assert.deepEqual(horaryCast(at).facts, horaryCast(at).facts,
    '같은 시각이면 명반과 무관하게 같은 괘다');
  const days = new Set();
  for (const d of [1, 8, 15, 22, 29]) {
    days.add(horaryCast(new Date(Date.UTC(2026, 8, d, 3, 0))).hexNum);
  }
  assert.ok(days.size >= 2, '날짜가 바뀌면 괘도 바뀐다');
  assert.ok(typeof birthHex === 'string' && birthHex.length > 0);
});

test('점시 문맥은 출생괘와 섞지 말라고 적는다', () => {
  const text = formatHorary(horaryCast(NOW), '지금 계속해도 될까요');
  assert.match(text, /출생괘와 다른 괘/);
  assert.match(text, /섞어 쓰지 말/);
  assert.match(text, /질문시각 점시/);
});

test('평생·시기 질문에는 점시를 켜지 않는다', () => {
  for (const q of ['평생 운세 봐주세요', '언제 이직하게 될까요', '내년 운세는 어때요',
    '내 사주 좀 봐주세요']) {
    assert.equal(isHoraryQuestion(q), false, `점시가 꺼져 있어야 한다: ${q}`);
  }
});

test('지괘는 동효 하나만 뒤집은 괘다', () => {
  const c = horaryCast(new Date(Date.UTC(2026, 8, 25, 3, 0)));
  assert.notEqual(c.hexNum, c.changedNum, '본괘와 지괘는 달라야 한다');
  assert.ok(c.movingLine >= 1 && c.movingLine <= 6);
});

/* ── 4. 계산에 없는 것을 사실처럼 쓰지 못하게 되어 있는가 ────── */

const PROMPT = readFileSync('app/fortune-ai/route.ts', 'utf8');

test('프롬프트 안에 백틱이나 ${ 가 없다 (있으면 빌드가 깨진다)', () => {
  // SYSTEM 프롬프트는 템플릿 리터럴이라 본문에 백틱을 쓰면 문자열이 거기서
  // 끊기고, ${ 는 보간으로 읽힌다. 실제로 한 번 빌드를 깼다.
  const open = PROMPT.indexOf('const SYSTEM = `');
  const body = PROMPT.slice(open + 'const SYSTEM = `'.length);
  const end = body.indexOf('`;');          // 닫는 백틱은 줄 끝에 붙어 있다
  assert.ok(end > 0, 'SYSTEM 리터럴의 끝을 찾아야 한다');
  const inner = body.slice(0, end);
  assert.ok(!inner.includes('`'), '프롬프트 본문에 백틱이 있으면 안 된다');
  assert.ok(!inner.includes('${'), '프롬프트 본문에 ${ 가 있으면 안 된다');
});

test('지어내기 금지가 프롬프트에 남아 있다', () => {
  assert.match(PROMPT, /계산에 없는 사실·확률·고유명사·사건은 단정이 아니라 창작/);
  assert.match(PROMPT, /퍼센트를 만들지 말고/);
});

test('카발라 22경로를 미구현으로 명시한다', () => {
  const k = kabbalah.analyze(readFortune(BIRTH, { now: NOW }).input);
  const f = k.facts.find((x) => x.label.includes('22경로'));
  assert.ok(f, '22경로 칸이 있어야 한다');
  assert.equal(f.value, '미구현');
  assert.match(k.readings.map((r) => r.text).join(' '), /전통 카발라 계산이 아닙니다/);
});

test('계산값과 해석의 구분 규칙이 남아 있다', () => {
  assert.match(PROMPT, /## 사실과 추론을 섞지 마세요/);
  assert.match(PROMPT, /계산값 \/ 거기서 읽은 것 \/ 사용자가 말해 준 것/);
});

/* ── 5. 근거가 셀 때 흐려지지 않는가 ────────────────────────── */

test('근거가 모이면 단정하라는 규칙이 있다', () => {
  assert.match(PROMPT, /## 근거가 모였으면 흐리지 마세요/);
  assert.match(PROMPT, /Tier S 또는 A/);
  assert.match(PROMPT, /가장 강한 시기는 2028년이다/);
  assert.match(PROMPT, /직업 변화가 먼저이고 주거 이동이 뒤따르는 흐름이다/);
});

/* ── 잘못 읽기 쉬운 계산값 ──────────────────────────────────── */

test('申궁과 身宮이 한 줄에서 구분된다', () => {
  // 1990년생 명반은 身宮이 亥, 질액궁이 申 — 한글로는 둘 다 "신궁"이다
  const f = { ...BIRTH, year: 1990, month: 6, day: 10, hour: 10, minute: 0 };
  const z = jamidusu.analyze(readFortune(f, { now: NOW }).input);
  const line = z.facts.map((x) => `${x.label} ${x.value}`).join(' · ');
  assert.match(line, /신궁\(身宮\)/, '身宮은 라벨에 한자를 달아야 한다');
  assert.match(line, /신궁\(申\)/, '申궁은 한자를 떼면 안 된다');
});

test('申궁은 같은 지지가 다시 나와도 한자를 떼지 않는다', () => {
  // 다른 지지는 두 번째부터 한글만 쓰지만 申만은 예외다
  for (const y of [1988, 1990, 1993, 1996, 2001]) {
    const f = { ...BIRTH, year: y, month: 6, day: 10, hour: 10, minute: 0 };
    const z = jamidusu.analyze(readFortune(f, { now: NOW }).input);
    const line = z.facts.map((x) => `${x.label} ${x.value}`).join(' · ');
    const bare = line.match(/신궁(?!\()/g) ?? [];
    // 라벨 '신궁(身宮)' 과 값 '신궁(申)' 외에 맨 '신궁' 이 있으면 안 된다
    assert.equal(bare.length, 0, `${y}: 한자 없는 맨 '신궁'이 있으면 身宮과 섞인다`);
  }
});

test('지장간을 문맥에 실어 "인성 0"을 오독하지 않게 한다', () => {
  const c = context();
  assert.match(c, /지장간 년지 [子丑寅卯辰巳午未申酉戌亥] → /);
  assert.match(c, /십신이 0이라고 그 기운이 아예 없다고 읽으면 안 된다/);
  // 이 명반은 십신 인성 0 인데 월지 지장간에 편인이 있다 — 딱 그 경우다
  assert.match(c, /인성 0/);
  assert.match(c, /지장간[^\n]*편인/);
});

test('프로젝트·의사결정 규칙이 프롬프트에 있다', () => {
  assert.match(PROMPT, /## 프로젝트·의사결정을 물을 때/);
  assert.match(PROMPT, /점시 괘를 중심에 놓고 답하세요/);
  assert.match(PROMPT, /같은 결론을 받쳐 줄 때만 짧게/);
  assert.match(PROMPT, /묻지 않은 월별 시기·재물·방위를\s*\n?\s*얹지 마세요/);
  assert.match(PROMPT, /### 알 수 없는 것을 없다고 하지 마세요/);
  assert.match(PROMPT, /외부 요인은 아닙니다/);
  assert.match(PROMPT, /가장 먼저 손볼 것은 내부 방식입니다/);
  assert.match(PROMPT, /장애물 → 왜 그런가 → 무엇을 할 것인가/);
});

test('오독하기 쉬운 계산값 규칙이 프롬프트에 있다', () => {
  assert.match(PROMPT, /## 계산값을 잘못 읽기 쉬운 자리/);
  assert.match(PROMPT, /申궁과 身宮\(신궁\)은 다릅니다/);
  assert.match(PROMPT, /"인성 0"을 "인성이 전혀 없다"로 읽지 마세요/);
  assert.match(PROMPT, /타로의 카드 역할을 바꾸지 마세요/);
  assert.match(PROMPT, /오행 수치 하나에서 성격·습관을 바로 만들지 마세요/);
  assert.match(PROMPT, /근거 이상으로 배타적이거나 구체적으로 단정하지 마세요/);
});

/* ── 자미두수 표기 ──────────────────────────────────────────── */

test('궁 이름은 한글이 먼저고 한자는 처음 한 번만 붙는다', () => {
  const z = jamidusu.analyze(readFortune(BIRTH, { now: NOW }).input);
  const line = z.facts.map((f) => `${f.label} ${f.value}`).join(' · ');
  assert.match(line, /명궁 [자축인묘진사오미신유술해]궁\(/, '한글궁(한자) 꼴이어야 한다');
  assert.ok(!/명궁 [子丑寅卯辰巳午未申酉戌亥]/.test(line), '한자가 앞에 오면 안 된다');
  // 같은 지지가 두 번 나오면 두 번째는 한자를 붙이지 않는다
  for (const b of ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']) {
    const n = (line.match(new RegExp(`\\(${b}\\)`, 'g')) ?? []).length;
    assert.ok(n <= 1, `${b} 병기는 한 번까지다 (실제 ${n})`);
  }
  assert.match(z.headline, /명궁 [자축인묘진사오미신유술해]궁/, '헤드라인도 한글');
});

test('유파가 갈리는 천간이면 사화에 그 사실을 적는다', () => {
  // 1990 庚午 · 1992 壬申 — 둘 다 판본이 갈리는 천간
  for (const y of [1990, 1992]) {
    const f = { ...BIRTH, year: y, month: 6, day: 10, hour: 10, minute: 0 };
    const z = jamidusu.analyze(readFortune(f, { now: NOW }).input);
    const s = z.readings.find((r) => r.title.startsWith('사화'));
    assert.match(s.text, /판본이 갈립니다/, `${y}년생은 유파 표시가 있어야 한다`);
    assert.match(s.text, /일부 유파에서는/);
  }
});

test('갈리지 않는 천간에는 유파 표시를 붙이지 않는다', () => {
  // BIRTH 는 辛未년생 — 신간 사화는 판본이 거의 일치한다
  const z = jamidusu.analyze(readFortune(BIRTH, { now: NOW }).input);
  const s = z.readings.find((r) => r.title.startsWith('사화'));
  assert.ok(!s.text.includes('판본이 갈립니다'), '안 갈리는 자리에 경고를 달지 않는다');
});

test('명궁 직접 별과 삼방 별을 문맥이 나눠 적는다', () => {
  const c = context();
  assert.match(c, /명궁 주성 —/);
  assert.match(c, /삼방사정 — 함께 보는 세 자리/);
  assert.match(c, /명궁 주성이 밑그림이라면/, '둘의 구실이 다르다고 적어야 한다');
});

test('자미두수 표기·해석 규칙이 프롬프트에 있다', () => {
  assert.match(PROMPT, /## 자미두수를 쓸 때/);
  assert.match(PROMPT, /### 한글로 쓰세요/);
  assert.match(PROMPT, /최초 한 번만\*\* 괄호로 병기/);
  assert.match(PROMPT, /복덕궁과 부모궁/);
  assert.match(PROMPT, /삼방의 별을 명궁에\s*\n?\s*있는 것처럼 쓰지 마세요/);
  assert.match(PROMPT, /### 한 궁만 보고 크기를 재지 마세요/);
  assert.match(PROMPT, /큰 재성이 재백궁에 없으니 큰돈은 못 번다/);
  assert.match(PROMPT, /재백궁 자체 \+ 삼방사정 \+ 사화 \+ 대한/);
  assert.match(PROMPT, /정적 축재형/);
  assert.match(PROMPT, /확장형/);
});

test('사화를 현실 의미로 한 번에 좁히지 말라는 규칙이 있다', () => {
  assert.match(PROMPT, /### 사화를 현실 의미로 한 번에 좁히지 마세요/);
  assert.match(PROMPT, /화과가 질액궁/);
  assert.match(PROMPT, /업계 전문가로 이름이 난다/);
  assert.match(PROMPT, /판본이 갈립니다 — 일부 유파에서는/);
});

test('"평생 최고·정점"을 아껴 쓰라는 규칙과 결론 예시가 있다', () => {
  assert.match(PROMPT, /### "평생 최고", "정점"은 아껴 쓰세요/);
  assert.match(PROMPT, /여러 강한 근거가 겹칠 때만/);
  assert.match(PROMPT, /가장 크게 확장되는 핵심 구간/);
  assert.match(PROMPT, /명예는 중상~상, 재물은 중상이며 후반 확장형입니다/);
});

/* ── 질문 범위 잠금 ─────────────────────────────────────────── */

test('체계를 지정하면 그 체계가 잠긴다', () => {
  assert.deepEqual(scopeLockOf('태양과 MC를 볼 때 직업은?'), ['서양점성술']);
  assert.deepEqual(scopeLockOf('재백궁과 관록궁으로 보면?'), ['자미두수']);
  assert.deepEqual(scopeLockOf('대운으로 보면 언제 이직해?'), ['사주']);
  assert.deepEqual(scopeLockOf('다샤로는 지금 어떤 시기야?'), ['베딕']);
});

test('요일을 물으면 요일을 보는 두 체계만 잠긴다', () => {
  const s = scopeLockOf('타고난 요일 기운으로 보면 어때?');
  assert.deepEqual(s.sort(), ['마하보테', '태국 점성술']);
  // 요일을 쓰는 체계는 이 둘뿐이라 다른 것이 섞이면 안 된다
  for (const bad of ['사주', '자미두수', '베딕', '숙요', '타로', '토정비결']) {
    assert.ok(!s.includes(bad), `${bad}이 끼면 안 된다`);
  }
});

test('연도 기운은 그 해 판을 세우는 체계로 잠긴다', () => {
  assert.deepEqual(scopeLockOf('음력 연도 기운은 어때?'), ['구성학']);
});

test('요일과 연도를 함께 물으면 셋이 잠긴다', () => {
  const s = scopeLockOf('타고난 요일과 음력 연도 기운을 볼 때 올해 주의할 것은?');
  assert.deepEqual(s.sort(), ['구성학', '마하보테', '태국 점성술']);
});

test('택일의 "요일"은 잠그지 않는다', () => {
  // "계약은 무슨 요일에" 는 태국 점성술이 아니라 택일 질문이다
  for (const q of ['계약은 무슨 요일에 하면 좋아?', '이사 요일 골라줘', '무슨 요일이 좋아']) {
    assert.equal(scopeLockOf(q), null, `택일인데 잠기면 안 된다: ${q}`);
  }
});

test('요일·연도 규칙이 프롬프트에 있다', () => {
  assert.match(PROMPT, /### 요일·연도를 물을 때/);
  assert.match(PROMPT, /요일을 보는 체계는 이 둘뿐입니다/);
  assert.match(PROMPT, /사주·자미두수·베딕·숙요·타로·토정비결을 임의로 끌어와 종합하지 마세요/);
  assert.match(PROMPT, /주의점 → 성취 분야 → 한 줄 요약/);
});

test('결론의 주근거가 지정 체계에서 나와야 한다는 규칙이 있다', () => {
  assert.match(PROMPT, /### 결론의 주근거가 지정한 체계에서 나와야 합니다/);
  assert.match(PROMPT, /다른 체계의 결론을 지정 체계의 결과처럼 말하지 마세요/);
});

test('달은 직접 물었을 때만 낸다는 규칙이 있다', () => {
  assert.match(PROMPT, /### 달은 직접 물었을 때만/);
  assert.match(PROMPT, /"몇 월"을 직접 묻지 않으면 월 단위 시기를 답에 꺼내지 마세요/);
});

test('체계를 안 대면 잠그지 않는다', () => {
  for (const q of ['올해 어때요', '자녀운 어때', '이직할 수 있을까']) {
    assert.equal(scopeLockOf(q), null, `잠기면 안 된다: ${q}`);
  }
});

test('"종합해서"라고 하면 잠그지 않는다', () => {
  assert.equal(scopeLockOf('대운이랑 자미 다 종합해서 봐줘'), null);
  assert.equal(scopeLockOf('열다섯 체계 전부로 봐줘'), null);
});

test('여럿을 대면 그만큼만 잠근다', () => {
  const s = scopeLockOf('사주 대운이랑 자미 관록궁으로 보면?');
  assert.deepEqual(s.sort(), ['사주', '자미두수']);
});

test('잠금이 걸리면 문맥 맨 앞에 적힌다', () => {
  const r = readFortune(BIRTH, { now: NOW });
  const plan = route('태양과 MC로 볼 때 직업은?');
  const text = buildHiRes(r, readForecast(BIRTH, NOW), plan).text;
  const head = text.slice(0, 700);
  assert.match(head, /※ 질문 범위 잠금/, '맨 앞에 와야 한다');
  assert.match(head, /서양점성술/);
  assert.match(head, /끌어다 쓰지 않는다/);
  assert.match(head, /분야 라우팅보다 이 지정이 앞선다/);
});

test('잠금이 없으면 그 구획을 넣지 않는다', () => {
  const r = readFortune(BIRTH, { now: NOW });
  const text = buildHiRes(r, readForecast(BIRTH, NOW), route('올해 어때요')).text;
  assert.ok(!text.includes('질문 범위 잠금'), '잠금이 없으면 조용해야 한다');
});

test('범위 잠금 규칙이 프롬프트에 있다', () => {
  assert.match(PROMPT, /## 질문 범위 잠금 — 부른 것만 씁니다/);
  assert.match(PROMPT, /분야 라우팅보다\s*\n?앞섭니다|분야 라우팅보다 앞섭니다/);
  assert.match(PROMPT, /그 체계로는 여기까지/);
  assert.match(PROMPT, /### 묻지 않은 축으로 넓히지 마세요/);
  for (const s of ['이직 시기·재물·창업·방위·건강', '시기 예측을 하지 않습니다',
    '수입 유형을 분석하지 않습니다', '창업 가능성을 판정하지 않습니다']) {
    assert.ok(PROMPT.includes(s), `빠진 규칙: ${s}`);
  }
});

test('배치를 직업 하나로 바로 좁히지 말라는 규칙이 있다', () => {
  assert.match(PROMPT, /### 배치 하나를 직업 하나로 바로 좁히지 마세요/);
  assert.match(PROMPT, /7하우스 → 고객·파트너·계약·대인관계/);
  assert.match(PROMPT, /7하우스 → 상담사·심사역/);
  assert.match(PROMPT, /공통 기능을 먼저 뽑고/);
});

test('빈 하우스를 약한 하우스로 읽지 않는다 — 프롬프트와 엔진 양쪽', () => {
  assert.match(PROMPT, /### 빈 하우스는 약한 하우스가 아닙니다/);
  // 엔진 쪽 문구도 같이 고정한다. 프롬프트만 고치면 문맥이 반대로 말한다
  const empty = modernHouse(
    { results: { astro: { name: '점성술', facts: [] } } }, 5, '자녀');
  assert.match(empty.text, /빈 하우스는 약한 하우스가 아닙니다/);
  assert.match(empty.text, /그 하우스의 주인이 어디서 무엇을 하는지/);
  assert.ok(!empty.text.includes('삶의 앞자리로 나오지 않는다'),
    '옛 문구가 남아 있으면 안 된다');
});

test('D1/D9/D10 혼용 금지와 계산 충돌 처리 규칙이 있다', () => {
  assert.match(PROMPT, /D1 · D9 · D10의 하우스와 궁주를 섞지 마세요/);
  assert.match(PROMPT, /계산값끼리 어긋나면 해석하지 말고 계산 오류로 다루세요/);
});

test('강하게 말하는 범위를 질문 범위로 묶는다', () => {
  assert.match(PROMPT, /강하게 말하는 것은 질문 범위 안에서입니다/);
  assert.match(PROMPT, /핵심 배치가 실제로 지지하는 범위까지만/);
});

test('강한 답변과 과도한 구체화를 가르는 규칙이 있다', () => {
  assert.match(PROMPT, /## 강한 답변과 과도한 구체화는 다릅니다/);
  assert.match(PROMPT, /강도는 디테일의 양이 아니라 근거의 일치도로 정합니다/);
  // 되는 쪽 / 안 되는 쪽이 짝으로 적혀 있어야 한다
  for (const ok of ['2027~2028년이 핵심이다', '조직형 경력이 더 강하다',
    '전문성 기반 추가수입이 유리하다', '이동 가능성이 강하다']) {
    assert.ok(PROMPT.includes(ok), `해도 되는 예가 있어야 한다: ${ok}`);
  }
  for (const no of ['2028년 2~5월에 실제로 이직한다', '외부에서 먼저 제안이 온다',
    '강의·자문 계약이 들어온다', '가까운 지역으로 이동한다']) {
    assert.ok(PROMPT.includes(no), `하면 안 되는 예가 있어야 한다: ${no}`);
  }
});

test('연 단위가 월 단위를 이긴다는 규칙이 있다', () => {
  assert.match(PROMPT, /### 연 단위가 월 단위를 이깁니다/);
  assert.match(PROMPT, /월 값으로 연간 결론을 뒤집지 마세요/);
  assert.match(PROMPT, /그 해 안에서 어디가 상대적으로 센가.*보조/s);
});

test('체계 용어 혼용을 금지한다 (대운 ≠ 대한)', () => {
  assert.match(PROMPT, /### 체계 용어를 섞지 마세요/);
  assert.match(PROMPT, /사주의 대운과 자미두수의 대한은 다른 것입니다/);
});

test('계산에 없는 세부 속성을 만들지 말라는 규칙이 있다 (재성 2 ≠ 편재 2개)', () => {
  assert.match(PROMPT, /### 계산에 없는 세부 속성을 만들지 마세요/);
  assert.match(PROMPT, /"재성 2"/);
  assert.match(PROMPT, /"편재 2개"/);
  assert.match(PROMPT, /문맥에 적힌 낱알까지만 씁니다/);
});

test('답은 결론 3~5문장 뒤 근거 2~4개 꼴이다', () => {
  assert.match(PROMPT, /## 답의 뼈대 — 결론 먼저, 근거는 추려서/);
  assert.match(PROMPT, /3~5문장으로 단정해서/);
  assert.match(PROMPT, /가장 강한 근거 2~4개만/);
  // 예전의 "다섯~여덟 문단" 규칙이 남아 있으면 새 뼈대와 충돌한다
  assert.ok(!PROMPT.includes('다섯~여덟 문단'), '옛 길이 규칙이 남아 있으면 안 된다');
});

test('묻지 않은 분야로 답을 넓히지 말라는 규칙이 있다', () => {
  assert.match(PROMPT, /## 물은 분야 \*\*안에서만\*\* 넓히세요/);
  assert.match(PROMPT, /방위·회사 규모·이동 거리·\s*창업 가능성/);
  // "확장 추론"이라는 옛 이름이 남아 있으면 반대 지시로 읽힌다
  assert.ok(!PROMPT.includes('묻지 않은 것까지 이어서 답하세요'),
    '옛 확장 추론 절이 남아 있으면 안 된다');
});

test('조심하는 말은 한 번만 붙이라는 규칙이 있다', () => {
  assert.match(PROMPT, /## 조심하는 말은 한 번만/);
  assert.match(PROMPT, /한 문장에 조심 장치를 두 번 이상 붙이지 마세요/);
});

test('시기 순위에는 측정 결과가 한 번만 붙는다', () => {
  const c = payload('자녀운 어때?');
  const n = (c.match(/이 문장은 답 전체에서 한 번만 쓸 것/g) ?? []).length;
  assert.ok(n >= 1, '측정 문구가 있어야 한다');
  assert.match(c, /p=0\.868/, '달 단위 측정값을 함께 싣는다');
});

/* ── 6. 합격·당첨 — 확정은 않되 최우선 시나리오를 먼저 ───────── */

test('합격 질문을 판정 질문으로 가려낸다', () => {
  for (const q of ['이번에 합격할까요', '서류 통과할까요', '당첨될까요']) {
    assert.equal(route(q).asksOutcome, true, `판정 질문이어야 한다: ${q}`);
  }
});

test('판정 질문은 최우선 시나리오를 먼저 내라고 되어 있다', () => {
  assert.match(PROMPT, /최우선 시나리오를 먼저/);
  assert.match(PROMPT, /가장 그럴듯한 그림을 먼저 단정해서 말합니다/);
  assert.match(PROMPT, /회피이지 정직이 아닙니다/);
});

test('그래도 결과 자체는 확정하지 않는다', () => {
  assert.match(PROMPT, /예·아니오로 답하지 마세요/);
  assert.match(PROMPT, /이 계산으로 가리지 못합니다/);
});

test('복권 당첨은 어떤 등급에서도 단정하지 않는다', () => {
  assert.match(PROMPT, /### 복권 질문에서 절대 쓰지 않는 표현/);
  assert.match(PROMPT, /이 번호가 당첨번호다/);
});
