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

import { buildContext, READING_PROMPT, buildCompatContext, COMPAT_PROMPT,
         domainSections, monthSection, dayContext, targetDayContext, FAMILY_NOTE, weddingDayCandidates } from './aiContext.js';
import { readForecast } from './forecast.js';
import { routeQuestion, inheritPlan, targetDayOf } from './hires/router.js';
import { buildHiRes, formatTraits } from './hires/context.js';
import * as PAIR from './hires/pair.js';
import { horaryCast, formatHorary } from './systems/horary.js';
import { loadCreditStatus } from './credits.js';
import { attachAnswerFeedback } from './feedback.js';

const ENDPOINT = '/fortune-ai';

/**
 * AI 질문을 받을지. 결제는 아직 없고, 질문권은 처음 1회 무료 + 독후감 한 편(책 한 권당 한 번, 100자 이상)마다 1개.
 * false 면 질문 영역은 그대로 보여 주되 버튼·입력칸을 막고 "준비 중"을 띄운다.
 * 서버 쪽도 막으려면 Vercel 환경변수 FORTUNE_AI_DISABLED=1 을 함께 둔다.
 */
export const AI_OPEN = true;

/** AI 모델은 하나로 고정 — Claude 심층(Opus), 질문 한 번에 질문권 1회(백엔드 FortuneAiModelTier 와 같은 값) */
const AI_TIER = 'CLAUDE_OPUS';
const AI_COST = 1;

/** 질문권을 얻는 길 — 결제가 붙기 전까지는 독후감 */
const EARN = '<a href="/write">독후감 쓰고 질문권 받기</a> (책 한 권당 1개 · 100자 이상)';

/** 결제 안내는 서버가 잔액 부족으로 확정한 경우에만 연다. */
export function isCreditExhausted(error) {
  return error?.status === 402;
}

/** 대화 상태. 한 사람의 명반에 대해 계속 이어서 묻는다 */
let session = null;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * 화면에 보일 때만 "첫 번째 사람·두 번째 사람"을 입력한 이름으로 바꾼다(이름이 없으면 그대로).
 * AI 로는 이름을 보내지 않는다(redactNames) — 바꾸는 것은 화면·복사 글뿐이다.
 * "사람"과 "님"이 둘 다 ㅁ 받침이라 뒤 조사(이·은·과)가 그대로 맞는다.
 */
function showNames(t) {
  let out = String(t ?? '');
  for (const [name, label] of session?.names ?? []) {
    const n = String(name ?? '').trim();
    if (!n || !PAIR_LABELS.includes(label)) continue;
    out = out.split(`${label}님`).join(`${n}님`).split(label).join(`${n}님`);
  }
  return out;
}

/** 문단을 최소한으로만 꾸민다. 마크다운 전체를 지원하지는 않는다 */
function renderText(t) {
  t = showNames(t);
  // 모델이 줄바꿈 대신 넣는 역슬래시 줄("\", "- \")과 불릿 사이 빈 줄을 걷는다 — 빈 불릿이 '* \'로 보였다
  t = String(t ?? '')
    .replace(/^[ \t]*(?:[-*•][ \t]*)?\\[ \t]*$/gm, '')
    .replace(/[ \t]*\\[ \t]*$/gm, '')
    .replace(/(^[-*] .+)\n\s*\n(?=[-*] )/gm, '$1\n');
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

/**
 * 글자를 클립보드에 넣는다.
 *
 * `navigator.clipboard` 는 https(또는 localhost)에서만 돌고, 권한이 막히면
 * 예외를 던진다. 그럴 때를 위해 옛 방식(`execCommand`)을 남겨 둔다.
 * **성공 여부를 돌려준다** — 실패했는데 "복사됨"이라고 적으면 안 된다.
 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* 아래 옛 방식으로 */ }

  const ta = document.createElement('textarea');
  ta.value = text;
  // 화면 밖에 두되 focus 가 가야 하므로 display:none 은 쓸 수 없다
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

/**
 * 답 하나에 복사 단추를 단다.
 *
 * 복사하는 것은 화면에 그려진 HTML 이 아니라 **모델이 보낸 원문**이다.
 * 붙여 넣었을 때 태그가 딸려 가면 쓸 수가 없다.
 *
 * 스트리밍 도중에는 `bubble.innerHTML` 이 계속 다시 그려지므로, 단추는
 * 다 받은 뒤에만 붙인다.
 */
function addCopy(bubble, text) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ai-copy';
  b.textContent = '복사';
  b.title = '이 답을 그대로 복사합니다';
  b.addEventListener('click', async () => {
    const ok = await copyText(text);
    b.textContent = ok ? '복사됨' : '복사 실패';
    b.classList.toggle('done', ok);
    setTimeout(() => { b.textContent = '복사'; b.classList.remove('done'); }, 1500);
  });
  bubble.appendChild(b);
}

export function aiSection(mode = 'solo', view = null) {
  quick = mode === 'pair' ? PAIR_QUICK : suggestedQuick(view);
  const target = mode === 'pair'
    ? `${view?.who?.a ?? '첫 번째 사람'} · ${view?.who?.b ?? '두 번째 사람'}`
    : `${view?.who?.name ?? '내'} 명반`;
  const off = AI_OPEN ? '' : ' disabled';
  return `
    <div class="card ai${AI_OPEN ? '' : ' ai-closed'}">
      <div class="ai-record-head">
        <div><p class="ai-kicker">AI 명반 해석</p><p class="ai-target">현재 분석 대상: ${esc(target)}</p></div>
        ${AI_OPEN
          ? '<p class="ai-credit" id="ai-credit-status" role="status">질문권을 확인하는 중입니다.</p>'
          : '<p class="ai-badge">준비 중</p>'}
      </div>
      ${AI_OPEN ? '' : `
      <div class="ai-soon" role="status">
        <p class="ai-soon-title">AI 질문은 준비 중이에요</p>
        <p class="ai-soon-body">질문권 결제 기능을 붙이는 중입니다. 열리면 이 명반으로 바로 물어볼 수 있어요.
        위의 명반 계산과 풀이는 지금도 그대로 볼 수 있습니다.</p>
      </div>`}
      <div class="ai-quick">
        ${quick.map((q, i) => `<button type="button" data-q="${i}"${off}>${esc(q[0])}</button>`).join('')}
      </div>
      <div id="ai-log" class="ai-log" aria-live="polite" aria-relevant="additions text"></div>
      ${AI_OPEN ? '<div class="ai-tools" hidden><button type="button" id="ai-reset" class="ai-reset">대화 초기화</button></div>' : ''}
      <div class="ai-input">
        <label class="sr-only" for="ai-q">명반에 관해 질문하기</label>
        <textarea id="ai-q" rows="3" placeholder="${AI_OPEN ? '궁금한 걸 물어보세요 (Ctrl+Enter 로 보내기)' : 'AI 질문은 준비 중이에요'}"${off}></textarea>
        <button type="button" id="ai-send"${off}>${AI_OPEN ? '보내기' : '준비 중'}</button>
      </div>
      <p class="ai-note" id="ai-note">
        질문권 1회는 질문 1개와 그 답변 한 벌입니다.
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
  wire(buildContext(form, fortune, forecast), { form, fortune, forecast });
}

/**
 * 이 질문에 필요한 고해상도 계산만 돌려 한 덩이로 만든다.
 * 계산이 터져도 질문 자체는 가야 하므로 실패는 조용히 삼킨다.
 */
/** 달을 묻는 질문 — 이때만 달 단위 계산(월운·유월·트랜싯)과 달 표를 싣는다 */
const MONTH_ASK = /몇 ?월|달별|월별|이번 ?달|다음 ?달|어느 ?달|무슨 ?달|몇 ?달|\d{1,2} ?월에/;

export function focusFor(question, calc, prevPlan = null) {
  if (!calc?.fortune) return null;
  try {
    // 후속 질문("아까 그 시기", "그중 몇 월")은 앞 질문의 분야·기간을 잇는다
    const routed = inheritPlan(routeQuestion(question, calc.fortune.input.currentYear), prevPlan);
    // 달을 물었을 때만 달 단위 계산을 싣는다(hires/context.js formatHiRes)
    const plan = { ...routed, wantsMonths: routed.needsDay || MONTH_ASK.test(question) };
    if (session) session.lastPlan = plan;
    const hires = buildHiRes(calc.fortune, calc.forecast, plan);
    // 성향만 물었으면 시기 계산·분야 구획 없이 속성별 담당 체계 구획만 보낸다
    if (plan.traitsOnly) return formatTraits(hires.json) || hires.text;
    const parts = [hires.text];

    // 분야 구획은 **걸린 분야만** 온다. 일곱을 다 캐시에 넣어 두었더니
    // 자녀를 물어도 재물·건강이 따라가 캐시 덩어리가 47,600자였다.
    // 분야를 못 가린 질문(가족·오늘 운세…)에는 싣지 않는다 — 예전엔 폴백이 직업이라 직업 구획이 따라가 답이 직업 쪽으로 끌렸다
    if (!plan.fallback) parts.push(domainSections(calc.fortune, plan.domains));
    if (plan.family) parts.push(FAMILY_NOTE);

    // 질문이 짚은 하루(내일 수술·다음 주 금요일 면접)는 그날 운을 싣는다. 날짜를 고르는 질문(needsDay)은 아래 120일 표가 맡는다
    if (plan.asksDay && !plan.needsDay && calc.form && calc.forecast?.today) {
      parts.push(targetDayContext(calc.form, calc.fortune, targetDayOf(question, calc.forecast.today)));
    }

    // 달 표는 달을 물었을 때만. 달 단위는 검증에서 진 값이라 안 물었는데
    // 실어 보내면 돈만 쓰고 답에는 잡음을 더한다
    if (plan.wantsMonths) {
      parts.push(monthSection(calc.fortune));
    }

    // 날짜를 고르는 질문에만 120일 일자별 표·수술 택일 후보를 붙인다(캐시 문맥에서 떼어 냄 — 매번 약 4천 자였다)
    if (plan.needsDay) parts.push(dayContext(calc.fortune, calc.forecast));

    // 점시는 **묻는 순간**에 세우는 것이라 캐시되는 명반 문맥이 아니라
    // 질문마다 새로 붙는 이 자리에 온다. 출생괘와 섞이지 않는 이유이기도 하다
    if (plan.needsHorary) parts.push(formatHorary(horaryCast(new Date()), question));

    return parts.filter(Boolean).join('\n\n');
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
  ), null, compat);
}

/**
 * 두 사람 화면에서 결혼 시기를 물으면 양쪽을 겹쳐 센다.
 *
 * 한 사람에게만 결혼운이 있는 해는 뜻이 없다. **두 사람 모두 같은 기간에
 * 켜지는가**가 조건이라, 그 계산을 질문이 들어올 때 돌린다.
 */
function pairFocus(question, compat) {
  if (!compat?.A?.input || !compat?.B?.input) return null;
  if (!/결혼|혼인|예식|언제|시기|날짜|신혼/.test(question)) return null;
  try {
    const from = compat.A.input.currentYear;
    const mw = PAIR.marriageWindow(compat.A, compat.B, from, 6);
    const rel = PAIR.relationshipCharts(compat.A, compat.B, mw.rows.map((r) => r.year));
    const nav = PAIR.navamsaPair(compat.A, compat.B);
    // 이름은 AI 로 보내지 않는다(개인정보처리방침). 두 사람은 순서로만 부른다
    const parts = [PAIR.formatPair(mw, rel, nav, PAIR_LABELS[0], PAIR_LABELS[1])];
    // 결혼식·예식·상견례 날짜를 물으면 120일 너머까지 달별 주말 후보를 싣는다(가까운 날만 고르던 문제)
    if (/날짜|날 ?잡|택일|며칠|예식|식장|결혼식|웨딩|상견례|좋은 날/.test(question)) parts.push(weddingDayCandidates(compat.A, compat.B));
    return parts.join('\n\n');
  } catch (e) {
    console.warn('[운세] 두 사람 겹침 계산을 건너뜁니다:', e.message);
    return null;
  }
}

const PAIR_LABELS = ['첫 번째 사람', '두 번째 사람'];

/**
 * AI 로 보내는 글에서 입력한 이름을 지운다.
 *
 * 문맥 생성기는 이름을 넣지 않게 짜여 있지만, 체계별 풀이 문장 어딘가에 이름이 섞여 들어가도
 * 밖으로 나가지 않도록 보내기 직전에 한 번 더 거른다. 한 글자 이름은 일반 낱말까지 지울 수 있어 건너뛴다.
 */
export function redactNames(text, names) {
  if (!text) return text;
  let out = String(text);
  for (const [name, label] of names) {
    const n = String(name ?? '').trim();
    if (n.length >= 2) out = out.split(n).join(label);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// 대화 이어 가기 — 질문권이 떨어져 독후감을 쓰고 돌아와도 대화가 남아 있게
// ─────────────────────────────────────────────────────────────

/**
 * 대화는 **그 사람의 브라우저에만** 명반별로 남긴다(서버에 저장하지 않는다). 30일이 지나면 버린다.
 * 열쇠는 출생 정보 자체가 아니라 그것을 섞은 짧은 값이라, 저장소를 열어 봐도 생년월일이 보이지 않는다.
 */
const SAVE_DAYS = 30;
const SAVE_MAX = 30;              // 메시지 수 상한 — 오래된 것부터 버린다
const hashOf = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0; return h.toString(36); };
function saveKeyOf(calc, compat) {
  const who = (x) => (x ? [x.year, x.month, x.day, x.hour, x.minute, x.gender, x.birthPlace].join('|') : '');
  const raw = compat ? `pair:${who(compat.A?.input)}:${who(compat.B?.input)}` : `solo:${who(calc?.fortune?.input)}`;
  return `unse-ai-chat:${hashOf(raw)}`;
}
function loadChat(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!v || !Array.isArray(v.messages) || Date.now() - (v.at ?? 0) > SAVE_DAYS * 864e5) return [];
    return v.messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string');
  } catch { return []; }
}
function saveChat(key, messages) {
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), messages: messages.slice(-SAVE_MAX) })); } catch { /* 저장 못 해도 대화는 계속된다 */ }
}
function clearChat(key) { try { localStorage.removeItem(key); } catch { /* */ } }

/** 답 끝의 '[이어서 물어보기]' 블록을 떼어 본문과 이어 물을 질문으로 나눈다 */
export function splitFollowUps(text) {
  const at = String(text ?? '').lastIndexOf('[이어서 물어보기]');
  if (at < 0) return { body: text, followUps: [] };
  const followUps = text.slice(at).split('\n').slice(1)
    .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, '').trim()).filter((l) => l && l.length <= 60).slice(0, 3);
  return { body: text.slice(0, at).trimEnd(), followUps };
}

// sessionId 는 사용량 로그를 상담 단위로 묶는 데만 쓴다 (사람을 가리키지 않는 임의 값)
const newSessionId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** 화면이 그려진 뒤 입력칸과 버튼을 붙인다. 개인·궁합이 같은 배선을 쓴다 */
function wire(context, calc = null, compat = null) {
  const names = compat
    ? [[compat.A?.input?.name, PAIR_LABELS[0]], [compat.B?.input?.name, PAIR_LABELS[1]]]
    : [[calc?.fortune?.input?.name, '본인']];
  session = { context: redactNames(context, names), calc, compat, names, messages: [], busy: false, lastPlan: null, id: newSessionId() };

  const log = document.querySelector('#ai-log');
  const box = document.querySelector('#ai-q');
  const send = document.querySelector('#ai-send');
  const reset = document.querySelector('#ai-reset');
  const credit = document.querySelector('#ai-credit-status');
  if (!log) return;
  // 닫혀 있으면 질문권 조회도, 버튼 배선도 하지 않는다 — 막힌 단추가 눌려도 아무 요청이 나가지 않게
  if (!AI_OPEN) return;
  let creditStatus = { kind: 'unavailable' };

  const saveKey = saveKeyOf(calc, compat);

  // 대화 초기화 단추는 대화가 있을 때만 보인다. 대화 칸 맨 위에 두면
  // 긴 대화에 밀려 올라가 안 보였다 — 입력칸 바로 위에 늘 둔다.
  const showReset = () => { if (reset) reset.parentElement.hidden = !log.childElementCount; };
  reset?.addEventListener('click', () => {
    if (session.busy) return;
    if (!confirm('지금까지 나눈 대화를 지우고 처음부터 새로 물을까요?\n지운 대화는 되살릴 수 없어요.')) return;
    clearChat(saveKey);
    // 앞 질문의 분야·기간을 잇지 않게 lastPlan 도 비우고, 사용량 로그도 새 상담으로 묶는다
    session.messages = [];
    session.lastPlan = null;
    session.id = newSessionId();
    log.innerHTML = '';
    showReset();
    box.focus();
  });

  // 지난 대화를 되살린다 — 질문권이 떨어져 독후감을 쓰고 돌아와도 이어서 물을 수 있게
  const restored = loadChat(saveKey);
  if (restored.length) {
    session.messages = restored;
    const head = document.createElement('div');
    head.className = 'ai-restored';
    head.innerHTML = '<span>지난 대화를 이어서 보여 드려요. AI 도 이 대화를 참고해 답하니, 처음부터 물으려면 아래 ‘대화 초기화’를 누르세요.</span>';
    log.appendChild(head);
    for (const m of restored) {
      if (m.role === 'user') { log.insertAdjacentHTML('beforeend', `<div class="ai-turn me"><p>${esc(m.content)}</p></div>`); continue; }
      const b = document.createElement('div');
      b.className = 'ai-turn bot';
      paintAnswer(b, m.content, false);
      log.appendChild(b);
    }
    log.scrollTop = log.scrollHeight;
  }
  showReset();

  /** 답 한 덩이를 그린다 — 본문, 복사 단추, 이어 물을 질문 단추(마지막 답에만) */
  function paintAnswer(bubble, text, withFollowUps = true) {
    const { body, followUps } = splitFollowUps(text);
    bubble.innerHTML = `<p>${renderText(body)}</p>`;
    addCopy(bubble, showNames(body));
    log.querySelectorAll('.ai-follow').forEach((x) => x.remove());
    if (withFollowUps && followUps.length) {
      const row = document.createElement('div');
      row.className = 'ai-follow ai-quick';
      for (const q of followUps) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = showNames(q);
        b.addEventListener('click', () => ask(q));
        row.appendChild(b);
      }
      bubble.after(row);
    }
  }

  const paintCredit = (status) => {
    creditStatus = status;
    if (!credit) return;
    if (status.unlimited) credit.innerHTML = '<a href="/ai-credits">관리자 · 무제한</a>';
    else if (status.kind === 'available') credit.innerHTML = `<a href="/ai-credits">남은 질문 ${status.totalBalance}회</a>`;
    else if (status.kind === 'exhausted') credit.innerHTML = `<a href="/ai-credits">남은 질문 0회</a> · ${EARN}`;
    else if (status.kind === 'logged-out') credit.innerHTML = `<a href="/auth/login?returnTo=/unse/">로그인하면 첫 질문 무료</a> · 독후감 한 편마다 1개`;
    else credit.textContent = '질문권 상태를 확인하지 못했습니다.';
    lockWhenEmpty(status);
  };

  /**
   * 질문권을 다 쓰면 입력·보내기·빠른 질문을 막고 '이용권 얻으러 독후감 쓰러 가기' 단추를 띄운다.
   * 독후감을 쓰고 돌아오면(visibilitychange) 질문권을 다시 읽어 저절로 풀린다.
   */
  function lockWhenEmpty(status) {
    const empty = status.kind === 'exhausted' && !status.unlimited;
    box.disabled = empty;
    send.disabled = empty || session.busy;
    box.placeholder = empty ? '질문권을 다 썼어요. 독후감을 쓰면 1회를 받아요.' : '궁금한 걸 물어보세요 (Ctrl+Enter 로 보내기)';
    document.querySelectorAll('.ai-quick button[data-q], .ai-follow button').forEach((b) => { b.disabled = empty; });
    let cta = document.querySelector('.ai-earn');
    if (empty && !cta) {
      cta = document.createElement('div');
      cta.className = 'ai-earn';
      cta.innerHTML = '<a class="ai-earn-btn" href="/write">이용권 얻으러 독후감 쓰러 가기</a>'
        + '<p>독후감 한 편(책 한 권당 한 번, 100자 이상)마다 질문권 1회를 드려요. 쓰고 돌아오면 이어서 물을 수 있어요.</p>';
      box.closest('.ai-input')?.after(cta);
    } else if (!empty && cta) cta.remove();
  }
  loadCreditStatus().then(paintCredit);
  // 독후감을 쓰고 이 탭으로 돌아오면 늘어난 질문권을 바로 보여 준다
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadCreditStatus().then(paintCredit);
  });

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
    if (creditStatus.kind === 'exhausted') {
      box.value = question;
      showPaywall(log, '질문권이 모두 사용되었습니다. 질문은 입력창에 남겨 두었습니다.');
      return;
    }
    // 질문 한 번에 질문권 1회. 모자라면 보내기 전에 알린다 — 서버도 같은 값으로 막는다
    if (creditStatus.kind === 'available' && !creditStatus.unlimited && creditStatus.totalBalance < AI_COST) {
      box.value = question;
      showPaywall(log, '질문권이 모두 사용되었습니다. 질문은 입력창에 남겨 두었습니다.');
      return;
    }
    session.busy = true;
    send.disabled = true;
    // 답을 받는 도중에는 지우지 못하게 막는다 — 흘러오던 답이 빈 칸에 다시 붙는다
    if (reset) reset.disabled = true;

    // 휴대폰은 화면을 벗어나면(탭 전환·홈 버튼·화면 꺼짐) 브라우저가 연결을
    // 끊는다. 그 자체는 막을 수 없으니, **끊겼을 때 무슨 일이 있었는지**를
    // 알 수 있게 기록해 둔다. 안 그러면 정체 모를 네트워크 오류로만 보인다.
    let leftPage = false;
    const watchLeave = () => { if (document.hidden) leftPage = true; };
    document.addEventListener('visibilitychange', watchLeave);

    log.insertAdjacentHTML('beforeend',
      `<div class="ai-turn me"><p>${esc(question)}</p></div>`);
    const bubble = document.createElement('div');
    bubble.className = 'ai-turn bot';
    bubble.innerHTML = '<p class="ai-wait">생각하는 중…</p>';
    log.appendChild(bubble);
    showReset();
    // 대화 칸은 자체 스크롤이다 — 새 질문은 칸 맨 아래로 내리고, 칸이 화면에 보이게 한다
    log.scrollTop = log.scrollHeight;
    log.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 직접 친 질문에 들어간 이름도 AI 로는 순서 이름으로 보낸다
    session.messages.push({ role: 'user', content: redactNames(question, session.names) });
    let acc = '';

    try {
      const focus = session.compat
        ? pairFocus(question, session.compat)
        : focusFor(question, session.calc, session.lastPlan);
      // 사용량 로그에 남길 질문 분야. 원가를 질문 유형별로 보려고 보낸다
      const category = session.compat ? 'pair' : (session.lastPlan?.domains ?? []).join(',');
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: session.context, focus: redactNames(focus, session.names), messages: session.messages, tier: AI_TIER, sessionId: session.id, category }),
      });

      if (!res.ok || !res.body) {
        let msg = `서버가 ${res.status} 를 돌려주었습니다.`;
        try { msg = (await res.json()).error ?? msg; } catch { /* 본문이 JSON 이 아닐 수 있다 */ }
        // 서버가 이유를 말해 준 오류다. 마침 탭을 옮겼더라도 이 말을 그대로
        // 보여줘야 한다 — "화면을 벗어나서"로 덮으면 진짜 원인이 가려진다
        throw Object.assign(new Error(msg), { fromServer: true, status: res.status });
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
            // 사용자가 위로 올려 읽는 중이면 끌어내리지 않는다
            const stick = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
            bubble.innerHTML = `<p>${renderText(acc)}</p>`;
            if (stick) log.scrollTop = log.scrollHeight;
          } else if (ev.error) {
            throw Object.assign(new Error(ev.error), { fromServer: true });
          } else if (ev.done) {
            // 비용 표시가 터져도 답은 살아야 한다. 이 호출이 바깥 try 로
            // 새면 **이미 다 받아 그려 놓은 답이 오류 메시지로 덮인다**
            // (usage 모양이 조금만 달라져도 그렇게 됐다).
            try { showUsage(ev.usage); } catch { /* 값만 못 적을 뿐이다 */ }
          }
        }
      }

      if (!acc) throw new Error('빈 응답이 돌아왔습니다.');
      session.messages.push({ role: 'assistant', content: acc });
      paintAnswer(bubble, acc);
      // 답변마다 👍/👎 + 한 줄(선택) — 질문 글·출생 정보는 보내지 않는다(feedback.js)
      attachAnswerFeedback(bubble, { topic: session.compat ? '궁합' : (session.lastPlan?.domains ?? []).join('·'), names: session.names.map(([n]) => n).filter(Boolean) });
      saveChat(saveKey, session.messages);
      loadCreditStatus().then(paintCredit);
    } catch (err) {
      // **받아 둔 답을 버리지 않는다.** 여기서 bubble 을 통째로 덮어쓰고
      // 있었는데, 휴대폰에서 화면을 벗어나면 연결이 끊겨 이 자리로 오므로
      // 그때까지 흘러온 답이 통째로 사라졌다. 끊긴 것은 연결이지 답이 아니다.
      const why = (leftPage && !err.fromServer)
        ? '화면을 벗어나 있는 동안 연결이 끊겼습니다.' +
          (acc ? ' 답을 다 받지 못한 질문은 질문권을 돌려드립니다(하루 2번까지). 다시 묻기를 누르면 처음부터 답합니다.' : '')
        : esc(err.message);
      if (isCreditExhausted(err)) {
        box.value = question;
        showPaywall(log, why);
        bubble.remove();
        session.messages.pop();
        return;
      }
      bubble.innerHTML = acc
        ? `<p>${renderText(acc)}</p><p class="ai-err" role="alert">${why} 여기까지 받았습니다.</p>`
        : `<p class="ai-err" role="alert">${why}</p>`;

      // 다시 묻기 — 끊긴 뒤에 질문을 손으로 다시 치게 하지 않는다
      const again = document.createElement('button');
      again.type = 'button';
      again.className = 'ai-retry';
      again.textContent = '다시 묻기';
      again.addEventListener('click', () => { again.remove(); ask(question); });
      bubble.appendChild(again);

      // 끊긴 답은 기록에 넣지 않는다. 반쪽짜리가 다음 질문에 딸려 올라가면
      // 모델이 이어 쓴 것처럼 굴어 더 헷갈린다. 화면에는 남기고 기록만 뺀다.
      session.messages.pop();
    } finally {
      document.removeEventListener('visibilitychange', watchLeave);
      session.busy = false;
      send.disabled = false;
      if (reset) reset.disabled = false;
    }
  }

  function showPaywall(parent, reason) {
    const row = document.createElement('div');
    row.className = 'ai-paywall';
    const balance = Number.isFinite(creditStatus.totalBalance) ? `현재 잔액 ${creditStatus.totalBalance}회 · ` : '';
    // 결제는 아직 열지 않았다 — 질문권은 독후감으로 받는다
    row.innerHTML = `<p><strong>질문권이 필요합니다.</strong> ${esc(reason)}</p><p>${balance}${EARN} · <a href="/terms">이용약관</a></p>`;
    parent.appendChild(row);
    showReset();
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showUsage(u) {
    if (!u) return;
    // 달러 원가는 여기서 셈하지 않는다. 모델마다 단가가 달라 화면에서 한 가지 값으로
    // 셈하면 틀린다(예전에는 어느 모델이든 Opus 5 단가로 셈했다). 원가는 백엔드
    // AiCostCalculator 가 한 곳에서 계산해 사용량 기록에 남긴다.
    const note = document.querySelector('#ai-note');
    if (note) {
      note.innerHTML =
        `직전 질문 — 입력 ${u.input.toLocaleString()} · 출력 ${u.output.toLocaleString()}` +
        // 캐시에 쓴 양을 빼놓으면 숫자가 안 맞아 보인다. 첫 질문은 입력이
        // 몇십 토큰인데도 명반 몇천 자를 캐시에 얹느라 값이 붙는다.
        (u.cacheWrite ? ` · 캐시에 올림 ${u.cacheWrite.toLocaleString()}` : '') +
        (u.cacheRead ? ` · 캐시에서 읽음 ${u.cacheRead.toLocaleString()}` : '') +
        ' 토큰<br>' +
        (u.cacheRead
          ? '명반을 캐시에서 읽어 입력 비용이 10분의 1로 줄었습니다.'
          : '이번엔 명반을 캐시에 올리느라 값이 붙었습니다. 다음 질문부터 크게 줄어듭니다.') +
        // 관리자는 잔액이 있으면 그걸 먼저 쓰고 모자랄 때만 자동 충전된다 — 숫자가 줄어 보여도 막히지 않는다
        (creditStatus.unlimited ? '<br><strong>AI 질문권: 관리자 · 무제한</strong>'
          : Number.isInteger(u.remaining) ? `<br><strong>남은 AI 질문권: ${u.remaining}회</strong>` : '');
    }
  }
}
