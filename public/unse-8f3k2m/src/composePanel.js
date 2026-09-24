/**
 * composePanel.js — **칸마다 누가 무슨 말을 했는지 펼쳐 보는 화면**
 *
 * '앞일 묻기'(`scenarioPanel.js`)는 질문 하나에 답한다. 여기는 질문 없이
 * **지금 이 사람이 어떤 사람인가**를 칸으로 나눠 보여 준다.
 *
 * ── 왜 합치지 않고 나란히 두는가 ───────────────────────────
 * 이 저장소는 열다섯 체계를 합치는 길을 네 번 시도해 네 번 실패했다
 * (평균·축별 가중치·체계별 가중치·주제별 선택). 그러다 드러난 것은
 * **체계들이 경쟁하지 않는다**는 사실이었다. 한 사람에게 일에 대해 여섯이
 * 서로 다른 말을 했는데 여섯이 다 맞았다 — 서로 다른 칸에 답하고 있었다.
 *
 * 그래서 여기서는 고르지도 평균 내지도 않는다. 칸을 나누고, 그 칸을 보는
 * 체계의 말을 **누가 한 말인지 붙여서** 나란히 둔다. 엇갈리면 엇갈린다고
 * 적고, 아무도 말하지 않는 칸은 비워 둔 채로 비었다고 말한다.
 *
 * ── 무겁다 ─────────────────────────────────────────────────
 * 열다섯 체계를 다시 세운다. `ui.js` 는 이 파일을 정적으로 import 하지
 * 않는다 — 누를 때 `import()` 로 받는다.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 굵게 표시한 자리(`**…**`)만 살려서 그린다 */
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

const DOMAINS = [
  ['career', '일'],
  ['wealth', '돈'],
  ['relationship', '관계'],
];

export function panelHtml() {
  return `
    <div class="card compose">
      <div class="cmp-tabs">
        ${DOMAINS.map(([k, label], i) =>
    `<button type="button" data-cmp="${k}"${i === 0 ? ' class="on"' : ''}>${esc(label)}</button>`).join('')}
      </div>
      <div id="cmp-out" class="cmp-out"></div>
      <p class="ai-note">
        칸마다 <b>그 자리를 보는 체계의 말을 나란히</b> 둔 것입니다. 합치거나 고르지 않습니다 —
        한 칸에 여럿이 들어오면 둘 다 맞을 수 있기 때문입니다.
        말이 엇갈리는 자리는 엇갈린다고 적고, 아무도 말하지 않는 칸은 비워 둡니다.
      </p>
    </div>`;
}

/** 칸 하나 */
function slotHtml(sec) {
  if (sec.empty) {
    return `
      <div class="cmp-slot cmp-slot-empty">
        <div class="cmp-h">${esc(sec.label)}<span>${esc(sec.ask ?? '')}</span></div>
        <p class="scen-empty">${esc(sec.text)}</p>
      </div>`;
  }
  return `
    <div class="cmp-slot">
      <div class="cmp-h">${esc(sec.label)}<span>${esc(sec.ask ?? '')}</span></div>
      ${sec.voices.map((v) => `
        <div class="cmp-v">
          <div class="cmp-who">${esc(v.system)}<em>${esc(v.what)}</em></div>
          <p>${rich(v.lines.join(' '))}</p>
        </div>`).join('')}
      ${sec.tension ? `<p class="cmp-tension">${esc(sec.tension)}</p>` : ''}
      ${sec.source ? `<details class="cmp-src"><summary>어디를 보고 정한 칸인가</summary>
        <p>${esc(sec.source)}</p></details>` : ''}
    </div>`;
}

/**
 * 패널을 켠다.
 *
 * @param {HTMLElement} root 패널이 들어 있는 칸
 * @param {object} birth     출생 정보
 */
export async function initCompose(root, birth) {
  const out = root.querySelector('#cmp-out');
  if (!out) return;

  out.innerHTML = '<p class="scen-empty">열다섯 체계를 세우는 중입니다…</p>';
  await new Promise((r) => setTimeout(r, 0));   // '세우는 중'이 실제로 보이게

  let cache = null;
  try {
    const [core, ST, C, N] = await Promise.all([
      import('./semantic/index.js'),
      import('./semantic/structure/saju.js'),
      import('./semantic/compose/slots.js'),
      import('./semantic/compose/narrate.js'),
    ]);
    const { fortune } = core.natalFortune(birth);
    // 사주 구조(격)는 성별에 따라 짝별이 달라진다 — 명반에 성별이 없어 넣어 준다
    const structures = ST.readStructures(
      { ...fortune.chart, gender: birth.gender },
    ).structures;
    cache = {};
    for (const [k] of DOMAINS) {
      cache[k] = N.narrateSlots(C.fillSlots(fortune, structures, k)).sections;
    }
  } catch (err) {
    out.innerHTML = `<p class="scen-empty">세우지 못했습니다. (${esc(err?.message ?? err)})</p>`;
    return;
  }

  const draw = (key) => { out.innerHTML = cache[key].map(slotHtml).join(''); };
  draw(DOMAINS[0][0]);

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cmp]');
    if (!b) return;
    for (const x of root.querySelectorAll('button[data-cmp]')) x.classList.toggle('on', x === b);
    draw(b.dataset.cmp);
  });
}
