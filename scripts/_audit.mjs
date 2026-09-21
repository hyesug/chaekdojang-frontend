// 임시 감사 — 각 체계가 계산해 두고 있는 것 전부
import { readFortune } from '../public/unse-8f3k2m/src/engine.js';

const r = readFortune({
  name: 'x', gender: 'female', year: 1992, month: 1, day: 30,
  hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전',
}, { now: new Date('1992-01-30T03:00:00Z') });

for (const s of r.results) {
  console.log('════', s.id, s.name, `(confidence ${s.confidence})`);
  console.log('  headline:', s.headline);
  console.log('  facts:');
  for (const f of s.facts ?? []) {
    console.log(`    - ${f.label} = ${JSON.stringify(f.value)}${f.note ? `   // ${String(f.note).slice(0, 70)}` : ''}`);
  }
  console.log('  keywords:', (s.signals?.keywords ?? []).join(', '));
  console.log('  tags:', (s.signals?.tags ?? []).join(', '));
  console.log('  domains:', JSON.stringify(s.signals?.domains));
  console.log('  readings:', (s.readings ?? []).map((x) => x.title).join(' | '));
  console.log('');
}
