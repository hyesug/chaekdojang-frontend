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

test('결과는 핵심 요약·오늘/이달·상세 리포트·AI·체계별 상세 순서로 읽게 한다', async () => {
  const ui = await read('src/ui.js');
  const report = await read('src/report.js');
  const personalRender = ui.slice(ui.indexOf('function render(form, r, f)'));
  const pairRender = ui.slice(ui.indexOf('function renderCompat(formA, formB, r)'));

  // '해석 · 핵심 종합'은 아래 리포트와 겹쳐 뺐다
  assert.doesNotMatch(ui, /해석 · 핵심 종합/);
  // 이달의 일자별 표와 날짜 가이드는 뺐다(사용자 요청)
  assert.doesNotMatch(ui, /이달의 날짜 가이드|일자별로 보기/);
  // 핵심 요약이 맨 위 — 모바일 첫 화면에 핵심 성향이 보이게
  const highlights = personalRender.indexOf('renderHighlights(h)');
  const tabs = personalRender.indexOf('data-tab="today"');
  // 상세 리포트는 AI 해석 위에 둔다 — 무료로 먼저 읽고, 더 궁금한 것만 AI 에 묻게 한다
  const reportAt = personalRender.indexOf('${renderReport(form, r, f, v, { memo: h?.memo })}');
  const ai = personalRender.indexOf('AI 명반 해석');
  const calculation = personalRender.indexOf('${chartPanel(r)}');
  assert.ok(highlights > 0 && tabs > highlights && reportAt > tabs && ai > reportAt && calculation > ai);
  assert.match(ui, /체계별 상세 · 계산값 · 명반 요약/);
  // 요약 카드는 늘 보이고, 자세한 장은 접힌 채로 두되 펼칠 수 있다
  assert.match(report, /더 자세히 보기/);
  assert.match(report, /<details class="rp-ch">/);

  const pairReportAt = pairRender.indexOf('${renderPairReport(');
  const pairAi = pairRender.indexOf('AI 명반 해석');
  assert.ok(pairReportAt >= 0 && pairAi > pairReportAt);
  // 여덟 축마다 정해진 문단을 싣던 '관계 축별 해석'은 뺐다
  assert.doesNotMatch(pairRender, /<details class="compat-details"/);
});

test('AI 영역은 질문권 상태와 소진 paywall을 기록 안에서 표시한다', async () => {
  const ai = await read('src/ai.js');

  assert.match(ai, /loadCreditStatus/);
  assert.match(ai, /id="ai-credit-status"/);
  assert.match(ai, /className = 'ai-paywall'/);
});

test('결과 아래에 링크 공유 버튼이 있고, 링크는 궁합의 결혼 여부까지 되살린다', async () => {
  const ui = await read('src/ui.js');
  assert.match(ui, /data-act="share"/);
  assert.match(ui, /링크에 생년월일과 태어난 시각이 담기니/);
  const { encodeState, decodeState } = await import('../../public/unse/src/share.js');
  const a = { name: '가', gender: 'female', year: 1993, month: 5, day: 17, hour: 14, minute: 20, birthPlace: '서울', homePlace: '서울', marital: 'married' };
  const b = { ...a, name: '나', gender: 'male', marital: null };
  const st = decodeState(encodeState('pair', a, b));
  assert.equal(st.mode, 'pair');
  assert.equal(st.formA.marital, 'married');
  assert.equal(st.formB.marital, null);
});

test('책 카드는 저자가 길어도 화면 밖으로 밀려나지 않는다', async () => {
  const ui = await read('src/ui.js');
  const css = await read('assets/style.css');
  assert.match(ui, /function shortAuthors\(author\)/);
  assert.match(ui, /외 \$\{xs\.length - 2\}명/);
  assert.match(css, /\.rp-book-list li \{ min-width: 0; \}/);
  assert.doesNotMatch(css, /\.rp-book-meta small \{[^}]*white-space: nowrap/);
});
