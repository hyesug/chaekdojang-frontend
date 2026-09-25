import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readProfileInterpretation } from '../public/unse/src/engine.js';
import { assessCasebookBias } from '../public/unse/src/validation/casebook.js';
import { normalizeProfile } from '../public/unse/src/validation/profileInput.js';

const [input, ...args] = process.argv.slice(2);
if (!input) {
  console.error('사용법: node scripts/fortune-evidence-report.mjs validation-data/profile-cases.json [--json report.json]');
  process.exit(1);
}

const cases = JSON.parse(readFileSync(resolve(input), 'utf8'));
const bias = assessCasebookBias(cases);
for (const warning of bias.warnings) console.warn(`표본 경고: ${warning}`);
const people = cases.map((person) => {
  try { return { id: person.id, status: 'ok', interpretation: readProfileInterpretation(normalizeProfile(person.profile)) }; }
  catch (error) { return { id: person.id, status: 'error', message: error.message }; }
});

for (const person of people) {
  if (person.status !== 'ok') { console.log(`${person.id}: ${person.status}`); continue; }
  const supported = Object.entries(person.interpretation.areas)
    .filter(([, area]) => area.status === 'supported')
    .map(([area, value]) => `${area}=${value.candidates.map((c) => c.key).join(',') || '-'}`);
  const anchors = Object.entries(person.interpretation.domainEvidence)
    .filter(([, value]) => value.anchors.length)
    .map(([area, value]) => `${area}[${value.anchors.map((x) => `${x.name}:${x.fact.label}`).join(',')}]`);
  const targets = Object.entries(person.interpretation.targets)
    .flatMap(([area, items]) => items.filter((item) => item.confidence === 'candidate').map((item) => `${area}=${item.key}`));
  console.log(`${person.id}: ${supported.join(' | ') || '후보 근거 부족'}${targets.length ? ` · 프로필 ${targets.join(',')}` : ''}${anchors.length ? ` · 원국 ${anchors.join(' | ')}` : ''}`);
}
if (args[0] === '--json' && args[1]) writeFileSync(resolve(args[1]), JSON.stringify({ bias, people }, null, 2));
