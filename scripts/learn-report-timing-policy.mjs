/**
 * /unse 리포트의 연도 시기 규칙을 실제 사례로 고른다.
 *
 * 결과가 좋아 보이는 후보를 그대로 채택하지 않는다. 사람 하나를 통째로 뺀
 * LOO와 사건 연도를 섞은 기준선을 모두 통과한 후보만 policy.js에 옮길 수 있다.
 */
import { existsSync, readFileSync } from 'node:fs';
import { timingFor } from '../public/unse/src/semantic/compose/timing.js';
import { scoreEventYearly } from '../public/unse/src/validation/timingMetrics.js';
import { selectTimingPolicy } from '../public/unse/src/validation/timingPolicy.js';
import { seededRandom } from '../public/unse/src/semantic/timing/schema.js';

const file = process.argv[2] ?? 'validation/cases.json';
if (!existsSync(file)) {
  console.error(`${file} 이 없습니다.`);
  process.exit(1);
}

const DOMAIN = { 직업: '직업', 재물: '재물', 관계: '관계', 결혼: '결혼', 주거: '주거', 이사: '이사', 건강: '건강', 학업: '학업', 자녀: '자녀' };
const CANDIDATES = {
  baseline: null,
  saju: { systems: ['saju'] },
  jamidusu: { systems: ['jamidusu'] },
  vedic: { systems: ['vedic'] },
  saju_jamidusu: { systems: ['saju', 'jamidusu'] },
  saju_vedic: { systems: ['saju', 'vedic'] },
  jamidusu_vedic: { systems: ['jamidusu', 'vedic'] },
  all: { systems: ['saju', 'jamidusu', 'vedic'] },
};
const names = Object.keys(CANDIDATES);
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

function seriesFor(birth, domain, from, to, policy) {
  const input = { ...birth, currentYear: from };
  const chart = { gender: birth.gender };
  const output = timingFor(input, chart, domain, { from, to, policy });
  const byYear = new Map(output.rows.map((row) => [row.year, row.systems.length * 10 + row.n]));
  return Array.from({ length: to - from + 1 }, (_, i) => {
    const year = from + i;
    return { k: String(year), v: byYear.get(year) ?? 0 };
  });
}

function scoreSeries(series, year) {
  const score = scoreEventYearly(series, year);
  return score.unscorable ? null : score.eventPercentile;
}

const groups = new Map();
for (const person of JSON.parse(readFileSync(file, 'utf8'))) {
  for (const event of person.events ?? []) {
    const domain = DOMAIN[event.domain];
    if (!domain || !Number.isInteger(event.year)) continue;
    const key = `${person.id}\u0000${domain}`;
    const group = groups.get(key) ?? { person: person.id, birth: person.birth, domain, events: [] };
    group.events.push(event);
    groups.set(key, group);
  }
}

const rowsByDomain = new Map();
for (const group of groups.values()) {
  const years = group.events.map((event) => event.year);
  const from = Math.min(...years) - 3;
  const to = Math.max(...years) + 3;
  const series = Object.fromEntries(names.map((name) => [name,
    seriesFor(group.birth, group.domain, from, to, CANDIDATES[name]) ]));
  for (const event of group.events) {
    const scores = Object.fromEntries(names.map((name) => [name, scoreSeries(series[name], event.year)]));
    const row = {
      person: group.person,
      precision: event.month == null ? 'year' : 'month',
      scores, series, from, to,
    };
    const list = rowsByDomain.get(group.domain) ?? [];
    list.push(row);
    rowsByDomain.set(group.domain, list);
  }
}

function shuffledRows(rows, random) {
  return rows.map((row) => {
    const year = row.from + Math.floor(random() * (row.to - row.from + 1));
    return {
      ...row,
      scores: Object.fromEntries(names.map((name) => [name, scoreSeries(row.series[name], year)])),
    };
  });
}

console.log('# 리포트 시기 정책 학습');
console.log('사례에 맞춘 점수가 아니라, 사람 단위 LOO와 날짜 섞기 검증을 통과한 후보만 제안합니다.');
const promoted = {};
for (const [domain, rows] of rowsByDomain) {
  const preliminary = selectTimingPolicy(rows, { baseline: 'baseline' });
  const random = seededRandom(20261008);
  const shuffled = [];
  if (preliminary.loo?.selected != null) {
    for (let i = 0; i < 200; i++) {
      const verdict = selectTimingPolicy(shuffledRows(rows, random), { baseline: 'baseline' });
      if (verdict.loo?.selected != null) shuffled.push(verdict.loo.selected);
    }
  }
  const verdict = selectTimingPolicy(rows, { baseline: 'baseline', shuffledSelectedScores: shuffled });
  const loo = verdict.loo ? `${verdict.loo.baseline?.toFixed(1)} → ${verdict.loo.selected?.toFixed(1)}` : '—';
  const p = verdict.permutation?.p == null ? '—' : verdict.permutation.p.toFixed(3);
  console.log(`- ${domain}: ${verdict.promote ? '승격' : '유지'} · 후보 ${verdict.selected} · LOO ${loo} · 섞기 p=${p}`);
  console.log(`  ${verdict.reason}`);
  if (verdict.promote) promoted[domain] = CANDIDATES[verdict.selected];
}
console.log('');
console.log('## policy.js에 반영할 제안');
console.log(JSON.stringify(promoted, null, 2));
