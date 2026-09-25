/**
 * ledger.mjs — **학습 장부: 열다섯이 한 말을 한 줄에 하나씩 펼친다**
 *
 *   node scripts/ledger.mjs --id P01
 *   node scripts/ledger.mjs 1992-01-30 16:28 여주 대전 female
 *
 * ── 왜 만들었나 ────────────────────────────────────────────
 * 이 저장소는 열다섯 체계의 말을 스무 개 축의 숫자로 바꿔서 합쳐 왔다.
 * 그런데 그 변환에서 정작 사람이 확인해 줄 수 있는 것이 사라진다.
 *
 *   "코사인 0.248"        → 사용자가 맞다/아니다를 말할 수 없다
 *   "거문 — 따지고 파고든다" → 바로 말할 수 있다
 *
 * 그리고 P01 에서 드러났듯이 **합치는 순간 신호가 죽는다.** 자미두수 단독은
 * 정답과 0.649 인데 열다섯을 합치면 0.248 이다. 자미가 `분석` 을 말하고
 * 있었는데 다른 열넷이 희석시켰다.
 *
 * 그래서 합치기 전에 **각자 한 말을 그대로 남기고, 어느 말이 맞았는지
 * 사람에게 표시받는다.** 그 표시가 쌓인 것이 "해석하는 법"이다.
 *
 * ── 이 장부로 배우는 것 ────────────────────────────────────
 * 배우는 단위는 체계의 가중치가 아니라 **말 하나하나**다.
 *
 *   `자미:명궁 주성 — 거문` 이 뜬 사람들에게 그 말이 맞았는가?
 *
 * 열쇠(`체계:제목`)가 사람이 바뀌어도 같으므로, 같은 별이 뜬 다른 사람에게
 * 그대로 넘어간다. "P01 은 카발라가 맞혔다"는 안 넘어가지만
 * "거문이 뜨면 따지고 파고든다"는 넘어간다.
 *
 * ── 표시하는 법 ────────────────────────────────────────────
 *   [o] 맞다   [x] 아니다   [~] 반쯤   [ ] 모르겠다/해당 없음
 *
 * **모르겠으면 비워 두세요.** 억지로 채운 표시가 가장 나쁩니다 —
 * 틀린 정답표로 배우면 틀린 것을 배웁니다.
 *
 * ── 개인정보 ───────────────────────────────────────────────
 * 나오는 파일 `validation/ledger-*.md` 는 `.gitignore` 에 있다.
 * 열다섯의 말 옆에 그 사람의 실제 삶이 적히는 판이라 더 민감하다.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { natalFortune } from '../public/unse/src/semantic/index.js';
import { readStructures } from '../public/unse/src/semantic/structure/saju.js';

const args = process.argv.slice(2);

// ── 누구인가 ──
let birth = null; let who = null; let id = null; let known = null;
const idArg = args.indexOf('--id');
if (idArg >= 0) {
  const f = 'validation/people.json';
  if (!existsSync(f)) { console.error(`${f} 이 없습니다.`); process.exit(1); }
  const p = JSON.parse(readFileSync(f, 'utf8')).find((x) => x.id === args[idArg + 1]);
  if (!p) { console.error(`${args[idArg + 1]} 을 찾지 못했습니다.`); process.exit(1); }
  birth = p.birth; id = p.id;
  who = `${p.id}${p.labels?.career?.occupationKey ? ` — ${p.labels.career.occupationKey}` : ''}`;
  known = p.labels ?? null;
} else {
  const [date, time, bp, hp, gender] = args;
  if (!date) {
    console.error('사용법: node scripts/ledger.mjs --id P01');
    console.error('       node scripts/ledger.mjs 1992-01-30 16:28 여주 대전 female');
    process.exit(1);
  }
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time ?? '').split(':').map(Number);
  birth = {
    name: '조회', gender: gender ?? 'female', year: y, month: m, day: d,
    ...(Number.isFinite(hh) ? { hour: hh, minute: mm ?? 0 } : {}),
    birthPlace: bp ?? '서울', homePlace: hp ?? bp ?? '서울',
  };
  id = `${date.replace(/-/g, '')}-${(time ?? '0000').replace(':', '')}`;
  who = `${date} ${time ?? '시각미상'} · ${bp} 출생 · ${hp} 거주`;
}

const { fortune } = natalFortune(birth);

/**
 * 같은 말이 다른 사람에게도 뜨는가 — **배울 수 있는 말인지 가른다.**
 *
 * 열한 명으로 재 보면 서로 다른 말이 330가지인데 그중 199가지가 한 사람에게만
 * 뜬다. 가장 잘 가르는 말이지만 한 명으로는 배울 수 없다. 반대로 스무 가지는
 * 전원에게 떠서 배울 수는 있어도 사람을 가르지 못한다.
 *
 * 그래서 몇 명에게 떴는지를 줄마다 적는다. 표시할 힘이 한정돼 있으면
 * **가운데(둘~아홉 명)부터** 표시하는 것이 남는다.
 */
function keyFrequency() {
  const f = 'validation/people.json';
  if (!existsSync(f)) return null;
  const freq = {}; let n = 0;
  for (const p of JSON.parse(readFileSync(f, 'utf8'))) {
    let fo = null;
    try { ({ fortune: fo } = natalFortune(p.birth)); } catch { continue; }
    n += 1;
    const seen = new Set();
    for (const v of Object.values(fo.results ?? {})) {
      for (const r of v.readings ?? []) {
        if (r?.mono) continue;
        seen.add(keyOf(v.hanja || v.name, r.title));
      }
    }
    try {
      for (const s of readStructures({ ...fo.chart, gender: p.birth.gender }).structures) {
        seen.add(`四柱格:${s.name}`);
      }
    } catch { /* 명식을 못 세운 사람은 건너뛴다 */ }
    for (const k of seen) freq[k] = (freq[k] ?? 0) + 1;
  }
  return { freq, n };
}

/**
 * 말 하나를 열쇠로 바꾼다.
 *
 * 같은 별이 뜬 다른 사람에게서도 **같은 열쇠**가 나와야 배운 것이 넘어간다.
 * 그래서 한자 괄호와 군더더기를 털고 제목만 남긴다. 제목에 값이 들어
 * 있는 것("명궁 주성 — 거문")이 중요하다 — 값이 빠지면 누구에게나 같은
 * 열쇠가 되어 아무것도 못 가린다.
 */
const keyOf = (sysHanja, title) => `${sysHanja}:${String(title ?? '')
  .replace(/\s*\([^)]*\)\s*/g, '')      // (巨門) 같은 한자 괄호
  .replace(/\s*—\s*/g, ' — ')
  .replace(/\s+/g, ' ')
  .trim()}`;

/** 문장 단위로 쪼갠다 — 한 줄에 여러 주장이 섞이면 표시할 수가 없다 */
const sentences = (text) => String(text ?? '')
  .split(/(?<=[.。!?])\s+|\n+/)
  .map((s) => s.trim())
  .filter((s) => s.length >= 6);

/**
 * 명반 낱말 — 이것이 주어 자리에 있으면 사람이 아니라 **판**을 말하는 문장이다.
 *
 * 짧은 것(목·화·토·금·수·살·관·인)은 다른 낱말 속에 흔히 들어가므로
 * (`수`면, 변`화`) 조사가 붙은 꼴로만 센다.
 */
const CHART_LONG = new RegExp([
  '비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인',
  '비겁', '식상', '재성', '관성', '인성', '칠살', '십신', '오행', '지장간', '납음',
  '일간', '일지', '년지', '월지', '시지', '년간', '월간', '대운', '세운', '원국', '명식',
  '명궁', '신궁', '부처궁', '관록궁', '재백궁', '질액궁', '전택궁', '복덕궁',
  '형제궁', '자녀궁', '노복궁', '천이궁', '부모궁', '명반', '오행국',
  '자미', '천기', '무곡', '천동', '염정', '천부', '태음', '탐랑', '거문', '천상',
  '천량', '파군', '문창', '문곡', '좌보', '우필', '화록', '화권', '화과', '화기', '사화',
  '상승점', '중천', '하우스', '아야남샤',
  '라그나', '찬드라', '수르야', '다샤', '나크샤트라', '라시',
  '본괘', '지괘', '동효', '상괘', '하괘', '중괘', '초효',
  '삼전', '사과', '초전', '말전', '월장', '기궁', '천반', '지반',
  '태을궁', '주산', '객산', '본명성', '월명성', '중궁', '본명숙', '파다', '태세수',
  '세피라', '라이프 ?패스', '생일수', '개인년', '생일 카드',
].join('|'));

/** 짧은 낱말은 조사가 붙은 꼴로만 — `금이` 는 오행이지만 `지금` 의 금은 아니다 */
const CHART_SHORT = /(^|[\s(·「])(목|화|토|금|수|살|관|인|재|식)[이가은는을를과와]([\s.,)]|$)/;

/**
 * 존재·위치·수량을 말하는 서술어.
 *
 * 이런 서술어가 명반 낱말과 함께 오면 **계산을 되읊은 것**이다. "금이
 * 강합니다"는 참/거짓을 물을 수 없다 — 명반을 보면 그냥 그렇다.
 * 반대로 "기준이 뚜렷하고 판단이 빠릅니다"는 사람에 대한 주장이라 물을 수 있다.
 */
const CALC_TAIL = new RegExp(`(${[
  '있습니다', '없습니다', '입니다', '것입니다', '셈입니다',
  '해당합니다', '충합니다', '형합니다', '합합니다',
  '강합니다', '약합니다', '우세합니다', '뚜렷합니다',
  '들었습니다', '듭니다', '앉았습니다', '떨어졌습니다', '놓였습니다', '섰습니다',
  '낳습니다', '지킵니다', '나옵니다', '봅니다', '뜻입니다',
].join('|')})[.!?]?$`);

/** 표를 찾아 읽은 것 — 색·방위·숫자·시간대는 대응표 조회지 주장이 아니다 */
const LOOKUP = /^(색은|방향은|방위는|숫자는|시간대는|행운의|수호)/;

/**
 * 이 문장은 표시할 수 있는가.
 *
 * 가리는 기준은 하나다 — **명반을 보지 않고 맞다/아니다를 말할 수 있는가.**
 * 말할 수 없으면 그것은 계산이거나 낱말 뜻풀이지 이 사람에 대한 주장이 아니다.
 *
 * 완벽하지 않다. 그래서 걸러낸 문장을 지우지 않고 접어서 함께 싣는다 —
 * 잘못 걸렀으면 보여야 고칠 수 있다.
 */
function markable(s) {
  if (LOOKUP.test(s)) return false;
  // 괄호 안 주석("(시지 정관 · 년간 편관)")을 떼고 서술어를 본다
  const bare = s.replace(/\s*[(（][^)）]*[)）]\s*/g, ' ').replace(/\*\*/g, '').trim();
  // 한자가 섞인 문장은 거의 언제나 명반 표기다
  const chart = CHART_LONG.test(s) || CHART_SHORT.test(s) || /[一-鿿]/.test(s);
  return !(chart && CALC_TAIL.test(bare));
}

/**
 * 이미 표시해 둔 것을 되살린다.
 *
 * 체계를 고치면 장부를 다시 뽑게 되는데, 그때마다 표시가 날아가면 아무도
 * 표시하지 않는다. 문장 그대로를 열쇠 삼아 옛 표시를 옮겨 붙인다. 문장이
 * 바뀐 줄은 옮기지 않는다 — **다른 말에 옛 표시를 붙이면 그게 곧 조작이다.**
 *
 * 사람이 적어 넣은 '아는 사실' 칸도 통째로 지킨다.
 */
function previous(path) {
  if (!existsSync(path)) return { marks: {}, known: null };
  const text = readFileSync(path, 'utf8');
  const marks = {};
  for (const m of text.matchAll(/^- \[([ox~])\] (.+)$/gm)) marks[m[2].trim()] = m[1];
  const block = text.match(/## 아는 사실\n([\s\S]*?)\n---\n/);
  return { marks, known: block ? block[1].trimEnd() : null };
}

const out = `validation/ledger-${id}.md`;
const prev = previous(out);
const shared = keyFrequency();

/** 이 말이 몇 명에게 떴나 — 표시할 값어치를 가른다 */
function reach(key) {
  if (!shared) return null;
  const c = shared.freq[key] ?? 1;
  if (c >= shared.n) return { c, tag: '전원', worth: 0 };
  if (c === 1) return { c, tag: '혼자', worth: 1 };
  return { c, tag: `${c}명`, worth: 2 };
}

const lines = [];
lines.push(`# 학습 장부 — ${who}`);
lines.push('');
lines.push('열다섯 체계가 이 사람에 대해 한 말을 **합치기 전에** 그대로 펼친 것입니다.');
lines.push('');
lines.push('`[o]` 맞다 · `[x]` 아니다 · `[~]` 반쯤 · `[ ]` 모르겠다 (비워 두세요)');
lines.push('');
lines.push('> 모르겠으면 **반드시 비워 두세요.** 억지로 채운 표시로 배우면 틀린 것을 배웁니다.');
lines.push('> 해당 사항이 없는 말(예: 아직 겪지 않은 일)도 비워 둡니다.');
lines.push('');
if (shared) {
  lines.push(`제목 옆의 \`◆\` 는 **정답표 ${shared.n}명 가운데 몇 명에게 이 말이 떴는지**입니다.`);
  lines.push('');
  lines.push('- `◆전원` — 누구에게나 뜹니다. 맞아도 이 사람을 가린 것이 아닙니다. 나중에 표시하세요.');
  lines.push('- `◆혼자` — 이 사람에게만 떴습니다. 가장 잘 가르지만 한 명이라 아직 배울 수 없습니다.');
  lines.push(`- \`◆2~${shared.n - 1}명\` — **여기부터 표시하세요.** 지금 배울 수 있는 것은 이 자리뿐입니다.`);
  lines.push('');
}

// ── 아는 사실 — 표시할 때 옆에 놓고 본다 ──
lines.push('## 아는 사실');
if (prev.known) {
  // 사람이 적어 넣은 것은 그대로 지킨다
  lines.push(prev.known);
} else {
  lines.push('');
  if (known) {
    for (const [domain, v] of Object.entries(known)) {
      const label = v?.occupationKey ?? v?.label ?? null;
      if (label) lines.push(`- **${domain}**: ${label}`);
    }
    lines.push('');
  }
  lines.push('여기에 아는 것을 자유롭게 더 적으세요. 진로 흐름·관계 이력·돈·건강·가족·주거 —');
  lines.push('나중에 무엇이 맞았는지 세려면 이 칸이 채워져 있어야 합니다.');
  lines.push('');
  lines.push('```');
  lines.push('진로:');
  lines.push('관계:');
  lines.push('돈:');
  lines.push('건강:');
  lines.push('가족·주거:');
  lines.push('```');
}
lines.push('');
lines.push('---');
lines.push('');

// ── 체계마다 ──
let total = 0; let learnable = 0; let kept = 0; let calc = 0;

/**
 * 한 덩이를 적는다 — **주장은 표시 줄로, 계산은 접어서.**
 *
 * 걸러낸 것을 지우지 않고 함께 싣는 이유: 가리는 규칙이 완벽하지 않다.
 * 보이지 않으면 잘못 걸러도 알 수가 없다.
 */
function block(title, key, text, extra = null) {
  const ss = sentences(text);
  if (!ss.length) return;
  const claims = ss.filter(markable);
  const restated = ss.filter((s) => !markable(s));
  if (!claims.length && !restated.length) return;

  const rc = reach(key);
  lines.push(`**${title}** ${rc ? `\`◆${rc.tag}\`` : ''} <sub>\`${key}\`</sub>`);
  lines.push('');
  if (extra) { lines.push(extra); lines.push(''); }

  for (const s of claims) {
    const mark = prev.marks[s] ?? ' ';     // 문장이 그대로일 때만 옛 표시를 옮긴다
    lines.push(`- [${mark}] ${s}`);
    total += 1;
    if (mark !== ' ') kept += 1;
  }
  if (claims.length && rc?.worth === 2) learnable += claims.length;

  if (restated.length) {
    if (claims.length) lines.push('');
    lines.push('<details><summary>명반을 되읊은 줄 (표시 안 함)</summary>');
    lines.push('');
    for (const s of restated) lines.push(`- ${s}`);
    lines.push('');
    lines.push('</details>');
    calc += restated.length;
  }
  lines.push('');
}

for (const v of Object.values(fortune.results ?? {})) {
  lines.push(`## ${v.name} ${v.hanja ? `(${v.hanja})` : ''}`);
  lines.push('');
  if (v.headline) lines.push(`\`${v.headline}\``);
  lines.push('');

  // 명반 사실 — 표시 대상이 아니다. 계산값이지 주장이 아니기 때문이다
  const facts = (v.facts ?? []).filter((f) => f?.label && f?.value);
  if (facts.length) {
    lines.push('<details><summary>세운 값 (표시 대상 아님 — 주장이 아니라 계산입니다)</summary>');
    lines.push('');
    for (const f of facts) {
      lines.push(`- ${f.label}: **${f.value}**${f.note ? ` — ${f.note}` : ''}`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  // 주장 — 여기가 표시할 자리
  for (const r of v.readings ?? []) {
    if (r?.mono) continue;             // 판을 그린 것은 주장이 아니다
    block(r.title, keyOf(v.hanja || v.name, r.title), r.text);
  }

  // 사주는 개수만 말하고("관성 3 · 인성 0") 이름 붙은 조합은 안 낸다.
  // 관살혼잡·상관견관·군겁쟁재처럼 **조합에 이름이 붙은 것**이 명리가
  // 실제로 사람의 일을 말하는 자리라, 구조 판독기를 따로 물린다.
  if (v.name === '사주') {
    const st = readStructures({ ...fortune.chart, gender: birth.gender });
    if (st.structures.length) {
      lines.push('### 이름 붙은 구조 (조합)');
      lines.push('');
      lines.push(`<sub>신강·신약: **${st.facts.strength.level}** (돕는 힘 ${st.facts.strength.help}`
        + ` 대 쓰는 힘 ${st.facts.strength.drain})</sub>`);
      lines.push('');
      for (const s of st.structures) {
        block(`${s.name} ${s.hanja}`, `四柱格:${s.name}`, s.text, `<sub>출전: ${s.source}</sub>`);
      }
    }
  }

  const sig = v.signals ?? {};
  if (sig.tags?.length || sig.keywords?.length) {
    lines.push(`<sub>태그: ${[...(sig.tags ?? []), ...(sig.keywords ?? [])].join(' · ')}</sub>`);
    lines.push('');
  }
}

lines.push('---');
lines.push('');
lines.push(`표시할 주장 **${total}개** · 명반을 되읊어 표시에서 뺀 줄 ${calc}개`
  + (shared ? ` · 지금 배울 수 있는 자리(◆2~${shared.n - 1}명) **${learnable}개**` : '') + '.');
lines.push('');
lines.push('다 표시하지 않아도 됩니다. **확실한 것만** 표시하는 편이 낫습니다.');

if (!existsSync('validation')) mkdirSync('validation');
writeFileSync(out, lines.join('\n'), 'utf8');

const lost = Object.keys(prev.marks).length - kept;
console.log(`${out} — 문장 ${total}개`
  + (shared ? ` · 지금 배울 수 있는 자리 ${learnable}개` : ''));
if (Object.keys(prev.marks).length) {
  console.log(`  옛 표시 ${kept}개를 옮겼습니다.`
    + (lost > 0 ? ` ${lost}개는 문장이 바뀌어 옮기지 않았습니다.` : ''));
}
console.log('');
console.log('  [o] 맞다  [x] 아니다  [~] 반쯤  [ ] 모르겠다');
console.log('');
console.log('  모르는 것은 비워 두세요 — 억지로 채운 표시가 가장 나쁩니다.');
