import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../../public/unse/', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');

test('운세 입력은 분석 입력 fieldset과 보정 options를 구분한다', async () => {
  const html = await read('index.html');

  assert.match(html, /<fieldset class="analysis-fields"/);
  assert.match(html, /<legend>분석할 사람의 출생 정보<\/legend>/);
  assert.match(html, /<details class="input-options">/);
  assert.match(html, /태어난 시간 보정과 거주지/);
});

test('명반 생성 결과와 계산 진행 영역은 접근 가능한 상태를 제공한다', async () => {
  const html = await read('index.html');
  const style = await read('assets/style.css');

  assert.match(html, /id="form-error"[^>]*role="alert"/);
  assert.match(html, /id="result"[^>]*aria-live="polite"/);
  assert.match(style, /#result:focus\s*\{\s*outline:\s*none/);
});

test('계산 시작과 실패는 결과 busy 상태와 첫 입력 오류를 연결한다', async () => {
  const boot = await read('src/boot.js');

  assert.match(boot, /function showFormError\(/);
  assert.match(boot, /box\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(boot, /box\.setAttribute\('aria-busy', 'false'\)/);
});

test('결과는 계산값·오늘/이달·통합 리포트·AI 순서로 읽게 한다', async () => {
  const ui = await read('src/ui.js');
  const report = await read('src/report.js');
  const personalRender = ui.slice(ui.indexOf('function render(form, r, f)'));
  const pairRender = ui.slice(ui.indexOf('function renderCompat(formA, formB, r)'));

  // '해석 · 핵심 종합'은 아래 리포트와 겹쳐 뺐다
  assert.doesNotMatch(ui, /해석 · 핵심 종합/);
  const calculation = personalRender.indexOf('${chartPanel(r)}');
  const interpretation = 0;
  // 통합 리포트는 AI 해석 위에 둔다 — 무료로 먼저 읽고, 더 궁금한 것만 AI 에 묻게 한다
  const reportAt = personalRender.indexOf('${renderReport(form, r, f, v)}');
  const ai = personalRender.indexOf('AI 명반 해석');
  assert.ok(interpretation >= 0 && calculation > interpretation && reportAt > calculation && ai > reportAt);
  assert.match(ui, /계산값 · 명반 요약/);
  // 요약 카드는 늘 보이고, 자세한 장은 펼친 채로 두되 접을 수 있다
  assert.match(report, /더 자세히 보기/);
  assert.match(report, /<details class="rp-ch" open>/);

  const pairReportAt = pairRender.indexOf('${renderPairReport(');
  const pairAi = pairRender.indexOf('AI 명반 해석');
  assert.ok(pairReportAt >= 0 && pairAi > pairReportAt);
  const pairDetail = pairRender.indexOf('관계 축별 해석');
  assert.ok(pairAi >= 0 && pairDetail > pairAi);
  assert.match(pairRender, /<details class="compat-details" open>/);
});

test('AI 영역은 질문권 상태와 소진 paywall을 기록 안에서 표시한다', async () => {
  const ai = await read('src/ai.js');

  assert.match(ai, /loadCreditStatus/);
  assert.match(ai, /id="ai-credit-status"/);
  assert.match(ai, /className = 'ai-paywall'/);
});
