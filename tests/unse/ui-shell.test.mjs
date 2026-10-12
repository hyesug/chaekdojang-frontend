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
  assert.match(html, /태어난 시간 보정 \(시간 기준 · 서머타임\)/);
  // 시주를 세우는 시간 기준 — 진태양시(기본) / 일반 만세력 방식
  assert.match(html, /<select id="timeBasis">\s*<option value="tst">진태양시/);
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

test('결과 칸마다 피드백(👍/👎 + 한 줄)을 붙이고, 출생 정보는 보내지 않는다', async () => {
  const ui = await read('src/ui.js');
  const fb = await read('src/feedback.js');
  assert.match(ui, /attachFeedback\(box, \{ mode: 'solo', names: \[form\.name\] \}\)/);
  assert.match(ui, /attachFeedback\(box, \{ mode: 'pair', names: \[form\.name, formB\.name\] \}\)/);
  assert.match(fb, /fetch\('\/api\/fortune\/feedback'/);
  // 보내는 필드는 mode·section·verdict·snippet·comment 뿐 — 생년월일·시각·이름 필드가 없다
  const payload = fb.match(/const payload = [^\n]+/)[0];
  assert.match(payload, /\{ mode, section, verdict, snippet: snippetOf\(el, names\), comment \}/);
  assert.doesNotMatch(fb, /year|month|day|hour|birth/);
  assert.match(fb, /split\(n\)\.join\('○○'\)/);   // 문장 속 이름은 지운다
});

test('피드백 한 줄 입력은 👎를 누르기 전에는 숨어 있다', async () => {
  const css = await read('assets/style.css');
  assert.match(css, /\.fb-form\[hidden\] \{ display: none; \}/);
});

test('궁합 전용 칸(결혼 여부)은 숨김 속성이 display:grid 에 덮이지 않는다', async () => {
  const css = await read('assets/style.css');
  assert.match(css, /\.pair-only\[hidden\][^{]*\{ display: none; \}/);
});

test('로그인하면 여러 사람을 저장하고, 두 사람 칸 모두에서 불러온다', async () => {
  const html = await read('index.html');
  const boot = await read('src/boot.js');
  const profile = await read('src/profile.js');
  const ui = await read('src/ui.js');
  // 출생 정보 칸 맨 위에 늘 보인다(로그인 전에는 로그인 길을 알려 준다)
  assert.match(html, /<div class="saved-pick">\s*<label for="savedPick">[\s\S]*<select id="savedPick"/);
  assert.ok(html.indexOf('id="savedPick"') < html.indexOf('id="year"'), '생년월일 칸보다 위에 있어야 한다');
  // 두 번째 사람 칸은 첫 칸을 복제하므로 b-savedPick 도 생긴다 — 둘 다 채운다
  assert.match(boot, /for \(const prefix of \['', 'b-'\]\)/);
  // 고르면 칸만 채우고, 결과는 '명반 생성하기'를 눌렀을 때(피드백)
  assert.doesNotMatch(boot, /requestSubmit/);
  assert.match(profile, /export async function loadProfiles\(/);
  assert.match(profile, /call\('POST', '', bodyOf\(form\)\)/);
  assert.match(profile, /call\('PUT', `\/\$\{id\}`/);
  // 궁합 결과에도 두 사람 저장 칸
  assert.match(ui, /fillProfileCard\(\[form, formB\]\)/);
});

test('AI 질문은 Claude 두 모델만, 모델별 질문권(균형 1·심층 2)을 보내기 전에 확인하고, 질문권은 독후감으로 받는다', async () => {
  const ai = await read('src/ai.js');
  assert.match(ai, /export const AI_OPEN = true;/);
  assert.doesNotMatch(ai, /GPT_SOL|GPT_ASTRA/);
  assert.match(ai, /const TIER_COST = \{ CLAUDE_SONNET: 1, CLAUDE_OPUS: 2 \};/);
  assert.match(ai, /creditStatus\.totalBalance < cost/);
  assert.match(ai, /href="\/write">독후감 쓰고 질문권 받기/);
  assert.doesNotMatch(ai, /질문권 구매/);
  // 질문권 1회 = 질문 1개 + 그 답변. 답을 받다 끊기면 돌려준다(하루 2번까지)
  assert.match(ai, /질문권 1회는 질문 1개와 그 답변 한 벌입니다/);
  const route = await readFile(new URL('../../app/fortune-ai/route.ts', import.meta.url), 'utf8');
  assert.match(route, /settleCredit\(req, requestId, "refund", \{ errorType: "CLIENT_ABORTED_MID_ANSWER" \}\)/);
});

test('AI 문맥 — 일자별 120일 표·수술 택일은 캐시 문맥에서 빼고 날짜 질문에만 붙인다', async () => {
  const { readFortune } = await import('../../public/unse/src/engine.js');
  const { readForecast } = await import('../../public/unse/src/forecast.js');
  const { buildContext, dayContext } = await import('../../public/unse/src/aiContext.js');
  const { routeQuestion } = await import('../../public/unse/src/hires/router.js');
  const form = { name: 'x', year: 1990, month: 5, day: 15, hour: 14, minute: 0, birthPlace: '서울', homePlace: '서울', gender: 'female' };
  const r = readFortune(form); const f = readForecast(form);
  const base = buildContext(form, r, f);
  assert.doesNotMatch(base, /## 일자별|## 수술·시술 택일 참고 후보/);
  const day = dayContext(r, f);
  assert.match(day, /## 일자별 \(/);
  assert.match(day, /## 수술·시술 택일 참고 후보/);
  for (const q of ['다음 달 계약하기 좋은 날 알려줘', '수술 날짜 잡아줘', '이사 날 골라줘']) {
    assert.equal(routeQuestion(q, 2026).needsDay, true, q);
  }
  const ai = await read('src/ai.js');
  assert.match(ai, /if \(plan\.needsDay\) parts\.push\(dayContext\(calc\.fortune, calc\.forecast\)\);/);
});

test('AI 대화는 명반별로 브라우저에 남아 독후감을 쓰고 돌아와도 이어지고, 답 끝 질문은 단추가 된다', async () => {
  const ai = await read('src/ai.js');
  assert.match(ai, /const restored = loadChat\(saveKey\);/);
  assert.match(ai, /saveChat\(saveKey, session\.messages\);/);
  // 돌아오면 질문권을 다시 읽는다
  assert.match(ai, /visibilitychange', \(\) => \{\s*if \(!document\.hidden\) loadCreditStatus\(\)\.then\(paintCredit\);/);
  // 저장소 열쇠에 생년월일이 그대로 드러나지 않는다(섞은 값)
  assert.match(ai, /return `unse-ai-chat:\$\{hashOf\(raw\)\}`;/);
  const { splitFollowUps } = await import('../../public/unse/src/ai.js');
  const r = splitFollowUps('## 한마디로\n바뀌는 해예요.\n\n[이어서 물어보기]\n- 언제 옮길까요?\n- 분야는요?');
  assert.equal(r.body, '## 한마디로\n바뀌는 해예요.');
  assert.deepEqual(r.followUps, ['언제 옮길까요?', '분야는요?']);
  // 관리자는 무제한으로 보인다
  assert.match(ai, /관리자 · 무제한/);
});

test('프로필 저장 칸은 결과 맨 위(제목 바로 아래, 핵심 요약 앞)에 있다 — 개인·궁합 모두', async () => {
  const ui = await read('src/ui.js');
  for (const start of ['function render(form, r, f)', 'function renderCompat(formA, formB, r)']) {
    const body = ui.slice(ui.indexOf(start));
    const card = body.indexOf('id="profileCard"');
    const hl = body.indexOf('renderHighlights(h)');
    assert.ok(card > 0 && card < hl, `${start}: 저장 칸이 핵심 요약보다 앞에 있어야 한다`);
  }
});

test('저장한 사람 고르기는 입력 칸 한 곳뿐이고, 링크로 열어도(주소에 결과가 있어도) 목록을 읽는다', async () => {
  const boot = await read('src/boot.js');
  const ui = await read('src/ui.js');
  assert.match(boot, /아직 저장한 사람이 없어요/);
  assert.match(boot, /document\.addEventListener\('unse:profiles-changed'/);
  // 주소에 결과가 있든 없든 먼저 읽는다
  assert.ok(boot.indexOf('const savedReady = loadSaved();') < boot.indexOf('if (location.hash.length > 1)'));
  // 결과 칸의 '다른 사람 보기'는 위 칸과 합쳤다
  assert.doesNotMatch(ui, /profile-switch/);
});

test("저장한 사람 셀렉트에서 '직접 입력'을 고르면 그 사람 칸을 비운다", async () => {
  const boot = await read('src/boot.js');
  assert.match(boot, /if \(sel\.value === ''\) \{ clearPerson\(prefix\); return; \}/);
  assert.match(boot, /function clearPerson\(prefix\)/);
});
