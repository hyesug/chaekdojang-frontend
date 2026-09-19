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
import { readForecast } from './forecast.js';
import { routeQuestion } from './hires/router.js';
import { buildHiRes } from './hires/context.js';

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

/**
 * 개인 화면의 빠른 질문.
 *
 * 고정 목록만 두면 화면에 무엇이 나왔든 같은 것을 묻게 된다. 결과에서
 * 실제로 두드러진 것 - 가장 세게 켜진 주제, 갈린 지점, 인연이 걸린 해 -
 * 를 질문으로 만들어 앞에 둔다. 아래 기본 목록은 그 뒤에 붙는다.
 */
const SOLO_BASE = [
  ['전체 풀이', READING_PROMPT],
  ['과거 맞춰보기', '지난 십 년을 한 해씩 짚어서, 그 해에 어떤 일이 있었을지 구체적으로 말해주세요. 이직·이별·이사·시험·돈 문제처럼 사람들이 실제로 겪는 일로 짚어주시고, 제가 맞는지 확인할 수 있게 해마다 한두 줄로 써주세요.'],
  ['날 잡기', '앞으로 넉 달 안에서 계약·면접·이사·수술처럼 중요한 일을 하기 좋은 날을 실제 날짜로 골라주세요. 무슨 일이냐에 따라 맞는 날이 다르면 그것도 나눠서 알려주시고, 피해야 할 날도 함께 짚어주세요.'],
  ['건강', '올해 몸과 생활 리듬에서 조심할 시기와, 무리하지 않고 흐름을 지키는 방법을 알려주세요.'],
];

/** 결과에서 뽑아낸 질문 */
function suggestedQuick(v) {
  if (!v) return SOLO_BASE;
  const out = [];
  const top = v.hero?.themes?.[0];
  if (top && top.on >= 2) {
    out.push([`${top.label} 신호가 강한 이유`,
      `올해 제 명반에서 ${top.label} 쪽 신호가 네 체계 중 ${top.on}개에서 같이 잡혔다고 나옵니다. ` +
      `어느 체계가 무엇을 근거로 그렇게 보는지, 그리고 그것이 현실에서 어떤 형태로 나타날 수 있는지 알려주세요. 특정 사건으로 단정하지는 말아주세요.`]);
  }
  if (v.twist) {
    out.push(['체계가 갈리는 지점',
      '제 명반에서 체계마다 판단이 갈리는 지점이 있다고 나옵니다. 어느 체계가 어떻게 다르게 보는지, 그리고 그 둘을 같이 놓으면 무엇이 남는지 정리해주세요.']);
  }
  if (v.highlights?.length) {
    out.push(['내 명반의 특이점',
      `제 명반에서 눈에 띈다고 나온 것이 ${v.highlights.map((h) => h.tag).join(', ')} 입니다. ` +
      '각각이 무슨 뜻인지, 그리고 이것들이 서로 어떻게 맞물리는지 다시 설명해주세요.']);
  }
  if (v.ahead?.bond?.length) {
    out.push(['관계 신호가 강한 해',
      `${v.ahead.bond.join(', ')}년에 관계 신호가 강하다고 나옵니다. 각 해가 어떻게 다른지, ` +
      '그리고 결혼·동거·계약처럼 어떤 형태가 가능한지 짚어주세요. 하나로 단정하지는 말아주세요.']);
  }
  out.push(['돈 버는 방식',
    '제 명반에서 돈이 들어오는 경로가 어느 쪽인지, 어떤 일 구조에서 수입이 붙는지 알려주세요.']);
  return [...out, ...SOLO_BASE];
}

const PAIR_QUICK = [
  ['전체 풀이', COMPAT_PROMPT],
  ['어디서 부딪칠까요?', '두 사람이 부딪치기 쉬운 지점과, 그럴 때 무엇을 하면 되는지 알려주세요.'],
  ['오래 갈까요?', '이 관계가 시간이 지나면 어떻게 변해갈지 명반을 근거로 봐주세요.'],
  ['결혼 날짜', '두 사람의 흐름을 함께 보고 결혼을 준비하기 좋은 달과 예식에 맞는 실제 날짜를 골라주세요. 피해야 할 날도 알려주세요.'],
  ['서로 뭘 채워주나요?', '한쪽에 없는 것을 다른 쪽이 가지고 있는 부분을 짚어 주세요.'],
  ['일로 만나면', '연애가 아니라 동업이나 같이 일하는 사이라면 어떤지 봐주세요.'],
  ['갈리는 지점', '열다섯 체계 가운데 판단이 엇갈리는 곳은 어디이고, 왜 그런지 설명해 주세요.'],
];

/** 지금 화면에 걸린 빠른 질문 목록 */
let quick = SOLO_BASE;

export function aiSection(mode = 'solo', view = null) {
  quick = mode === 'pair' ? PAIR_QUICK : suggestedQuick(view);
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
        위의 열다섯 체계 계산 결과와 앞으로 120일치 일진을 그대로 넘겨서 묻습니다.
        간지·절기는 이미 계산된 값을 쓰므로 AI 가 ${mode === 'pair' ? '두 사람 사주를' : '사주를'} 다시 셈하지 않고,
        날짜를 물으면 지어내지 않고 그 표에서 골라 답합니다.
      </p>
    </div>`;
}

/**
 * 결과 화면이 그려진 뒤 호출한다.
 *
 * 명반 본문은 한 사람에 대해 고정이라 그대로 캐시에 태운다. 고해상도
 * 계산은 질문에 따라 봐야 할 것이 달라서 (§ 질문별 계산 파이프라인)
 * 물을 때마다 다시 만든다. 그래서 두 덩이를 갈라 보낸다.
 */
export function initAI(form, fortune, forecast) {
  wire(buildContext(form, fortune, forecast), { fortune, forecast });
}

/**
 * 이 질문에 필요한 고해상도 계산만 돌려 한 덩이로 만든다.
 * 계산이 터져도 질문 자체는 가야 하므로 실패는 조용히 삼킨다.
 */
function focusFor(question, calc) {
  if (!calc?.fortune) return null;
  try {
    const plan = routeQuestion(question, calc.fortune.input.currentYear);
    return buildHiRes(calc.fortune, calc.forecast, plan).text;
  } catch (e) {
    console.warn('[운세] 고해상도 계산을 건너뜁니다:', e.message);
    return null;
  }
}

/** 궁합 화면용. 두 사람 명반을 통째로 싣는다 */
export function initCompatAI(formA, formB, compat) {
  // 궁합만으로는 언제가 좋은지 답할 수 없다. 두 사람의 개인 시기 흐름도
  // 같이 계산해 넣어, 관계의 결뿐 아니라 실제로 맞물리는 달을 보게 한다.
  wire(buildCompatContext(
    formA, formB, compat,
    readForecast(formA), readForecast(formB),
  ));
}

/** 화면이 그려진 뒤 입력칸과 버튼을 붙인다. 개인·궁합이 같은 배선을 쓴다 */
function wire(context, calc = null) {
  session = { context, calc, messages: [], busy: false };

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
      const focus = focusFor(question, session.calc);
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: session.context, focus, messages: session.messages }),
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
