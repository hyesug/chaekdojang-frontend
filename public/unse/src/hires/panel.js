/**
 * panel.js — 고해상도 계산을 화면에서 펼쳐 볼 수 있게 한다
 *
 * 일반 사용자는 결론만 보면 된다. 그래도 "왜 그렇게 나왔는지"를 보고 싶은
 * 사람이 반드시 있고, 그 사람이 실제 계산값까지 내려갈 수 있어야 한다.
 * 그래서 접어 두고, 펼칠 때 계산한다.
 *
 * 펼칠 때 계산하는 이유는 속도다. 세 분야 × 세 해를 돌리면 1초쯤 걸린다.
 * 화면이 처음 뜰 때 그걸 붙들고 있으면 결과가 그만큼 늦게 나온다.
 *
 * 화면에 쓰는 class 는 전부 기존 style.css 에 있는 것만 쓴다. 이 기능 때문에
 * 스타일시트를 건드리지 않는다.
 */

import { defaultPlan } from './router.js';
import { buildHiRes } from './context.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 화면에 먼저 깔아 두는 껍데기. 펼치기 전에는 비어 있다 */
export function hiresPanel() {
  return `
    <div class="section-label">계산 근거 펼쳐 보기</div>
    <div class="card">
      <p class="agree-note">
        아래는 이 명반을 달 단위까지 내려 계산한 것입니다. 결론만 보셔도 되고,
        펼치면 어느 체계가 무엇을 근거로 그렇게 보는지까지 확인할 수 있습니다.
        펼칠 때 계산하므로 잠깐 걸립니다.
      </p>
      <details class="why" id="hires-panel">
        <summary>고해상도 계산과 사건 추론 보기</summary>
        <div id="hires-body"><p class="agree-note">계산하는 중…</p></div>
      </details>
    </div>`;
}

/** 결과 화면이 그려진 뒤 붙인다 */
export function initHiResPanel(r, f) {
  const box = document.querySelector('#hires-panel');
  const body = document.querySelector('#hires-body');
  if (!box || !body) return;

  let done = false;
  box.addEventListener('toggle', () => {
    if (!box.open || done) return;
    done = true;
    // 펼치는 동작이 먼저 그려지게 한 박자 넘긴다
    setTimeout(() => {
      try {
        const plan = defaultPlan(r.input.currentYear);
        body.innerHTML = renderHiRes(buildHiRes(r, f, plan));
      } catch (e) {
        body.innerHTML = `<p class="agree-note">계산하지 못했습니다: ${esc(e.message)}</p>`;
      }
    }, 0);
  });
}

const sub = (title, html) => html
  ? `<details class="why"><summary>${esc(title)}</summary>${html}</details>`
  : '';

const say = (label, text) =>
  `<div class="say"><div class="say-name">${esc(label)}</div><p class="say-text">${esc(text)}</p></div>`;

function renderHiRes(h) {
  const parts = [];

  // [결론] — 분야마다 주 시나리오 한 줄
  parts.push(h.inferences.map((inf) => {
    const s = inf.scenarios.main;
    const w = inf.windows[0];
    return say(inf.domain,
      (s ? `${s.name} 쪽이 가장 두텁습니다. ` : '뚜렷한 사건 후보가 잡히지 않습니다. ') +
      (w ? `가장 강한 구간은 ${w.label}입니다.` : '이 기간에는 달 단위로 좁힐 근거가 부족합니다.') +
      ` (신뢰도 ${inf.confidence.grade})`);
  }).join(''));

  // [가장 강한 시기]
  parts.push(sub('가장 강한 시기', h.inferences.map((inf) => `
    <div class="ev">
      <span class="ev-dot ${inf.windows.length ? 'on' : ''}"></span>
      <div>
        <div class="ev-name">${esc(inf.domain)}</div>
        ${inf.windows.length
          ? inf.windows.map((w) => `<div class="ev-head">${esc(w.band)} · ${esc(w.label)} · 정점 ${esc(w.peak.label)}</div>
              <div class="ev-facts">${esc(w.phases.filter((p) => p.phase).map((p) => `${p.label}${p.phase}`).join(' → ') || '국면을 가를 근거 부족')}</div>`).join('')
          : '<div class="ev-head">두드러진 구간 없음</div>'}
      </div>
    </div>`).join('') +
    `<p class="agree-note">등급은 이 기간 안에서의 상대 순위입니다. 확률이 아닙니다.</p>`));

  // [예상 사건]
  parts.push(sub('예상 사건과 그 성격', h.inferences.map((inf) => `
    <div class="ev"><span class="ev-dot on"></span><div>
      <div class="ev-name">${esc(inf.domain)}</div>
      <div class="ev-head">${esc(inf.candidates.slice(0, 4).map((c) => c.name).join(' > '))}</div>
      <div class="ev-facts">${esc(inf.attributes.filter((a) => a.lean)
        .map((a) => `${a.key}=${a.lean}(${a.strength})`).join(' · ') || '성격까지 좁힐 근거 부족')}</div>
    </div></div>`).join('')));

  // [초구체화 추정]
  const loc = h.location;
  parts.push(sub('초구체화 추정 (지역·방향)', loc ? `
    ${say('방향 신호 (계산)', loc.directionSignals.join(' / '))}
    ${say('반복되는 방향', loc.repeatedDirection
      ? `${loc.repeatedDirection.dir} — ${loc.repeatedDirection.from.join(', ')}`
      : '없음. 방향을 하나로 좁힐 근거가 부족합니다.')}
    ${loc.candidates.length ? say('후보 생활권 (추정)', loc.candidates.join(' / ')) : ''}
    <p class="agree-note">${esc(loc.caveat)}</p>`
    : '<p class="agree-note">이 화면에서는 지역 계산을 돌리지 않았습니다. 지역을 물으면 그때 계산합니다.</p>'));

  // [체계별 근거]
  parts.push(sub('체계별 근거', h.inferences.map((inf) => `
    <div class="ev"><span class="ev-dot on"></span><div>
      <div class="ev-name">${esc(inf.domain)} — 지지한 체계 ${esc(inf.activeSystems.join('·') || '없음')}</div>
      ${inf.windows.slice(0, 2).map((w) => `
        <div class="ev-head">${esc(w.label)}</div>
        <div class="ev-facts">${esc(w.reasons.map((x) => `${x.system}: ${x.why}`).join(' / '))}</div>`).join('')}
    </div></div>`).join('')));

  // [상충되는 근거]
  const conflicts = h.inferences.flatMap((inf) => inf.conflicts.map((c) => `${inf.domain} — ${c}`));
  parts.push(sub('상충되는 근거', conflicts.length
    ? conflicts.map((c) => `<p class="say-text">${esc(c)}</p>`).join('')
    : '<p class="agree-note">핵심 체계가 정면으로 갈리는 지점은 잡히지 않았습니다.</p>'));

  // [사건 선후]
  if (h.chain.order) {
    parts.push(sub('사건 선후', say('순서', h.chain.order) +
      (h.chain.notes.length ? `<p class="agree-note">${esc(h.chain.notes.join(' · '))}</p>` : '')));
  }

  // [계산 데이터] — 원본 그대로
  parts.push(sub('계산 데이터 (원본)',
    `<pre style="white-space:pre-wrap;font-size:12px;line-height:1.5;overflow-x:auto">${esc(h.text)}</pre>`));

  return parts.join('');
}
