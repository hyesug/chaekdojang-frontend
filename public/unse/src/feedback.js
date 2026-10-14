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
  clone.querySelectorAll('.fb, summary, .rp-card-h, button').forEach((x) => x.remove());
  // 칸 이름과 문장이 붙지 않게 덩어리마다 띄어 쓴다(예: '가장 강하게 나타나는 성향신중하고…')
  clone.querySelectorAll('p, li, b, h4, dt, dd, small, article, div').forEach((x) => x.append(' '));
  let t = clone.textContent.replace(/\s+/g, ' ').trim();
  for (const n of names.filter((x) => x && x.length >= 1)) t = t.split(n).join('○○');
  return t.slice(0, 600);
}

/**
 * 칸의 문장을 한 줄씩 — 👎를 누르면 다른 줄만 고르게 한다.
 * 칸 전체를 한 덩어리로 보내면 주간 자동 수정이 그 안의 문장마다 👎를 하나씩 세어,
 * 한 줄만 달라도 같은 칸 문장이 모두 고칠 후보 쪽으로 밀렸다(사용자 지적).
 */
export function linesOf(el, names = []) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll('.fb, summary, .rp-card-h, h4, button, .ai-follow').forEach((x) => x.remove());
  // AI 답변은 한 문단 안에서 <br>로 줄을 나눈다 — 줄바꿈으로 바꿔 둬야 줄이 붙지 않는다
  clone.querySelectorAll('br').forEach((x) => x.replaceWith('\n'));
  const leaves = [...clone.querySelectorAll('p, li, dd')].filter((x) => !x.querySelector('p, li, dd'));
  const out = [];
  for (const x of leaves) {
    let t = x.textContent;
    for (const n of names.filter((v) => v && v.length >= 1)) t = t.split(n).join('○○');
    for (const line of t.split(/\n+/)) {
      for (const s of line.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/)) {
        // 소제목("이렇게 봤어요")처럼 짧고 마침표 없는 줄은 고를 거리가 아니다
        if (s.length >= 6 && (/[.!?)]$|[요다]$/.test(s) || s.length >= 15) && !out.includes(s)) out.push(s);
      }
    }
  }
  return out.slice(0, 40);
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
        <fieldset class="fb-lines" hidden></fieldset>
        <input type="text" maxlength="300" placeholder="어디가 달랐나요? (선택)" aria-label="다른 점 한 줄">
        <button type="submit">보내기</button>
        <p class="fb-note">이름·연락처·생년월일은 적지 말아 주세요.</p>
      </form>`;
    (el.matches('.rp-ch') ? el.querySelector('.rp-ch-body') ?? el : el).appendChild(bar);

    const done = (msg) => { bar.innerHTML = `<span class="fb-done">${esc(msg)}</span>`; };
    let lines = [];
    // 👎는 고른 줄만 보낸다. '칸 전체가 달라요'를 고르거나 줄이 하나뿐이면 칸 전체를
    const payload = (verdict, comment = null, picked = null) =>
      ({ mode, section, verdict, snippet: picked ? picked.join(' ').slice(0, 600) : snippetOf(el, names), comment });
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
      lines = linesOf(el, names);
      const box = form.querySelector('.fb-lines');
      if (lines.length > 1) {
        box.innerHTML = '<legend>어느 줄이 달랐나요? 고른 줄만 고칩니다.</legend>'
          + lines.map((l, i) => `<label><input type="checkbox" value="${i}"> <span>${esc(l)}</span></label>`).join('')
          + '<label class="fb-all"><input type="checkbox" value="all"> <span>칸 전체가 달라요</span></label>';
        box.hidden = false;
        box.querySelector('input').focus();
      } else {
        form.querySelector('input[type="text"]').focus();
      }
    });
    bar.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = bar.querySelector('.fb-form input[type="text"]');
      const checked = [...bar.querySelectorAll('.fb-lines input:checked')].map((x) => x.value);
      let picked = null;
      if (lines.length > 1 && !checked.includes('all')) {
        if (!checked.length) {
          bar.querySelector('.fb-note').textContent = '다른 줄을 하나 이상 골라 주세요. 칸 전체가 다르면 맨 아래를 고르세요.';
          return;
        }
        picked = checked.map((i) => lines[Number(i)]).filter(Boolean);
      }
      try { await send(payload('down', input.value.trim() || null, picked)); done('알려 주셔서 고마워요. 고른 줄을 고치는 데 쓸게요.'); } catch { done('지금은 보내지 못했어요. 잠시 뒤 다시 눌러 주세요.'); }
    });
  }
}

/**
 * AI 답변 한 덩이에 붙이는 👍/👎 + 한 줄(선택).
 * 보내는 것은 'AI 답변 · 분야', 👍/👎, 답변 앞부분(이름을 지운 것), 한 줄뿐이다.
 * 질문 글·출생 정보·회원 식별자는 보내지 않는다 — 서버도 답변 발췌에서 연락처·날짜를 한 번 더 지운다.
 * @param {HTMLElement} bubble 답변 칸
 * @param {{topic?: string, names?: string[]}} opts topic 은 질문 분야(재물·직업…)
 */
export function attachAnswerFeedback(bubble, { topic = '', names = [] } = {}) {
  if (!bubble || bubble.querySelector('.fb')) return;
  const section = ('AI 답변' + (topic ? ` · ${topic}` : '')).slice(0, 80);
  const bar = document.createElement('div');
  bar.className = 'fb fb-ai';
  bar.innerHTML = `
    <span class="fb-q">이 답변, 도움이 됐나요?</span>
    <button type="button" data-fb="up" aria-label="좋아요">👍 좋아요</button>
    <button type="button" data-fb="down" aria-label="별로예요">👎 별로예요</button>
    <form class="fb-form" hidden>
      <fieldset class="fb-lines" hidden></fieldset>
      <input type="text" maxlength="300" placeholder="한 줄 의견 (선택)" aria-label="한 줄 의견">
      <button type="submit">보내기</button>
      <p class="fb-note">이름·연락처는 적지 말아 주세요.</p>
    </form>`;
  bubble.appendChild(bar);
  let verdict = null;
  let lines = [];
  const done = (msg) => { bar.innerHTML = `<span class="fb-done">${esc(msg)}</span>`; };
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fb]');
    if (!b) return;
    verdict = b.dataset.fb;
    bar.querySelectorAll('[data-fb]').forEach((x) => { x.disabled = true; x.classList.toggle('on', x === b); });
    const form = bar.querySelector('.fb-form');
    form.hidden = false;
    // 👎면 결과지와 같이 다른 줄만 고르게 한다 — 답 전체를 보내면 어느 문장이 틀렸는지 알 수 없다
    lines = verdict === 'down' ? linesOf(bubble, names) : [];
    const box = form.querySelector('.fb-lines');
    if (lines.length > 1) {
      box.innerHTML = '<legend>어느 줄이 달랐나요?</legend>'
        + lines.map((l, i) => `<label><input type="checkbox" value="${i}"> <span>${esc(l)}</span></label>`).join('')
        + '<label class="fb-all"><input type="checkbox" value="all"> <span>답 전체가 별로예요</span></label>';
      box.hidden = false;
      box.querySelector('input').focus();
    } else {
      form.querySelector('input[type="text"]').focus();
    }
  });
  bar.addEventListener('submit', async (e) => {
    e.preventDefault();
    const comment = bar.querySelector('.fb-form input[type="text"]').value.trim() || null;
    const checked = [...bar.querySelectorAll('.fb-lines input:checked')].map((x) => x.value);
    let picked = null;
    if (lines.length > 1 && !checked.includes('all')) {
      if (!checked.length) {
        bar.querySelector('.fb-note').textContent = '별로였던 줄을 하나 이상 골라 주세요. 답 전체가 별로면 맨 아래를 고르세요.';
        return;
      }
      picked = checked.map((i) => lines[Number(i)]).filter(Boolean);
    }
    try {
      await send({ mode: 'ai', section, verdict, snippet: picked ? picked.join(' ').slice(0, 600) : snippetOf(bubble, names), comment });
      done('고마워요! 답변을 더 낫게 만드는 데 쓸게요.');
    } catch { done('지금은 보내지 못했어요. 잠시 뒤 다시 눌러 주세요.'); }
  });
}
