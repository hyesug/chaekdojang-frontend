/**
 * audit-casebook.mjs — 사례집 분야별 · 체계별 O/X 감사
 *
 *   node scripts/audit-casebook.mjs [--json out.json]
 *
 * 사례집(validation/people.json · cases.json, 개인정보라 커밋 안 됨)에 정답이 있는
 * 분야마다, 17체계(15체계 + 현대·고전 점성)가 **각자 단독으로** 맞혔는지 O/X 를 낸다.
 *
 *   시기 — 사건 달(월 미상이면 해)이 그 체계의 사건 ±3년 창에서 상위 20% 안이면 O.
 *          찍어서 맞을 확률이 20% 다.
 *   직업 — 그 체계가 읽은 직업 범주 상위 3개(15개 중) 안에 실제 범주가 있으면 O. 우연 20%.
 *   나이차 — 그 체계에 연상·연하를 가리는 전통 규칙이 있을 때만 채점.
 *   자녀 수 — 자미 자녀궁 수 표 범위 안이면 O. 사주·베딕은 '열림/눌림'만 말한다.
 *
 * 말하지 않은 칸('·')은 X 로 세지 않는다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { predictTimeline } from '../public/unse/src/semantic/timing/timeline.js';
import { SYSTEM_IDS, SYSTEM_NAME } from '../public/unse/src/semantic/extract.js';
import { groupTimingEvents } from '../public/unse/src/validation/timingCaseWindows.js';
import { scoreEvent, scoreEventYearly } from '../public/unse/src/validation/timingMetrics.js';
import { normalizeTimingEvent } from '../public/unse/src/validation/eventTargets.js';
import { natalFortune } from '../public/unse/src/semantic/index.js';
import { interpretCareer } from '../public/unse/src/semantic/systems.js';
import { categorizeCareer } from '../public/unse/src/semantic/categories.js';
import { readFortune } from '../public/unse/src/engine.js';
import { tenGod, MAIN_HIDDEN, TEN_GOD_GROUP } from '../public/unse/src/core/ganzhi.js';
import { readSpouse, spousePalaceStars } from '../public/unse/src/semantic/structure/spouse.js';
import { readChildren, childPalaceStars } from '../public/unse/src/semantic/structure/children.js';
import { marriagePack, childrenPack } from '../public/unse/src/hires/vedicExt.js';
import { planetPositions, houses, houseOf } from '../public/unse/src/core/planets.js';

const people = JSON.parse(readFileSync('validation/people.json', 'utf8'));
const cases = JSON.parse(readFileSync('validation/cases.json', 'utf8'));
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;

const ASTRO = ['astrology_modern', 'astrology_classical'];
const SYS = [...SYSTEM_IDS, ...ASTRO];
const NAME = { ...SYSTEM_NAME, astrology_modern: '점성(현대)', astrology_classical: '점성(고전)' };
const OK = 80;   // 상위 20%

const out = { timing: [], career: [], age: [], childCount: [] };

// ── 1. 시기 ──────────────────────────────────────────────
const DOMAIN_OF = {
  직업: 'career', 재물: 'wealth', 관계: 'relationship', 결혼: 'marriage', 자녀: 'children',
  주거: 'residence', 이사: 'movement', 건강: 'health', 학업: 'education',
};
const policies = (domain) => Object.fromEntries(SYS.map((id) => [id, { [domain]: { systems: [id], leadMonths: 0 } }]));
for (const group of groupTimingEvents(cases, DOMAIN_OF, { paddingYears: 3 })) {
  let res;
  try {
    res = predictTimeline({ birth: group.birth, domains: [group.domain], from: group.from, to: group.to,
      validationPolicies: policies(group.domain) });
  } catch (e) { console.error(`! ${group.person} ${group.domain} ${e.message}`); continue; }
  for (const ev of group.events) {
    const target = normalizeTimingEvent(ev, group.domain);
    const row = { person: group.person, domain: group.domain, what: ev.what, year: ev.year, month: ev.month ?? null, by: {} };
    for (const id of SYS) {
      const meta = res.validationCandidateMeta?.[id]?.[group.domain] ?? {};
      // 사건 종류 후보가 있으면 그 점수로, 없으면 분야 활성도로 잰다
      const kinds = res.validationEventCandidates?.[id]?.[group.domain] ?? {};
      const act = Object.entries(res.validationCandidates?.[id]?.[group.domain] ?? {});
      let series = target.eligible
        ? act.map(([k]) => ({ k, v: kinds[k]?.[target.candidateKind] ?? null })).filter((x) => Number.isFinite(x.v))
        : [];
      // 사건 종류 점수를 못 내는 체계는 분야 활성도(이 분야가 움직이는 때)로 잰다
      if (new Set(series.map((x) => x.v)).size <= 1) series = act.map(([k, v]) => ({ k, v })).filter((x) => Number.isFinite(x.v));
      if (!series.length) { row.by[id] = null; continue; }
      (row.series ??= {})[id] = { resolution: meta.resolution, points: series };
      const yearly = meta.resolution === 'year' || ev.month == null;
      const s = yearly ? scoreEventYearly(series, ev.year)
        : scoreEvent(series, `${ev.year}-${String(ev.month).padStart(2, '0')}`);
      row.by[id] = s.unscorable ? null : s.eventPercentile;
    }
    out.timing.push(row);
  }
}

// ── 2. 직업 ──────────────────────────────────────────────
for (const p of people) {
  const c = p.labels?.career;
  if (c?.status !== 'known' || !c.category) continue;
  const { fortune, stack } = natalFortune({ ...p.birth, name: 'x' });
  const by = {};
  for (const s of interpretCareer(fortune, stack)) {
    if (!s.features || s.status === 'unavailable') { by[s.system] = null; continue; }
    const cat = categorizeCareer(s.features, s.profile);
    const top = cat?.levelC?.ranked?.slice(0, 3).map((x) => x.key) ?? [];
    by[s.system] = { hit: top.includes(c.category), top };
  }
  out.career.push({ person: p.id, truth: c.category, job: c.occupationKey, by });
}

// ── 3. 나이차 · 자녀 수 ─────────────────────────────────
const AGE = { P02: '연상', P03: '연상', P04: '연상', P09: '연상', P10: '연상', P11: '연하', P12: '연상', P05: '연상', P08: '연하', P01: '연하' };
for (const p of people) {
  const r = readFortune(p.birth);
  const ch = { ...r.chart, gender: r.input.gender };
  const female = p.birth.gender === 'female';
  const t = r.input.timeKnown;
  if (AGE[p.id]) {
    const by = {};
    const god = tenGod(r.chart.dayStem, MAIN_HIDDEN[r.chart.pillars.day.branch]);
    by.saju = { 관성: '연상', 인성: '연상', 식상: '연하' }[TEN_GOD_GROUP[god]] ?? null;
    const zw = t ? readSpouse(ch, spousePalaceStars(r.input)).find((x) => x.topicKey === '나이차참고') : null;
    by.jamidusu = zw ? (/연상 쪽/.test(zw.text) ? '연상' : /연하 쪽/.test(zw.text) ? '연하' : null) : null;
    const mp = marriagePack(r.input);
    const vp = (pl) => (['토성', '태양', '목성'].includes(pl) ? '연상' : ['달', '금성', '수성'].includes(pl) ? '연하' : null);
    by.vedic = t ? vp(mp?.d1_7?.lord) : vp(mp?.darakaraka?.planet);
    const pos = planetPositions(r.input.jdUT);
    const sat = pos.토성.lon;
    const tg = female ? ['태양', '화성'] : ['달', '금성'];
    const asp = tg.some((x) => { const d = Math.abs(((pos[x].lon - sat + 540) % 360) - 180); return [0, 90, 180].some((a) => Math.abs(d - a) <= 8); });
    by.astrology_modern = asp ? '연상' : null;
    by.astrology_classical = t && houseOf(sat, houses(r.input.jdUT, r.input.place.lat, r.input.place.lon).cusps) === 7 ? '연상' : null;
    out.age.push({ person: p.id, truth: AGE[p.id], god, by });
  }
  const k = p.labels?.children;
  if (k?.status === 'known') {
    const reads = readChildren(ch, childPalaceStars(r.input), childrenPack(r.input));
    const zw = reads.find((x) => x.system === '자미두수' && x.range);
    const sj = reads.find((x) => x.system === '사주' && x.topicKey === '열림');
    const vd = reads.find((x) => x.system === '베딕' && x.topicKey === '열림');
    out.childCount.push({ person: p.id, truth: k.count, note: k.note ?? null, by: {
      jamidusu: zw ? { range: zw.range, hit: k.count >= zw.range[0] && k.count <= zw.range[1] } : null,
      saju: sj?.stance ?? null, vedic: vd?.stance ?? null,
    } });
  }
}

// ── 출력 ────────────────────────────────────────────────
const mark = (v) => (v == null ? ' · ' : v >= OK ? ' O ' : ' X ');
const head = (ids) => ids.map((id) => NAME[id].slice(0, 4).padEnd(5)).join('');
const label = { career: '직업', wealth: '재물', relationship: '관계', marriage: '결혼', children: '자녀',
  residence: '주거', movement: '이사', health: '건강', education: '학업' };

console.log('# 시기 — 사건이 그 체계의 상위 20% 시기였나 (O) / 아니었나 (X) / 못 잼 (·)\n');
for (const d of [...new Set(out.timing.map((r) => r.domain))]) {
  const rows = out.timing.filter((r) => r.domain === d);
  console.log(`## ${label[d]} (${rows.length}건)`);
  console.log('사람  사건'.padEnd(26) + head(SYS));
  for (const r of rows) {
    console.log(`${r.person}  ${String(r.year) + (r.month ? '-' + String(r.month).padStart(2, '0') : '')} ${(r.what ?? '').slice(0, 10)}`.padEnd(26)
      + SYS.map((id) => mark(r.by[id]).padEnd(5)).join(''));
  }
  console.log('합계'.padEnd(26) + SYS.map((id) => {
    const s = rows.map((r) => r.by[id]).filter((v) => v != null);
    return `${s.filter((v) => v >= OK).length}/${s.length}`.padEnd(5);
  }).join(''));
  console.log('');
}

console.log('# 직업 — 실제 범주가 그 체계의 상위 3범주 안 (15개 중)\n');
console.log('사람  직업'.padEnd(20) + head(SYSTEM_IDS));
for (const r of out.career) {
  console.log(`${r.person}  ${r.job ?? r.truth}`.padEnd(20) + SYSTEM_IDS.map((id) => (r.by[id] == null ? ' · ' : r.by[id].hit ? ' O ' : ' X ').padEnd(5)).join(''));
}
console.log('합계'.padEnd(20) + SYSTEM_IDS.map((id) => {
  const s = out.career.map((r) => r.by[id]).filter(Boolean);
  return `${s.filter((v) => v.hit).length}/${s.length}`.padEnd(5);
}).join(''));

console.log('\n# 나이차 (규칙이 있는 체계만)\n');
const AGE_SYS = ['saju', 'jamidusu', 'vedic', 'astrology_modern', 'astrology_classical'];
console.log('사람  정답'.padEnd(12) + head(AGE_SYS));
for (const r of out.age) console.log(`${r.person}  ${r.truth}`.padEnd(12) + AGE_SYS.map((id) => (r.by[id] == null ? ' · ' : r.by[id] === r.truth ? ' O ' : ' X ').padEnd(5)).join(''));
console.log('합계'.padEnd(12) + AGE_SYS.map((id) => {
  const s = out.age.filter((r) => r.by[id] != null);
  return `${s.filter((r) => r.by[id] === r.truth).length}/${s.length}`.padEnd(5);
}).join(''));

console.log('\n# 자녀 수\n');
for (const r of out.childCount) {
  console.log(`${r.person}  ${r.truth}명${r.note ? '(관측 중)' : ''}  자미 ${r.by.jamidusu ? `${r.by.jamidusu.range.join('~')}명 ${r.by.jamidusu.hit ? 'O' : 'X'}` : '·'}  사주 ${r.by.saju ?? '·'}  베딕 ${r.by.vedic ?? '·'}`);
}

if (jsonOut) writeFileSync(jsonOut, JSON.stringify(out, null, 2));
