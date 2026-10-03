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

  assert.match(html, /id="form-error"[^>]*role="alert"/);
  assert.match(html, /id="result"[^>]*aria-live="polite"/);
});

test('계산 시작과 실패는 결과 busy 상태와 첫 입력 오류를 연결한다', async () => {
  const boot = await read('src/boot.js');

  assert.match(boot, /function showFormError\(/);
  assert.match(boot, /box\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(boot, /box\.setAttribute\('aria-busy', 'false'\)/);
});

test('결과는 해석·계산값·AI·세부 계산 순서로 읽게 한다', async () => {
  const ui = await read('src/ui.js');
  const report = await read('src/report.js');
  const personalRender = ui.slice(ui.indexOf('function render(form, r, f)'));

  const interpretation = personalRender.indexOf('해석 · 핵심 종합');
  const calculation = personalRender.indexOf('${chartPanel(r)}');
  const ai = personalRender.indexOf('AI 명반 해석');
  assert.ok(interpretation >= 0 && calculation > interpretation && ai > calculation);
  assert.match(ui, /계산값 · 명반 요약/);
  assert.match(report, /세부 계산 보기/);
  assert.doesNotMatch(report, /<details class="rp" open>/);
});
