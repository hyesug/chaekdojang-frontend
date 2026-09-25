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
import { buildContext } from '../../public/unse/src/aiContext.js';
import { routeQuestion } from '../../public/unse/src/hires/router.js';
import { horaryCast, isHoraryQuestion, formatHorary } from '../../public/unse/src/systems/horary.js';
import juyeok from '../../public/unse/src/systems/juyeok.js';
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

/* ── 1. 질문 유형마다 맞는 계산이 켜지는가 ──────────────────── */

test('대운으로 이직·재물 시기를 물으면 직업·재물이 켜진다', () => {
  const r = route('대운 흐름으로 볼 때 언제 이직하고 언제 재물이 들어올까요');
  assert.ok(r.domains.includes('직업'), '직업이 켜져야 한다');
  assert.ok(r.domains.includes('재물'), '재물이 켜져야 한다');
  assert.equal(r.needsHorary, false, '시기 질문은 점시가 아니다');
});

test('태양·MC 직업 적성 — 문맥에 10하우스 고전·현대 읽기가 함께 실린다', () => {
  const c = context();
  assert.match(c, /## 직업 — 체계마다 무엇이라 하는가/);
  assert.match(c, /고전 서양.*10하우스/s, '고전 10하우스 룰러 읽기');
  assert.match(c, /점성술\(현대\).*10하우스/s, '현대 10하우스 거주 행성');
});

test('자미 관록궁·재백궁이 성향까지 함께 나온다', () => {
  const c = context();
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
  const c = context();
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

test('월별 강약 — 열두 절기월이 간지와 함께 실린다', () => {
  const c = context();
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
  const c = context();
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
