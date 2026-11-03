/**
 * 운세 AI 답변 파이프라인(2026-11-03) 회귀.
 *
 *   ① 질문 의도 분석 → 답의 모양(prompt.ts planAnswer)
 *   ② 관련 계산값 추출 + 근거 번호(evidence.js — 출생 명반 [SJ3]… · 시기·층 [TM4]…)
 *   ⑤ 코드 검증(answerCheck.js — 없는 번호·연도·확률·단정 표현을 고치고, 모양 문제는 기록)
 *   ⑥ 렌더링(answerView.js — 결론 상자·영역 카드·비교표·근거 칩·종합 권고)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { readFortune } from '../../public/unse/src/engine.js';
import { readForecast } from '../../public/unse/src/forecast.js';
import { buildContext } from '../../public/unse/src/aiContext.js';
import { focusFor } from '../../public/unse/src/ai.js';
import { routeQuestion } from '../../public/unse/src/hires/router.js';
import { buildHiRes } from '../../public/unse/src/hires/context.js';
import { natalLedger, timeLedger, formatLedger, ledgerMap, resolveEvidence, plainEvidence } from '../../public/unse/src/evidence.js';
import { checkAnswer, evidenceIdsIn, issueSummary } from '../../public/unse/src/answerCheck.js';
import { renderAnswer } from '../../public/unse/src/answerView.js';
import { SYSTEM, FORMATS, MODULES, planAnswer, planNote } from '../../app/fortune-ai/prompt.ts';
import { detailLevel, lengthHint } from '../../app/fortune-ai/conversation.ts';

const NOW = new Date('2026-10-19T03:00:00Z');
const FORM = { name: '가', gender: 'female', year: 1993, month: 3, day: 17, hour: 15, minute: 42, birthPlace: '여주', homePlace: '서울' };
const fortune = readFortune(FORM, { now: NOW });
const forecast = readForecast(FORM, NOW);
const plan = (q) => {
  const r = routeQuestion(q, 2026);
  return planAnswer(q, { ...r, lifetime: r.needsLifetime }, detailLevel(q));
};

/* ── ① 질문 유형에 따라 답의 모양을 고른다 ───────────────────── */

test('필수 질문 10개가 질문 유형별 모양으로 갈린다', () => {
  const cases = [
    ['내 명반의 약점을 액땜이나 업상대체로 보완하는 방법 알려줘', 'remedy', 'long'],
    ['나한테 맞는 직업과 직업적으로 성공하는 방향은?', 'deep', 'long'],
    ['시험과 자격증 취득에 유리한 학습 방법이 궁금해', 'deep', 'long'],
    ['재물운과 부자가 되기 위한 현실적인 전략', 'deep', 'long'],
    ['배우자운과 안정적인 결혼 조건을 알려줘', 'deep', 'long'],
    ['건강운과 사고수는 어때?', 'health', 'normal'],
    ['2027년 운세는 어때?', 'timing', 'normal'],
    ['여러 체계를 종합해서 내 인생 로드맵을 짜줘', 'roadmap', 'long'],
    ['자미두수로만 봐줘. 내 관록궁은 어때?', 'focused', 'normal'],
    ['내 일간이 뭐야?', 'fact', 'short'],
  ];
  for (const [q, shape, detail] of cases) {
    const p = plan(q);
    assert.equal(p.shape, shape, q);
    assert.equal(p.detail, detail, q);
  }
});

test('질문에 걸린 분야 규칙만 붙고, 묻지 않은 규칙은 붙지 않는다', () => {
  const career = plan('나한테 맞는 직업과 직업적으로 성공하는 방향은?');
  assert.ok(career.modules.includes('career'));
  // '방향'·'성공' 낱말에 이사·판정 규칙이 끌려오지 않는다
  assert.ok(!career.modules.includes('place'), career.modules.join());
  assert.ok(!career.modules.includes('outcome'), career.modules.join());
  assert.ok(!career.modules.includes('money') && !career.modules.includes('health'));
  // 결혼을 물으면 router 가 재물 계산을 켜지만, 돈을 묻지 않았으면 답의 분야에는 넣지 않는다
  const love = plan('배우자운과 안정적인 결혼 조건을 알려줘');
  assert.deepEqual(love.domains, ['결혼']);
  assert.ok(love.modules.includes('love') && !love.modules.includes('money'));
  assert.ok(plan('이직할까 남을까').modules.includes('choice'));
  assert.ok(plan('행운의 색은?').modules.includes('color'));
  assert.deepEqual(plan('자미두수로만 봐줘. 내 관록궁은 어때?').scopeLock, ['자미두수']);
});

test('화면이 분석을 못 보내도(옛 화면) 질문 낱말로 설계하고, 이상한 값은 거른다', () => {
  assert.equal(planAnswer('나한테 맞는 직업과 성공 방향', null, 'normal').shape, 'deep');
  const p = planAnswer('올해 운세', { domains: ['직업', '<script>'], scopeLock: ['없는 체계'], asksChoice: 'yes' }, 'normal');
  assert.deepEqual(p.domains, ['직업']);
  assert.equal(p.scopeLock, null);
  assert.ok(!p.modules.includes('choice'));
  assert.equal(planAnswer('궁합 전체 풀이', { pair: true }, 'normal').shape, 'pair');
});

test('이번 답의 설계에 모양·먼저 볼 근거·길이·분야 규칙이 실린다', () => {
  const p = plan('나한테 맞는 직업과 직업적으로 성공하는 방향은?');
  const note = planNote(p, lengthHint(p.detail));
  assert.match(note, /^# 이번 답의 설계/);
  assert.match(note, /질문 유형: 영역별 심층 분석 · 분야 직업/);
  assert.match(note, /### ① \(영역\)/);
  assert.match(note, /명반 근거: \[번호\]/);
  assert.match(note, /## 종합 권고/);
  assert.match(note, /자미두수 직업을 보는 자리.*베딕 D1 10궁·D10/);
  assert.match(note, /길이: 심층/);
  assert.match(note, /## 진로·이직 의사결정 해석 규칙/);
  const lock = planNote(plan('자미두수로만 봐줘. 내 관록궁은 어때?'), '');
  assert.match(lock, /지정한 체계\(자미두수\)만/);
});

test('공통 지시문은 줄이고, 분야 규칙은 공통 지시문에서 빠져 질문마다 붙는다', () => {
  assert.ok(SYSTEM.length < 12_000, `SYSTEM ${SYSTEM.length}자`);
  assert.match(SYSTEM, /## 조심하는 말은 한 번만/);          // 리터럴이 끝까지 이어진다
  assert.match(SYSTEM, /## 근거 번호 — 중요한 근거는 번호로/);
  assert.match(SYSTEM, /여러 체계가 같은 뜻을 가리키는 것 \/ 한 체계만 말하는 것 \/ 서로 어긋나는 것 \/ 자료가 없어 판단할 수 없는 것/);
  assert.doesNotMatch(SYSTEM, /진로·이직 의사결정 해석 규칙|복권 질문에서|행운의 색을 말할 때/);
  for (const t of [SYSTEM, ...Object.values(MODULES), ...Object.values(FORMATS).map((f) => f.body)]) {
    assert.ok(!t.includes('${') && !t.includes('{{CARD}}'));
  }
  assert.match(MODULES.remedy, /성형·수술·문신·헌혈/);
  assert.match(MODULES.remedy, /이 대응은 예시일 뿐/);
});

/* ── ② 근거 번호 ───────────────────────────────────────────── */

test('출생 명반 근거 번호가 문맥의 접은 줄과 정확히 같다', () => {
  const ctx = buildContext(FORM, fortune, forecast);
  const nat = natalLedger(fortune);
  const ids = evidenceIdsIn(ctx);
  assert.ok(nat.length > 50);
  for (const e of nat) assert.ok(ids.has(e.id), e.id);
  const sj = nat.find((e) => e.id === 'SJ4');
  assert.equal(sj.field, '십신');
  assert.match(sj.limits, /0이어도 지장간/);
  assert.match(ctx, /\[SJ1\] 일간 丁/);
  assert.match(ctx, /\[ZW1\] 명궁 미궁/);
});

test('질문별 계산 맨 앞에 시기·층 근거 번호표가 붙는다(성향만 묻는 질문은 빼고)', () => {
  const f = focusFor('나한테 맞는 직업과 직업적으로 성공하는 방향은?', { fortune, forecast, form: FORM });
  assert.match(f, /^## 근거 번호 — 이 질문의 시기·층 값/);
  assert.match(f, /\[TM1\] 사주 · 지금 10년 운\(대운\): 戊午/);
  assert.match(f, /\[직업\] 원국 관록궁: 원국 관록궁 亥 · 공궁/);
  // 같은 한계 문구는 한 번만
  assert.equal(f.match(/연 1° 진행/g)?.length ?? 0, 1);
  const tm = timeLedger(buildHiRes(fortune, forecast, routeQuestion('2027년 운세', 2026)).json);
  assert.ok(tm.length >= 8 && tm.length <= 26);
  assert.ok(tm.every((e, i) => e.id === `TM${i + 1}`));
  const traits = focusFor('내 성격 장단점', { fortune, forecast, form: FORM });
  assert.doesNotMatch(traits ?? '', /## 근거 번호/);
});

test('번호는 엔진 계산값 이름표로 바뀌고, 없는 번호는 지워지며, 이력에는 평문으로 간다', () => {
  assert.equal(formatLedger([]), '');
  const map = ledgerMap(natalLedger(fortune));
  const out = resolveEvidence('명반 근거: [SJ4] [ZW99] [SJ4]', map);
  assert.match(out, /⟦사주 · 십신 비겁 0 · 식상 1/);
  assert.ok(out.match(/⟦([^⟧]*)⟧/)[1].length <= 46, '이름표는 짧게 자른다');
  assert.doesNotMatch(out, /ZW99|\[SJ4\]/);
  assert.equal(out.match(/⟦/g).length, 1, '한 줄의 같은 근거는 한 번만');
  assert.match(plainEvidence(out), /\(사주 · 십신/);
  assert.doesNotMatch(plainEvidence(out), /⟦/);
});

/* ── ⑤ 코드 검증 ───────────────────────────────────────────── */

const SOURCES = '[SJ1] 일간 丁 · [ZW8] 관록궁 해궁 — 공궁\n2026(33세) 丙午 · 2027(34세) 丁未 · 종합 반영 60% · D10 — 일의 자리';
const check = (t, o = {}) => checkAnswer(t, { sources: SOURCES, ...o });

test('없는 근거 번호·흉내 낸 이름표·단정 부사는 고친다', () => {
  const r = check('## 핵심 결론\n직업 기회가 커지는 해예요. [SJ1] [ZW77]\n반드시 잘 됩니다. ⟦사주 · 가짜 값⟧');
  assert.match(r.text, /\[SJ1\]/);
  assert.doesNotMatch(r.text, /ZW77|반드시|⟦/);
  assert.match(r.text, /사주 · 가짜 값/);              // 평문으로 풀려 칩이 되지 않는다
  const s = issueSummary(r.issues);
  assert.equal(s.unknownEvidence, 1); assert.equal(s.forgedChip, 1); assert.equal(s.absolute, 1);
});

test('자료에 없는 연도·확률·분할도를 쓴 문장, 확정 예언 문장은 뺀다 — 근거 있는 문장은 남긴다', () => {
  const r = check([
    '## 핵심 결론',
    '2027년은 역할이 커지는 해예요. 2031년에 큰 전환이 와요.',
    '- 합격 확률은 80%예요. 종합 반영 60%는 참고값이에요.',
    '- D9로 보면 배우자가 좋아요. D10은 가르치는 일과 가까워요.',
    '- 2027년에 이혼하게 됩니다. 관계에 긴장이 커질 수 있어요.',
    '- 이번 시험은 합격합니다. 위에 쓰는 병에 걸립니다.',
    '- 로또 1등에 당첨됩니다. 첫째는 아들이에요.',
    '| 연도 | 주제 |', '|---|---|', '| 2027 | 역할 확대 |', '| 2040 | 지어낸 해 |',
  ].join('\n'));
  assert.match(r.text, /2027년은 역할이 커지는 해예요/);
  assert.doesNotMatch(r.text, /2031|80%|D9|이혼하게|합격합니다|병에 걸립니다|당첨됩니다|아들이에요|2040/);
  assert.match(r.text, /종합 반영 60%/);
  assert.match(r.text, /D10은 가르치는 일/);
  assert.match(r.text, /관계에 긴장이 커질 수 있어요/);
  assert.match(r.text, /\| 2027 \| 역할 확대 \|/);
  const s = issueSummary(r.issues);
  for (const k of ['unknownYear', 'unknownPercent', 'unknownChart', 'definiteEvent', 'definiteOutcome', 'medicalClaim', 'lottery', 'childGender']) {
    assert.ok(s[k] >= 1, `${k} 가 걸려야 한다: ${JSON.stringify(s)}`);
  }
});

test('부정·조건 문장은 빼지 않고, 되풀이 문장은 하나만 남긴다', () => {
  const r = check('이혼한다고 단정할 수 없어요. 큰 병에 걸리는 것은 아니에요.\n같은 문장이 두 번 나오면 하나는 지워야 해요.\n같은 문장이 두 번 나오면 하나는 지워야 해요.');
  assert.match(r.text, /단정할 수 없어요/);
  assert.match(r.text, /아니에요/);
  assert.equal(r.text.match(/같은 문장이 두 번/g).length, 1);
});

test('모양 문제(서론·결론 없음·내부 용어·묻지 않은 달·블록 빠짐)는 고치지 않고 기록한다', () => {
  const r = check('좋은 질문이에요. 고해상도 계산을 보면 2027년 3월이 좋아요.', { final: true, detail: 'normal' });
  const s = issueSummary(r.issues);
  for (const k of ['preamble', 'noLead', 'jargon', 'monthNotAsked', 'noFollowUps', 'length']) assert.ok(s[k], k);
  assert.ok(r.issues.filter((i) => ['preamble', 'noLead', 'jargon'].includes(i.kind)).every((i) => !i.fixed));
  // 단순 사실 답은 소제목 없이 시작해도 된다
  assert.ok(!issueSummary(check('타고난 나는 등불 같은 불이에요. [SJ1]', { shape: 'fact' }).issues).noLead);
  // 달을 물었으면 달은 문제가 아니다
  assert.ok(!issueSummary(check('## 핵심 결론\n2027년 3월이 좋아요.', { asksMonth: true }).issues).monthNotAsked);
});

test('[이어서 물어보기] 블록은 검사에서 빼고 그대로 둔다', () => {
  const r = check('## 핵심 결론\n2027년이 좋아요.\n\n[이어서 물어보기]\n- 2035년은 어때요?\n- 몇 월이 좋아요?', { final: true });
  assert.match(r.text, /\[이어서 물어보기\]\n- 2035년은 어때요\?/);
  assert.ok(!issueSummary(r.issues).noFollowUps);
});

test('흘러오는 중의 반쪽 글도 깨지지 않는다', () => {
  for (const part of ['## 핵', '## 핵심 결론\n20', '## 핵심 결론\n2027년은 [SJ', '| 연도 |', '- 이혼하']) {
    assert.doesNotThrow(() => check(part));
    assert.doesNotThrow(() => renderAnswer(check(part).text));
  }
});

/* ── ⑥ 렌더링 ──────────────────────────────────────────────── */

test('결론 상자·영역 카드·비교표·근거 칩·종합 권고로 그린다', () => {
  const html = renderAnswer([
    '## 핵심 결론',
    '**책임을 전문성으로 바꾸는 구조예요.** 재산은 기준을 세워 지켜요.',
    '',
    '### ① 직업 — 압박을 전문성으로',
    '명반 근거: ⟦사주 · 십신 관성 1⟧ ⟦자미두수 · 관록궁 해궁 — 공궁⟧',
    '해석: 규율과 평가를 받는 구조를 검증 능력으로 쓸 수 있어요.',
    '추천: 기술 설계, 분석, 검증',
    '주의: 책임만 크고 권한이 없는 환경',
    '',
    '| 구분 | 버는 쪽 | 모으는 쪽 |',
    '|---|---|---|',
    '| 강점 | 전문성 | 기준 |',
    '',
    '## 종합 권고',
    '1. 검증 업무 경력을 쌓기',
    '2. 고정비 기준 세우기',
  ].join('\n'));
  assert.match(html, /<section class="ai-lead"><h4>핵심 결론<\/h4><p><strong>책임을 전문성으로/);
  assert.match(html, /<article class="ai-card"><h5>① 직업 — 압박을 전문성으로<\/h5>/);
  assert.match(html, /<p class="ai-ev"><span class="ai-k">명반 근거<\/span> <span class="ai-chip"[^>]*>사주 · 십신 관성 1<\/span>/);
  assert.match(html, /<p class="ai-lab ai-lab-say"><span class="ai-k">해석<\/span>/);
  assert.match(html, /ai-lab-do"><span class="ai-k">추천<\/span> 기술 설계/);
  assert.match(html, /ai-lab-warn"><span class="ai-k">주의<\/span>/);
  assert.match(html, /<div class="ai-table"[^>]*><table><thead><tr><th>구분<\/th>/);
  assert.match(html, /<td data-label="버는 쪽">전문성<\/td>/);
  assert.match(html, /<section class="ai-final"><h4>종합 권고<\/h4><ol><li>검증 업무 경력을 쌓기<\/li>/);
});

test('모델 글의 태그는 그대로 글자로 나오고, 번호가 다 지워진 근거 줄은 그리지 않는다', () => {
  const html = renderAnswer('<script>alert(1)</script>\n명반 근거: \n본문');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /ai-ev/);
});

test('화면은 검증·근거 변환을 거친 글을 그리고, 서버에 질문 분석과 평문 이력을 보낸다', async () => {
  const { readFileSync } = await import('node:fs');
  const ai = readFileSync('public/unse/src/ai.js', 'utf8');
  assert.match(ai, /bubble\.innerHTML = renderText\(shownAnswer\(acc, turn\)\);/);
  assert.match(ai, /const shown = shownAnswer\(acc, turn, true\);/);
  assert.match(ai, /intent: intentOf\(/);
  assert.match(ai, /plainEvidence\(m\.content\)/);
  const route = readFileSync('app/fortune-ai/route.ts', 'utf8');
  assert.match(route, /const intent = body\.intent \?\? \(\/\^## 두 사람\$\/m\.test\(context\) \? \{ pair: true \} : null\);/);
  assert.match(route, /const plan = planAnswer\(question, intent, detailLevel\(question\), \{ timeKnown: !context\.includes\("출생 시각을 몰라 시주가 없다"\) \}\);/);
  assert.match(route, /planNote\(plan, lengthHint\(detail\)\)/);
  assert.match(route, /const check = logCheck\(creditRequestId, plan, answer, checkInput\);/);
  // 로그에 답 본문은 싣지 않는다
  assert.doesNotMatch(route, /check " \+ JSON\.stringify\(\{[^}]*answer[,}]/);
});

/* ── 사건 판정 (15체계 사건 판정 통합 리딩, 2026-11-03) ─────────── */

const planWith = (q, chart = { timeKnown: true }) => {
  const r = routeQuestion(q, 2026);
  return planAnswer(q, { ...r, lifetime: r.needsLifetime, cityCount: r.cities.length }, detailLevel(q), chart);
};

test('무엇이 일어날지 묻는 질문은 사건 판정, 무엇을 할지 묻는 질문은 비교로 간다', () => {
  for (const q of ['2027년에 이직하게 될까?', '내년에 무슨 일이 생길까?', '올해 연애 쪽으로 어떤 일이 일어날까?', '이사하게 될까요?', '이번 시험 합격할 수 있을까']) {
    const p = planWith(q);
    assert.equal(p.shape, 'event', q);
    assert.equal(p.detail, 'long', q);
    assert.ok(p.modules.includes('event') && !p.modules.includes('outcome'), `${q} → ${p.modules}`);
  }
  for (const q of ['이직할까 남을까', '결혼할까 말까']) assert.equal(planWith(q).shape, 'compare', q);
  // 지금까지의 유형은 그대로
  assert.equal(planWith('2027년 운세는 어때?').shape, 'timing');
  assert.equal(planWith('건강운과 사고수는 어때?').shape, 'health');
});

test('사건 판정 단추는 분야 셋을 그대로 계산·판정한다', async () => {
  const { readFileSync } = await import('node:fs');
  const ai = readFileSync('public/unse/src/ai.js', 'utf8');
  const q = ai.match(/\['사건 판정', '([^']+)'\]/)[1];
  const p = planWith(q);
  assert.equal(p.shape, 'event');
  assert.deepEqual(p.eventFields, ['직업', '재정', '연애·결혼']);
});

test('입력 완성도는 코드가 센다 — 출생 시각·기간·분야·후보 목적지', () => {
  assert.deepEqual(planWith('2027년에 이직하게 될까?').completeness, { grade: '충분', missing: [] });
  const noTime = planWith('2027년에 이직하게 될까?', { timeKnown: false }).completeness;
  assert.equal(noTime.grade, '일부 부족');
  assert.match(noTime.missing[0], /출생 시각/);
  const move = planWith('이사하게 될까요?').completeness;
  assert.equal(move.grade, '일부 부족');
  assert.ok(move.missing.some((m) => /예측 기간/.test(m)) && move.missing.some((m) => /후보 목적지/.test(m)));
  const blank = planWith('무슨 일이 생길까?', { timeKnown: false }).completeness;
  assert.equal(blank.grade, '부족');
  // 분야를 정하지 않으면 네 분야를 두루 본다
  assert.deepEqual(planWith('내년에 무슨 일이 생길까?').eventFields, ['직업', '재정', '연애·결혼', '주거']);
});

test('사건 판정 설계에 완성도·분야별 후보·출력 형식·판정 규칙이 실린다', () => {
  const p = planWith('2027년에 이직하게 될까?', { timeKnown: false });
  const note = planNote(p, lengthHint(p.detail));
  assert.match(note, /질문 유형: 사건 판정/);
  assert.match(note, /## 입력 완성도 \(코드가 계산 — 첫 줄에 그대로\)\n일부 부족 — 빠진 것: 출생 시각/);
  assert.match(note, /- 직업: 현 직장 유지 \/ 같은 지역 이직 \/ 타지역 이직 \/ 휴직·독립 등 구조 변화/);
  assert.match(note, /\| 분야 \| 최우선 시나리오 \| 리딩 신뢰도 \| 2위 시나리오 \| 현실화 조건 \|/);
  for (const s of ['무슨 일이 가능한가:', '언제 강한가:', '왜 이쪽이 우세한가:', '현실화 조건:', '## 판정하지 못한 것', '## 근거 요약']) assert.ok(note.includes(s), s);
  const m = MODULES.event;
  for (const s of ['리딩 신뢰도', '근소 우세', '현실화 조건 미충족', '이번 기간에는 사건 판정 불가', '최우선 시나리오',
    '같은 출생 시각에서 나온 비슷한 신호를 독립된 증거처럼 더하지 않습니다', '단언 등급이 S·A면 높음까지', '진로·이직 의사결정 해석 규칙이 함께 붙으면 그 규칙이 앞섭니다']) {
    assert.ok(m.includes(s), `빠진 규칙: ${s}`);
  }
  assert.ok(note.includes('## 진로·이직 의사결정 해석 규칙'), '직업 사건이면 진로 규칙도 붙는다');
});

test('시기·층 근거 번호표에 분야 단언 등급이 실린다(리딩 신뢰도 상한)', () => {
  const f = focusFor('2027년에 이직하게 될까?', { fortune, forecast, form: FORM });
  assert.match(f, /\[TM\d+\] 종합 · \[직업\] 단언 등급: [SABC]/);
});

test('어느 결과에도 맞는 문장은 빼고, 조건부 판단은 남긴다', () => {
  const r = check([
    '## 한 줄 결론',
    '이직하거나 현재 직장에 남을 수 있어요. 결혼하거나 헤어질 수도 있어요.',
    '좋은 변화가 찾아와요. 돈 관리가 중요해요. 스트레스를 조심하세요.',
    '연봉이 오르면 남는 쪽, 성장할 자리가 없으면 옮기는 쪽이에요.',
  ].join('\n'));
  assert.doesNotMatch(r.text, /남을 수 있어요|헤어질 수도|좋은 변화|돈 관리|스트레스/);
  assert.match(r.text, /연봉이 오르면 남는 쪽/);
  assert.equal(issueSummary(r.issues).filler, 5);
});

test('사건 판정 답은 입력 완성도·리딩 신뢰도·판정표가 빠지면 기록한다', () => {
  const good = check('입력 완성도: 일부 부족 — 빠진 것: 출생 시각\n## 한 줄 결론\n2027년에 직업에서 가장 우세한 사건은 현 직장 유지예요.\n\n| 분야 | 최우선 시나리오 | 리딩 신뢰도 |\n|---|---|---|\n| 직업 | 현 직장 유지 | 보통 |\n\n[이어서 물어보기]\n- 다음 해는?',
    { shape: 'event', detail: 'long', final: true });
  const s = issueSummary(good.issues);
  for (const k of ['noCompleteness', 'noConfidence', 'noTable', 'noLead', 'preamble']) assert.ok(!s[k], `${k}: ${JSON.stringify(s)}`);
  const bad = issueSummary(check('## 한 줄 결론\n좋은 쪽이에요.', { shape: 'event', final: true }).issues);
  for (const k of ['noCompleteness', 'noConfidence', 'noTable']) assert.ok(bad[k], k);
});

test('사건 판정 화면 — 입력 완성도 줄, 사건 카드 칸, 근거 요약은 작게', () => {
  const html = renderAnswer([
    '입력 완성도: 일부 부족 — 빠진 것: 출생 시각',
    '## 한 줄 결론',
    '2027년에 직업에서 가장 우세한 사건은 현 직장 유지예요.',
    '### ① 현 직장 안에서 역할 확대',
    '무슨 일이 가능한가: 같은 회사에서 맡는 일이 커져요.',
    '언제 강한가: 2027년 상반기',
    '왜 이쪽이 우세한가: 조직 안 자리가 함께 켜져요.',
    '현실화 조건: 평가 시기와 직무 공고 확인',
    '## 근거 요약',
    '- 사주 · 그해 운 ⟦사주 · 2027 그해 운(세운) 丁未 비견⟧ / 조직 안 역할 / 평가 일정',
  ].join('\n'));
  assert.match(html, /^<p class="ai-lab ai-lab-meta"><span class="ai-k">입력 완성도<\/span>/);
  assert.match(html, /<section class="ai-lead"><h4>한 줄 결론<\/h4>/);
  assert.match(html, /ai-lab-say"><span class="ai-k">무슨 일이 가능한가<\/span>/);
  assert.match(html, /ai-lab-rule"><span class="ai-k">언제 강한가<\/span>/);
  assert.match(html, /ai-lab-do"><span class="ai-k">현실화 조건<\/span>/);
  assert.match(html, /<section class="ai-aside"><h4>근거 요약<\/h4><ul><li>.*<span class="ai-chip"/);
});
