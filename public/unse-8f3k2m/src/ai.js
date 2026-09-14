/**
 * ai.js — Claude 에게 묻기
 *
 * 계산은 엔진이 이미 끝냈다. 여기서는 그 결과를 프롬프트에 실어 보내고
 * 돌아오는 글자를 화면에 흘린다.
 *
 * API 키는 브라우저에 둘 수 없으므로 같은 도메인의 /fortune-ai 를 거친다.
 * (Next.js 라우트 핸들러. /api 아래에 두지 않은 이유는 그쪽이 자바 백엔드로
 *  넘어가기 때문이다.)
 */

import { buildContext, READING_PROMPT } from './aiContext.js';

const ENDPOINT = '/fortune-ai';

/** 대화 상태. 한 사람의 명반에 대해 계속 이어서 묻는다 */
let session = null;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 문단을 최소한으로만 꾸민다. 마크다운 전체를 지원하지는 않는다 */
function renderText(t) {
  return esc(t)
    .replace(/^### (.+)$/gm, '<h5>$1</h5>')
    .replace(/^## (.+)$/gm, '<h4>$1</h4>')
    .replace(/^# (.+)$/gm, '<h4>$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

const QUICK = [
  ['전체 풀이', READING_PROMPT],
  ['올해 어떤가요?', '올해 전체 흐름이 어떤지, 특히 몇 월을 눈여겨보면 좋을지 알려주세요.'],
  ['지금 이직해도 될까요?', '지금 시기에 직장을 옮기는 것에 대해 명반이 뭐라고 하는지 봐주세요.'],
  ['재물운', '재물의 흐름이 어떤지, 언제 조심해야 하는지 봐주세요.'],
  ['인연', '인연과 관계에 대해 봐주세요. 지금 시기는 어떤지도요.'],
  ['건강', '몸에서 먼저 신호가 오는 곳과, 지금 조심할 것을 알려주세요.'],
];

export function aiSection() {
  return `
    <div class="section-label">AI 에게 묻기</div>
    <div class="card ai">
      <div class="ai-quick">
        ${QUICK.map((q, i) => `<button type="button" data-q="${i}">${esc(q[0])}</button>`).join('')}
      </div>
      <div id="ai-log" class="ai-log"></div>
      <div class="ai-input">
        <textarea id="ai-q" rows="2" placeholder="궁금한 걸 물어보세요 (Ctrl+Enter 로 보내기)"></textarea>
        <button type="button" id="ai-send">보내기</button>
      </div>
      <p class="ai-note" id="ai-note">
        로그인 사용자에게 매달 5번 제공됩니다. 이름·생년월일·장소는 빼고 계산된 결과와 질문만 Claude에 보냅니다.
        어렵지 않은 상담 말투로, 지금 나에게 필요한 이야기를 들려드립니다.
      </p>
    </div>`;
}

/** 결과 화면이 그려진 뒤 호출한다 */
export function initAI(form, fortune, forecast) {
  session = {
    context: buildContext(form, fortune, forecast),
    messages: [],
    busy: false,
  };

  const log = document.querySelector('#ai-log');
  const box = document.querySelector('#ai-q');
  const send = document.querySelector('#ai-send');
  if (!log) return;

  document.querySelectorAll('.ai-quick button').forEach((b) => {
    b.addEventListener('click', () => ask(QUICK[+b.dataset.q][1]));
  });
  send.addEventListener('click', () => {
    const v = box.value.trim();
    if (v) { box.value = ''; ask(v); }
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send.click();
  });

  async function ask(question) {
    if (session.busy) return;
    session.busy = true;
    send.disabled = true;

    log.insertAdjacentHTML('beforeend',
      `<div class="ai-turn me"><p>${esc(question)}</p></div>`);
    const bubble = document.createElement('div');
    bubble.className = 'ai-turn bot';
    bubble.innerHTML = '<p class="ai-wait">생각하는 중…</p>';
    log.appendChild(bubble);
    bubble.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    session.messages.push({ role: 'user', content: question });
    let acc = '';

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: session.context, messages: session.messages }),
      });

      if (!res.ok || !res.body) {
        let msg = `서버가 ${res.status} 를 돌려주었습니다.`;
        try { msg = (await res.json()).error ?? msg; } catch { /* 본문이 JSON 이 아닐 수 있다 */ }
        throw new Error(msg);
      }

      // 줄 단위 JSON 을 흘려 받는다
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const ln of lines) {
          if (!ln.trim()) continue;
          let ev;
          try { ev = JSON.parse(ln); } catch { continue; }
          if (ev.t) {
            acc += ev.t;
            bubble.innerHTML = `<p>${renderText(acc)}</p>`;
            bubble.scrollIntoView({ block: 'nearest' });
          } else if (ev.error) {
            throw new Error(ev.error);
          } else if (ev.done) {
            showUsage(ev.usage);
          }
        }
      }

      if (!acc) throw new Error('빈 응답이 돌아왔습니다.');
      session.messages.push({ role: 'assistant', content: acc });
    } catch (err) {
      bubble.innerHTML = `<p class="ai-err">${esc(err.message)}</p>`;
      // 실패한 질문은 기록에서 빼둔다. 다음 질문에 딸려 올라가지 않도록.
      session.messages.pop();
    } finally {
      session.busy = false;
      send.disabled = false;
    }
  }

  function showUsage(u) {
    if (!u) return;
    // Opus 5 기준 입력 $5 / 출력 $25 per MTok. 캐시 읽기는 입력의 1/10로 잡는다.
    const usd = (u.input * 5 + u.output * 25 + u.cacheRead * 0.5 + u.cacheWrite * 6.25) / 1e6;
    const note = document.querySelector('#ai-note');
    if (note) {
      note.innerHTML =
        `직전 질문 — 입력 ${u.input.toLocaleString()} · 출력 ${u.output.toLocaleString()} 토큰` +
        (u.cacheRead ? ` · 캐시에서 읽음 ${u.cacheRead.toLocaleString()}` : '') +
        ` · 약 $${usd.toFixed(4)}<br>` +
        (Number.isInteger(u.remaining) ? `이번 달 ${u.remaining}회 남음 · ` : '') +
        '명반은 캐시에 얹혀 있어 두 번째 질문부터 입력 비용이 줄어듭니다.';
    }
  }
}
