/**
 * timing-coverage.mjs — **15체계 × 분야 시기 감사표**
 *
 *   node scripts/timing-coverage.mjs
 *
 * 정적 해석에서 "체계가 틀린 것인지 얕게 읽은 것인지" 를 가렸듯,
 * 시기에서도 **어느 체계가 어느 눈금으로 무엇을 보는지**를 먼저 적는다.
 * 깊이가 다르면 성능 비교가 공정하지 않다.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { predictTimeline } from '../public/unse-8f3k2m/src/semantic/timing/timeline.js';
import { DOMAINS, DOMAIN_LABEL, RESOLUTION } from '../public/unse-8f3k2m/src/semantic/timing/schema.js';
import { SYSTEM_IDS, SYSTEM_NAME } from '../public/unse-8f3k2m/src/semantic/extract.js';
import { lineageOf } from '../public/unse-8f3k2m/src/semantic/lineage.js';

/** 체계가 실제로 쓰는 시기 요소 — 어댑터가 읽는 자리를 그대로 적는다 */
const ELEMENTS = {
  saju: '대운 · 세운 · 월운 간지 · 원국과의 합충형 · 시기 십성',
  jamidusu: '대한 · 유년 · 유월 궁 · 원국 궁과의 중첩 · 사화',
  astrology: '트랜싯 (행성–출생점 각) · 하우스 주인/앵글 적중 · 오브',
  vedic: '마하다샤 · 안타르다샤 · 프라탼타르다샤 주인 · 궁주 일치 · 다샤 전환',
  juyeok: '그 시기의 괘 (팔괘 물상)',
  yukim: '그 시기의 초전 천장',
  hongguk: '그 시기의 궁 · 팔문',
  taeeul: '태을궁 (한 궁에 세 해)',
  gujeong: '연반 구성 · 그 해의 중궁',
  sukyo: '그 시기의 숙 관계 (칠요)',
  tojeong: '그 해의 괘 · 달별 흐름',
  kabbalah: '개인년 · 개인월 수',
  mahabote: '그 시기의 행성',
  thai: '요일 수호 행성',
  tarot: '그 시기의 카드',
};

/** 분야별 전용 시기 자리가 있는가 */
const DIRECT = {
  saju: new Set(DOMAINS.filter((d) => d !== 'personality' && d !== 'timing')),
  jamidusu: new Set(DOMAINS.filter((d) => d !== 'personality' && d !== 'timing')),
  astrology: new Set(['career', 'relationship', 'marriage', 'children', 'education',
    'wealth', 'residence', 'movement', 'health', 'majorChange']),
  vedic: new Set(['career', 'relationship', 'marriage', 'children', 'education',
    'wealth', 'residence', 'movement', 'health', 'majorChange']),
};

const BIRTH = { name: 'x', gender: 'female', year: 1992, month: 1, day: 30,
  hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전' };

const r = predictTimeline({ birth: BIRTH, from: '2027-01', to: '2031-12' });
const res = {};
for (const id of SYSTEM_IDS) {
  const ms = Object.values(r.systemResults[id].months).filter(Boolean);
  const kinds = [...new Set(ms.map((m) => m.resolution))];
  res[id] = {
    resolution: kinds.includes('month') ? 'month' : kinds.includes('year') ? 'year' : 'none',
    why: ms.find((m) => m.why)?.why ?? null,
    available: ms.filter((m) => m.available).length, total: ms.length,
  };
}

const mark = (id, d) => {
  if (res[id].resolution === 'none') return '—';
  if (DIRECT[id]?.has(d)) return res[id].resolution === 'month' ? 'direct' : 'direct/해';
  return res[id].resolution === 'month' ? 'indirect' : 'weak/해';
};

const out = [];
out.push('# 시기 해석 감사표 — 15체계 × 분야');
out.push('');
out.push('| 표시 | 뜻 |');
out.push('|---|---|');
out.push('| `direct` | 그 분야를 보는 **전용 시기 자리**가 있다 (궁·하우스·다샤 주인) |');
out.push('| `indirect` | 시기 눈금은 있으나 분야 전용 자리는 없다 — 전체 기운에서 나눈다 |');
out.push('| `/해` | 해 단위로만 바뀐다. 달을 가르지 못한다 |');
out.push('| `—` | 시기 해상도가 없다 |');
out.push('');
const head = ['체계', '눈금', ...DOMAINS.filter((d) => d !== 'personality' && d !== 'timing').map((d) => DOMAIN_LABEL[d])];
out.push(`| ${head.join(' | ')} |`);
out.push(`|${head.map(() => '---').join('|')}|`);
for (const id of SYSTEM_IDS) {
  const row = [SYSTEM_NAME[id], res[id].resolution,
    ...DOMAINS.filter((d) => d !== 'personality' && d !== 'timing').map((d) => mark(id, d))];
  out.push(`| ${row.join(' | ')} |`);
}
out.push('');
out.push('## 체계별 시기 요소');
out.push('');
out.push('| 체계 | 계보 | 눈금 | 쓰는 시기 요소 | 비고 |');
out.push('|---|---|---|---|---|');
for (const id of SYSTEM_IDS) {
  out.push(`| ${SYSTEM_NAME[id]} | ${lineageOf(id)} | ${res[id].resolution} | ${ELEMENTS[id]} | ${res[id].why ?? ''} |`);
}
out.push('');
out.push('## 분야별 시간 해상도');
out.push('');
out.push('| 분야 | 해상도 | 왜 |');
out.push('|---|---|---|');
const WHY = { career: '이직·직무변경은 분기로 움직인다', relationship: '달 단위로 변한다',
  marriage: '결혼은 반년 단위로 준비된다', children: '임신·출산은 반년 창', education: '시험은 달 단위',
  wealth: '수입·지출은 달 단위', residence: '계약·이사는 분기', movement: '이동은 분기',
  health: '몸은 달 단위', majorChange: '큰 전환은 분기~해', personality: '기질은 시기로 잘 안 움직인다',
  timing: '해 단위' };
for (const d of DOMAINS) out.push(`| ${DOMAIN_LABEL[d]} | ${RESOLUTION[d]} | ${WHY[d]} |`);
out.push('');
out.push('## 아직 시기 해석이 얕은 체계');
out.push('');
for (const id of SYSTEM_IDS) {
  if (res[id].resolution === 'month' && DIRECT[id]) continue;
  out.push(`- **${SYSTEM_NAME[id]}** (${res[id].resolution}) — ${res[id].why ?? '분야 전용 시기 자리가 없어 전체 기운에서 나눠 쓴다'}`);
}

mkdirSync('docs/unse', { recursive: true });
writeFileSync('docs/unse/timing-coverage.md', out.join('\n') + '\n', 'utf8');
console.log('체계'.padEnd(12) + '눈금'.padEnd(8) + '분야 전용 자리');
for (const id of SYSTEM_IDS) {
  const direct = DIRECT[id] ? DIRECT[id].size : 0;
  console.log(SYSTEM_NAME[id].padEnd(12) + res[id].resolution.padEnd(8) + (direct ? `${direct}개 분야` : '없음 (전체 기운에서 나눔)') + (res[id].why ? `  — ${res[id].why}` : ''));
}
console.log('\ndocs/unse/timing-coverage.md 에 적었습니다.');
