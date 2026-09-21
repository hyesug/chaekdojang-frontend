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
import { natalFortune } from '../public/unse-8f3k2m/src/semantic/index.js';
import { interpretCareer } from '../public/unse-8f3k2m/src/semantic/systems.js';
import { buildDictionary, toMarkdown } from '../public/unse-8f3k2m/src/semantic/dictionary.js';
import { measure, ruleSupportFrom } from '../public/unse-8f3k2m/src/semantic/calibration.js';
import { applyEmpirical } from '../public/unse-8f3k2m/src/semantic/rules.js';
import { labelFor } from '../public/unse-8f3k2m/src/semantic/tables/occupations.js';

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

const dict = buildDictionary('career');
const md = toMarkdown(dict, measurement);
mkdirSync('docs/unse', { recursive: true });
writeFileSync('docs/unse/career-dictionary-v1.md', md + '\n', 'utf8');

const count = Object.values(dict).reduce((a, s) => a + Object.values(s.places).reduce((b, e) => b + e.length, 0), 0);
console.error(`docs/unse/career-dictionary-v1.md — ${Object.keys(dict).length}개 체계 · 규칙 ${count}개`);
