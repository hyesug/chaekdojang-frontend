/**
 * validate-axes.mjs — **열다섯 체계 전부**를 같은 축에 세워 채점한다
 *
 *   node scripts/validate-axes.mjs
 *
 * ── 왜 필요했나 ────────────────────────────────────────────
 * 속성마다 담당 체계를 정하면서 실은 **핵심 넷만 재고 있었다.** 나머지
 * 열하나는 직업 문구만 내놓고 축 채점에는 들어오지 않았다. 그래서 '담당을
 * 정했다'고 말할 수 없었다 — 후보를 넷만 놓고 고른 것이었으니까.
 *
 * ── 표를 어떻게 썼나 ───────────────────────────────────────
 * 체계마다 '자기 판' 쪽 기호와 '조직' 쪽 기호를 **그 전통이 그 기호에
 * 붙여 둔 뜻**으로만 갈랐다. 그리고 **축마다 표를 새로 쓰지 않았다** —
 * 축마다 다시 쓰면 답을 보고 표를 고르게 된다. 한 표로 두 축을 잰다.
 *
 * ── 반드시 순열 검정을 함께 본다 ────────────────────────────
 * 열다섯을 늘어놓고 제일 잘한 것을 고르면 **아무 신호가 없어도 하나는
 * 잘한다.** 열 명 · 영점 50%면 8/10 은 우연만으로도 절반 넘게 나온다.
 * 그래서 라벨을 섞어 '열다섯 중 최고'를 다시 구하고, 실제 최고가 그 분포의
 * 어디쯤인지 본다. **이 p값이 표의 맨 윗줄보다 중요하다.**
 *
 * 사람 자료는 validation/attributes.json 에 있고 .gitignore 에 걸려 있다.
 */
import { readFileSync } from 'node:fs';
const B = '../public/unse-8f3k2m/src/';
const { readFortune } = await import(B + 'engine.js');
const ZW = await import(B + 'hires/ziwei.js');
const ZE = await import(B + 'hires/ziweiExt.js');
const VE = await import(B + 'hires/vedicExt.js');
const WS = await import(B + 'hires/western.js');
const { tenGod, TEN_GOD_GROUP } = await import(B + 'core/ganzhi.js');
const { solarToLunar } = await import(B + 'core/lunar.js');

function lunarToSolar(y, lm, ld) {
  for (let m = 1; m <= 12; m++) for (let d = 1; d <= 31; d++) {
    const L = solarToLunar(y, m, d);
    if (L && L.month === lm && L.day === ld && !L.leap) return { y, m, d };
  }
  return null;
}

// 독립/조직 — 기호의 전통적 뜻에서만 가른다
const SELF = {
  자미두수: ['파군', '칠살', '탐랑'],
  주역: ['震', '離', '兌', '艮'],
  태을신수: ['震', '離', '兌', '艮'],
  토정비결: ['震', '離', '兌', '艮'],
  구성학: ['삼벽', '구자', '칠적', '팔백'],
  홍국기문: ['개문', '경문', '생문'],
  육임: ['청룡', '육합', '백호', '현무'],
  마하보테: ['화성', '태양', '목성'],
  태국: ['화요일', '일요일', '목요일'],
  숙요: ['화요', '일요', '목요'],
  카발라: [1, 3, 5, 8],
  타로: ['마법사', '전차', '바보', '악마', '탑', '운명의수레바퀴', '황제'],
};
const ORG = {
  자미두수: ['자미', '천부', '천상', '천량', '천동'],
  주역: ['乾', '坤', '巽', '坎'],
  태을신수: ['乾', '坤', '巽', '坎'],
  토정비결: ['乾', '坤', '巽', '坎'],
  구성학: ['육백', '이흑', '사록', '일백'],
  홍국기문: ['휴문', '두문', '사문', '상문'],
  육임: ['귀인', '주작', '태상', '구진'],
  마하보테: ['토성', '수성', '금성', '달'],
  태국: ['토요일', '수요일', '금요일', '월요일'],
  숙요: ['토요', '수요', '금요', '월요'],
  카발라: [2, 4, 6, 7, 9],
  타로: ['교황', '정의', '여황제', '은둔자', '힘', '절제', '심판', '세계',
        '여사제', '매달린사람', '연인', '별', '달', '태양', '죽음'],
};
const TRIGRAM = { 1: '乾', 2: '兌', 3: '離', 4: '震', 5: '巽', 6: '坎', 7: '艮', 8: '坤' };

const P = JSON.parse(readFileSync('validation/attributes.json', 'utf8'))
  .map((r) => (r.lunar ? { ...r, ...lunarToSolar(r.lunar[0], r.lunar[1], r.lunar[2]) } : r));

function symbols(r) {
  const by = Object.fromEntries((r.results ?? []).map((x) => [x.name, x]));
  const head = (n) => String(by[n]?.headline ?? '');
  const fact = (n, label) => (by[n]?.facts ?? []).find((f) => f.label === label)?.value ?? '';
  const s = {};

  if (r.input.timeKnown) {
    const st = ZW.stackAt(r.input, 2026, null);
    const row = ZE.domainPalaces(r.input, '직업', st.layers).find((x) => x.palace === '관록궁')
      ?.rows?.find((x) => /원국/.test(x.layer ?? ''));
    let main = row?.main ?? [];
    if (!main.length && row?.branch != null) {
      main = st.board?.board?.[ZE.trineSquare(row.branch).opposite] ?? [];
    }
    s.자미두수 = main;
    const N = WS.natalPack(r.input);
    const mc = Math.floor((((N.cusps[10] % 360) + 360) % 360) / 30);
    s.점성술 = [0, 4, 8].includes(mc) ? '자기' : [1, 5, 9].includes(mc) ? '조직' : null;
  } else { s.자미두수 = null; s.점성술 = null; }

  const dist = {};
  for (const k of ['year', 'month', 'day', 'hour']) {
    const pil = r.chart.pillars[k]; if (!pil) continue;
    const g = TEN_GOD_GROUP?.[tenGod(r.chart.dayStem, pil.stem)];
    if (g) dist[g] = (dist[g] ?? 0) + 1;
  }
  s.사주 = { dyn: (dist['비겁'] ?? 0) + (dist['식상'] ?? 0), sta: (dist['관성'] ?? 0) + (dist['인성'] ?? 0) };
  s.베딕 = VE.wealthPack(r.input)?.d10_10?.lord ?? null;

  s.주역 = fact('주역', '상괘');
  const tg = String(fact('태을신수', '태을궁')).replace(/[^離坎坤震巽乾兌艮中]/g, '');
  s.태을신수 = tg === '中' ? '坤' : (tg || null);
  s.토정비결 = TRIGRAM[Number(fact('토정비결', '상괘'))] ?? null;
  s.구성학 = (head('구성학').match(/(일백|이흑|삼벽|사록|오황|육백|칠적|팔백|구자)/) ?? [])[1] ?? null;
  s.홍국기문 = (head('홍국기문').match(/(휴문|생문|상문|두문|경문|사문|개문)/) ?? [])[1] ?? null;
  s.육임 = (by['육임']?.facts ?? []).map((f) => String(f.value)).join(' ')
    .match(/(귀인|등사|주작|육합|구진|청룡|천공|백호|태상|현무|태음|천후)/)?.[1] ?? null;
  s.마하보테 = (head('마하보테').match(/(태양|달|화성|수성|목성|금성|토성)/) ?? [])[1] ?? null;
  s.태국 = (head('태국 점성술').match(/[일월화수목금토]요일/) ?? [])[0] ?? null;
  const yo = (head('숙요').match(/·\s*([일월화수목금토])요/) ?? [])[1];
  s.숙요 = yo ? yo + '요' : null;
  s.카발라 = Number((head('카발라').match(/라이프 패스\s*(\d+)/) ?? [])[1]) || null;
  s.타로 = (head('타로').match(/생일 카드\s*([^\s·]+)/) ?? [])[1] ?? null;
  return s;
}

const rows = [];
for (const p of P) {
  const r = readFortune({ name: 'x', gender: p.g, year: p.y, month: p.m, day: p.d,
    hour: p.h ?? undefined, minute: p.mi ?? undefined, birthPlace: '대전', homePlace: '대전' });
  rows.push({ ...p, s: symbols(r) });
}

function saysIndependent(sys, v) {
  if (v == null) return null;
  if (sys === '사주') return v.dyn === v.sta ? null : (v.dyn > v.sta ? '자영' : '월급');
  if (sys === '점성술') return v === '자기' ? '자영' : v === '조직' ? '월급' : null;
  if (sys === '베딕') return ['화성', '태양', '목성'].includes(v) ? '자영'
    : ['토성', '수성', '금성', '달'].includes(v) ? '월급' : null;
  if (sys === '자미두수') {
    const mv = v.filter((x) => SELF.자미두수.includes(x));
    const st = v.filter((x) => ORG.자미두수.includes(x));
    return mv.length && !st.length ? '자영' : st.length && !mv.length ? '월급' : null;
  }
  if ((SELF[sys] ?? []).includes(v)) return '자영';
  if ((ORG[sys] ?? []).includes(v)) return '월급';
  return null;
}

const SYSTEMS = ['사주', '자미두수', '점성술', '베딕', '주역', '태을신수', '토정비결', '구성학',
  '홍국기문', '육임', '마하보테', '태국', '숙요', '카발라', '타로'];

function run(title, keyOf, map) {
  console.log('');
  console.log('=== ' + title + ' ===');
  const all = rows.filter((r) => keyOf(r));
  const cnt = {}; for (const r of all) cnt[keyOf(r)] = (cnt[keyOf(r)] ?? 0) + 1;
  const zero = Object.entries(cnt).sort((x, y) => y[1] - x[1])[0];
  const base = zero[1] / all.length;
  console.log(`영점('${zero[0]}'만 찍기) = ${zero[1]}/${all.length} = ${Math.round(base * 100)}%`);
  const res = [];
  for (const sys of SYSTEMS) {
    let n = 0, h = 0;
    for (const r of all) {
      const said = map(saysIndependent(sys, r.s[sys]));
      if (!said) continue;
      n++; if (said === keyOf(r)) h++;
    }
    res.push({ sys, n, h, pct: n ? h / n : null });
  }
  res.sort((x, y) => (y.pct ?? -1) - (x.pct ?? -1) || y.n - x.n);
  for (const x of res) {
    const bar = x.n ? `${x.h}/${x.n}  ${String(Math.round(x.pct * 100)).padStart(3)}%` : '  침묵';
    const mark = x.n >= 6 && x.pct > base ? '   <= 영점 넘음' : '';
    console.log(`  ${x.sys.padEnd(6)} ${bar}${mark}`);
  }
}

run('수입형태 (자영/월급)', (r) => r.pay, (v) => v);
run('직업전환 (바꿈/한우물)', (r) => r.sw,
  (v) => (v === '자영' ? '바꿈' : v === '월급' ? '한우물' : null));

// ── 순열 검정 — '열다섯 중 최고'가 우연히 얼마나 잘 나오는가 ──
function permTest(title, keyOf, map, ROUNDS = 20000) {
  const all = rows.filter((r) => keyOf(r));
  const said = {};
  for (const sys of SYSTEMS) said[sys] = all.map((r) => map(saysIndependent(sys, r.s[sys])));
  const score = (labels) => {
    let best = 0;
    for (const sys of SYSTEMS) {
      let n = 0, h = 0;
      said[sys].forEach((v, i) => { if (v) { n++; if (v === labels[i]) h++; } });
      if (n >= 6) best = Math.max(best, h / n);
    }
    return best;
  };
  const real = score(all.map(keyOf));
  let ge = 0;
  const labels = all.map(keyOf);
  for (let i = 0; i < ROUNDS; i++) {
    const sh = labels.slice();
    for (let j = sh.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1)); [sh[j], sh[k]] = [sh[k], sh[j]];
    }
    if (score(sh) >= real - 1e-9) ge++;
  }
  console.log('');
  console.log(`[순열] ${title}`);
  console.log(`  실제 '열다섯 중 최고' = ${Math.round(real * 100)}%`);
  console.log(`  라벨을 섞어도 그만큼 나온 비율 = ${(ge / ROUNDS * 100).toFixed(1)}%  (p = ${(ge / ROUNDS).toFixed(3)})`);
}
permTest('수입형태', (r) => r.pay, (v) => v);
permTest('직업전환', (r) => r.sw, (v) => (v === '자영' ? '바꿈' : v === '월급' ? '한우물' : null));
