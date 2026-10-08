// 운세 AI 입력 크기 측정 — 최적화 전/후 비교 (테스트 질문 A~F)
//
//   node scripts/measure-fortune-ai.mjs [답변 길이(자)=2500] [글자당 토큰=1.0]
//
// 모델을 부르지 않는다. 실제 명반·고해상도 계산을 만들어 글자 수를 재고,
// 같은 대화를 예전 구조와 지금 구조로 보냈을 때 캐시 밖 입력·캐시 읽기·캐시
// 쓰기가 각각 몇 자인지 셈한다. 답변 길이와 글자당 토큰은 가정값이다 —
// 실측은 운영 로그(ai_usage_records)로 한다.
import { readFortune } from '../public/unse/src/engine.js';
import { readForecast } from '../public/unse/src/forecast.js';
import { buildContext, domainSections, monthSection } from '../public/unse/src/aiContext.js';
import { routeQuestion, inheritPlan } from '../public/unse/src/hires/router.js';
import { buildHiRes, formatTraits } from '../public/unse/src/hires/context.js';
import { compactHistory } from '../app/fortune-ai/conversation.ts';
import { readFileSync } from 'node:fs';

const ANSWER = Number(process.argv[2] ?? 2500);
const TOK = Number(process.argv[3] ?? 1.0);
const TTL = process.argv[4] === '1h' ? 'w1h' : 'w5m';   // 지금 구조의 캐시 수명 (FORTUNE_AI_CACHE_TTL)
// Opus 5.5 단가 (USD / 100만 토큰)
const P = { in: 4, out: 20, read: 0.2, w5m: 5, w1h: 8 };

const NOW = new Date('2026-09-24T03:00:00Z');
const form = { name: '가', gender: 'female', year: 1993, month: 3, day: 17, hour: 15, minute: 42, birthPlace: '여주', homePlace: '서울' };
const fortune = readFortune(form, { now: NOW });
const forecast = readForecast(form, NOW);
const context = buildContext(form, fortune, forecast);
const route = readFileSync(new URL('../app/fortune-ai/route.ts', import.meta.url), 'utf8');
const start = route.indexOf('const SYSTEM = `') + 16;
const SYSTEM = route.slice(start, route.indexOf('`;', start));
const CHART = SYSTEM.length + context.length + 40;

const Q = [
  ['A', '내 성격을 자세하게 분석해줘'],
  ['B', '2027년 연애운 알려줘'],
  ['C', '2027년 중에서도 몇 월이 가장 강해?'],
  ['D', '아까 말한 시기에 만나는 사람의 성격은?'],
  ['E', '2027년과 2028년 결혼운을 비교해줘'],
  ['F', '내 인생 전체 재물운을 20대부터 60대까지 자세히 분석해줘'],
];

function focusText(question, plan, mode) {
  const hires = buildHiRes(fortune, forecast, plan);
  if (mode === 'after' && plan.traitsOnly) return formatTraits(hires.json) || hires.text;   // ai.js 와 같은 규칙
  const parts = [hires.text, domainSections(fortune, plan.domains)];
  if (plan.needsDay || /몇 ?월|달별|월별|이번 달|다음 달/.test(question)) parts.push(monthSection(fortune));
  return parts.filter(Boolean).join('\n\n');
}

const fakeAnswer = (k) => `${k} 답의 결론입니다. 2027년 하반기가 가장 강합니다. ` + '가'.repeat(ANSWER - 30);

/** 한 대화를 끝까지 보내며 질문마다 글자 수를 센다 */
function simulate(questions, mode) {
  const rows = [];
  const msgs = [];
  let prevPlan = null;
  let cachedHistory = 0;    // 지금 구조: 직전 질문 때 캐시에 올려 둔 대화 길이
  let lastSummary = null;
  for (const [k, q] of questions) {
    const raw = routeQuestion(q, fortune.input.currentYear);
    const plan = mode === 'before' ? raw : inheritPlan(raw, prevPlan);
    prevPlan = plan;
    const focus = focusText(q, plan, mode).length;
    msgs.push({ role: 'user', content: q });
    const r = { k, domains: plan.domains.join(','), period: `${plan.fromYear}~${plan.fromYear + plan.years - 1}`, focus };
    if (mode === 'before') {
      // 규칙+명반만 캐시(5분). 대화 기록·focus 는 매번 정가
      const history = msgs.slice(0, -1).reduce((s, m) => s + m.content.length, 0);
      Object.assign(r, { uncached: focus + history + q.length, read: rows.length ? CHART : 0, w5m: rows.length ? 0 : CHART, w1h: 0, history });
    } else {
      const { summary, recent } = compactHistory(msgs);
      const prior = recent.slice(0, -1).reduce((s, m) => s + m.content.length, 0);
      const sum = summary?.length ?? 0;
      const sumChanged = summary !== lastSummary;
      lastSummary = summary;
      // 규칙+명반은 첫 질문에만 쓴다. 요약은 바뀔 때만 다시 쓴다.
      // 대화는 직전에 올린 만큼 읽고, 새로 늘어난 턴만 쓴다 (요약이 바뀌면 처음부터 다시 쓴다)
      const histRead = sumChanged ? 0 : Math.min(cachedHistory, prior);
      const histWrite = prior - histRead;
      cachedHistory = prior;
      const write = (rows.length ? 0 : CHART) + (sumChanged ? sum : 0) + histWrite;
      Object.assign(r, {
        uncached: focus + q.length + (focus ? 200 : 0),
        read: (rows.length ? CHART : 0) + (sumChanged ? 0 : sum) + histRead,
        w5m: TTL === 'w5m' ? write : 0,
        w1h: TTL === 'w1h' ? write : 0,
        history: prior, summary: sum,
      });
    }
    r.cost = ((r.uncached * P.in + r.read * P.read + r.w5m * P.w5m + r.w1h * P.w1h) / TOK) / 1e6;
    rows.push(r);
    msgs.push({ role: 'assistant', content: fakeAnswer(k) });
  }
  return rows;
}

const fmt = (n) => n.toLocaleString('en-US');
function report(title, questions) {
  const b = simulate(questions, 'before');
  const a = simulate(questions, 'after');
  console.log(`\n## ${title}`);
  console.log('| 질문 | 분야(전→후) | 기간(전→후) | focus 자(전→후) | 캐시 밖 입력 자(전→후) | 캐시 읽기 자(전→후) | 캐시 쓰기 자(전→후) | 입력 원가 $(전→후) |');
  console.log('|---|---|---|---|---|---|---|---|');
  let tb = 0, ta = 0, ub = 0, ua = 0;
  b.forEach((x, i) => {
    const y = a[i];
    tb += x.cost; ta += y.cost; ub += x.uncached; ua += y.uncached;
    console.log(`| ${x.k} | ${x.domains}→${y.domains} | ${x.period}→${y.period} | ${fmt(x.focus)}→${fmt(y.focus)} | ${fmt(x.uncached)}→${fmt(y.uncached)} | ${fmt(x.read)}→${fmt(y.read)} | ${fmt(x.w5m + x.w1h)}→${fmt(y.w5m + y.w1h)} | ${x.cost.toFixed(4)}→${y.cost.toFixed(4)} |`);
  });
  console.log(`| 합계 | | | | ${fmt(ub)}→${fmt(ua)} (${Math.round((1 - ua / ub) * 100)}%↓) | | | ${tb.toFixed(4)}→${ta.toFixed(4)} (${Math.round((1 - ta / tb) * 100)}%↓) |`);
}

console.log(`규칙 ${fmt(SYSTEM.length)}자 · 명반 ${fmt(context.length)}자 · 답변 가정 ${fmt(ANSWER)}자 · 글자당 토큰 가정 ${TOK} · 캐시 ${TTL === 'w1h' ? '1시간' : '5분'}(전 구조는 5분) · Opus 5.5 단가 · 캐시는 매번 맞는다고 가정`);
report('A~F 를 한 상담에서 이어서 물을 때', Q);
const long = [...Q, ...Q.map(([k, q]) => [`${k}'`, q])];
report('같은 질문을 두 바퀴(12턴) 물을 때 — 요약 접힘 확인', long);
