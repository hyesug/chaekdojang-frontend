/**
 * build-people.mjs — 흩어져 있던 사례 파일 셋을 **새 정답표 하나**로 모은다
 *
 *   node validation/build-people.mjs
 *
 * 읽는 것 (전부 .gitignore)
 *   validation/attribution.json   직업
 *   validation/attributes.json    수입형태·직업전환
 *   validation/cases.json         날짜가 있는 사건 (결혼·출산 등)
 *
 * 쓰는 것
 *   validation/people.json        새 규격 (.gitignore)
 *
 * ── 이 스크립트가 하지 않는 일 ──────────────────────────────
 * **모르는 칸을 채우지 않는다.** 학업·주거·재물은 지금 자료에 없으므로
 * `unknown` 으로 남긴다. 빈칸을 그럴듯한 값으로 메우면 그 순간 정답표가
 * 창작이 된다.
 *
 * **아직 일어나지 않은 일을 정답으로 쓰지 않는다.** 미혼인 사람은
 * '결혼 안 함'이 아니라 `censored`(그 나이까지 관측 없음)다.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { labelFor } from '../public/unse-8f3k2m/src/semantic/tables/occupations.js';
import { childrenBand } from '../public/unse-8f3k2m/src/validation/labels.js';
import { solarToLunar } from '../public/unse-8f3k2m/src/core/lunar.js';
import { FIRST_MARRIAGE_AGE } from '../public/unse-8f3k2m/src/hires/baserate.js';

const AS_OF = process.env.AS_OF ?? new Date().toISOString().slice(0, 10);
const thisYear = Number(AS_OF.slice(0, 4));

const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);

/** 음력 생일을 양력으로. 사례 파일 몇 개가 음력으로 적혀 있다 */
function lunarToSolar(y, lm, ld) {
  for (let m = 1; m <= 12; m++) for (let d = 1; d <= 31; d++) {
    const L = solarToLunar(y, m, d);
    if (L && L.month === lm && L.day === ld && !L.leap) return { y, m, d };
  }
  return null;
}

const attribution = read('validation/attribution.json') ?? [];
const attributes = read('validation/attributes.json') ?? [];
const cases = read('validation/cases.json') ?? [];

if (!attribution.length) {
  console.error('validation/attribution.json 이 없습니다. 개인정보 파일이라 저장소에 없습니다.');
  process.exit(1);
}

const attrById = Object.fromEntries(attributes.map((a) => [a.id, a]));
const caseById = Object.fromEntries(cases.map((c) => [c.id, c]));

const PAY_TO_FORM = { 자영: 'self_employed', 월급: 'organization' };

const people = attribution.map((row) => {
  const solar = row.lunar ? lunarToSolar(row.lunar[0], row.lunar[1], row.lunar[2]) : null;
  const y = solar?.y ?? row.y, m = solar?.m ?? row.m, d = solar?.d ?? row.d;
  const a = attrById[row.id] ?? {};
  const c = caseById[row.id] ?? null;
  const birthPlace = c?.birth?.birthPlace ?? '대전';
  const homePlace = c?.birth?.homePlace ?? birthPlace;

  const birth = {
    gender: row.g, year: y, month: m, day: d,
    ...(row.h != null ? { hour: row.h, minute: row.mi ?? 0 } : {}),
    birthPlace, homePlace,
  };
  const age = thisYear - y;

  // ── 직업 ──
  const occ = labelFor(row.job);
  const career = occ
    ? { status: 'known', category: occ.category,
        // 정답은 직업명 하나가 아니라 **속성 벡터**다. 키만 적고 값은
        // occupations.js 에서 읽는다 — 정답 정의를 한 군데에만 둔다
        occupationKey: occ.key,
        features: occ.features,
        employmentForm: PAY_TO_FORM[a.pay] ?? occ.employmentForm ?? null,
        // 직업전환 축은 지금 막혀 있다. 라벨만 남겨 둔다
        switching: a.sw ?? null }
    : { status: 'unknown', why: `직업 표에 '${row.job}' 이 없다 — occupations.js 를 보고 추가할 것` };

  // ── 결혼 ──
  const marriage = c?.events?.find((e) => e.domain === '결혼');
  let relationship;
  if (marriage) {
    const at = marriage.year - y;
    const mean = FIRST_MARRIAGE_AGE[row.g];
    // 평균 초혼연령보다 3해 이상 이르면 조혼, 3해 이상 늦으면 만혼
    relationship = {
      status: 'known', marriedAtAge: at,
      unionTiming: at <= mean - 3 ? 'early' : at >= mean + 3 ? 'late' : 'mid',
    };
  } else {
    // **미혼을 '결혼 안 함'으로 적지 않는다**
    relationship = { status: 'censored', observedUntilAge: age,
      why: `${age}세 현재 결혼 사건이 관측되지 않았다` };
  }

  // ── 자녀 ──
  const births = (c?.events ?? []).filter((e) => e.domain === '자녀').length;
  const children = c
    ? { status: 'known', count: births, band: childrenBand(births) }
    : { status: 'unknown', why: '사건 자료가 없다' };

  return {
    id: row.id,
    birth,
    labels: {
      career, relationship, children,
      education: { status: 'unknown', why: '현재 자료에 학업 칸이 없다' },
      residence: { status: 'unknown', why: '현재 자료에 주거 칸이 없다' },
      wealth: { status: 'unknown', why: '현재 자료에 재물 칸이 없다' },
      health: { status: 'not_applicable', why: '건강은 채점 대상으로 삼지 않는다' },
    },
    plannedFutureEvents: [],
  };
});

writeFileSync('validation/people.json', JSON.stringify(people, null, 1) + '\n', 'utf8');

const count = (pick) => people.filter(pick).length;
console.log(`validation/people.json — ${people.length}명`);
console.log(`  직업 채점 가능     ${count((p) => p.labels.career.status === 'known')}명`);
console.log(`  결혼 관측됨        ${count((p) => p.labels.relationship.status === 'known')}명`
  + ` · 절단(미혼) ${count((p) => p.labels.relationship.status === 'censored')}명`);
console.log(`  자녀 채점 가능     ${count((p) => p.labels.children.status === 'known')}명`);
for (const p of people) {
  if (p.labels.career.status !== 'known') console.log(`  ! ${p.id} ${p.labels.career.why}`);
}
