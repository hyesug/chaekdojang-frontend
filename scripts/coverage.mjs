/**
 * coverage.mjs — **15체계 × 12분야 정보 충실도 감사표**
 *
 *   node scripts/coverage.mjs                 표만
 *   node scripts/coverage.mjs --sample        한 사람을 실제로 돌려 본 결과까지
 *
 * "자미가 잘 맞고 주역이 못 맞는다"를 견주기 전에, **체계마다 우리가 얼마나
 * 깊게 읽고 있는지**를 먼저 본다. 깊이가 다르면 성능 비교가 공정하지 않다.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { natalFortune } from '../public/unse/src/semantic/index.js';
import {
  DOMAINS, DOMAIN_LABEL, coverage, gather, interpretDomain, DOMAIN_RULES, NATURE_FILLED,
} from '../public/unse/src/semantic/domains.js';
import { RULES } from '../public/unse/src/semantic/rules.js';
import { SYSTEM_IDS, SYSTEM_NAME } from '../public/unse/src/semantic/extract.js';
import { interpretCareer } from '../public/unse/src/semantic/systems.js';
import { AXIS_LABEL } from '../public/unse/src/semantic/axes.js';

const withSample = process.argv.includes('--sample');
const cov = coverage();
const pad = (s, n) => {
  const w = [...String(s ?? '')].reduce((a, c) => a + (/[가-힣一-鿿]/.test(c) ? 2 : 1), 0);
  return String(s ?? '') + ' '.repeat(Math.max(0, n - w));
};

// 직업은 rules.js 쪽 등록소에서 센다
const careerCount = (id) => {
  const rs = RULES.filter((r) => r.system === id && r.domain === 'career');
  const direct = rs.filter((r) => r.evidenceType === 'direct').length;
  return { mark: !rs.length ? '—' : direct >= 10 ? '◎' : direct > 0 ? '○' : '△', total: rs.length, direct,
    where: [...new Set(rs.map((r) => r.where))] };
};

const cell = (id, d) => (d === 'career' ? careerCount(id) : cov[id][d]);

const out = [];
out.push('# 15체계 × 12분야 정보 충실도 감사표');
out.push('');
out.push('`src/semantic/rules.js` 와 `src/semantic/domains.js` 의 규칙 등록소에서');
out.push('바로 센 값입니다. 이 문서와 코드가 갈라질 수 없습니다.');
out.push('');
out.push('| 표시 | 뜻 |');
out.push('|---|---|');
out.push('| ◎ | 전용 자리가 있고 규칙이 열 개 이상 |');
out.push('| ○ | 전용 자리가 있다 |');
out.push('| △ | 전용 자리는 없고 **물상**으로만 읽는다 |');
out.push('| — | 이 전통은 이 분야를 말하지 않는다 |');
out.push('');

// ── 표 ──
const head = ['체계', ...DOMAINS.map((d) => DOMAIN_LABEL[d])];
out.push(`| ${head.join(' | ')} |`);
out.push(`|${head.map(() => '---').join('|')}|`);
for (const id of SYSTEM_IDS) {
  const row = [SYSTEM_NAME[id], ...DOMAINS.map((d) => {
    const c = cell(id, d);
    return c ? `${c.mark} ${c.total}` : '—';
  })];
  out.push(`| ${row.join(' | ')} |`);
}
out.push('');
out.push('숫자는 그 칸에 등록된 해석 규칙 수입니다.');
out.push('');

// ── 체계별 상세 ──
out.push('---');
out.push('');
out.push('## 체계별 — 무엇을 읽고 무엇을 안 읽는가');
out.push('');
for (const id of SYSTEM_IDS) {
  out.push(`### ${SYSTEM_NAME[id]}`);
  out.push('');
  out.push('| 분야 | 깊이 | 규칙 | 읽는 자리 |');
  out.push('|---|---|---|---|');
  for (const d of DOMAINS) {
    const c = cell(id, d);
    if (!c || !c.total) { out.push(`| ${DOMAIN_LABEL[d]} | — | 0 | 이 전통은 여기를 말하지 않는다 |`); continue; }
    out.push(`| ${DOMAIN_LABEL[d]} | ${c.mark} | ${c.total} (직접 ${c.direct}) | ${c.where.slice(0, 4).join(' · ')} |`);
  }
  out.push('');
}

// ── 아직 공정하게 비교할 수 없는 체계 ──
out.push('---');
out.push('');
out.push('## 아직 정보량이 얕은 자리');
out.push('');
const thin = [];
for (const id of SYSTEM_IDS) {
  const totals = DOMAINS.map((d) => cell(id, d)?.total ?? 0);
  const sum = totals.reduce((a, b) => a + b, 0);
  const directSum = DOMAINS.map((d) => cell(id, d)?.direct ?? 0).reduce((a, b) => a + b, 0);
  thin.push({ id, sum, directSum });
}
thin.sort((a, b) => a.sum - b.sum);
for (const t of thin.slice(0, 6)) {
  out.push(`- **${SYSTEM_NAME[t.id]}** — 규칙 ${t.sum}개 (직접 근거 ${t.directSum}개). ` +
    (t.directSum === 0 ? '전용 자리가 하나도 없어 전부 물상으로만 읽습니다. 직접 근거를 내는 체계와 같은 자로 견주면 안 됩니다.'
      : '전용 자리가 적습니다.'));
}
out.push('');
out.push('물상으로만 채운 칸: ' + (NATURE_FILLED.size ? `${NATURE_FILLED.size}개` : '없음'));
out.push('');

// ── 보강할 재료가 없는 자리 ──
out.push('## 더 깊게 읽을 재료가 없는 자리');
out.push('');
out.push('| 체계 | 왜 |');
out.push('|---|---|');
out.push('| 토정비결 | 중괘(1~6)·하괘(1~3)는 팔괘가 아니라 옮길 물상표가 없습니다. 상괘 하나가 전부입니다 |');
out.push('| 태국 점성술 | 색·방위·불상이 전부 **출생 요일에서 파생된 같은 정보**입니다. 따로 세면 한 재료를 네 번 세는 것입니다 |');
out.push('| 타로 | 상황·과제·조언 카드는 **해마다 바뀌어** 원국에 쓸 수 없습니다. 생일 카드 하나뿐입니다 |');
out.push('| 마하보테 | 자리와 요일 행성 둘뿐이고, 요일 행성은 태국 점성술과 **같은 재료**라 계보가 묶입니다 |');
out.push('');

// ── 표본 한 사람 ──
if (withSample) {
  const { fortune, stack } = natalFortune({
    name: 'x', gender: 'female', year: 1992, month: 1, day: 30,
    hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전',
  });
  const raw = gather(fortune, stack);
  out.push('---');
  out.push('');
  out.push('## 실제로 한 사람을 돌려 본 결과 (표본 하나)');
  out.push('');
  out.push('| 분야 | 말한 체계 | 침묵 | 가장 두드러진 축 |');
  out.push('|---|---|---|---|');
  for (const d of DOMAINS) {
    const reads = d === 'career' ? interpretCareer(fortune, stack) : interpretDomain(raw, d);
    const spoke = reads.filter((r) => r.status === 'ok');
    const top = {};
    for (const r of spoke) for (const [k, v] of Object.entries(r.features ?? {})) top[k] = Math.max(top[k] ?? 0, v);
    const lead = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k, v]) => `${AXIS_LABEL[k] ?? k} ${v.toFixed(2)}`).join(' · ');
    out.push(`| ${DOMAIN_LABEL[d]} | ${spoke.length} | ${reads.length - spoke.length} | ${lead || '—'} |`);
  }
  out.push('');
}

const md = out.join('\n') + '\n';
mkdirSync('docs/unse', { recursive: true });
writeFileSync('docs/unse/coverage.md', md, 'utf8');

// 콘솔 요약
console.log('체계'.padEnd(12) + DOMAINS.map((d) => pad(DOMAIN_LABEL[d], 7)).join(''));
for (const id of SYSTEM_IDS) {
  console.log(pad(SYSTEM_NAME[id], 12) + DOMAINS.map((d) => {
    const c = cell(id, d);
    return pad(c && c.total ? `${c.mark}${c.total}` : '—', 7);
  }).join(''));
}
console.log('');
console.log(`규칙 합계 — 직업 ${RULES.filter((r) => r.domain === 'career').length}개 · 나머지 열한 분야 ${DOMAIN_RULES.length}개`);
console.log('docs/unse/coverage.md 에 자세한 표를 적었습니다.');
