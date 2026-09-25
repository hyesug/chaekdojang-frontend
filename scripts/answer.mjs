/**
 * answer.mjs — **한 질문에 열다섯이 각각 뭐라 하는지 전부 적는다**
 *
 *   node scripts/answer.mjs --id P01
 *   node scripts/answer.mjs 1992-01-30 16:28 여주 대전 female
 *
 * 화면이나 AI 를 거치지 않고 **엔진이 실제로 가진 말**을 그대로 펼친다.
 * "왜 이 답이 안 나오지"를 따질 때 여기부터 본다 — 엔진에 없는 것인지,
 * 있는데 안 나가는 것인지가 여기서 갈린다.
 *
 * 말하지 않는 체계도 **말하지 않는다고 적는다.** 빠뜨린 것과 할 말이 없는
 * 것은 다르고, 그 구별이 보이지 않으면 어디를 고쳐야 할지 알 수 없다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { readFortune } from '../public/unse/src/engine.js';
import { readChildren, childPalaceStars, childrenVerdict }
  from '../public/unse/src/semantic/structure/children.js';
import { readSpouse, spousePalaceStars, spouseVerdict }
  from '../public/unse/src/semantic/structure/spouse.js';
import { readStructures } from '../public/unse/src/semantic/structure/saju.js';
import { lifeChapters, chaptersAt } from '../public/unse/src/semantic/compose/life.js';
import { childrenPack, marriagePack } from '../public/unse/src/hires/vedicExt.js';
import { merge, consensusOf } from '../public/unse/src/semantic/compose/consensus.js';
import { westernPair } from '../public/unse/src/semantic/structure/western.js';

const ALL = ['사주', '자미두수', '점성술(현대)', '고전 서양', '베딕', '주역', '육임', '홍국기문', '태을신수',
  '구성학', '숙요', '토정비결', '카발라', '마하보테', '태국 점성술', '타로'];

const args = process.argv.slice(2);
let birth = null; let who = null;
const idArg = args.indexOf('--id');
if (idArg >= 0) {
  const p = JSON.parse(readFileSync('validation/people.json', 'utf8'))
    .find((x) => x.id === args[idArg + 1]);
  if (!p) { console.error('그 id 가 없습니다.'); process.exit(1); }
  birth = { ...p.birth, name: p.id };
  who = `${p.id} — ${p.labels?.career?.occupationKey ?? ''}`;
} else {
  const [date, time, bp, hp, gender] = args;
  if (!date) { console.error('사용법: node scripts/answer.mjs --id P01'); process.exit(1); }
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time ?? '').split(':').map(Number);
  birth = { name: '조회', gender: gender ?? 'female', year: y, month: m, day: d,
    ...(Number.isFinite(hh) ? { hour: hh, minute: mm ?? 0 } : {}),
    birthPlace: bp ?? '서울', homePlace: hp ?? bp ?? '서울' };
  who = `${date} ${time ?? '시각미상'} · ${bp} · ${hp}`;
}

const r = readFortune(birth);
const chart = { ...r.chart, gender: birth.gender };
const wrap = (s, n = 96) => String(s).replace(/\s+/g, ' ')
  .replace(new RegExp(`(.{1,${n}})(\\s|$)`, 'g'), '$1\n      ').trimEnd();

/** 한 질문을 적는다 — 말한 체계와 말하지 않은 체계를 모두 */
function section(title, reads, verdictLines) {
  console.log('');
  console.log('━'.repeat(78));
  console.log(`  ${title}`);
  console.log('━'.repeat(78));
  // '사주(격)' 은 사주로 접되 '점성술(현대)' 는 그대로 둔다 — 고전과 다른 체계다
  const said = new Set(reads.map((x) => x.system.replace(/\(격\)/, '').trim()));
  for (const x of reads) {
    console.log(`  [${x.system}] ${x.what ?? ''}`);
    console.log(`      ${wrap(x.text)}`);
    if (x.source) console.log(`      └ ${x.source}`);
  }
  const silent = ALL.filter((s) => !said.has(s));
  if (silent.length) {
    console.log('');
    console.log(`  말하지 않는 체계 (${silent.length}) — ${silent.join(' · ')}`);
    console.log('      이 자리를 보는 전통이 아니거나, 이 사이트가 그 읽기를 아직 안 만들었습니다.');
  }
  if (verdictLines?.length) {
    console.log('');
    console.log('  ▶ 종합 (겹치면 단정 · 갈리면 뺌 · 하나뿐이면 보수적)');
    for (const l of verdictLines) console.log(`      ${wrap(l)}`);
  }
}

console.log(`# ${who}`);

// ── ① 직업 전환 ──
{
  const st = readStructures(chart).structures;
  const reads = [];
  for (const name of ['상관견관', '관살혼잡', '관유인무', '무관', '관인상생']) {
    const s = st.find((x) => x.name === name);
    if (s) reads.push({ system: '사주(격)', what: `${s.name} ${s.hanja}`, text: s.text, source: s.source });
  }
  const zw = r.results.find((x) => x.name === '자미두수');
  for (const t of ['관록궁 — 일의 자리', '명궁 주성']) {
    const hit = (zw?.readings ?? []).find((x) => x.title.startsWith(t));
    if (hit) reads.push({ system: '자미두수', what: hit.title, text: hit.text });
  }
  const te = r.results.find((x) => x.name === '태을신수');
  const teR = (te?.readings ?? []).find((x) => /주산|객산/.test(x.title));
  if (teR) reads.push({ system: '태을신수', what: teR.title, text: teR.text });
  reads.push(...westernPair(r.input, r, 10, '직업'));

  // 상충하지 않는 면들을 **합친다.** 따로 두고 각각 물러서면 아무 말도 안 된다
  const facets = [];
  const has = (n) => st.some((x) => x.name === n);
  if (has('상관견관')) facets.push({ system: '사주 상관견관', facet: '제도가 정해 준 길보다 자기 기술로 가는 쪽' });
  if (has('관살혼잡')) facets.push({ system: '사주 관살혼잡', facet: '한 곳에 오래 있기보다 여러 군데를 거치는 쪽' });
  if (has('관유인무')) facets.push({ system: '사주 관유인무', facet: '자격·학위로 들어가는 길은 문턱에서 막히는 쪽' });
  const careerStar = (zw?.readings ?? []).find((x) => x.title.startsWith('관록궁'));
  if (/고정되지 않습니다/.test(careerStar?.text ?? '')) {
    facets.push({ system: '자미 관록궁', facet: '일의 성격이 한 갈래로 고정되지 않는 쪽' });
  }
  if (/주산이 크다/.test(teR?.text ?? '')) {
    facets.push({ system: '태을 주산', facet: '급히 판을 바꾸기보다 자리를 지키며 옮기는 쪽' });
  }

  section('① 나는 직업 전환이 있을까?', reads, [
    merge(facets) ? `**${merge(facets)}** — 이 다섯은 서로 반대말이 아니라 다른 면입니다.`
      + ' 상충이 없어 합쳐서 봅니다.' : null,
    '**다만 이 축은 저희가 재 봤더니 졌습니다.** 열다섯을 다 재도 순열검정 p=0.423 —'
      + ' 1위(토정 8/10)가 우연과 구별되지 않았습니다. 전통이 뭐라 하는지는 위와 같고,'
      + ' 그것이 맞는다고는 말하지 않습니다.',
  ].filter(Boolean));
}

// ── ② 배우자 ──
{
  const reads = [...readSpouse(chart, spousePalaceStars(r.input), marriagePack(r.input)),
    ...westernPair(r.input, r, 7, '결')];
  const v = spouseVerdict(reads);
  const ch = lifeChapters(r.input, r.chart, r.input.isMale);
  const here = chaptersAt(ch, r.input.currentYear).map((c) => `${c.system} ${c.label}`).join(' · ');
  const west = consensusOf(reads.filter((x) => x.topicKey === '결' && x.stance));
  section('② 배우자는 무슨 직업이고 몇 살이고 언제 결혼할까?', reads, [
    ...v.lines,
    west.verdict === '겹침'
      ? `관계 자리 자체는 **${west.stance === '많음' ? '받쳐지는 쪽' : '눌리는 쪽'}**입니다. ${west.say}`
      : west.verdict === '갈림' ? west.say : null,
    `시기 — 지금 걸린 구간은 ${here}. **다만 결혼 시기는 이 사이트가 두 번 재서 두 번 다`
      + ` 신호를 못 찾았습니다**(달 단위 p=0.868, 해 단위 p=0.196). 구간 경계는 확정 계산이지만`
      + ` 거기서 결혼을 끌어내는 것은 검증되지 않았습니다.`,
  ].filter(Boolean));
}

// ── ③ 자녀 ──
{
  const reads = [...readChildren(chart, childPalaceStars(r.input), childrenPack(r.input)),
    ...westernPair(r.input, r, 5, '열림')];
  section('③ 자녀운은 어떻게 돼?', reads, childrenVerdict(reads).lines);
}

console.log('');
console.log('━'.repeat(78));
console.log('  ※ 위는 각 전통의 규칙을 옮긴 것입니다. 맞는다고 검증된 것이 아닙니다.');
console.log('━'.repeat(78));
