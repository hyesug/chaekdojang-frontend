import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runBenchmark } from '../public/unse/src/validation/runner.js';
import { collectBenchmarkMonths } from '../public/unse/src/validation/benchmark.js';

const [input, ...args] = process.argv.slice(2);
if (!input) { console.error('사용법: node scripts/fortune-benchmark.mjs validation-data/cases.json [--json result.json]'); process.exit(1); }
const cases = JSON.parse(readFileSync(resolve(input), 'utf8'));
const result = runBenchmark(cases, { collect: collectBenchmarkMonths });
for (const [id, summary] of Object.entries(result.systems)) console.log(`${id}: 사건 ${summary.sampleSize} · 평균 percentile ${summary.meanPercentile ?? '-'} · Hit@3 ${summary.hitAt[3] ?? '-'}%`);
if (args[0] === '--json' && args[1]) writeFileSync(resolve(args[1]), JSON.stringify(result, null, 2));
