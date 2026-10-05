/**
 * report.js — **AI 없이 쓰는 통합 해석 문서**
 *
 * AI 질문 한 번에 수백 원이 나갔는데, 모델이 하던 일의 대부분은 **엔진이
 * 이미 써 둔 문장 가운데 그 주제에 맞는 것을 골라 배열하는 것**이었다.
 * 그 고르기와 배열을 코드로 옮기면 값이 들지 않는다.
 *
 * ── 한 번 크게 틀렸던 것 ───────────────────────────────────
 * 처음에는 각 체계의 `readings` 를 통째로 주제별 제목 아래에 붙였다. 그래서
 * "1-1. 직장 이동과 재물" 밑에 "하고 싶은 말과 재주가 밖으로 나오는 해"가
 * 실렸다. **제목이 약속한 주제와 내용이 따로 놀았다.**
 *
 * 지금은 `semantic/` 의 분야 모듈에서 가져온다 — `timingFor('직업')` 은 그
 * 해에 관성이 들어오는지를 말하고, `natureOf(관록궁)` 은 일할 때의 결을
 * 말한다. **제목이 묻는 것에 답하는 값**이라야 그 자리에 놓는다.
 *
 * ── 여기서 문장을 새로 짓지 않는다 ─────────────────────────
 * 고르고 배열만 한다. 새로 지으면 어느 계산에서 나온 말인지 추적할 수 없다.
 */
import { areaText } from './forecast.js';
import { currentDaeun, computeDaeun, TEN_GOD_GROUP, BRANCHES } from './core/ganzhi.js';
import { buildBoard, decadeLimits, palaceBranch } from './hires/ziwei.js';
import { classicalChart, readHouse } from './hires/classical.js';
import { yearTimeline } from './reading.js';
import { j } from './core/josa.js';
import { yearDirections } from './systems/gujeong.js';
import { timingFor } from './semantic/compose/timing.js';
import { palaceStars, natureOf } from './semantic/structure/stars.js';
import { westernPair } from './semantic/structure/western.js';
import { readSpouse, spousePalaceStars, spouseVerdict } from './semantic/structure/spouse.js';
import { readChildren, childPalaceStars, childrenVerdict } from './semantic/structure/children.js';
import { childrenPack, marriagePack } from './hires/vedicExt.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const sysOf = (r, name) => Object.values(r.results ?? {}).find((v) => v?.name === name) ?? null;
const headOf = (r, name) => sysOf(r, name)?.headline ?? '';

function readings(r, name, max = 99) {
  const s = sysOf(r, name);
  if (!s?.readings?.length) return '';
  return s.readings.slice(0, max)
    .map((x) => `<p class="rp-t"><strong>${esc(x.title)}</strong> — ${esc(x.text)}</p>`).join('');
}

/** viewmodel 은 칸마다 모양이 다르다 — 그냥 글이거나 `{text, sources}` 다 */
function withSrc(x) {
  if (!x) return null;
  if (typeof x === 'string') return x;
  if (typeof x.text !== 'string') return null;
  return x.sources?.length ? `${x.text} (${x.sources.join('·')})` : x.text;
}

const table2 = (head, rows) => !rows.length ? '' : `
  <table class="rp-tbl">
    <thead><tr><th>${esc(head[0])}</th><th>${esc(head[1])}</th></tr></thead>
    <tbody>${rows.map(([a, b]) =>
      `<tr><td class="k">${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody>
  </table>`;

const para = (t) => t ? `<p class="rp-t">${esc(t)}</p>` : '';
const sec = (n, title, body) => !body ? '' :
  `<section class="rp-sec"><h3 class="rp-h">${esc(n)}. ${esc(title)}</h3>${body}</section>`;
const sub = (n, title, body) => !body ? '' :
  `<div class="rp-sub"><h4 class="rp-h4">${esc(n)}${n ? '. ' : ''}${esc(title)}</h4>${body}</div>`;

/** 분야 모듈이 낸 읽기 목록을 체계 이름과 함께 */
const readList = (reads) => (reads ?? [])
  .filter((x) => x?.text)
  .map((x) => `<p class="rp-t"><strong>${esc(x.system)}${x.what ? ` (${esc(x.what)})` : ''}</strong> — ${esc(x.text)}</p>`)
  .join('');

/**
 * 한 분야의 시기 — **그 분야의 근거로만** 만든 연도표.
 *
 * 문서의 "2027 丁未 | 丑未冲으로 직장·조직 변화" 가 이 모양이다. 주제와
 * 무관한 연운 문구를 쓰면 제목과 내용이 따로 논다.
 */
function timingOf(r, domain, span = 10) {
  let t = null;
  try {
    const from = r.input.currentYear;
    t = timingFor(r.input, { ...r.chart, gender: r.input.gender }, domain,
      { from, to: from + span - 1 });
  } catch { return ''; }
  if (!t) return '';

  const bg = (t.background ?? []).map(para).join('');
  const rows = (t.rows ?? []).slice(0, 8).map((x) => [
    `${x.year} (${x.age}세)`,
    `${x.systems.join('+')} — ${x.why.join(' / ')}`,
  ]);
  const win = (t.windows ?? []).slice(0, 4).map((w) =>
    [`${w.span}${w.ageLabel ? ` (${w.ageLabel})` : ''}`, `${w.systems.join('+')} ${w.systems.length}갈래가 짚습니다`]);

  if (!bg && !rows.length && !win.length) return '';
  return bg
    + (win.length ? table2(['창', '몇 갈래가 짚는가'], win) : '')
    + (rows.length ? table2(['시기', '핵심 흐름'], rows) : '')
    + para(t.measured);
}

/* ═══════════════════════════════════════════════════════════
   통합 해석 보고서의 형식

   참고 보고서에서 가져온 것은 차례·제목·표 머리글 같은 편집 형식뿐이다.
   특정인의 결론, 날짜, 관계 평가는 복사하지 않는다. 각 절은 지금 계산한
   명반의 facts·readings·viewmodel만 재배열하므로 대상이 달라지면 내용도
   달라진다. 엔진에 없는 지표(서비스 실적, 추첨 번호, 질문 시각 점시)는
   그럴듯한 답으로 채우지 않고 계산 범위를 적는다.
   ═══════════════════════════════════════════════════════════ */

function readingText(r, sysName, contains) {
  const s = sysOf(r, sysName);
  return s?.readings?.find((x) => String(x.title).includes(contains))?.text ?? '';
}
const labeled = (k, t) => t ? `<p class="rp-t"><strong>${esc(k)}:</strong> ${esc(t)}</p>` : '';

/** 머리글이 여럿인 표 — 문서의 4열 월운 표가 이 모양이다 */
const tableN = (head, rows) => !rows.length ? '' : `
  <table class="rp-tbl rp-tbl-${head.length}">
    <thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((cs) => `<tr>${cs.map((c, i) =>
      `<td${i === 0 ? ' class="k"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;

/** 십성 무리가 그 해에 건드리는 것 — 고정표 */
const GOD_FIELD = {
  관성: '자리와 역할', 재성: '돈과 조건', 식상: '드러냄과 표현',
  인성: '배움과 문서', 비겁: '경쟁과 동료',
};
/** 지지끼리 부딪친 꼴 — 고정표 */
const HIT_LINE = {
  충: '자리가 흔들리는 해', 육합: '사람과 일이 맞물리는 해', 반합: '주변이 밀어주는 해',
  삼형: '같은 문제로 말이 오가는 해', 상형: '같은 문제로 말이 오가는 해',
  자형: '혼자 떠안고 지치기 쉬운 해', 해: '겉은 조용한데 속이 상하는 해',
  파: '정해둔 것이 틀어져 다시 짜는 해',
};

/* ── 0. 한눈에 보는 통합 결론 ─────────────────────────────── */

function overview(v, f, r) {
  const rows = [];
  const add = (k, x) => { const t = withSrc(x); if (t) rows.push([k, t]); };
  add('커리어', v.life?.career);
  add('재물', v.work?.money);
  add('직업 적성', v.work?.job);
  add('관계', v.life?.spouse);
  add('자녀', v.life?.child);
  add('건강', v.life?.body);
  add(`${f.year?.period?.sajuYear ?? ''}`, v.now?.year);
  const kw = v.hero?.keywords?.length ? v.hero.keywords.join(', ') : '';
  const ag = f.year?.agreement;
  return table2(['영역', '통합 결론'], rows)
    + (kw ? para(`통합 키워드: "${kw}"`) : '')
    + (ag ? para(`열다섯 가운데 ${ag.good}곳이 올해를 좋게, ${ag.bad}곳이 어렵게 봅니다.`) : '');
}

/* ── 1. 평생 커리어·명예·재물 흐름 ────────────────────────── */

function s11(v, r) {
  let dae = null;
  try { dae = currentDaeun(computeDaeun(r.chart, r.input.isMale, r.input.jdUT), r.input.age); }
  catch { /* 문단만 건너뛴다 */ }
  const head = dae
    ? `현재는 ${dae.hanja} 대운(${dae.fromAge}~${dae.toAge}세)으로, 일간에게 ${dae.god}이 드는 `
      + `구간입니다. ${GOD_FIELD[TEN_GOD_GROUP[dae.god]] ?? '이 자리'}가 이 십 년의 주제가 되는 `
      + '시기로 보았습니다.'
    : '';

  const rows = [];
  try {
    const from = r.input.currentYear;
    const chart = { ...r.chart, gender: r.input.gender };
    const byYear = new Map();
    for (const domain of ['직업', '재물']) {
      for (const x of timingFor(r.input, chart, domain, { from, to: from + 9 }).rows ?? []) {
        if (!byYear.has(x.year)) byYear.set(x.year, []);
        byYear.get(x.year).push(...x.why);
      }
    }
    for (const y of yearTimeline(r.input, r.chart, from, from + 9)) {
      const why = byYear.get(y.year) ?? [];
      const bits = [];
      for (const w of why) {
        const m = w.match(/(정관|편관|정재|편재|식신|상관|정인|편인|비견|겁재)/);
        if (m) { bits.push(`${m[1]}이 들어와 ${GOD_FIELD[TEN_GOD_GROUP[m[1]]] ?? ''}이 앞으로 나옵니다`); break; }
      }
      if (!bits.length) {
        const sh = why.find((w) => w.includes('사화'));
        if (sh) bits.push(sh.replace(/^자미두수: /, ''));
      }
      if (y.hit?.pair) bits.push(`${y.hit.pair} — ${HIT_LINE[y.hit.kind] ?? '자리가 움직입니다'}`);
      if (y.daeunFrom) bits.push('대운이 바뀌는 해입니다');
      if (!bits.length) continue;
      rows.push([`${y.year} ${y.gz?.hanja ?? ''}`, bits.join('. ') + '.']);
    }
  } catch { /* 표만 건너뛴다 */ }

  return para(head) + table2(['시기', '핵심 흐름'], rows) + para(withSrc(v.life?.career));
}

function s12(r) {
  const a = sysOf(r, '점성술');
  const fact = (l) => a?.facts?.find((x) => x.label === l);
  const noDeg = (x) => String(x ?? '').replace(/\s*[\d.]+°$/, '');
  const sun = fact('태양'), mc = fact('중천'), asc = fact('상승점');
  let h10 = null;
  try {
    const cc = classicalChart(r.input);
    h10 = readHouse(10, cc.pos, { cusps: cc.cusps, asc: cc.asc, mc: cc.mc }, cc.sect);
  } catch { /* 룰러 없이 */ }

  const head = [
    sun ? `태양 ${noDeg(sun.value)}${sun.note ? ` ${sun.note}` : ''}` : '',
    mc ? `MC ${noDeg(mc.value)}` : '',
    h10 ? `MC 지배성 ${h10.ruler}의 ${h10.rulerSign} ${h10.rulerHouse}하우스`
      + `${h10.rulerDignity?.exaltation ? ' 고양' : h10.rulerDignity?.domicile ? ' 자기 자리' : ''}` : '',
    asc ? `상승 ${noDeg(asc.value)}` : '',
  ].filter(Boolean).join(', ');
  const gate = h10?.rulerDignity?.score >= 5
    ? '이 자리의 주인이 힘을 받고 있어, 사회적 자리는 받쳐지는 쪽으로 보았습니다.'
    : (h10?.rulerDignity?.fall || h10?.rulerDignity?.detriment)
      ? '이 자리의 주인이 약한 자리에 있어, 자리를 얻는 데 품이 더 드는 쪽으로 보았습니다.' : '';

  return para(head ? `서양점성술에서는 ${head}를 핵심으로 보았습니다. ${gate}` : '')
    + labeled('태양이 놓인 자리', readingText(r, '점성술', '태양'))
    + labeled('사회적 목표점(MC)', readingText(r, '점성술', '중천') || (h10
      ? `${h10.cuspSign}가 사회적 목표점입니다. 그 자리의 주인 ${j(h10.ruler, '은')} `
        + `${h10.rulerSign} ${h10.rulerHouse}하우스에 있어, 그 영역을 통해 자리가 만들어집니다.` : ''))
    + labeled('겉으로 드러나는 나', readingText(r, '점성술', '상승'));
}

function s13(r) {
  let b = null, gwanBr = '', jaeBr = '';
  try {
    b = buildBoard(r.input);
    gwanBr = BRANCHES[palaceBranch(b.myeong, '관록궁')] ?? '';
    jaeBr = BRANCHES[palaceBranch(b.myeong, '재백궁')] ?? '';
  } catch { /* 지지 없이 */ }
  const gwan = palaceStars(r.input, '관록궁'), jae = palaceStars(r.input, '재백궁');
  const nat = natureOf(gwan, '일할 때의 본인');

  let nextLine = '';
  try {
    const lim = decadeLimits(r.input, b);
    const cur = lim.find((d) => r.input.currentYear >= d.fromYear && r.input.currentYear <= d.toYear);
    const nxt = cur ? lim.find((d) => d.fromYear > cur.toYear) : null;
    if (nxt) {
      nextLine = `다음 ${nxt.fromAge}~${nxt.toAge}세 대한(${nxt.fromYear}~${nxt.toYear}년)은 `
        + `원국의 ${nxt.palaceOfNatal}에 겹칩니다. 그 십 년에는 그 자리가 삶의 앞으로 나오는 `
        + '구간으로 보았습니다.';
    }
  } catch { /* 생략 */ }

  return para((gwan.length || jae.length)
    ? `관록궁 ${gwanBr}의 ${gwan.join('·') || '공궁'}, 재백궁 ${jaeBr}의 `
      + `${j(jae.join('·') || '공궁', '을')} 핵심으로 보았습니다. 직업이 삶의 축이 되는 자리와, `
      + '그 직업이 돈으로 바뀌는 자리를 나란히 놓고 읽습니다.' : '')
    + labeled('명예운', readingText(r, '자미두수', '관록궁'))
    + labeled('재물운', readingText(r, '자미두수', '재백궁'))
    + labeled('주의', nat?.risk?.length ? nat.risk.join(' / ') : '')
    + para(nextLine);
}

const careerLife = (v, r) =>
  sub('1-1', '대운 기준 직장 이동과 재물', s11(v, r))
  + sub('1-2', '태양·MC가 보여주는 사회적 잠재력', s12(r))
  + sub('1-3', '자미두수 관록궁·재백궁: 명예운과 재물 그릇', s13(r))
  + sub('1-4', '사주가 보는 타고난 구성', readings(r, '사주', 6))
  + sub('1-5', '평생의 결',
    [v.life?.early, v.life?.middle, v.life?.late].map(withSrc).filter(Boolean).map(para).join(''));

/* ── 2. 프로젝트·사업·수익화 ───────────────────────────── */

function projectBusiness(v, r) {
  const signals = [
    ['직업 적성', withSrc(v.work?.job)],
    ['재물 흐름', withSrc(v.work?.money)],
    ['홍국기문', headOf(r, '홍국기문')],
  ].filter(([, value]) => value);
  return sub('2-1', '현재 프로젝트 전반의 장애물',
    table2(['계산에서 읽힌 축', '현재 해석'], signals)
    + para('이 절은 명반에서 반복되는 일·재물의 결을 모은 것입니다. 실제 일정, 매출, 팀 구성 같은 사업 지표는 계산하지 않습니다.'))
    + sub('2-2', '책도장',
      labeled('일을 만드는 방식', withSrc(v.work?.job))
      + labeled('돈과 조건의 흐름', withSrc(v.work?.money))
      + para('책도장의 실제 성과나 제품 의사결정은 명반으로 판정하지 않습니다. 이 기록은 현재 입력에서 읽힌 일의 결을 점검하는 보조 자료입니다.'))
    + sub('2-3', '로또 분석과 횡재운',
      labeled('재물 축', withSrc(v.work?.money))
      + labeled('현재 상징값', headOf(r, '주역') || headOf(r, '홍국기문'))
      + para('추첨 번호·당첨 확률·구매 시점은 이 명반 계산의 범위가 아닙니다. 재물 해석을 로또 결과나 투자 판단으로 바꾸어 읽지 마세요.'));
}

/* ── 2. 관계 ────────────────────────────────────────────── */

function relations(v, r) {
  const chart = { ...r.chart, gender: r.input.gender };
  let sp = [], spv = { lines: [] }, ch = [], chv = { lines: [] };
  try {
    sp = readSpouse(chart, spousePalaceStars(r.input), marriagePack(r.input), palaceStars(r.input, '부처궁'));
    spv = spouseVerdict(sp);
  } catch { /* */ }
  try {
    ch = readChildren(chart, childPalaceStars(r.input), childrenPack(r.input), palaceStars(r.input, '자녀궁'));
    chv = childrenVerdict(ch);
  } catch { /* */ }
  let buBr = '', jaBr = '';
  try {
    const b = buildBoard(r.input);
    buBr = BRANCHES[palaceBranch(b.myeong, '부처궁')] ?? '';
    jaBr = BRANCHES[palaceBranch(b.myeong, '자녀궁')] ?? '';
  } catch { /* */ }
  const spS = palaceStars(r.input, '부처궁'), chS = palaceStars(r.input, '자녀궁');

  return sub('3-1', '배우자 — 어떤 사람이고 언제인가',
      para(spS.length ? `부처궁 ${buBr}의 ${j(spS.join('·'), '을')} 핵심으로 보았습니다.` : '')
      + (spv.lines ?? []).map(para).join('') + readList(sp) + timingOf(r, '결혼'))
    + sub('3-2', '자녀 — 수·성별·시기',
      para(chS.length ? `자녀궁 ${jaBr}의 ${j(chS.join('·'), '을')} 핵심으로 보았습니다.` : '')
      + (chv.lines ?? []).map(para).join('') + readList(ch) + timingOf(r, '자녀'))
    + sub('3-3', `27숙(숙요) — ${headOf(r, '숙요')}`,
      para(`본명숙을 ${headOf(r, '숙요')}로 두고 읽었습니다.`) + readings(r, '숙요', 4))
    + sub('3-4', '형제·또래', para(withSrc(v.life?.sibling)));
}

/* ── 3. 올해 흐름 ───────────────────────────────────────── */

function thisYear(v, f, r) {
  const yr = f.year?.period?.sajuYear ?? r.input.currentYear;
  const gz = f.year?.period?.gz?.year?.hanja ?? '';

  // 4-4 월운 — 문서의 4열 표(절기월 | 핵심 | 좋은 점 | 주의)
  const months = (f.timeline ?? []).map((m) => {
    const a = m.areas ?? {};
    const pick = (k) => a[k]?.score ?? null;
    const best = ['금전운', '직장운', '애정운', '학업운', '건강운']
      .map((k) => [k, pick(k)]).filter(([, s]) => s != null)
      .sort((x, y) => y[1] - x[1])[0];
    const worst = ['금전운', '직장운', '애정운', '학업운', '건강운']
      .map((k) => [k, pick(k)]).filter(([, s]) => s != null)
      .sort((x, y) => x[1] - y[1])[0];
    return [
      `${m.from.m}월 ${m.gz?.hanja ?? ''}`,
      areaText('총운', pick('총운') ?? m.score, 'month'),
      best ? `${best[0].replace('운', '')} 쪽이 이 달에서 가장 낫습니다` : '',
      worst ? `${worst[0].replace('운', '')} 쪽은 이 달에서 가장 낮습니다` : '',
    ];
  });

  const areas = ['총운', '금전운', '직장운', '애정운', '학업운', '건강운']
    .map((a) => {
      const s = f.year?.areas?.[a]?.score;
      return s == null ? null : [a.replace('운', ''), areaText(a, s, 'year')];
    }).filter(Boolean);

  return para(`${yr}년은 ${gz}년입니다. 요일·다샤·점시 형식의 현재 흐름·월운을 차례로 놓았습니다.`)
    + sub('4-1', `요일·Jupiter와 ${yr}년 — ${headOf(r, '태국 점성술')}`,
      para(`출생 요일과 주성을 ${headOf(r, '태국 점성술')}로 두고 읽었습니다.`)
      + readings(r, '태국 점성술', 4) + readings(r, '마하보테', 3))
    + sub('4-2', `현재 다샤 — ${headOf(r, '베딕')}`, readings(r, '베딕', 5))
    + sub('4-3', `${yr}년 점시 형식의 현재 흐름 (별도 점시 아님) — ${headOf(r, '토정비결')}`,
      readings(r, '토정비결', 4) + readings(r, '태을신수', 2)
      + para('질문 시각을 입력받아 세운 별도 점시는 아닙니다. 출생 명반과 올해 계산값으로 현재 흐름을 정리했습니다.'))
    + sub('4-4', '절기월 열두 달',
      tableN(['절기월', '핵심', '좋은 점', '주의'], months)
      + table2(['영역', '풀이'], areas)
      + para('달마다의 간지는 역법으로 정해지는 값입니다. 다만 어느 달이 더 좋은지를 가리는 '
        + '힘은 저희가 재 봤을 때 기준선을 넘지 못했으니, 순위로 읽지 마시고 "이 달에 무엇이 '
        + '맞물리는가"까지만 보세요.'));
}

/* ── 4. 행운 요소·방위 ──────────────────────────────────── */

function direction(r, f) {
  let d = null;
  try { d = yearDirections(r.input.sajuYear, f.year?.period?.sajuYear ?? r.input.currentYear); }
  catch { /* */ }
  const rows = [];
  if (d?.good?.length) rows.push(['열린 방위', d.good.map((g) => `${g.dir}(${g.star})`).join(', ')]);
  if (d?.bad?.length) {
    rows.push(['피할 방위', d.bad.map((b) =>
      `${b.dir}(${b.kind}${b.overlap ? ` · 흉방 ${b.overlap}개 겹침` : ''})`).join(', ')]);
  }
  const thai = sysOf(r, '태국 점성술')?.facts ?? [];
  const lucky = thai.filter((x) => /색|방위|행성|요일/.test(x.label))
    .map((x) => `${x.label} ${x.value}`).join(' · ');

  return para('구성학 연반으로 그 해 열린 방위와 막힌 방위를 보고, 요일 체계의 행운 상징을 '
      + '함께 놓았습니다.')
    + (lucky ? labeled('행운 상징', lucky) : '')
    + table2(['구분', '방위'], rows)
    + (rows.length ? para('방위는 계산값이지만 실제 동네 이름은 그 방향을 지도에 대 본 추정입니다. '
      + '세파는 구성 배치가 아니라 그 해 간지에서 나옵니다. 실제 이사에서는 연반과 월반이 다르므로 '
      + '목적지와 날짜가 정해지면 다시 계산해야 합니다.') : '')
    + sub('5-1', `구성학 — ${headOf(r, '구성학')}`, readings(r, '구성학', 4))
    + sub('5-2', '옮기는 시기', timingOf(r, '이사', 8));
}

/* ── 5. 기문·수비학 ─────────────────────────────────────── */

function inner(r) {
  const hg = sysOf(r, '홍국기문');
  const num = (hg?.facts ?? []).filter((x) => /천수|지수|궁|문|성/.test(x.label))
    .map((x) => `${x.label} ${x.value}`).join(' · ');

  // 문서의 '상승 / 정체 / 손실' 패턴 표 — 고정 3행
  const pattern = [
    ['상승', '분석 → 기준 결정 → 실행 → 공개 → 평가 → 확장'],
    ['정체', '분석 → 재분석 → 새 변수 발견 → 다시 설계 → 미완성'],
    ['손실', '흥분 → 여러 개 동시 시작 → 비용·시간 과투입 → 피로 → 중단'],
  ];

  return sub('6-1', `홍국기문 — ${headOf(r, '홍국기문')}`,
      para(num ? `${num}를 핵심으로 보았습니다. 쌓은 것을 밖으로 내보내야 완성되는 자리입니다.` : '')
      + readings(r, '홍국기문', 5)
      + table2(['패턴', '내용'], pattern))
    + sub('6-2', `Life Path·생일수 — ${headOf(r, '카발라')}`,
      para(`${headOf(r, '카발라')}로 두고 읽었습니다.`) + readings(r, '카발라', 5))
    + sub('6-3', `타고난 괘 — ${headOf(r, '주역')}`, readings(r, '주역', 4))
    + sub('6-4', `육임 — ${headOf(r, '육임')}`, readings(r, '육임', 3))
    + sub('6-5', `타로 — ${headOf(r, '타로')}`, readings(r, '타로', 4));
}

/* ── 6. 올해 전반 신수 ──────────────────────────────────── */

function yearHealth(f, r, v) {
  const a = (k) => {
    const s = f.year?.areas?.[k]?.score;
    return s == null ? null : areaText(k, s, 'year');
  };
  const rows = [
    ['건강', a('건강운') ?? ''],
    ['재물', a('금전운') ?? ''],
    ['직장', a('직장운') ?? ''],
    ['관계', a('애정운') ?? ''],
    ['전체', a('총운') ?? ''],
  ].filter((x) => x[1]);
  return para(`${headOf(r, '주역')}, ${headOf(r, '홍국기문')}, ${headOf(r, '토정비결')}을 `
      + '함께 놓고 올해 전반을 보았습니다.')
    + table2(['분야', '해석'], rows)
    + para('큰 흉을 단정하지 않습니다. 몸은 과로와 수면, 사고는 피곤한 상태에서의 무리한 강행을 '
      + '조심하시라는 뜻으로 읽으시면 됩니다.');
}

/* ── 8. 질문별 답변 통합 색인 ───────────────────────────── */

function answerIndex(v, f, r) {
  const yr = f.year?.period?.sajuYear ?? r.input.currentYear;
  const rows = [
    ['커리어·명예', withSrc(v.life?.career)],
    ['재물·수익화', withSrc(v.work?.money)],
    ['관계·숙요', withSrc(v.life?.spouse)],
    [`${yr}년 흐름`, withSrc(v.now?.year)],
    ['건강·생활 리듬', withSrc(v.life?.body)],
  ].filter(([, answer]) => answer);
  return para('같은 계산값을 여러 절에서 반복해 읽지 않도록, 주요 질문의 현재 답을 한 표로 모았습니다.')
    + tableN(['#', '질문', '통합 답변'], rows.map(([question, answer], index) => [index + 1, question, answer]));
}

/* ── 7. 최종 타임라인과 실행 원칙 ───────────────────────── */

function finale(r) {
  const rows = [];
  for (const [domain, label] of [['직업', '일'], ['재물', '돈'], ['결혼', '관계'],
    ['자녀', '자녀'], ['이사', '옮김']]) {
    try {
      const from = r.input.currentYear;
      const t = timingFor(r.input, { ...r.chart, gender: r.input.gender }, domain,
        { from, to: from + 14 });
      const w = (t.windows ?? [])[0];
      if (w) rows.push([label, `${w.span}${w.ageLabel ? ` (${w.ageLabel})` : ''} · ${w.systems.join('+')} ${w.systems.length}갈래가 짚습니다`]);
    } catch { /* */ }
  }
  const principles = [
    '한 번에 크게 키우는 일은 하나만 둡니다.',
    '분석은 기한을 두고 끝냅니다. 충분히 모였다고 판단되면 실행합니다.',
    '능력은 숫자·문서·결과물처럼 밖에 보이는 증거로 남깁니다.',
    '재물은 횡재보다 본업 경쟁력 → 추가 현금흐름 → 자산 축적 순서로 키웁니다.',
    '관계는 말보다 생활과 책임에서 실제 행동이 바뀌는지를 봅니다.',
    '운세는 선택을 대신하는 도구가 아니라, 되풀이되는 패턴을 점검하는 보조 자료입니다.',
  ];
  return para('분야마다 가장 센 창을 한 표에 모았습니다.')
    + table2(['분야', '시기'], rows)
    + `<p class="rp-t"><strong>최종 실행 원칙</strong></p>`
    + `<ul class="rp-ul">${principles.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
    + para('이 문서의 값은 천문·역법 계산에서 나온 것이고, 풀이는 각 전통의 독법을 옮긴 것입니다. '
      + '시기를 짚는 힘은 저희가 재 봤을 때 기준선을 넘지 못했으니, "언제"보다 "무엇이 어떤 결로 '
      + '흐르는가"를 보시는 편이 이 문서를 제대로 쓰는 길입니다.');
}

/* ── 문서 전체 ──────────────────────────────────────────── */

export function renderReport(form, r, f, v) {
  const today = `${f.today.y}.${String(f.today.m).padStart(2, '0')}.${String(f.today.d).padStart(2, '0')}`;
  const yr = f.year?.period?.sajuYear ?? r.input.currentYear;
  const body = [
    sec(0, '한눈에 보는 통합 결론', overview(v, f, r)),
    sec(1, '평생 커리어·명예·재물 흐름', careerLife(v, r)),
    sec(2, '프로젝트·사업·수익화', projectBusiness(v, r)),
    sec(3, '관계·숙요', relations(v, r)),
    sec(4, `${yr}년 흐름: 요일·다샤·점시·월운`, thisYear(v, f, r)),
    sec(5, '행운 요소·방위·이사/이직 방향', direction(r, f)),
    sec(6, '기문·수비학이 보여주는 평생 성패와 내적 과제', inner(r)),
    sec(7, `${yr}년 전반 신수: 건강·집안·사고·재물`, yearHealth(f, r, v)),
    sec(8, '질문별 답변 통합 색인', answerIndex(v, f, r)),
    sec(9, '최종 타임라인과 실행 원칙', finale(r)),
  ].filter(Boolean).join('');

  return `
    <details class="rp">
      <summary class="rp-sum">세부 계산 보기 <span>열다섯 체계의 통합 해석 문서</span></summary>
      <div class="rp-doc">
        <div class="rp-cover">
          <h2 class="rp-title">${esc(v.who?.name ?? form.name ?? '')} 명반 통합 해석</h2>
          <p class="rp-sub-t">열다섯 체계의 풀이를 하나로 재구성한 기록 · ${esc(today)}</p>
          <p class="rp-note">이 문서는 사주·자미두수·서양점성술·베딕 점성술·숙요·기문·주역·수비학 등
            여러 상징체계의 해석을 통합한 기록입니다. 서로 다른 점술 체계의 해석은 과학적으로
            검증된 예측이 아니며, 실제 이직·투자·건강·관계 결정에서는 현실 조건과 객관적
            자료를 우선해야 합니다.</p>
        </div>
        ${body}
      </div>
    </details>`;
}

/* ═══════════════════════════════════════════════════════════
   궁합 — 통합 관계 해석 보고서
   개인 문서와 같은 원칙이다. 여기서 문장을 짓지 않고, 각 체계가 두 사람을
   맞대 보고 이미 써 둔 말을 절마다 골라 놓는다.
   ═══════════════════════════════════════════════════════════ */

/** 궁합 결과에서 체계 하나 */
const pSys = (c, name) => (c.results ?? []).find((x) => x?.name === name) ?? null;
const pHead = (c, name) => pSys(c, name)?.headline ?? '';

/** 그 체계의 facts 를 `라벨=값` 표로 */
function pFacts(c, name) {
  const s = pSys(c, name);
  if (!s?.facts?.length) return '';
  return table2(['항목', '값'], s.facts.filter((f) => f.value).map((f) => [f.label, f.value]));
}

/** 그 체계의 풀이 */
function pRead(c, name, max = 99) {
  const s = pSys(c, name);
  if (!s?.readings?.length) return '';
  return s.readings.slice(0, max).map((x) =>
    `<p class="rp-t">${x.title ? `<strong>${esc(x.title)}</strong> — ` : ''}${esc(x.text)}</p>`).join('');
}

function pFirstText(c, name) {
  const item = pSys(c, name)?.readings?.[0];
  if (!item) return '';
  return [item.title, item.text].filter(Boolean).join(' — ');
}

/** 한 체계 절 — 계산값 표 + 풀이 */
const pBlock = (c, n, title, name, max = 99) =>
  sub(n, `${title} — ${pHead(c, name)}`, pFacts(c, name) + pRead(c, name, max));

const pairAxisText = (v, key) => {
  const axis = v?.eightAxes?.find((item) => item.key === key);
  if (!axis) return '';
  return [axis.conclusion, axis.reality, axis.good, axis.bad].filter(Boolean).join(' ');
};

function pairCommonYear(v, year) {
  const lifeRows = [
    ['생활의 기준', pairAxisText(v, '생활')],
    ['돈·일의 조율', pairAxisText(v, '돈')],
    ['역할 나누기', pairAxisText(v, '역할분담')],
  ].filter(([, value]) => value);
  const impactRows = [
    ['끌림', pairAxisText(v, '끌림')],
    ['감정', pairAxisText(v, '감정')],
    ['대화', pairAxisText(v, '대화')],
  ].filter(([, value]) => value);

  return sub('12-1', '결혼·생활 계획',
    table2(['공동 과제', `${year}년 해석`], lifeRows)
    + para('실제 결혼·주거·재정 일정은 두 사람의 합의와 현실 조건으로 정해야 합니다. 이 표는 관계 명반에서 반복되는 점검 항목입니다.'))
    + sub('12-2', '서로에게 미치는 영향',
      table2(['관계 축', '관계에서 읽힌 축'], impactRows));
}

function pairCurrentChecklist(c, v) {
  const rows = [
    ['생활', pHead(c, '사주'), pairAxisText(v, '생활')],
    ['돈', pHead(c, '베딕'), pairAxisText(v, '돈')],
    ['대화', pHead(c, '점성술'), pairAxisText(v, '대화')],
    ['장기 유지', pHead(c, '자미두수'), pairAxisText(v, '장기유지')],
  ].filter(([, headline, reading]) => headline || reading)
    .map((row) => row.map((value) => value || '계산값 없음'));

  return tableN(['관계 축', '주요 계산값', '현재 확인할 점'], rows)
    + para('현재 궁합 엔진은 두 사람의 출생 명반을 비교합니다. 달별 관계 예측은 계산하지 않으므로, 이 절은 월별 흐름이 아니라 지금의 관계에서 확인할 축을 정리한 것입니다.');
}

function pairGoodTime(c, year) {
  const rows = [
    ['주역', pHead(c, '주역'), pFirstText(c, '주역')],
    ['수리', pHead(c, '카발라'), pFirstText(c, '카발라')],
  ].filter(([, value]) => value);
  return tableN(['근거', '현재 계산값', `${year}년 적용 원칙`], rows)
    + para('날짜를 길일로 판정하는 별도 계산은 제공하지 않습니다. 실제 일정은 건강·계약·가족 상황을 먼저 확인하세요.');
}

export function renderPairReport(formA, formB, c, v, elementDist) {
  const A = c.A?.input?.name ?? formA.name;
  const B = c.B?.input?.name ?? formB.name;
  const s = c.synthesis ?? {};
  const today = new Date();
  const stamp = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const year = c.A?.input?.currentYear ?? today.getFullYear();

  // 1. 핵심 결론 — 체계마다 한 줄씩. 문서의 "명리: … / 시나스트리: …" 모양
  const lines = (c.results ?? [])
    .filter((x) => x?.headline)
    .map((x) => [`${x.name} (${x.verdict ?? ''})`, x.headline]);

  // 2. 핵심 계산값 — 두 사람을 나란히
  const pillarsOf = (p) => ['year', 'month', 'day', 'hour']
    .map((k) => p?.[k]?.hanja).filter(Boolean).join(' ');
  const who = (name, side, sysName) => {
    const f = pSys(c, sysName)?.facts ?? [];
    return f.map((x) => `${x.label}: ${x.value}`).join(' / ');
  };
  const calc = [
    [A, `${c.A?.input?.year}.${c.A?.input?.month}.${c.A?.input?.day}`
      + ` · 일간 ${c.A?.chart?.pillars?.day?.hanja ?? ''}`
      + ` · 사주 ${pillarsOf(c.A?.chart?.pillars)}`],
    [B, `${c.B?.input?.year}.${c.B?.input?.month}.${c.B?.input?.day}`
      + ` · 일간 ${c.B?.chart?.pillars?.day?.hanja ?? ''}`
      + ` · 사주 ${pillarsOf(c.B?.chart?.pillars)}`],
  ];

  // 3.2 오행 보완성 — 두 사람 수치를 나란히 놓고 적은 쪽을 짚는다
  const ELEM = ['목', '화', '토', '금', '수'];
  const ea = elementDist?.a, eb = elementDist?.b;
  const elemRows = (ea && eb) ? ELEM.map((e, i) => {
    const x = Math.round(ea[i] * 10) / 10, y = Math.round(eb[i] * 10) / 10;
    // 0.8 이상 벌어지면 한쪽으로 기운 것으로 본다. 오행 수치는 지장간까지
    // 가중해 더한 값이라 1.0 을 문턱으로 잡으면 눈에 띄는 차이도 '비슷함'이 된다
    const note = (x < 1 && y < 1) ? '둘 다 부족 — 서로 채워주지 못하는 자리'
      : x - y >= 0.8 ? `${A} 쪽이 많음` : y - x >= 0.8 ? `${B} 쪽이 많음` : '비슷함';
    return [e, `${A} ${x} / ${B} ${y} — ${note}`];
  }) : [];

  const body = [
    sec(1, '핵심 결론',
      (s.summary ? para(s.summary) : '')
      + table2(['체계', '한 줄 결론'], lines)),
    sec(2, '해석에 사용한 핵심 계산값', table2(['사람', '값'], calc)),
    sec(3, '사주 — 일간·오행·합충',
      sub('3-1', `일간 관계 — ${pHead(c, '사주')}`, pFacts(c, '사주') + pRead(c, '사주'))
      + sub('3-2', '오행 보완성', table2(['오행', '두 사람'], elemRows)
        + (elemRows.length ? para('두 사람 모두 옅은 오행이 있으면 상대가 그 자리를 채워주지 '
          + '못합니다. 그럴 때는 관계 바깥에서 의식적으로 메워야 합니다.') : ''))),
    sec(4, '서양 시나스트리 — 감정·끌림·지속성',
      pFacts(c, '점성술') + pRead(c, '점성술')),
    sec(5, '자미두수 — 부처궁 교차와 상호 영향',
      pFacts(c, '자미두수') + pRead(c, '자미두수')),
    sec(6, '27숙(숙요) — 위성 관계', pFacts(c, '숙요') + pRead(c, '숙요')),
    sec(7, '요일·수호행성',
      pBlock(c, '7-1', '태국 점성술', '태국 점성술')
      + pBlock(c, '7-2', '마하보테', '마하보테')),
    sec(8, '베딕 아스타쿠타', pFacts(c, '베딕') + pRead(c, '베딕')),
    sec(9, '구성학 본명성', pFacts(c, '구성학') + pRead(c, '구성학')),
    sec(10, '생명의 나무 — 수비학', pFacts(c, '카발라') + pRead(c, '카발라')),
    sec(11, `${year}년 결혼 점시 (출생정보 기준·별도 점시 아님)`,
      pBlock(c, '11-1', '주역', '주역')
      + pBlock(c, '11-2', '육임', '육임')
      + pBlock(c, '11-3', '홍국기문', '홍국기문')
      + pBlock(c, '11-4', '태을신수', '태을신수')
      + pBlock(c, '11-5', '토정비결', '토정비결')
      + pBlock(c, '11-6', '타로', '타로')
      + para('질문을 던진 시각을 입력받아 세운 결혼 점시는 아닙니다. 두 사람의 출생 명반 비교에서 나온 현재 상징값을 같은 형식으로 정리했습니다.')),
    sec(12, `${year}년 두 사람의 공동운 (출생정보 기준)`, pairCommonYear(v, year)),
    sec(13, '현재부터 3개월 관계 흐름 (월별 예측 아님)', pairCurrentChecklist(c, v)),
    sec(14, `${year}년 화합하기 좋은 시기: 주역·수리 (일정 판정 없음)`, pairGoodTime(c, year)),
    sec(15, '여러 체계에서 반복되는 공통 패턴',
      table2(['판정', '체계'], ['좋음', '무난', '어려움']
        .filter((k) => s.buckets?.[k]?.length)
        .map((k) => [k, s.buckets[k].join(' · ')]))
      + (s.coreBuckets ? para(`명반을 통째로 세우는 넷만 보면 — `
        + ['좋음', '무난', '어려움'].filter((k) => s.coreBuckets[k]?.length)
          .map((k) => `${k}: ${s.coreBuckets[k].join('·')}`).join(' / ')) : '')
      + (s.split ? para('명반을 세우는 체계 안에서도 판단이 갈립니다. '
        + '한쪽 결론만 들고 가지 마세요.') : '')),
    sec(16, '최종 통합 판단',
      para(`열다섯을 모두 놓고 보면 ${s.verdict ?? ''} 쪽입니다.`)
      + (s.best?.length ? para(`가장 후하게 본 곳: ${s.best.map((x) => x.name).join(' · ')}`) : '')
      + (s.worst?.length ? para(`가장 어렵게 본 곳: ${s.worst.map((x) => x.name).join(' · ')}`) : '')),
    sec('부록', '해석 범위와 주의사항',
      para('이 보고서는 현재 입력한 두 사람의 출생 정보로 계산한 상징 체계의 해석입니다. 결혼·이별·임신·투자·건강과 관련된 실제 의사결정은 당사자의 대화와 전문가의 객관적 조언을 우선하세요.')),
  ].filter(Boolean).join('');

  return `
    <details class="rp">
      <summary class="rp-sum">세부 계산 보기 <span>열다섯 체계의 관계 해석 보고서</span></summary>
      <div class="rp-doc">
        <div class="rp-cover">
          <h2 class="rp-title">${esc(A)} · ${esc(B)}</h2>
          <p class="rp-sub-t">통합 관계 해석 보고서 · 기준일 ${esc(stamp)}</p>
          <p class="rp-sub-t">명리 · 자미두수 · 시나스트리 · 베딕 · 숙요 · 구성학 · 요일행성 · 주역 · 수리</p>
          <p class="rp-note">두 사람의 명반을 열다섯 체계로 각각 맞대어 본 기록입니다.
            점술·점성 체계는 상징적 해석 도구이며 실제 미래를 확정하지 않습니다.
            유파가 갈리는 값은 이 사이트가 고른 기준으로 적었습니다.</p>
        </div>
        ${body}
      </div>
    </details>`;
}
