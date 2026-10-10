/**
 * feedback.js — 결과 칸마다 "이 내용, 맞나요? 👍 / 👎" + (👎이면) 한 줄 입력.
 *
 * 누구나 남길 수 있다(로그인 불필요). 보내는 것은 칸 이름 · 그 칸의 문장(이름을 지운 것) · 👍/👎 · 한 줄뿐이고
 * 생년월일·시각·이름은 보내지 않는다. 서버(POST /api/fortune/feedback)도 한 줄에서 연락처·출생일처럼
 * 보이는 것을 한 번 더 지운다. AI 호출은 없다.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 피드백을 붙일 칸 — 요약·발견·리포트 카드와 접힌 장. 책·공유·AI 칸은 뺀다 */
const TARGETS = '.rp > .rp-card:not(.rp-books-card), #result > .rp-card, .rp-ch';

/** 칸 이름 — 제목에서 이모지와 번호를 뺀다 */
function sectionName(el) {
  const h = el.matches('.rp-ch') ? el.querySelector('.rp-ch-t') : el.querySelector('.rp-card-h');
  const t = (h?.childNodes ? [...h.childNodes].filter((n) => n.nodeType === 3 || !n.matches?.('small,[aria-hidden]')).map((n) => n.textContent).join('') : h?.textContent) ?? '';
  return t.replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** 칸에 보였던 문장 — 이름은 지운다 */
export function snippetOf(el, names = []) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll('.fb, summary, .rp-card-h').forEach((x) => x.remove());
  let t = clone.textContent.replace(/\s+/g, ' ').trim();
  for (const n of names.filter((x) => x && x.length >= 1)) t = t.split(n).join('○○');
  return t.slice(0, 600);
}

async function send(payload) {
  const res = await fetch('/api/fortune/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(String(res.status));
}

/**
 * @param {HTMLElement} root 결과 영역
 * @param {{mode: 'solo'|'pair', names?: string[]}} opts
 */
export function attachFeedback(root, { mode, names = [] }) {
  for (const el of root.querySelectorAll(TARGETS)) {
    if (el.querySelector(':scope > .fb, :scope > .rp-ch-body > .fb')) continue;
    const section = sectionName(el);
    if (!section) continue;
    const bar = document.createElement('div');
    bar.className = 'fb';
    bar.innerHTML = `
      <span class="fb-q">이 내용, 맞나요?</span>
      <button type="button" data-fb="up" aria-label="맞아요">👍 맞아요</button>
      <button type="button" data-fb="down" aria-label="아니에요">👎 아니에요</button>
      <form class="fb-form" hidden>
        <input type="text" maxlength="300" placeholder="어디가 달랐나요? (선택)" aria-label="다른 점 한 줄">
        <button type="submit">보내기</button>
        <p class="fb-note">이름·연락처·생년월일은 적지 말아 주세요.</p>
      </form>`;
    (el.matches('.rp-ch') ? el.querySelector('.rp-ch-body') ?? el : el).appendChild(bar);

    const done = (msg) => { bar.innerHTML = `<span class="fb-done">${esc(msg)}</span>`; };
    const payload = (verdict, comment = null) => ({ mode, section, verdict, snippet: snippetOf(el, names), comment });
    bar.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-fb]');
      if (!b) return;
      if (b.dataset.fb === 'up') {
        try { await send(payload('up')); done('고마워요! 더 정확해지는 데 쓸게요.'); } catch { done('지금은 보내지 못했어요. 잠시 뒤 다시 눌러 주세요.'); }
        return;
      }
      const form = bar.querySelector('.fb-form');
      form.hidden = false;
      bar.querySelectorAll('[data-fb]').forEach((x) => { x.disabled = true; });
      form.querySelector('input').focus();
    });
    bar.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = bar.querySelector('.fb-form input');
      try { await send(payload('down', input.value.trim() || null)); done('알려 주셔서 고마워요. 해석을 고치는 데 쓸게요.'); } catch { done('지금은 보내지 못했어요. 잠시 뒤 다시 눌러 주세요.'); }
    });
  }
}
