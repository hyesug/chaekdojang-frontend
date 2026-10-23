/*
 * 운세 AI 답변 품질 블라인드 비교 — PROTOCOL.md (실행 전 고정).
 *
 *   node analysis/answer-quality/run-eval.mjs --dry-run          입력 크기·예상 비용만 (모델 호출 없음)
 *   node analysis/answer-quality/run-eval.mjs --answers [--limit N]  A·B·C 답 만들기 (호출 — 비용 발생)
 *   node analysis/answer-quality/run-eval.mjs --judge            블라인드 채점 (호출 — 비용 발생)
 *   node analysis/answer-quality/run-eval.mjs --report           집계·report.md
 *
 * 키는 ANTHROPIC_API_KEY 환경변수 또는 `ant auth login` 프로필로만 읽는다. 저장하지 않는다.
 * 중간에 끊겨도 다시 돌리면 이미 받은 답·채점은 건너뛴다(runs/<run>/*.jsonl).
 */
import Anthropic from '@anthropic-ai/sdk';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFortune } from '../../public/unse/src/engine.js';
import { readForecast } from '../../public/unse/src/forecast.js';
import { buildContext } from '../../public/unse/src/aiContext.js';
import { focusFor } from '../../public/unse/src/ai.js';
import { detailLevel, lengthHint, slimFocus, THINKING_BUDGET, wantsThinking } from '../../app/fortune-ai/conversation.ts';
import { FORMS, QUESTIONS, NOW } from './items.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k) => process.argv.includes(k);
const val = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const RUN = join(HERE, 'runs', val('--run', 'r1'));
const MODEL = 'claude-opus-5-5';
// Opus 5.5 단가(USD / 100만 토큰) — 입력 4 · 출력 20 · 캐시 읽기 0.2 · 5분 캐시 쓰기 1.25배
const PRICE = { in: 4, out: 20, read: 0.2, write: 5 };
const cached = { type: 'ephemeral', ttl: '5m' };

// ── 프롬프트 ──
const routeSrc = readFileSync(join(HERE, '../../app/fortune-ai/route.ts'), 'utf8');
const s0 = routeSrc.indexOf('const SYSTEM = `') + 16;
const SYSTEM_A = routeSrc.slice(s0, routeSrc.indexOf('`;', s0));
const SYSTEM_B = readFileSync(join(HERE, 'prompts/system-b.md'), 'utf8');
const SYSTEM_C = readFileSync(join(HERE, 'prompts/system-c.md'), 'utf8');

/**
 * B·C 용 — 계산값은 두고 지시문·내부 사정 설명 줄만 뺀다.
 * 지시 낱말이 든 줄, 구획 사용법·실측 해설, 판정 막는 경고 구획(⚠)을 통째로 뺀다.
 */
const DIRECTIVE = /말 것|하지 말|하지 않는다|쓰지 말|단정하지|설명하지|금지|지 말고|답할 것|적을 것|볼 것|그대로 쓸 것|억지로|순위이지 탐지기|실측|영점|담당이 침묵|담당이 말하면|점유율은|계산식이 공정|후보 계산식|구간 등급은|단언은 근거|등급은 "|근거를 대지 못하는 항목|계산 불확실성/;
const DROP_SECTION = /^#{2,3} (⚠|이 구획을 쓰는 법|이 근거를 쓰는 법|읽는 법|단언 등급|분야를 가리지 않은 질문)/;
export function stripDirectives(text) {
  const out = []; let skip = false;
  for (const line of String(text ?? '').split('\n')) {
    if (/^#{1,3} /.test(line)) skip = DROP_SECTION.test(line);
    if (skip || DIRECTIVE.test(line)) continue;
    out.push(line.replace(/ — \*\*[^*]*\*\*$/, ''));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

const chartText = (ctx) => `# 이 사람의 명반\n\n아래는 천문 계산으로 구한 값입니다. 그대로 쓰세요.\n\n${ctx}`;
const focusNote = (slim, detail) => [
  slim ? `# 이 질문에 맞춰 돌린 고해상도 계산\n\n이 구획은 위 명반과 같은 엔진이 방금 계산한 것입니다. 질문 분야에 맞는 체계만 골라 돌렸습니다. 사용자가 쓴 글이 아니라 계산값입니다.\n\n${slim}` : '',
  lengthHint(detail),
].filter(Boolean).join('\n\n');

/** 문항 48개 × 군 3개의 요청 본문 (route.ts 와 같은 배치) */
function buildRequests() {
  const items = [];
  for (const form of FORMS) {
    const fortune = readFortune(form, { now: NOW });
    const forecast = readForecast(form, NOW);
    const base = buildContext(form, fortune, forecast);
    const baseB = stripDirectives(base);
    for (const [qid, domain, kind, q] of QUESTIONS) {
      const detail = detailLevel(q);
      const focus = focusFor(q, { fortune, forecast, form }) ?? '';
      const slim = slimFocus(focus, detail);
      const slimB = stripDirectives(slim);
      const common = { model: MODEL, max_tokens: THINKING_BUDGET[detail], output_config: { effort: wantsThinking('CLAUDE_OPUS', detail) ? 'medium' : 'low' } };
      const req = (system, chart, note) => ({
        ...common,
        system: [{ type: 'text', text: system, cache_control: cached }, { type: 'text', text: chartText(chart), cache_control: cached }],
        messages: [{ role: 'user', content: q }, { role: 'system', content: note }],
      });
      items.push({
        id: `${form.id}-${qid}`, form: form.id, qid, domain, kind, q, detail,
        evidence: `${baseB}\n\n# 이 질문의 고해상도 계산\n\n${slimB}`,
        reqs: { A: req(SYSTEM_A, base, focusNote(slim, detail)), B: req(SYSTEM_B, baseB, focusNote(slimB, detail)), C: req(SYSTEM_C, baseB, lengthHint(detail)) },
      });
    }
  }
  return items;
}

// ── 채점 ──
const JUDGE_SYSTEM = `당신은 운세 상담 답변을 평가하는 심사자입니다. 같은 질문에 대한 세 답(①②③)을 받습니다. 어느 답이 어떤 방식으로 만들어졌는지는 알려 주지 않습니다. 답의 길이나 형식이 아니라 아래 기준으로만 평가하세요.

각 답마다 1~5점:
1. direct — 첫머리에서 물은 것에 답하는가. 양자택일이면 어느 쪽에 더 가까운지 밝히는가. "알 수 없다"로 피하면 낮은 점수.
2. accurate — 답이 쓴 계산값(간지·궁·별·사화·하우스·다샤·연도)이 [계산 자료]와 맞는가. 자료에 없는 사실·날짜·확률·사건을 지어냈으면 크게 깎는다. 자료를 직접 대조하세요.
3. key_evidence — 그 질문 분야의 핵심 근거를 썼는가(직업: 관록궁과 그 사화·관성·MC/10하우스 / 돈: 재백궁·재성·2·8·11하우스 / 연애·배우자: 부처궁·일지·7하우스·금성·D9 / 건강: 질액궁·오행 편중·6하우스 / 시기: 대운·세운·대한·유년·다샤). 자료에 그 근거가 있는데 빠뜨렸으면 깎는다.
4. calibrated — 근거보다 세게 단정하지도, 근거가 모였는데 흐리지도 않는가.
5. readable — 일반인이 읽기에 자연스럽고 이해하기 쉬운가. 내부 용어(점유율·담당 체계·Tier·후보 순위 같은)나 설명 없는 전문 용어가 많으면 깎는다.

그리고 세 답을 종합해 가장 나은 순서(ranking, 예: ["②","①","③"])를 매기고, 한두 문장으로 이유(reason)를 적으세요.`;
const SCORE = { type: 'object', properties: { direct: { type: 'integer' }, accurate: { type: 'integer' }, key_evidence: { type: 'integer' }, calibrated: { type: 'integer' }, readable: { type: 'integer' }, fabricated: { type: 'string', description: '자료에 없는데 지어낸 사실(없으면 빈 문자열)' } }, required: ['direct', 'accurate', 'key_evidence', 'calibrated', 'readable', 'fabricated'], additionalProperties: false };
const JUDGE_SCHEMA = { type: 'object', properties: { '①': SCORE, '②': SCORE, '③': SCORE, ranking: { type: 'array', items: { type: 'string', enum: ['①', '②', '③'] } }, reason: { type: 'string' } }, required: ['①', '②', '③', 'ranking', 'reason'], additionalProperties: false };
const LABELS = ['①', '②', '③'];
/** 문항마다 고정 시드로 섞는다 — 같은 문항은 다시 돌려도 같은 순서 */
function shuffleFor(id) {
  let h = 2166136261; for (const ch of id + '20261019') h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const v = ['A', 'B', 'C'];
  for (let i = 2; i > 0; i--) { h = Math.imul(h ^ (h >>> 13), 1597334677) >>> 0; const j = h % (i + 1); [v[i], v[j]] = [v[j], v[i]]; }
  return v; // v[k] = 라벨 LABELS[k] 의 군
}
function judgeRequest(item, answers) {
  const order = shuffleFor(item.id);
  const body = order.map((g, k) => `### 답 ${LABELS[k]}\n\n${answers[g]}`).join('\n\n');
  return {
    model: MODEL, max_tokens: 16000, output_config: { effort: 'medium', format: { type: 'json_schema', schema: JUDGE_SCHEMA } },
    system: [{ type: 'text', text: JUDGE_SYSTEM, cache_control: cached }],
    messages: [{ role: 'user', content: `[질문]\n${item.q}\n\n[계산 자료]\n${item.evidence}\n\n[세 답]\n\n${body}` }],
    order,
  };
}

// ── 호출 ──
const readJsonl = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const costOf = (u) => ((u.input_tokens ?? 0) * PRICE.in + (u.output_tokens ?? 0) * PRICE.out + (u.cache_read_input_tokens ?? 0) * PRICE.read + (u.cache_creation_input_tokens ?? 0) * PRICE.write) / 1e6;
async function call(client, params) {
  const { order, ...p } = params;
  const msg = await client.messages.stream(p).finalMessage();
  if (msg.stop_reason === 'refusal') return { text: '', stop: 'refusal', usage: msg.usage };
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { text, stop: msg.stop_reason, usage: msg.usage };
}
async function pool(tasks, n) { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < tasks.length) { const k = i++; out[k] = await tasks[k](); } })); return out; }

async function runAnswers(items, client) {
  const file = join(RUN, 'answers.jsonl');
  const done = new Set(readJsonl(file).map((r) => `${r.id}|${r.group}`));
  let spent = readJsonl(file).reduce((s, r) => s + r.cost, 0);
  // 캐시가 맞게 군·명반 단위로 묶고, 묶음마다 첫 호출이 끝난 뒤(캐시 데움) 나머지를 셋씩 병렬로
  for (const g of ['A', 'B', 'C']) for (const form of FORMS.map((f) => f.id)) {
    const todo = items.filter((it) => it.form === form && !done.has(`${it.id}|${g}`));
    const one = async (it) => {
      const t0 = Date.now(); const r = await call(client, it.reqs[g]);
      const row = { id: it.id, group: g, text: r.text, stop: r.stop, usage: r.usage, cost: costOf(r.usage), ms: Date.now() - t0 };
      appendFileSync(file, JSON.stringify(row) + '\n'); spent += row.cost;
      console.log(`${it.id} ${g} ${r.stop} ${row.text.length}자 $${row.cost.toFixed(3)} 누계 $${spent.toFixed(2)}`);
    };
    if (!todo.length) continue;
    await one(todo[0]);
    await pool(todo.slice(1).map((it) => () => one(it)), 3);
  }
}
async function runJudge(items, client) {
  const ans = readJsonl(join(RUN, 'answers.jsonl')); const file = join(RUN, 'judgments.jsonl');
  const done = new Set(readJsonl(file).map((r) => r.id));
  const ready = items.filter((it) => !done.has(it.id) && ['A', 'B', 'C'].every((g) => ans.some((a) => a.id === it.id && a.group === g)));
  let spent = readJsonl(file).reduce((s, r) => s + r.cost, 0);
  const one = async (it) => {
    const answers = Object.fromEntries(['A', 'B', 'C'].map((g) => [g, ans.find((a) => a.id === it.id && a.group === g).text]));
    const req = judgeRequest(it, answers); const r = await call(client, req);
    let parsed = null; try { parsed = JSON.parse(r.text); } catch { /* 아래에서 기록 */ }
    const row = { id: it.id, order: req.order, parsed, raw: parsed ? undefined : r.text, stop: r.stop, cost: costOf(r.usage) };
    appendFileSync(file, JSON.stringify(row) + '\n'); spent += row.cost;
    console.log(`채점 ${it.id} ${parsed ? parsed.ranking.map((l) => req.order[LABELS.indexOf(l)]).join('>') : '해석 실패'} 누계 $${spent.toFixed(2)}`);
  };
  if (ready.length) { await one(ready[0]); await pool(ready.slice(1).map((it) => () => one(it)), 3); }
}

// ── 집계 ──
function report(items) {
  const J = readJsonl(join(RUN, 'judgments.jsonl')).filter((r) => r.parsed);
  const ans = readJsonl(join(RUN, 'answers.jsonl'));
  const KEYS = ['direct', 'accurate', 'key_evidence', 'calibrated', 'readable'];
  const per = J.map((r) => { const s = {}; r.order.forEach((g, k) => { s[g] = r.parsed[LABELS[k]]; }); const rank = r.parsed.ranking.map((l) => r.order[LABELS.indexOf(l)]); return { id: r.id, s, rank, reason: r.parsed.reason }; });
  const mean = (g, k) => per.reduce((t, p) => t + p.s[g][k], 0) / per.length;
  const total = (p, g) => KEYS.reduce((t, k) => t + p.s[g][k], 0);
  const first = (g) => per.filter((p) => p.rank[0] === g).length;
  const binom = (n, k) => { let s = 0; const C = (a, b) => { let x = 1; for (let i = 0; i < b; i++) x = x * (a - i) / (i + 1); return x; }; for (let i = k; i <= n; i++) s += C(n, i) / 2 ** n; return Math.min(1, 2 * Math.min(s, 1 - s + C(n, k) / 2 ** n)); };
  const pair = (x, y) => { let w = 0, l = 0; for (const p of per) { const a = p.rank.indexOf(x), b = p.rank.indexOf(y); if (a < b) w++; else l++; } return { w, l, p: binom(w + l, Math.max(w, l)) }; };
  let seed = 7; const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const ci = (x, y) => { const d = per.map((p) => total(p, x) - total(p, y)); const bs = []; for (let k = 0; k < 2000; k++) { let t = 0; for (let i = 0; i < d.length; i++) t += d[Math.floor(rnd() * d.length)]; bs.push(t / d.length); } bs.sort((a, b) => a - b); return [bs[49], bs[1949]].map((v) => v.toFixed(2)).join(' ~ '); };
  const cost = [...ans, ...readJsonl(join(RUN, 'judgments.jsonl'))].reduce((t, r) => t + (r.cost ?? 0), 0);
  const L = [`# 답변 품질 블라인드 비교 결과 (${per.length}문항)`, '', `절차: PROTOCOL.md · 실행 비용 합계 $${cost.toFixed(2)}`, '',
    '| 군 | 종합 1위 | 직답 | 근거 정확 | 핵심 근거 | 균형 | 읽기 | 합계 |', '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...['A', 'B', 'C'].map((g) => `| ${{ A: 'A 현행', B: 'B 간소화', C: 'C 일반 상담' }[g]} | ${first(g)}/${per.length} | ${KEYS.map((k) => mean(g, k).toFixed(2)).join(' | ')} | ${(KEYS.reduce((t, k) => t + mean(g, k), 0)).toFixed(2)} |`), '',
    '| 비교 | 앞선 문항 / 뒤진 문항 | 부호 검정 p | 합계 차이 95% 구간 |', '|---|---:|---:|---:|',
    ...[['B', 'A'], ['A', 'C'], ['B', 'C']].map(([x, y]) => { const r = pair(x, y); return `| ${x} vs ${y} | ${r.w} / ${r.l} | ${r.p.toFixed(3)} | ${ci(x, y)} |`; }), '',
    '## 분야·유형별 종합 1위', '', '| 문항 | 질문 | 순위 | 채점 이유 |', '|---|---|---|---|',
    ...per.map((p) => { const it = items.find((i) => i.id === p.id); return `| ${p.id} | ${it?.q ?? ''} | ${p.rank.join(' > ')} | ${p.reason.replace(/\|/g, '/').replace(/\n/g, ' ')} |`; }), '',
    '## 지어낸 사실로 지적된 것', '', ...J.flatMap((r) => r.order.map((g, k) => [g, r.parsed[LABELS[k]].fabricated, r.id]).filter(([, f]) => f).map(([g, f, id]) => `- ${id} ${g}: ${f}`)), ''];
  writeFileSync(join(RUN, 'report.md'), L.join('\n'));
  console.log(L.slice(0, 14).join('\n'));
}

// ── 시작 ──
mkdirSync(RUN, { recursive: true });
const items = buildRequests();
if (arg('--dry-run')) {
  // 글자 수로 어림한다(한국어 기준 글자당 약 1토큰 — scripts/measure-fortune-ai.mjs 와 같은 가정). 출력은 사고 포함 가정값
  const TOK = Number(val('--tok', '1.0')); const OUT = { short: 1500, normal: 3000, long: 6000 };
  let noCache = 0, withCache = 0; const seen = new Set(); const rows = [];
  for (const g of ['A', 'B', 'C']) {
    let sysC = 0, chartC = 0, varC = 0;
    for (const it of items) {
      const r = it.reqs[g]; const sys = r.system[0].text.length, chart = r.system[1].text.length, vary = it.q.length + r.messages[1].content.length;
      sysC = sys; chartC = Math.max(chartC, chart); varC += vary;
      const inTok = (sys + chart + vary) * TOK, out = OUT[it.detail];
      noCache += (inTok * PRICE.in + out * PRICE.out) / 1e6;
      const key = `${g}|${it.form}`; const cachedTok = (sys + chart) * TOK;
      withCache += (seen.has(key) ? cachedTok * PRICE.read : cachedTok * PRICE.write) / 1e6 + (vary * TOK * PRICE.in + out * PRICE.out) / 1e6; seen.add(key);
    }
    rows.push(`${g}: system ${sysC.toLocaleString()}자 · 명반 최대 ${chartC.toLocaleString()}자 · 질문별 평균 ${Math.round(varC / items.length).toLocaleString()}자`);
  }
  let judge = 0; for (const it of items) { const tok = (JUDGE_SYSTEM.length + it.evidence.length + 3 * 1500) * TOK; judge += (tok * PRICE.in + 1500 * PRICE.out) / 1e6; }
  console.log(`문항 ${items.length}개 × 군 3개 = 답 ${items.length * 3}회 + 채점 ${items.length}회`);
  console.log(rows.join('\n'));
  console.log(`답 생성 예상: 캐시 없이 $${noCache.toFixed(2)} · 캐시 적용 $${withCache.toFixed(2)}`);
  console.log(`채점 예상: $${judge.toFixed(2)}`);
  console.log(`합계 예상(캐시 적용): $${(withCache + judge).toFixed(2)}`);
  writeFileSync(join(RUN, 'dry-run-sample-B.txt'), items[0].reqs.B.system.map((b) => b.text).join('\n\n----\n\n') + '\n\n----\n\n' + items[0].reqs.B.messages[1].content);
} else if (arg('--report')) {
  report(items);
} else {
  const client = new Anthropic();
  const limit = Number(val('--limit', '0'));
  const pick = limit ? items.filter((it) => QUESTIONS.slice(0, limit).some(([qid]) => it.qid === qid)) : items;
  if (arg('--answers')) await runAnswers(pick, client);
  if (arg('--judge')) await runJudge(pick, client);
  if (arg('--answers') || arg('--judge')) report(pick);
}
