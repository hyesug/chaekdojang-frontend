/*
 * 운세 AI 답변 파이프라인 개선 전후 비교 (2026-11-03)
 *
 *   node analysis/answer-quality/compare-pipeline.mjs --dry-run        요청 크기·예상 비용만 (호출 없음)
 *   node analysis/answer-quality/compare-pipeline.mjs --answers        전후 답 만들기 (호출 — 비용 발생)
 *   node analysis/answer-quality/compare-pipeline.mjs --judge          블라인드 쌍 비교 채점 (호출 — 비용 발생)
 *   node analysis/answer-quality/compare-pipeline.mjs --report         코드 검증 지표 + 채점 집계 → report.md
 *
 * 같은 모델(claude-opus-5-5)·같은 명반 계산값·같은 질문 10개(사용자가 정한 필수 테스트)로
 *   B(before) — 개선 전: 커밋 3b22de9 의 route.ts SYSTEM, 근거 번호 없는 문맥, 길이 지시만
 *   N(new)    — 개선 후: prompt.ts SYSTEM + '이번 답의 설계', 근거 번호가 붙은 문맥·시기 번호표
 * 를 만든다. 두 답 모두 answerCheck.js 로 같은 검사를 돌려 위반 수를 세고(코드 지표),
 * 채점자(같은 모델)는 어느 쪽이 개선 후인지 모른 채 두 답을 항목별로 매긴다(블라인드).
 *
 * 키는 ANTHROPIC_API_KEY 환경변수로만 읽고 저장하지 않는다. 중간에 끊겨도 다시 돌리면 받은 것은 건너뛴다.
 */
import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFortune } from '../../public/unse/src/engine.js';
import { readForecast } from '../../public/unse/src/forecast.js';
import { buildContext } from '../../public/unse/src/aiContext.js';
import { focusFor } from '../../public/unse/src/ai.js';
import { routeQuestion } from '../../public/unse/src/hires/router.js';
import { natalLedger, timeLedger, ledgerMap, resolveEvidence, plainEvidence } from '../../public/unse/src/evidence.js';
import { buildHiRes } from '../../public/unse/src/hires/context.js';
import { checkAnswer, evidenceIdsIn, issueSummary } from '../../public/unse/src/answerCheck.js';
import { SYSTEM, planAnswer, planNote } from '../../app/fortune-ai/prompt.ts';
import { detailLevel, lengthHint, slimFocus, THINKING_BUDGET, wantsThinking } from '../../app/fortune-ai/conversation.ts';
import { FORMS, NOW } from './items.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k) => process.argv.includes(k);
const val = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const RUN = join(HERE, 'runs', val('--run', 'pipeline-2026-11'));
const MODEL = 'claude-opus-5-5';
// Opus 5.5 단가(USD / 100만 토큰) — run-eval.mjs 와 같은 값
const PRICE = { in: 4, out: 20, read: 0.2, write: 5 };
const cached = { type: 'ephemeral', ttl: '5m' };
const BEFORE_COMMIT = '3b22de9';

/** 사용자가 정한 필수 테스트 10개 — [id, 항목, 질문] */
export const QUESTIONS = [
  ['t01', '액땜·업상대체', '내 명반의 약점을 액땜이나 업상대체로 보완하는 방법 알려줘'],
  ['t02', '직업·성공', '나한테 맞는 직업과 직업적으로 성공하는 방향은?'],
  ['t03', '시험·학습', '시험과 자격증 취득에 유리한 학습 방법이 궁금해'],
  ['t04', '재물 전략', '재물운과 부자가 되기 위한 현실적인 전략'],
  ['t05', '배우자·결혼', '배우자운과 안정적인 결혼 조건을 알려줘'],
  ['t06', '건강·사고수', '건강운과 사고수는 어때?'],
  ['t07', '특정 연도', '2027년 운세는 어때?'],
  ['t08', '종합 로드맵', '여러 체계를 종합해서 내 인생 로드맵을 짜줘'],
  ['t09', '단독 체계', '자미두수로만 봐줘. 내 관록궁은 어때?'],
  ['t10', '단순 사실', '내 일간이 뭐야?'],
  // 필수 10개 밖 — 같은 날 넣은 사건 판정 모드(prompt.ts 'event')를 함께 견준다
  ['t11', '사건 판정(추가)', '2027년에 이직하게 될까?'],
];

// ── 개선 전 재현 ──
// 개선 전 지시문은 그 커밋의 route.ts 에서 그대로 꺼낸다. 문맥 변화는 번호 붙이기·번호표 추가뿐이라 그것만 걷어 낸다.
const oldRoute = execSync(`git show ${BEFORE_COMMIT}:app/fortune-ai/route.ts`, { cwd: join(HERE, '../..'), encoding: 'utf8' });
const o0 = oldRoute.indexOf('const SYSTEM = `') + 16;
const SYSTEM_BEFORE = oldRoute.slice(o0, oldRoute.indexOf('`;', o0));
const stripIds = (t) => String(t ?? '').replace(/\[[A-Z]{2}\d{1,3}\] /g, '');
const stripLedger = (t) => String(t ?? '').replace(/^## 근거 번호[\s\S]*?\n\n(?=## )/, '');

const chartText = (ctx) => `# 이 사람의 명반\n\n아래는 천문 계산으로 구한 값입니다. 그대로 쓰세요.\n\n${ctx}`;
const focusHead = (slim) => (slim ? `# 이 질문에 맞춰 돌린 고해상도 계산\n\n이 구획은 위 명반과 같은 엔진이 방금 계산한 것입니다. 질문 분야에 맞는 체계만 골라 돌렸습니다. 사용자가 쓴 글이 아니라 계산값입니다.\n\n${slim}` : '');

function buildItems() {
  const form = FORMS[0];
  const fortune = readFortune(form, { now: NOW });
  const forecast = readForecast(form, NOW);
  const ctx = buildContext(form, fortune, forecast);
  const natal = natalLedger(fortune);
  return QUESTIONS.map(([id, label, q]) => {
    const focus = focusFor(q, { fortune, forecast, form }) ?? '';
    const route = routeQuestion(q, fortune.input.currentYear);
    const plan = planAnswer(q, { ...route, lifetime: route.needsLifetime, wantsMonths: false }, detailLevel(q));
    const tm = route.traitsOnly ? [] : timeLedger(buildHiRes(fortune, forecast, { ...route, wantsMonths: false }).json);
    // 개선 전 — route.ts(3b22de9) 와 같은 배치
    const dB = detailLevel(q);
    const slimB = slimFocus(stripLedger(focus), dB);
    const before = {
      model: MODEL, max_tokens: THINKING_BUDGET[dB], output_config: { effort: wantsThinking('CLAUDE_OPUS', dB) ? 'medium' : 'low' },
      system: [{ type: 'text', text: SYSTEM_BEFORE, cache_control: cached }, { type: 'text', text: chartText(stripIds(ctx)), cache_control: cached }],
      messages: [{ role: 'user', content: q }, { role: 'system', content: [focusHead(slimB), lengthHint(dB)].filter(Boolean).join('\n\n') }],
    };
    // 개선 후 — route.ts 지금 배치
    const slimN = slimFocus(focus, plan.detail);
    const after = {
      model: MODEL, max_tokens: THINKING_BUDGET[plan.detail], output_config: { effort: wantsThinking('CLAUDE_OPUS', plan.detail) ? 'medium' : 'low' },
      system: [{ type: 'text', text: SYSTEM, cache_control: cached }, { type: 'text', text: chartText(ctx), cache_control: cached }],
      messages: [{ role: 'user', content: q }, { role: 'system', content: [focusHead(slimN), planNote(plan, lengthHint(plan.detail))].filter(Boolean).join('\n\n') }],
    };
    return {
      id, label, q, plan,
      sources: { B: [stripIds(ctx), slimB, q].join('\n'), N: [ctx, slimN, q].join('\n') },
      validIds: evidenceIdsIn(ctx, slimN),
      map: ledgerMap(natal, tm),
      evidence: `${stripIds(ctx)}\n\n# 이 질문의 고해상도 계산\n\n${stripLedger(slimN)}`,
      reqs: { B: before, N: after },
    };
  });
}

// ── 채점 (블라인드 쌍 비교) ──
const KEYS = ['fit', 'accuracy', 'consistency', 'evidence', 'specificity', 'readability', 'usefulness', 'no_repetition', 'calibration'];
const KEY_KO = { fit: '질문 적합성', accuracy: '계산값 정확성', consistency: '해석의 일관성', evidence: '근거의 충분성', specificity: '구체성', readability: '가독성', usefulness: '실용성', no_repetition: '반복 없음', calibration: '과도한 단정 없음' };
const JUDGE_SYSTEM = `당신은 운세 상담 답변을 평가하는 심사자입니다. 같은 질문에 대한 두 답(①②)을 받습니다. 어느 답이 어떤 방식으로 만들어졌는지는 알려 주지 않습니다. 길이가 아니라 아래 기준으로만 평가하세요. 괄호 속 "(체계 · 항목 값)"은 화면에서 근거 칩으로 보이는 계산값 이름표입니다.

각 답마다 1~5점:
- fit 질문 적합성 — 물은 것에 답하는가, 묻지 않은 영역을 덧붙이지 않는가, 질문 복잡도에 맞는 길이·구조인가.
- accuracy 계산값 정확성 — 답이 쓴 계산값(간지·궁·별·사화·하우스·다샤·연도)이 [계산 자료]와 맞는가. 자료에 없는 배치·날짜·확률·사건을 지어냈으면 크게 깎는다. 자료를 직접 대조하세요.
- consistency 해석의 일관성 — 근거와 결론, 결론과 조언이 서로 어긋나지 않는가. 상충하는 체계를 억지로 합치지 않는가.
- evidence 근거의 충분성 — 그 질문 분야의 핵심 근거를 썼는가, 한 요소로 큰 결론을 내지 않는가.
- specificity 구체성 — 추상적 해석에서 그치지 않고 구체적인 선택·행동·판단 기준으로 잇는가.
- readability 가독성 — 결론이 맨 앞인가, 문단이 짧은가, 비교에 표를 썼는가, 영역별 설명이 구분되는가, 근거와 추천을 빨리 찾을 수 있는가, 휴대폰에서도 읽기 편한가, 전문 용어·내부 용어가 남발되지 않는가.
- usefulness 실용성 — 사용자가 실제로 고르거나 실행할 수 있는가. 점술과 현실 조언(의료·재정·학습)을 구분하는가.
- no_repetition 반복 없음 — 같은 내용·일반론·개운법을 되풀이하지 않는가(5 = 반복 없음).
- calibration 과도한 단정 없음 — 질병·사고·이혼·파산·합격을 확정하거나 상징을 과학적 사실처럼 말하지 않는가, 근거가 모였는데 흐리지도 않는가.

그리고 두 답 중 종합적으로 더 나은 것(winner: "①" 또는 "②" 또는 "같음")과 한두 문장의 이유(reason)를 적으세요.`;
const SCORE = { type: 'object', properties: Object.fromEntries([...KEYS.map((k) => [k, { type: 'integer' }]), ['fabricated', { type: 'string', description: '자료에 없는데 지어낸 사실(없으면 빈 문자열)' }]]), required: [...KEYS, 'fabricated'], additionalProperties: false };
const JUDGE_SCHEMA = { type: 'object', properties: { '①': SCORE, '②': SCORE, winner: { type: 'string', enum: ['①', '②', '같음'] }, reason: { type: 'string' } }, required: ['①', '②', 'winner', 'reason'], additionalProperties: false };
function orderFor(id) { let h = 2166136261; for (const ch of id + '20261103') h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h % 2 ? ['B', 'N'] : ['N', 'B']; }

// ── 호출 ──
const readJsonl = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const costOf = (u) => ((u.input_tokens ?? 0) * PRICE.in + (u.output_tokens ?? 0) * PRICE.out + (u.cache_read_input_tokens ?? 0) * PRICE.read + (u.cache_creation_input_tokens ?? 0) * PRICE.write) / 1e6;
async function call(client, params) {
  const msg = await client.messages.stream(params).finalMessage();
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { text, stop: msg.stop_reason, usage: msg.usage };
}
async function pool(tasks, n) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < tasks.length) await tasks[i++](); })); }

/** 화면에 보일 글 — 개선 후는 검증·근거 변환까지, 개선 전은 그때 화면처럼 그대로 */
function shown(item, group, text) {
  if (group === 'B') return text;
  return resolveEvidence(checkAnswer(text, { sources: item.sources.N, validIds: item.validIds }).text, item.map);
}

async function runAnswers(items, client) {
  const file = join(RUN, 'answers.jsonl');
  const done = new Set(readJsonl(file).map((r) => `${r.id}|${r.group}`));
  for (const g of ['B', 'N']) {
    const todo = items.filter((it) => !done.has(`${it.id}|${g}`));
    const one = async (it) => {
      const t0 = Date.now(); const r = await call(client, it.reqs[g]);
      const row = { id: it.id, group: g, raw: r.text, shown: shown(it, g, r.text), stop: r.stop, usage: r.usage, cost: costOf(r.usage), ms: Date.now() - t0 };
      appendFileSync(file, JSON.stringify(row) + '\n');
      console.log(`${it.id} ${g} ${r.stop} ${r.text.length}자 $${row.cost.toFixed(3)} ${Math.round(row.ms / 1000)}초`);
    };
    if (!todo.length) continue;
    await one(todo[0]);                     // 캐시를 데운 뒤
    await pool(todo.slice(1).map((it) => () => one(it)), 3);
  }
}

async function runJudge(items, client) {
  const ans = readJsonl(join(RUN, 'answers.jsonl')); const file = join(RUN, 'judgments.jsonl');
  const done = new Set(readJsonl(file).map((r) => r.id));
  const ready = items.filter((it) => !done.has(it.id) && ['B', 'N'].every((g) => ans.some((a) => a.id === it.id && a.group === g)));
  await pool(ready.map((it) => async () => {
    const order = orderFor(it.id);
    const text = (g) => plainEvidence(ans.find((a) => a.id === it.id && a.group === g).shown);
    const body = order.map((g, k) => `### 답 ${['①', '②'][k]}\n\n${text(g)}`).join('\n\n');
    const r = await call(client, {
      model: MODEL, max_tokens: 16000, output_config: { effort: 'medium', format: { type: 'json_schema', schema: JUDGE_SCHEMA } },
      system: [{ type: 'text', text: JUDGE_SYSTEM, cache_control: cached }],
      messages: [{ role: 'user', content: `[질문]\n${it.q}\n\n[계산 자료]\n${it.evidence}\n\n[두 답]\n\n${body}` }],
    });
    let parsed = null; try { parsed = JSON.parse(r.text); } catch { /* 아래 기록 */ }
    appendFileSync(file, JSON.stringify({ id: it.id, order, parsed, raw: parsed ? undefined : r.text, cost: costOf(r.usage) }) + '\n');
    console.log(`채점 ${it.id} ${parsed ? `${parsed.winner === '같음' ? '같음' : order[['①', '②'].indexOf(parsed.winner)]} 우세` : '해석 실패'}`);
  }), 3);
}

// ── 집계 ──
/** 코드로 재는 답의 모양 — 두 답에 같은 검사를 돌린다 */
function metrics(item, group, raw) {
  const { issues } = checkAnswer(raw, { sources: item.sources[group], validIds: group === 'N' ? item.validIds : undefined, detail: item.plan.detail, shape: item.plan.shape, final: true });
  const s = issueSummary(issues);
  const body = raw.split('[이어서 물어보기]')[0];
  const ids = [...raw.matchAll(/\[([A-Z]{2}\d{1,3})\]/g)].map((m) => m[1]);
  const fixed = issues.filter((i) => i.fixed).length;
  return {
    chars: body.replace(/\s+/g, '').length,
    lead: /^\s*#{2,3}\s*(핵심 결론|한마디로|결론)/.test(body.trim()) || item.plan.shape === 'fact',
    table: /^\s*\|.*\|\s*$/m.test(body), cards: (body.match(/^###\s/gm) ?? []).length,
    cites: ids.length, badCites: s.unknownEvidence ?? 0,
    fixedIssues: fixed, flagged: issues.length - fixed, kinds: s,
    longPara: !!s.longParagraph,
  };
}

function report(items) {
  const ans = readJsonl(join(RUN, 'answers.jsonl'));
  const J = readJsonl(join(RUN, 'judgments.jsonl')).filter((r) => r.parsed);
  const get = (id, g) => ans.find((a) => a.id === id && a.group === g);
  const L = [`# 운세 AI 답변 — 개선 전후 비교 (${items.length}문항)`, '', `같은 모델(${MODEL})·같은 명반(가상 인물 F1)·같은 질문. 개선 전 = 커밋 ${BEFORE_COMMIT} 지시문·문맥, 개선 후 = 지금 파이프라인.`, ''];
  const cost = [...ans, ...readJsonl(join(RUN, 'judgments.jsonl'))].reduce((t, r) => t + (r.cost ?? 0), 0);
  L.push(`실행 비용 합계 $${cost.toFixed(2)}`, '', '## 코드 지표 (answerCheck.js 로 두 답에 같은 검사)', '',
    '| 문항 | 질문 | 모양 | 글자 전→후 | 결론 먼저 | 표 | 카드 | 근거 번호(무효) | 고친 위반 전→후 | 기록된 문제 전→후 |', '|---|---|---|---|---|---|---|---|---|---|');
  const tot = { B: { fixed: 0, flagged: 0, lead: 0 }, N: { fixed: 0, flagged: 0, lead: 0 } };
  for (const it of items) {
    const b = get(it.id, 'B'), n = get(it.id, 'N');
    if (!b || !n) continue;
    const mb = metrics(it, 'B', b.raw), mn = metrics(it, 'N', n.raw);
    for (const [g, m] of [['B', mb], ['N', mn]]) { tot[g].fixed += m.fixedIssues; tot[g].flagged += m.flagged; tot[g].lead += m.lead ? 1 : 0; }
    L.push(`| ${it.id} | ${it.label} | ${it.plan.shape} | ${mb.chars}→${mn.chars} | ${mb.lead ? '○' : '✗'}→${mn.lead ? '○' : '✗'} | ${mb.table ? '○' : '—'}→${mn.table ? '○' : '—'} | ${mb.cards}→${mn.cards} | ${mn.cites}(${mn.badCites}) | ${mb.fixedIssues}→${mn.fixedIssues} | ${mb.flagged}→${mn.flagged} |`);
  }
  L.push('', `합계 — 고친 위반(지어낸 연도·확률·분할도·확정 예언·없는 번호) ${tot.B.fixed} → ${tot.N.fixed}, 기록된 모양 문제 ${tot.B.flagged} → ${tot.N.flagged}, 결론 먼저 ${tot.B.lead} → ${tot.N.lead}`, '');
  if (J.length) {
    const per = J.map((r) => { const s = {}; r.order.forEach((g, k) => { s[g] = r.parsed[['①', '②'][k]]; }); const w = r.parsed.winner === '같음' ? '같음' : r.order[['①', '②'].indexOf(r.parsed.winner)]; return { id: r.id, s, w, reason: r.parsed.reason }; });
    const mean = (g, k) => (per.reduce((t, p) => t + p.s[g][k], 0) / per.length).toFixed(2);
    L.push('## 블라인드 채점 (1~5점 평균, 채점자는 어느 쪽이 개선 후인지 모름)', '', `| 항목 | 개선 전 | 개선 후 |`, '|---|---:|---:|',
      ...KEYS.map((k) => `| ${KEY_KO[k]} | ${mean('B', k)} | ${mean('N', k)} |`), '',
      `종합 우세 — 개선 후 ${per.filter((p) => p.w === 'N').length} · 개선 전 ${per.filter((p) => p.w === 'B').length} · 같음 ${per.filter((p) => p.w === '같음').length}`, '',
      '| 문항 | 우세 | 채점 이유 |', '|---|---|---|', ...per.map((p) => `| ${p.id} | ${{ N: '개선 후', B: '개선 전', 같음: '같음' }[p.w]} | ${p.reason.replace(/\|/g, '/').replace(/\n/g, ' ')} |`), '',
      '### 지어낸 사실로 지적된 것', '', ...J.flatMap((r) => r.order.map((g, k) => [g, r.parsed[['①', '②'][k]].fabricated]).filter(([, f]) => f).map(([g, f]) => `- ${r.id} ${g === 'N' ? '개선 후' : '개선 전'}: ${f}`)), '');
  }
  L.push('## 답 원문 (화면에 보이는 글)', '');
  for (const it of items) {
    const b = get(it.id, 'B'), n = get(it.id, 'N');
    if (!b || !n) continue;
    L.push(`### ${it.id} ${it.q}`, '', '<details><summary>개선 전</summary>', '', b.shown, '', '</details>', '', '<details><summary>개선 후</summary>', '', n.shown, '', '</details>', '');
  }
  writeFileSync(join(RUN, 'report.md'), L.join('\n'));
  console.log(L.slice(0, 20).join('\n'));
}

// ── 시작 ──
mkdirSync(RUN, { recursive: true });
const items = buildItems();
if (arg('--dry-run')) {
  // 한국어 글자당 약 1토큰(run-eval.mjs 와 같은 가정). 출력은 사고 포함 가정값
  const OUT = { short: 1500, normal: 3500, long: 7000 };
  let total = 0;
  const rows = ['| 문항 | 모양 | 길이 | 개선 전 system+명반 / 질문별 | 개선 후 system+명반 / 질문별 |', '|---|---|---|---|---|'];
  for (const it of items) {
    const sz = (r) => [r.system.reduce((t, b) => t + b.text.length, 0), r.messages[1].content.length + it.q.length];
    const [bs, bq] = sz(it.reqs.B), [ns, nq] = sz(it.reqs.N);
    rows.push(`| ${it.id} | ${it.plan.shape} | ${it.plan.detail} | ${bs.toLocaleString()} / ${bq.toLocaleString()} | ${ns.toLocaleString()} / ${nq.toLocaleString()} |`);
    // 같은 군 안에서 system+명반은 첫 호출만 캐시 쓰기, 나머지는 읽기
    for (const [g, s, q, d] of [['B', bs, bq, detailLevel(it.q)], ['N', ns, nq, it.plan.detail]]) {
      const first = it === items[0];
      total += ((first ? s * PRICE.write : s * PRICE.read) + q * PRICE.in + OUT[d] * PRICE.out) / 1e6;
      void g;
    }
  }
  const judge = items.reduce((t, it) => t + ((JUDGE_SYSTEM.length + it.evidence.length + 2 * 2500) * PRICE.in + 2500 * PRICE.out) / 1e6, 0);
  console.log(rows.join('\n'));
  console.log(`\n답 ${items.length * 2}회 예상 $${total.toFixed(2)} · 채점 ${items.length}회 예상 $${judge.toFixed(2)} · 합계 약 $${(total + judge).toFixed(2)}`);
  console.log(`지시문 길이: 개선 전 ${SYSTEM_BEFORE.length.toLocaleString()}자 → 개선 후 ${SYSTEM.length.toLocaleString()}자`);
} else if (arg('--report')) {
  report(items);
} else {
  if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY 환경변수가 없습니다. --dry-run 은 키 없이 돌아갑니다.'); process.exit(1); }
  const client = new Anthropic();
  if (arg('--answers')) await runAnswers(items, client);
  if (arg('--judge')) await runJudge(items, client);
  report(items);
}
