/**
 * scenarioPanel.js — **질문 하나에 계산으로 답하는 화면**
 *
 * AI 탭과 다른 자리다. AI 탭은 계산 결과를 통째로 넘겨 모델이 글을 쓰고,
 * 여기는 **모델 없이** 시나리오 층이 만든 답을 그대로 보여 준다. 같은
 * 질문에 늘 같은 답이 나오고, 문장마다 어느 근거에서 나왔는지 펼쳐 볼 수 있다.
 *
 * ── 무겁다. 그래서 늦게 받는다 ─────────────────────────────
 * 시나리오 층은 명반을 여러 해치 다시 세운다(1~2초). 첫 화면에 끼우면
 * 안 되고, 이 탭을 처음 열 때 `import()` 로 받아 온다. `ui.js` 는 이
 * 파일을 정적으로 import 하지 않는다 — 그러면 떼어 낸 뜻이 없다.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 눌러서 물을 수 있는 것들 — 분야가 골고루 닿게 */
export const PRESETS = [
  ['언제 이직해?', 'career'],
  ['지금 회사 오래 다닐까?', 'career'],
  ['결혼은 언제 할까?', 'marriage'],
  ['이사는 언제쯤?', 'movement'],
  ['돈은 언제 풀릴까?', 'wealth'],
  ['시험·자격은 어때?', 'education'],
  ['건강은 어때?', 'health'],
];

/** 왜 그렇게 봤는지 물을 수 있는 자리 */
const WHY = [
  ['why_event', '왜 그 사건인가'],
  ['why_timing', '왜 그 시기인가'],
  ['why_direction', '왜 그 방향인가'],
  ['why_not_narrower', '왜 더 못 좁히는가'],
];

/**
 * 알려 주면 답이 달라지는 것들.
 *
 * **이건 운세가 맞힌 것이 아니라 사용자가 말해 준 것이다.** 그래서
 * `contextAnchor` 로 따로 들어가고, 답에도 "알려주신 사실"이라고 적힌다.
 * 비워 두면 추측하지 않는다 — 모르는 채로 답이 굵어질 뿐이다.
 */
const FIELDS = [
  { k: 'occupation', label: '지금 하는 일', type: 'text', ph: '예: 백엔드 개발자' },
  { k: 'employmentType', label: '고용 형태', type: 'select', opts: [
    ['', '모름/안 밝힘'], ['employed', '회사에 소속'], ['none', '일을 쉬는 중'],
    ['freelance', '프리랜서'], ['business', '자기 사업'],
  ] },
  { k: 'region', label: '사는 곳', type: 'text', ph: '예: 대전 유성구' },
  { k: 'relationshipStatus', label: '관계', type: 'select', opts: [
    ['', '모름/안 밝힘'], ['single', '혼자'], ['dating', '사귀는 사람 있음'],
    ['cohabiting', '함께 삶'], ['married', '기혼'], ['separated', '별거·이혼'],
  ] },
  { k: 'hasChildren', label: '자녀', type: 'select', opts: [
    ['', '모름/안 밝힘'], ['true', '있음'], ['false', '없음'],
  ] },
];

const fieldHtml = (f) => `
  <label class="scen-f">
    <span>${esc(f.label)}</span>
    ${f.type === 'text'
    ? `<input type="text" data-ctx="${f.k}" placeholder="${esc(f.ph ?? '')}">`
    : `<select data-ctx="${f.k}">${f.opts
      .map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select>`}
  </label>`;

export function panelHtml() {
  return `
    <div class="card scenario">
      <details class="scen-ctx">
        <summary>지금 상황을 알려주면 더 좁혀서 답합니다 (선택)</summary>
        <div class="scen-fields">${FIELDS.map(fieldHtml).join('')}</div>
        <p class="scen-ctx-note">
          여기 적은 것은 <b>알려주신 사실</b>로만 씁니다. 운세가 맞힌 것처럼 쓰지 않고,
          답에도 그렇게 적힙니다. 비워 두면 추측하지 않습니다.
        </p>
      </details>
      <div class="scen-quick">
        ${PRESETS.map(([q], i) => `<button type="button" data-sq="${i}">${esc(q)}</button>`).join('')}
      </div>
      <div class="ai-input">
        <textarea id="scen-q" rows="2" placeholder="언제 이직해? / 결혼은 언제 할까? (Ctrl+Enter 로 보기)"></textarea>
        <button type="button" id="scen-go">보기</button>
      </div>
      <div id="scen-out" class="scen-out"></div>
      <p class="ai-note">
        여기 답은 <b>모델이 쓴 글이 아니라 계산 결과를 그대로 옮긴 것</b>입니다.
        같은 질문에는 늘 같은 답이 나오고, 근거가 끊기는 자리에서 말을 멈춥니다.
        점수는 확률이 아니라 그 사람의 그 기간 안에서의 자리입니다.
      </p>
    </div>`;
}

/** 답 한 덩이를 그린다 */
function render(out, narration, scenario) {
  if (!narration) { out.innerHTML = '<p class="scen-empty">답을 만들지 못했습니다.</p>'; return; }

  const paras = String(narration.text ?? '').split('\n\n').filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`).join('');

  const conf = scenario?.primary?.confidence ?? null;
  const KO = { high: '두터움', medium_high: '보통 이상', medium: '보통', low: '얇음', insufficient: '근거 없음' };
  const NAME = { event: '사건', timing: '시기', direction: '방향', role: '역할', location: '지역', district: '구·동' };
  const confRow = conf
    ? `<div class="scen-conf">${['event', 'timing', 'direction', 'role', 'location', 'district']
      .map((k) => `<span><b>${NAME[k]}</b> ${esc(KO[conf[k]] ?? conf[k])}</span>`).join('')}</div>`
    : '';

  out.innerHTML = `
    <div class="scen-answer">${paras}</div>
    ${confRow}
    <div class="scen-why">
      ${WHY.map(([k, label]) => `<button type="button" data-why="${k}">${esc(label)}</button>`).join('')}
    </div>
    <div id="scen-why-out" class="scen-why-out"></div>`;
}

/** "왜?" 를 눌렀을 때 — 그 자리의 근거만 */
function renderWhy(box, picked) {
  if (!picked || (!picked.items?.length && !picked.blocked?.length)) {
    box.innerHTML = `<p class="scen-empty">${esc(picked?.note ?? '그 자리에는 댈 근거가 없습니다.')}</p>`;
    return;
  }
  const SRC = { fortune: '명반', context: '알려주신 것', reality: '실제 자료', derived: '위에서 끌어낸 것' };
  const groups = Object.entries(picked.bySource ?? {})
    .filter(([, v]) => v.length)
    .map(([k, v]) => `
      <div class="scen-src">
        <div class="scen-src-h">${esc(SRC[k] ?? k)}</div>
        <ul>${v.map((x) => `<li>${esc(x.claim)}${
  x.systems?.length ? `<span class="scen-sys">${esc(x.systems.map((s) => s.what).join(' · '))}</span>` : ''
}</li>`).join('')}</ul>
      </div>`).join('');
  const blocked = picked.blocked?.length
    ? `<div class="scen-src"><div class="scen-src-h">여기서 멈춘 까닭</div>
       <ul>${picked.blocked.map((b) => `<li>${esc(b.reason)}</li>`).join('')}</ul></div>`
    : '';
  box.innerHTML = groups + blocked
    + (picked.note ? `<p class="scen-empty">${esc(picked.note)}</p>` : '');
}

/**
 * 패널을 켠다.
 *
 * @param {HTMLElement} root 패널이 들어 있는 칸
 * @param {object} birth     출생 정보 (`readFortune` 과 같은 모양)
 */
/** 화면에서 적은 것을 시나리오 층이 읽는 모양으로 */
function readContext(root) {
  const v = {};
  for (const el of root.querySelectorAll('[data-ctx]')) {
    const raw = String(el.value ?? '').trim();
    if (!raw) continue;
    v[el.dataset.ctx] = raw;
  }
  const currentState = {};
  if (v.occupation) currentState.occupation = v.occupation;
  if (v.employmentType) currentState.employmentType = v.employmentType;
  if (v.relationshipStatus) {
    currentState.relationshipStatus = v.relationshipStatus;
    // 기혼·별거는 결혼 상태로도 읽힌다 (상태 기계가 갈 수 없는 길을 지운다)
    if (v.relationshipStatus === 'married') currentState.maritalStatus = 'married';
    if (v.relationshipStatus === 'separated') currentState.maritalStatus = 'separated';
  }
  if (v.hasChildren) currentState.hasChildren = v.hasChildren === 'true';
  return {
    currentState: Object.keys(currentState).length ? currentState : null,
    // 지역은 **사용자가 말해 준 것**이라 운세 근거로 올라가지 않는다
    contextLocation: v.region || null,
  };
}

export async function initScenario(root, birth) {
  const out = root.querySelector('#scen-out');
  const box = root.querySelector('#scen-q');
  if (!out || !box) return;

  // 무거운 층은 여기서 처음 받는다
  const S = await import('./semantic/scenario/index.js');
  let last = null;

  const ask = async (text) => {
    const q = String(text ?? '').trim();
    if (!q) return;
    out.innerHTML = '<p class="scen-empty">계산하는 중입니다…</p>';
    // 그리기를 한 번 넘겨 '계산 중'이 실제로 보이게 한다
    await new Promise((r) => setTimeout(r, 0));
    try {
      const y = new Date().getFullYear();
      const ctx = readContext(root);
      const r = S.answerScenario({
        birth, question: q,
        from: `${y}-01`, to: `${y + 3}-12`,
        supporting: true,
        currentState: ctx.currentState,
        contextLocation: ctx.contextLocation,
        narrate: { detail: 'normal' },
      });
      last = r;
      render(out, r.narration, r.scenario);
    } catch (err) {
      out.innerHTML = `<p class="scen-empty">계산하지 못했습니다. (${esc(err?.message ?? err)})</p>`;
    }
  };

  root.addEventListener('click', (e) => {
    const q = e.target.closest('button[data-sq]');
    if (q) { box.value = PRESETS[Number(q.dataset.sq)][0]; ask(box.value); return; }
    if (e.target.closest('#scen-go')) { ask(box.value); return; }
    const why = e.target.closest('button[data-why]');
    if (why && last) {
      const w = root.querySelector('#scen-why-out');
      renderWhy(w, S.selectEvidence({ scenario: last.scenario, questionType: why.dataset.why }));
    }
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ask(box.value);
  });
}
