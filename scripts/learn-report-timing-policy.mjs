/**
 * /unse 시기 정책 학습기.
 *
 * 모든 15체계 단독과, 계산 재료가 다른 사전등록 쌍만 비교한다. 개인 이력은
 * 진단에는 쓰되 서비스 규칙을 자동으로 바꾸지 않는다.
 */
import { existsSync, readFileSync } from 'node:fs';
import { predictTimeline } from '../public/unse/src/semantic/timing/timeline.js';
import { SYSTEM_IDS } from '../public/unse/src/semantic/extract.js';
import { lineageOf } from '../public/unse/src/semantic/lineage.js';
import { groupTimingEvents } from '../public/unse/src/validation/timingCaseWindows.js';
import { scoreEvent, scoreEventYearly } from '../public/unse/src/validation/timingMetrics.js';
import { selectTimingPolicy } from '../public/unse/src/validation/timingPolicy.js';
import { seededRandom } from '../public/unse/src/semantic/timing/schema.js';

const file = process.argv[2] ?? 'validation/cases.json';
if (!existsSync(file)) {
  console.error(`${file} 이 없습니다.`);
  process.exit(1);
}

const DOMAIN_OF = {
  직업: 'career', 재물: 'wealth', 관계: 'relationship', 결혼: 'marriage', 자녀: 'children',
  주거: 'residence', 이사: 'movement', 건강: 'health', 학업: 'education', '큰 전환': 'majorChange',
};
const DOMAIN_LABEL = Object.fromEntries(Object.entries(DOMAIN_OF).map(([label, id]) => [id, label]));
const ASTRO_CANDIDATES = ['astrology_modern', 'astrology_classical'];
const SYSTEM_CANDIDATES = [...SYSTEM_IDS, ...ASTRO_CANDIDATES];
const lineage = (id) => id.startsWith('astrology_') ? 'tropical' : lineageOf(id);

// 같은 계보(예: 현대·고전 점성)를 섞은 쌍은 독립 확인이 아니므로 후보에 넣지 않는다.
const candidateSystems = { baseline: null };
for (const id of SYSTEM_CANDIDATES) candidateSystems[id] = [id];
for (let i = 0; i < SYSTEM_CANDIDATES.length; i++) {
  for (let j = i + 1; j < SYSTEM_CANDIDATES.length; j++) {
    const [a, b] = [SYSTEM_CANDIDATES[i], SYSTEM_CANDIDATES[j]];
    if (lineage(a) === lineage(b)) continue;
    candidateSystems[`${a}+${b}`] = [a, b];
  }
}

const candidatePolicy = (domain) => Object.fromEntries(Object.entries(candidateSystems).map(([name, systems]) => [
  name, systems ? { [domain]: { systems } } : {},
]));

const seriesOf = (result, candidate, domain) => Object.entries(result.validationCandidates[candidate]?.[domain] ?? {})
  .map(([k, v]) => ({ k, v }));
const score = (series, event) => {
  const measured = event.month == null ? scoreEventYearly(series, event.year) : scoreEvent(series,
    `${event.year}-${String(event.month).padStart(2, '0')}`);
  return measured.unscorable ? null : measured.eventPercentile;
};

/** 같은 원인에서 갈린 급여·직급 기록은 후보별 평균 하나로 접는다. */
function collapseFamilies(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const family = row.event.eventFamily ?? `event:${row.event.year}-${row.event.month ?? 'year'}-${row.event.what ?? ''}`;
    const key = `${row.person}\u0000${row.domain}\u0000${family}`;
    const bucket = grouped.get(key) ?? { ...row, family, members: [] };
    bucket.members.push(row);
    grouped.set(key, bucket);
  }
  return [...grouped.values()].map((bucket) => ({
    person: bucket.person, precision: bucket.members.every((row) => row.precision === 'month') ? 'month' : 'year',
    eventFamily: bucket.family,
    scores: Object.fromEntries(Object.keys(candidateSystems).map((candidate) => {
      const values = bucket.members.map((row) => row.scores[candidate]).filter(Number.isFinite);
      return [candidate, values.length ? values.reduce((a, b) => a + b, 0) / values.length : null];
    })),
    seriesByCandidate: bucket.members[0].seriesByCandidate,
  }));
}

function shuffledRows(rows, random) {
  return rows.map((row) => {
    const scores = Object.fromEntries(Object.entries(row.seriesByCandidate).map(([candidate, series]) => {
      const keys = series.map((entry) => entry.k);
      const key = keys[Math.floor(random() * keys.length)];
      const event = row.precision === 'month'
        ? { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) }
        : { year: Number(key.slice(0, 4)) };
      return [candidate, score(series, event)];
    }));
    return { ...row, scores };
  });
}

const cases = JSON.parse(readFileSync(file, 'utf8'));
const rowsByDomain = new Map();
for (const group of groupTimingEvents(cases, DOMAIN_OF, { paddingYears: 3 })) {
  const result = predictTimeline({
    birth: group.birth, from: group.from, to: group.to, domains: [group.domain],
    validationPolicies: candidatePolicy(group.domain),
  });
  for (const event of group.events) {
    const precision = event.month == null ? 'year' : 'month';
    const seriesByCandidate = Object.fromEntries(Object.keys(candidateSystems).map((candidate) => [
      candidate, seriesOf(result, candidate, group.domain),
    ]));
    const row = {
      person: group.person, domain: group.domain, event, precision, seriesByCandidate,
      scores: Object.fromEntries(Object.entries(seriesByCandidate).map(([candidate, series]) => [candidate, score(series, event)])),
    };
    const rows = rowsByDomain.get(group.domain) ?? [];
    rows.push(row); rowsByDomain.set(group.domain, rows);
  }
}

console.log('# 리포트 시기 정책 학습');
console.log(`단독 ${SYSTEM_CANDIDATES.length}개 + 독립 계보 쌍 ${Object.keys(candidateSystems).length - 1 - SYSTEM_CANDIDATES.length}개를 비교합니다.`);
console.log('사람 단위 LOO·날짜 섞기·쌍 대 단독 비교를 모두 통과해야 서비스 정책이 됩니다.');
const service = {};
const personal = {};
for (const [domain, rawRows] of rowsByDomain) {
  const rows = collapseFamilies(rawRows);
  const preliminary = selectTimingPolicy(rows, { baseline: 'baseline', candidateSystems });
  const random = seededRandom(20261008);
  const shuffled = [];
  if (preliminary.loo?.selected != null) {
    for (let i = 0; i < 200; i++) {
      const verdict = selectTimingPolicy(shuffledRows(rows, random), { baseline: 'baseline', candidateSystems });
      if (verdict.loo?.selected != null) shuffled.push(verdict.loo.selected);
    }
  }
  const verdict = selectTimingPolicy(rows, {
    baseline: 'baseline', shuffledSelectedScores: shuffled, candidateSystems,
  });
  const selectedSystems = candidateSystems[verdict.promote ? verdict.selected : verdict.personalSelected] ?? null;
  const label = DOMAIN_LABEL[domain] ?? domain;
  console.log(`- ${label}: ${verdict.scope} · ${verdict.promote ? '서비스 승격' : '개인 진단'} · ${verdict.personalSelected}`);
  console.log(`  ${verdict.reason} · 사람 ${verdict.people}명 · 월 사건 ${verdict.monthlyEvents}건`);
  if (verdict.pairComparison) console.log(`  쌍 ${verdict.pairComparison.pair}: ${verdict.pairComparison.pairScore?.toFixed(1)} vs 단독 ${verdict.pairComparison.bestMember} ${verdict.pairComparison.bestMemberScore?.toFixed(1)}`);
  const proposal = { scope: verdict.scope, systems: selectedSystems, basis: 'loo-and-shuffle', evidence: {
    people: verdict.people, monthlyEvents: verdict.monthlyEvents, reason: verdict.reason,
  } };
  (verdict.promote ? service : personal)[label] = proposal;
}
console.log('\n## 서비스에 반영 가능한 제안');
console.log(JSON.stringify(service, null, 2));
console.log('\n## 개인 진단용 제안 (자동 반영 금지)');
console.log(JSON.stringify(personal, null, 2));
