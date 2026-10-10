/**
 * build-dictionary.mjs — **해석 사전 v1** 을 문서로 뽑는다
 *
 *   node scripts/build-dictionary.mjs                  실측 없이 (전통 표만)
 *   node scripts/build-dictionary.mjs validation/people.json   실측 뒷받침까지
 *
 * 사전은 `src/semantic/rules.js` 가 원본이다. 이 문서는 그것을 펼친 것이라
 * 둘이 갈라질 수 없다. 규칙을 고치면 사전을 다시 뽑는다.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { natalFortune } from '../public/unse/src/semantic/index.js';
import { interpretCareer } from '../public/unse/src/semantic/systems.js';
import { buildDictionary, toMarkdown } from '../public/unse/src/semantic/dictionary.js';
import { measure, ruleSupportFrom } from '../public/unse/src/semantic/calibration.js';
import { applyEmpirical } from '../public/unse/src/semantic/rules.js';
import { labelFor } from '../public/unse/src/semantic/tables/occupations.js';
import { DOMAINS, DOMAIN_LABEL } from '../public/unse/src/semantic/domains.js';

const file = process.argv[2] ?? null;
let measurement = null;

if (file && existsSync(file)) {
  const people = JSON.parse(readFileSync(file, 'utf8'));
  const rows = [];
  for (const p of people) {
    if (p.labels?.career?.status !== 'known') continue;
    const occ = p.labels.career.occupationKey ? labelFor(p.labels.career.occupationKey) : null;
    const truth = occ?.features ?? p.labels.career.features;
    if (!truth) continue;
    const { fortune: f, stack: st } = natalFortune({ ...p.birth, name: 'x' });
    rows.push({ id: p.id, truth, systems: interpretCareer(f, st) });
  }
  if (rows.length) {
    measurement = measure(rows);
    applyEmpirical(ruleSupportFrom(rows));
    console.error(`실측 ${rows.length}명을 규칙에 얹었습니다.`);
  }
} else if (file) {
  console.error(`${file} 이 없어 전통 표만으로 뽑습니다.`);
}

mkdirSync('docs/unse', { recursive: true });
let total = 0;
for (const domain of DOMAINS) {
  const dict = buildDictionary(domain);
  const md = toMarkdown(dict, domain === 'career' ? measurement : null, domain);
  const name = domain === 'career' ? 'career-dictionary-v1.md' : `dictionary-${domain}.md`;
  writeFileSync(`docs/unse/${name}`, md + '\n', 'utf8');
  const count = Object.values(dict).reduce((a, s) => a + Object.values(s.places).reduce((b, e) => b + e.length, 0), 0);
  total += count;
  console.error(`  ${DOMAIN_LABEL[domain].padEnd(5)} ${String(count).padStart(4)}개 → docs/unse/${name}`);
}
console.error(`해석 사전 — 열두 분야 · 규칙 ${total}개`);
