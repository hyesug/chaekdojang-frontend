import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runBenchmark } from '../public/unse-8f3k2m/src/validation/runner.js';
import { collectBenchmarkMonths } from '../public/unse-8f3k2m/src/validation/benchmark.js';
import { assessCasebookBias } from '../public/unse-8f3k2m/src/validation/casebook.js';
import { normalizeProfile } from '../public/unse-8f3k2m/src/validation/profileInput.js';

const [input, ...args] = process.argv.slice(2);
if (!input) {
  console.error('사용법: node scripts/fortune-casebook-benchmark.mjs validation-data/profile-cases.json [--json result.json]');
  process.exit(1);
}
const casebook = JSON.parse(readFileSync(resolve(input), 'utf8'));
const cases = casebook.map((person) => ({
  id: person.id, profile: normalizeProfile(person.profile),
  events: (person.events ?? []).filter((event) => /^\d{4}-\d{2}$/.test(event.date ?? '')),
})).filter((person) => person.events.length);
const bias = assessCasebookBias(casebook);
for (const warning of bias.warnings) console.warn(`표본 경고: ${warning}`);
if (!cases.length) { console.error('연·월이 확정된 사건이 없습니다.'); process.exit(1); }
const benchmark = runBenchmark(cases, { collect: collectBenchmarkMonths });
console.log(`채점 사례 ${cases.length}명 · 사건 ${cases.reduce((n, person) => n + person.events.length, 0)}건`);
for (const [id, summary] of Object.entries(benchmark.systems)) console.log(`${id}: n=${summary.sampleSize}, percentile=${summary.meanPercentile ?? '-'}, Hit@3=${summary.hitAt[3] ?? '-'}%`);
if (args[0] === '--json' && args[1]) writeFileSync(resolve(args[1]), JSON.stringify({ bias, benchmark }, null, 2));
