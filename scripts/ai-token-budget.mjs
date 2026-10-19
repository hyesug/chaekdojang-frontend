/**
 * AI 대화 토큰·비용 어림 — 같은 질문 넷(단순·일반·심층·후속)으로 수정 전후를 견준다.
 * 실제 API 는 부르지 않는다. 글자 수 → 토큰은 route.ts 의 approxTokens(1.5자=1토큰)와 같은 어림,
 * 단가는 chaekdojang-api AiCostCalculator 의 CLAUDE_OPUS(입력 4, 출력 20, 캐시 읽기 0.2 USD/100만, 5분 캐시 쓰기 1.25배).
 * 실행: node scripts/ai-token-budget.mjs [라벨]
 */
import { readFileSync } from 'node:fs';
import { readFortune } from '../public/unse/src/engine.js';
import { readForecast } from '../public/unse/src/forecast.js';
import { buildContext } from '../public/unse/src/aiContext.js';
import { focusFor } from '../public/unse/src/ai.js';
import { routeQuestion } from '../public/unse/src/hires/router.js';

const label = process.argv[2] ?? 'now';
const route = readFileSync('app/fortune-ai/route.ts', 'utf8');
const SYSTEM = route.slice(route.indexOf('const SYSTEM = `') + 16, route.indexOf('`;', route.indexOf('const SYSTEM = `')));
const conv = readFileSync('app/fortune-ai/conversation.ts', 'utf8');
const form = { name: '테스트', gender: 'female', year: 1986, month: 5, day: 9, hour: 10, minute: 8, birthPlace: '여주', homePlace: '서울' };
const now = new Date('2026-10-19T03:00:00Z');
const fortune = readFortune(form, { now }); const forecast = readForecast(form, now);
const context = buildContext(form, fortune, forecast);
const calc = { form, fortune, forecast };
const tok = (chars) => Math.ceil(chars / 1.5);
const PRICE = { in: 4, out: 20, read: 0.2, write: 5 };
// 목표 답 길이(글자)와 사고 어림(토큰) — 실제 사고 토큰은 API 로만 알 수 있어 가정값이다
// 답 길이: 전 = 예전 지시(단순 2~4문장, 그 밖 800~1,500자 → 가운데 1,150자), 후 = 단순 2~5문장, 일반 700~1,200(950), 심층 1,200~2,000(1,600)
const ANSWER = label === '전' ? { short: 250, normal: 1150, long: 1150 } : { short: 280, normal: 950, long: 1600 };
const THINK = { low: 600, medium: 2500 };
const Q = [
  ['단순', '올해 재물운 한 줄로 알려줘', null],
  ['일반', '올해 이직해도 될까?', null],
  ['심층', '2027년과 2028년 중 이직하기 더 좋은 해를 자세히 비교해줘', null],
  ['후속', '그럼 그때 연봉도 오를까?', '올해 이직해도 될까?'],
];
const { detailLevel, slimFocus } = await import('../app/fortune-ai/conversation.ts').catch(() => ({}));
const level = (q) => (/한 ?줄|한 ?마디|짧게|간단|핵심만|요약/.test(q) ? 'short' : /자세히|자세하게|상세|비교|전체 ?풀이|평생|인생/.test(q) ? 'long' : 'normal');
console.log(`[${label}] 규칙(SYSTEM) ${SYSTEM.length.toLocaleString()}자 ≈ ${tok(SYSTEM.length).toLocaleString()}토큰 · 명반 ${context.length.toLocaleString()}자 ≈ ${tok(context.length).toLocaleString()}토큰`);
let total = 0;
for (const [name, q, prev] of Q) {
  const lv = (detailLevel ?? level)(q);
  const raw = focusFor(q, calc, prev ? routeQuestion(prev, fortune.input.currentYear) : null) ?? '';
  const focus = (label !== '전' && slimFocus) ? slimFocus(raw, lv) : raw;
  const history = prev ? prev.length + ANSWER.normal : 0; // 직전 질문 + 답 원문
  const cachedIn = tok(SYSTEM.length + context.length) + (prev ? tok(history) : 0); // 두 번째 질문부터 캐시 읽기
  const freshIn = tok(focus.length + q.length + 200);
  const out = tok(ANSWER[lv]) + THINK[lv === 'long' ? 'medium' : 'low'];
  const cost = (cachedIn * PRICE.read + freshIn * PRICE.in + out * PRICE.out) / 1e6;
  total += cost;
  console.log(`${name} (${lv}) 고해상도 ${focus.length.toLocaleString()}자 · 입력(캐시 읽기) ${cachedIn.toLocaleString()} + 입력(새로) ${freshIn.toLocaleString()} + 출력·사고 ${out.toLocaleString()} 토큰 ≈ $${cost.toFixed(4)}`);
}
console.log(`넷 합계 ≈ $${total.toFixed(4)} (캐시가 데워진 상태 가정, 첫 질문의 캐시 쓰기 ≈ $${(tok(SYSTEM.length + context.length) * PRICE.write / 1e6).toFixed(4)} 별도)`);
