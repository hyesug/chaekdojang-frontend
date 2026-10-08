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
import { selectTimingPolicy, selectProvisionalPolicy } from '../public/unse/src/validation/timingPolicy.js';
import { seededRandom } from '../public/unse/src/semantic/timing/schema.js';

// 사례는 여러 파일에 나뉘어 있다(모두 .gitignore — 개인정보). 인자를 주면 그 파일들만 쓴다.
//   validation/cases.json             지인 사례 (birth · events[year, month])
//   validation-data/people.json       지인 사례 (profile · events[date 'YYYY-MM'])
//   validation-data/profile-cases.json 지인 사례 (같은 형식)
//   validation-data/cases.json        유명인 사례 — 생시 출처 미검증
// 체계 선택은 본인·지인이 확인한 사례로만 한다. 유명인은 생시가 불확실해 따로 검증한다(--celebs).
const REAL_FILES = ['validation/cases.json', 'validation-data/people.json', 'validation-data/profile-cases.json'];
const CELEB_FILES = ['validation-data/cases.json'];
const args = process.argv.slice(2);
const files = args.includes('--celebs') ? CELEB_FILES
  : args.length ? args : REAL_FILES.filter((f) => existsSync(f));
if (!files.length || !files.every((f) => existsSync(f))) {
  console.error(`${files.join(', ') || REAL_FILES[0]} 이 없습니다.`);
  process.exit(1);
}

/** 형식을 하나로 맞추고, 같은 사람(생년월일시·성별)과 같은 사건(분야·연·월)은 한 번만 센다 */
function loadCases(paths) {
  const byBirth = new Map();
  const sources = [];
  for (const path of paths) {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    let added = 0;
    for (const c of Array.isArray(raw) ? raw : []) {
      const b = c.birth ?? c.profile;
      if (!b?.year || b.hour == null) continue;           // 시각이 없으면 월 단위 시기를 잴 수 없다
      const key = `${b.gender}|${b.year}-${b.month}-${b.day} ${b.hour}:${b.minute ?? 0}`;
      const person = byBirth.get(key) ?? { id: c.id, birth: { name: c.id, ...b }, events: [], sources: [] };
      person.sources.push(path);
      const seen = new Set(person.events.map((e) => `${e.domain}|${e.year}|${e.month ?? ''}`));
      for (const e of c.events ?? []) {
        const [y, m] = e.date ? e.date.split('-').map(Number) : [e.year, e.month];
        if (!Number.isInteger(y)) continue;
        const ev = { domain: e.domain, year: y, ...(Number.isInteger(m) ? { month: m } : {}),
          what: e.what ?? e.type, ...(e.eventFamily ? { eventFamily: e.eventFamily } : {}) };
        const k = `${ev.domain}|${ev.year}|${ev.month ?? ''}`;
        if (seen.has(k)) continue;
        seen.add(k); person.events.push(ev); added++;
      }
      byBirth.set(key, person);
    }
    sources.push({ path, added });
  }
  return { cases: [...byBirth.values()].filter((p) => p.events.length), sources };
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

// 자녀는 출산 달 그대로와 '아홉 달 앞(임신 무렵)' 둘 다 모든 후보에 똑같이 잰다.
// 전에는 사주만 아홉 달 앞을 보고 나머지는 출산 달로 재서 사주에 유리했다.
// '후보@9' = 그 후보의 신호를 아홉 달 뒤로 옮겨 출산 달과 맞춘 것. baseline 은 현재 규칙(사주·아홉 달 앞).
const CHILD_LEAD = 9;
const isChildren = (domain) => domain === 'children';
const candidatePolicy = (domain) => Object.fromEntries(Object.entries(candidateSystems).map(([name, systems]) => [
  name, systems ? { [domain]: { systems, ...(isChildren(domain) ? { leadMonths: 0 } : {}) } } : {},
]));
const shiftKey = (key, d) => {
  const n = Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1 + d;
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
};
for (const [name, systems] of Object.entries(candidateSystems)) {
  if (systems) candidateSystems[`${name}@${CHILD_LEAD}`] = systems;
}

const seriesOf = (result, candidate, domain, fromKey = null) => {
  const lead = candidate.endsWith(`@${CHILD_LEAD}`);
  const base = lead ? candidate.slice(0, -`@${CHILD_LEAD}`.length) : candidate;
  if (lead && !isChildren(domain)) return [];
  return Object.entries(result.validationCandidates[base]?.[domain] ?? {})
    .map(([k, v]) => ({ k: lead ? shiftKey(k, CHILD_LEAD) : k, v }))
    .filter((e) => !fromKey || e.k >= fromKey);
};
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

const { cases, sources } = loadCases(files);
console.log('## 사례');
for (const s of sources) console.log(`  ${s.path}: 새 사건 ${s.added}건`);
console.log(`  합계: 사람 ${cases.length}명 · 사건 ${cases.reduce((a, c) => a + c.events.length, 0)}건 (같은 사람·같은 사건은 한 번만)`);
const rowsByDomain = new Map();
for (const group of groupTimingEvents(cases, DOMAIN_OF, { paddingYears: 3 })) {
  let result;
  try {
    result = predictTimeline({
      birth: group.birth, domains: [group.domain],
      // 자녀는 아홉 달 앞까지 계산해 두어야 옮긴 신호가 기간 첫 달부터 찬다
      from: isChildren(group.domain) ? shiftKey(group.from, -CHILD_LEAD) : group.from, to: group.to,
      validationPolicies: candidatePolicy(group.domain),
    });
  } catch (err) {
    // 목록에 없는 출생지 등 — 그 사람만 건너뛰고 알린다
    console.log(`  ! ${group.person} ${DOMAIN_LABEL[group.domain] ?? group.domain}: ${err.message.slice(0, 60)}`);
    continue;
  }
  for (const event of group.events) {
    const precision = event.month == null ? 'year' : 'month';
    const seriesByCandidate = Object.fromEntries(Object.keys(candidateSystems).map((candidate) => [
      candidate, seriesOf(result, candidate, group.domain, isChildren(group.domain) ? group.from : null),
    ]).filter(([, series]) => series.length));
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
const report = {};      // 리포트에 넣을 제안 — service, 아니면 빼고 고르기(잠정), 아니면 기본 방식
const table = [];
const fmt = (v) => (Number.isFinite(v) ? `${v.toFixed(0)}%` : '—');
const systemsOf = (candidate) => candidateSystems[candidate] ?? [...SYSTEM_IDS];   // baseline = 15체계 전체
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

  // 승격하지 못한 분야는 '빼고 고르기'로 잠정 조합을 고른다
  const prov = verdict.promote ? null : selectProvisionalPolicy(rows, { baseline: 'baseline' });
  const chosen = verdict.promote ? verdict.selected : prov.selected;
  report[label] = {
    scope: verdict.promote ? 'service' : 'provisional',
    systems: systemsOf(chosen),
    ...(String(chosen).endsWith(`@${CHILD_LEAD}`) ? { leadMonths: CHILD_LEAD } : {}),
    basis: verdict.promote ? 'loo-and-shuffle' : prov.method === 'loo-vote' ? 'loo-vote' : 'single-case',
  };
  table.push({
    label, people: verdict.people, events: rows.length,
    inSample: `${verdict.personalSelected} ${fmt(prov?.full?.score ?? verdict.full?.score)}`,
    unit: prov ? `${prov.unit === 'person' ? '사람' : '사건'} ${prov.units}` : '—',
    cv: prov?.cv ? `${fmt(prov.cv.selected)} vs ${fmt(prov.cv.baseline)}`
      : verdict.loo ? `${fmt(verdict.loo.selected)} vs ${fmt(verdict.loo.baseline)}` : '—',
    agreement: prov?.agreement != null ? `${Math.round(prov.agreement * 100)}%` : '—',
    decision: verdict.promote ? `service: ${chosen}` : `${prov.method === 'loo-vote' ? '빼고 고르기' : '사례 1건'}: ${chosen}`,
    votes: prov?.votes ? Object.entries(prov.votes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(', ') : '',
  });
}

console.log('\n## 분야별 결과 — 빼고 고르기로 가장 많이 뽑힌 후보');
console.log('분야 | 사람 | 사건 | 사례 전체 최고(점수) | 빼는 단위 | 이 방법의 빠진 쪽 점수 vs 기본 방식 (참고) | 표 비율 | 결정 | 표');
for (const t of table) console.log(`${t.label} | ${t.people} | ${t.events} | ${t.inSample} | ${t.unit} | ${t.cv} | ${t.agreement} | ${t.decision} | ${t.votes}`);
console.log('\n## 리포트 정책 제안 (policy.js 에 옮길 값)');
console.log(JSON.stringify(report, null, 2));
console.log('\n## 서비스에 반영 가능한 제안');
console.log(JSON.stringify(service, null, 2));
console.log('\n## 개인 진단용 제안 (자동 반영 금지)');
console.log(JSON.stringify(personal, null, 2));
