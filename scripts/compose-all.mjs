/**
 * compose-all.mjs — **칸 배치가 사람마다 버티는가**
 *
 *   node scripts/compose-all.mjs              (열한 명 한눈에)
 *   node scripts/compose-all.mjs --id P01     (한 사람 자세히)
 *   node scripts/compose-all.mjs 1992-01-30 16:28 여주 대전 female   (모르는 사람)
 *
 * ── 무엇을 재는가 ──────────────────────────────────────────
 * 이건 **맞았나를 세는 자리가 아니다.** 칸 배치가 쓸 만한지 보는 자리다.
 * 두 가지가 드러난다.
 *
 *   ① 비는 칸 — 아무 체계도 말하지 않는 자리. 그 칸은 답할 수 없다는 뜻이다.
 *   ② 남의 칸 말 — 관계 이야기가 직업 칸에 들어오는 것. 배치가 틀린 것이다.
 *
 * 둘 다 **눈으로 바로 보인다.** 코사인 0.248 은 어디가 틀렸는지 알려주지
 * 않지만, "드러나는가 칸에 7하우스(짝) 이야기가 들어와 있다"는 바로 보인다.
 * 그것이 이 방식을 고른 이유다.
 *
 * ── 왜 점수를 안 내는가 ────────────────────────────────────
 * 열한 명에 대해 가중치를 배우는 시도를 네 번 했고 네 번 다 실패했다
 * (`learn-combine.mjs`, `learn-select.mjs`). 실패한 이유가 여기 있다 —
 * 체계들은 **경쟁하지 않고 서로 다른 칸에 답한다.** 한 칸에 여럿이 들어오면
 * 둘 다 맞을 수 있으므로 하나로 줄이지 않는다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { natalFortune } from '../public/unse/src/semantic/index.js';
import { readStructures } from '../public/unse/src/semantic/structure/saju.js';
import { SLOTS, fillSlots } from '../public/unse/src/semantic/compose/slots.js';

const args = process.argv.slice(2);
const DOMAINS = ['career', 'wealth', 'relationship'];
const DOMAIN_KR = { career: '일', wealth: '돈', relationship: '관계' };
const pad = (s, n) => {
  const t = String(s ?? '');
  const w = [...t].reduce((a, c) => a + (c.charCodeAt(0) > 0x1100 ? 2 : 1), 0);
  return t + ' '.repeat(Math.max(0, n - w));
};

function slotsFor(birth) {
  const { fortune } = natalFortune(birth);
  const structures = readStructures({ ...fortune.chart, gender: birth.gender }).structures;
  const out = {};
  for (const d of DOMAINS) out[d] = fillSlots(fortune, structures, d);
  return out;
}

// ── 한 사람 자세히 ──
const idArg = args.indexOf('--id');
const detail = idArg >= 0 || (args[0] && /^\d{4}-\d{2}-\d{2}$/.test(args[0]));
if (detail) {
  let birth = null; let who = null;
  if (idArg >= 0) {
    const p = JSON.parse(readFileSync('validation/people.json', 'utf8'))
      .find((x) => x.id === args[idArg + 1]);
    if (!p) { console.error('그 id 가 없습니다.'); process.exit(1); }
    birth = p.birth; who = `${p.id} — ${p.labels?.career?.occupationKey ?? ''}`;
  } else {
    const [date, time, bp, hp, gender] = args;
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = (time ?? '').split(':').map(Number);
    birth = { name: '조회', gender: gender ?? 'female', year: y, month: m, day: d,
      ...(Number.isFinite(hh) ? { hour: hh, minute: mm ?? 0 } : {}),
      birthPlace: bp ?? '서울', homePlace: hp ?? bp ?? '서울' };
    who = `${date} ${time ?? '시각미상'} · ${bp} 출생 · ${hp} 거주`;
  }

  const all = slotsFor(birth);
  console.log(`# ${who}`);
  console.log('');
  console.log('칸마다 그 자리를 보는 체계의 말을 모은 것입니다. **합치지 않습니다.**');
  console.log('한 칸에 여럿이 들어오면 둘 다 맞을 수 있어 그대로 둡니다.');
  console.log('');
  for (const d of DOMAINS) {
    console.log(`## ${DOMAIN_KR[d]}`);
    console.log('');
    for (const s of all[d]) {
      console.log(`### ${s.label} — ${s.ask}`);
      console.log(`<sub>보는 자리: ${s.source}</sub>`);
      console.log('');
      if (s.empty) { console.log('  **비어 있습니다.** 이 자리를 말하는 체계가 없습니다.'); console.log(''); continue; }
      for (const f of s.filled) {
        console.log(`- **${f.system}** · ${f.what}`);
        console.log(`  ${f.text.replace(/\n/g, ' ')}`);
      }
      console.log('');
    }
  }
  process.exit(0);
}

// ── 열한 명 한눈에 — 칸이 버티는가 ──
const file = 'validation/people.json';
if (!existsSync(file)) { console.error(`${file} 이 없습니다.`); process.exit(1); }
const people = JSON.parse(readFileSync(file, 'utf8'));

console.log('# 칸 배치가 사람마다 버티는가');
console.log('');
console.log('칸마다 **몇 개 체계가 말했는지**입니다. `·` 은 아무도 말하지 않은 칸입니다.');
console.log('');

const rows = [];
for (const p of people) {
  let all = null;
  try { all = slotsFor(p.birth); } catch { continue; }
  rows.push({ id: p.id, label: p.labels?.career?.occupationKey ?? '', all });
}

for (const d of DOMAINS) {
  const table = SLOTS[d];
  console.log(`## ${DOMAIN_KR[d]}`);
  console.log('');
  console.log(`  ${pad('사람', 6)}${pad('', 14)}${table.map((s) => pad(s.label, 15)).join('')}`);
  for (const r of rows) {
    console.log(`  ${pad(r.id, 6)}${pad(r.label, 14)}`
      + table.map((s, i) => {
        const n = r.all[d][i].filled.length;
        return pad(n ? `${n}개` : '·', 15);
      }).join(''));
  }
  console.log('');
  // 비는 칸이 몇 명에게 생기나 — 이 칸은 답할 수 없는 자리다
  const holes = table.map((s, i) => ({
    label: s.label,
    empty: rows.filter((r) => r.all[d][i].empty).length,
  })).filter((x) => x.empty);
  if (holes.length) {
    console.log('  비는 칸:');
    for (const h of holes) {
      console.log(`    ${pad(h.label, 14)} ${h.empty}/${rows.length}명에게 비어 있음`
        + (h.empty === rows.length ? '   ← **아무에게도 안 채워짐. 칸을 지우거나 볼 자리를 다시 정해야 함**' : ''));
    }
    console.log('');
  }
}

console.log('## 읽는 법');
console.log('  · 칸이 **모두에게 비면** 그 자리를 볼 체계를 잘못 지목한 것입니다.');
console.log('  · 칸에 **늘 같은 수**가 들어오면 사람을 가르지 못하는 것일 수 있습니다.');
console.log('  · 맞았나 틀렸나는 여기서 재지 않습니다. `--id` 로 펼쳐서 눈으로 봅니다.');
