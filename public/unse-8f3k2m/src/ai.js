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

import { buildContext, READING_PROMPT, buildCompatContext, COMPAT_PROMPT } from './aiContext.js';

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

const SOLO_QUICK = [
  ['전체 풀이', READING_PROMPT],
  ['올해 어떤가요?', '올해 전체 흐름이 어떤지, 특히 몇 월을 눈여겨보면 좋을지 알려주세요.'],
  ['지금 이직해도 될까요?', '지금 시기에 직장을 옮기는 것에 대해 명반이 뭐라고 하는지 봐주세요.'],
  ['재물운', '재물의 흐름이 어떤지, 언제 조심해야 하는지 봐주세요.'],
  ['인연', '인연과 관계에 대해 봐주세요. 지금 시기는 어떤지도요.'],
  ['건강', '몸에서 먼저 신호가 오는 곳과, 지금 조심할 것을 알려주세요.'],
];

const PAIR_QUICK = [
  ['전체 풀이', COMPAT_PROMPT],
  ['어디서 부딪칠까요?', '두 사람이 부딪치기 쉬운 지점과, 그럴 때 무엇을 하면 되는지 알려주세요.'],
  ['오래 갈까요?', '이 관계가 시간이 지나면 어떻게 변해갈지 명반을 근거로 봐주세요.'],
  ['서로 뭘 채워주나요?', '한쪽에 없는 것을 다른 쪽이 가지고 있는 부분을 짚어 주세요.'],
  ['일로 만나면', '연애가 아니라 동업이나 같이 일하는 사이라면 어떤지 봐주세요.'],
  ['갈리는 지점', '열다섯 체계 가운데 판단이 엇갈리는 곳은 어디이고, 왜 그런지 설명해 주세요.'],
];

/** 지금 화면에 걸린 빠른 질문 목록 */
let quick = SOLO_QUICK;

export function aiSection(mode = 'solo') {
  quick = mode === 'pair' ? PAIR_QUICK : SOLO_QUICK;
  return `
    <div class="section-label">AI 에게 묻기</div>
    <div class="card ai">
      <div class="ai-quick">
        ${quick.map((q, i) => `<button type="button" data-q="${i}">${esc(q[0])}</button>`).join('')}
      </div>
      <div id="ai-log" class="ai-log"></div>
      <div class="ai-input">
        <textarea id="ai-q" rows="2" placeholder="궁금한 걸 물어보세요 (Ctrl+Enter 로 보내기)"></textarea>
        <button type="button" id="ai-send">보내기</button>
      </div>
      <p class="ai-note" id="ai-note">
        위의 열다섯 체계 계산 결과를 그대로 넘겨서 묻습니다.
        간지·절기는 이미 계산된 값을 쓰므로 AI 가 ${mode === 'pair' ? '두 사람 사주를' : '사주를'} 다시 셈하지 않습니다.
      </p>
    </div>`;
}

/** 결과 화면이 그려진 뒤 호출한다 */
export function initAI(form, fortune, forecast) {
  wire(buildContext(form, fortune, forecast));
}

/** 궁합 화면용. 두 사람 명반을 통째로 싣는다 */
export function initCompatAI(formA, formB, compat) {
  wire(buildCompatContext(formA, formB, compat));
}

/** 화면이 그려진 뒤 입력칸과 버튼을 붙인다. 개인·궁합이 같은 배선을 쓴다 */
function wire(context) {
  session = { context, messages: [], busy: false };

  const log = document.querySelector('#ai-log');
  const box = document.querySelector('#ai-q');
  const send = document.querySelector('#ai-send');
  if (!log) return;

  document.querySelectorAll('.ai-quick button').forEach((b) => {
    b.addEventListener('click', () => ask(quick[+b.dataset.q][1]));
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
        `직전 질문 — 입력 ${u.input.toLocaleString()} · 출력 ${u.output.toLocaleString()}` +
        // 캐시에 쓴 양을 빼놓으면 숫자가 안 맞아 보인다. 첫 질문은 입력이
        // 몇십 토큰인데도 명반 몇천 자를 캐시에 얹느라 값이 붙는다.
        (u.cacheWrite ? ` · 캐시에 올림 ${u.cacheWrite.toLocaleString()}` : '') +
        (u.cacheRead ? ` · 캐시에서 읽음 ${u.cacheRead.toLocaleString()}` : '') +
        ` 토큰 · 약 $${usd.toFixed(4)}<br>` +
        (u.cacheRead
          ? '명반을 캐시에서 읽어 입력 비용이 10분의 1로 줄었습니다.'
          : '이번엔 명반을 캐시에 올리느라 값이 붙었습니다. 다음 질문부터 크게 줄어듭니다.');
    }
  }
}
