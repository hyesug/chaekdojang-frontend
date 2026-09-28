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

/* ── 0 ──────────────────────────────────────────────────── */

function overview(v, f, r) {
  const rows = [];
  const add = (k, x) => { const t = withSrc(x); if (t) rows.push([k, t]); };
  add('커리어', v.life?.career);
  add('재물', v.work?.money);
  add('직업의 결', v.work?.job);
  add('관계', v.life?.spouse);
  add('자녀', v.life?.child);
  add('몸', v.life?.body);
  add('올해', v.now?.year);
  const ag = f.year?.agreement;
  return table2(['영역', '통합 결론'], rows)
    + (ag ? para(`열다섯 가운데 ${ag.good}곳이 올해를 좋게, ${ag.bad}곳이 어렵게 봅니다.`) : '');
}

/* ── 1. 평생 커리어·명예·재물 ─────────────────────────────── */

function careerLife(v, r) {
  const gwan = natureOf(palaceStars(r.input, '관록궁'), '일할 때의 본인');
  const jae = natureOf(palaceStars(r.input, '재백궁'), '돈을 다룰 때의 본인');
  let west = [];
  try { west = westernPair(r.input, r, 10, '직업'); } catch { /* 넘어간다 */ }

  return sub('1-1', '대운 기준 직장 이동',
      para(withSrc(v.life?.career)) + timingOf(r, '직업'))
    + sub('1-2', '재물이 들어오는 자리',
      para(withSrc(v.work?.money)) + timingOf(r, '재물'))
    + sub('1-3', `태양·MC가 보여주는 사회적 잠재력 — ${headOf(r, '점성술')}`,
      readList(west) + readings(r, '점성술', 4))
    + sub('1-4', `자미두수 관록궁·재백궁 — ${headOf(r, '자미두수')}`,
      (gwan ? para(gwan.text) : '') + (jae ? para(jae.text) : ''))
    + sub('1-5', `사주가 보는 자리 — ${headOf(r, '사주')}`, readings(r, '사주', 6))
    + sub('1-6', '평생의 결',
      [v.life?.early, v.life?.middle, v.life?.late].map(withSrc).filter(Boolean).map(para).join(''));
}

/* ── 2. 관계 ────────────────────────────────────────────── */

function relations(v, r) {
  const chart = { ...r.chart, gender: r.input.gender };
  let sp = [], spv = { lines: [] }, ch = [], chv = { lines: [] };
  try {
    sp = readSpouse(chart, spousePalaceStars(r.input), marriagePack(r.input),
      palaceStars(r.input, '부처궁'));
    spv = spouseVerdict(sp);
  } catch { /* 넘어간다 */ }
  try {
    ch = readChildren(chart, childPalaceStars(r.input), childrenPack(r.input),
      palaceStars(r.input, '자녀궁'));
    chv = childrenVerdict(ch);
  } catch { /* 넘어간다 */ }

  return sub('2-1', '배우자 — 어떤 사람이고 언제인가',
      readList(sp) + (spv.lines ?? []).map(para).join('') + timingOf(r, '결혼'))
    + sub('2-2', '자녀 — 수·성별·시기·어떤 아이인가',
      readList(ch) + (chv.lines ?? []).map(para).join('') + timingOf(r, '자녀'))
    + sub('2-3', `숙요 — ${headOf(r, '숙요')}`, readings(r, '숙요', 4))
    + sub('2-4', '형제·또래', para(withSrc(v.life?.sibling)));
}

/* ── 3. 올해 ────────────────────────────────────────────── */

function thisYear(v, f, r) {
  const areas = ['총운', '금전운', '직장운', '애정운', '학업운', '건강운']
    .map((a) => {
      const s = f.year?.areas?.[a]?.score;
      return s == null ? null : [a.replace('운', ''), areaText(a, s, 'year')];
    }).filter(Boolean);
  const months = (f.timeline ?? []).map((m) => [
    `${m.from.m}/${m.from.d}~ ${m.gz?.hanja ?? ''}`,
    areaText('총운', m.areas?.총운?.score ?? m.score, 'month'),
  ]);

  return sub('3-1', `요일과 수호 행성 — ${headOf(r, '태국 점성술')}`,
      readings(r, '태국 점성술', 4) + readings(r, '마하보테', 3))
    + sub('3-2', `현재 다샤 — ${headOf(r, '베딕')}`, readings(r, '베딕', 5))
    + sub('3-3', `올해 괘 — ${headOf(r, '토정비결')}`,
      readings(r, '토정비결', 4) + readings(r, '태을신수', 2))
    + sub('3-4', '올해 영역별', table2(['영역', '풀이'], areas))
    + sub('3-5', '절기월 열두 달', table2(['달', '흐름'], months)
      + para('달마다의 간지는 역법으로 정해지는 값입니다. 다만 어느 달이 더 좋은지를 '
        + '가리는 힘은 저희가 재 봤을 때 기준선을 넘지 못했으니, 순위로 읽지 마시고 '
        + '"이 달에 무엇이 맞물리는가"까지만 보세요.'));
}

/* ── 4. 방위 ────────────────────────────────────────────── */

function direction(r, f) {
  let d = null;
  try { d = yearDirections(r.input.sajuYear, f.year?.period?.sajuYear ?? r.input.currentYear); }
  catch { /* 풀이만 */ }
  const rows = [];
  if (d?.good?.length) rows.push(['열린 방위', d.good.map((g) => `${g.dir}(${g.star})`).join(', ')]);
  if (d?.bad?.length) {
    rows.push(['피할 방위', d.bad.map((b) =>
      `${b.dir}(${b.kind}${b.overlap ? ` · 흉방 ${b.overlap}개 겹침` : ''})`).join(', ')]);
  }
  return sub('4-1', '올해 방위', table2(['구분', '방위'], rows)
      + (rows.length ? para('방위는 계산값이지만 실제 동네 이름은 그 방향을 지도에 대 본 '
        + '추정입니다. 세파는 구성 배치가 아니라 그 해 간지에서 나옵니다.') : ''))
    + sub('4-2', `구성학 — ${headOf(r, '구성학')}`, readings(r, '구성학', 4))
    + sub('4-3', '옮기는 시기', timingOf(r, '이사', 8));
}

/* ── 5. 기문·수비학 ─────────────────────────────────────── */

const inner = (r) =>
  sub('5-1', `홍국기문 — ${headOf(r, '홍국기문')}`, readings(r, '홍국기문', 5))
  + sub('5-2', `수비학 — ${headOf(r, '카발라')}`, readings(r, '카발라', 5))
  + sub('5-3', `타고난 괘 — ${headOf(r, '주역')}`, readings(r, '주역', 4))
  + sub('5-4', `육임 — ${headOf(r, '육임')}`, readings(r, '육임', 3))
  + sub('5-5', `타로 — ${headOf(r, '타로')}`, readings(r, '타로', 4));

/* ── 6. 최종 타임라인 ───────────────────────────────────── */

function finale(r) {
  // 분야마다 창을 한 표에 모은다 — "언제 무엇이" 가 한눈에 보여야 한다
  const rows = [];
  for (const [domain, label] of [['직업', '일'], ['재물', '돈'], ['결혼', '관계'],
    ['자녀', '자녀'], ['이사', '옮김']]) {
    try {
      const from = r.input.currentYear;
      const t = timingFor(r.input, { ...r.chart, gender: r.input.gender }, domain,
        { from, to: from + 14 });
      const w = (t.windows ?? [])[0];
      if (w) rows.push([label, `${w.span}${w.ageLabel ? ` (${w.ageLabel})` : ''} · ${w.systems.join('+')} ${w.systems.length}갈래`]);
    } catch { /* 그 분야만 건너뛴다 */ }
  }
  return sub('6-1', '분야마다 가장 센 창', table2(['분야', '시기'], rows))
    + sub('6-2', '읽는 법', para('이 문서의 값은 천문·역법 계산에서 나온 것이고, 풀이는 각 '
      + '전통의 독법을 옮긴 것입니다. 시기를 짚는 힘은 저희가 재 봤을 때 기준선을 넘지 '
      + '못했으니, "언제"보다 "무엇이 어떤 결로 흐르는가"를 보시는 편이 이 문서를 제대로 '
      + '쓰는 길입니다.'));
}

/* ── 문서 전체 ──────────────────────────────────────────── */

export function renderReport(form, r, f, v) {
  const today = `${f.today.y}.${String(f.today.m).padStart(2, '0')}.${String(f.today.d).padStart(2, '0')}`;
  const yr = f.year?.period?.sajuYear ?? r.input.currentYear;
  const body = [
    sec(0, '한눈에 보는 통합 결론', overview(v, f, r)),
    sec(1, '평생 커리어·명예·재물 흐름', careerLife(v, r)),
    sec(2, '관계 — 배우자·자녀·형제', relations(v, r)),
    sec(3, `${yr}년 흐름 — 요일·다샤·괘·월운`, thisYear(v, f, r)),
    sec(4, '행운 요소·방위 — 이사와 이직', direction(r, f)),
    sec(5, '기문·수비학이 보는 평생 성패와 내적 과제', inner(r)),
    sec(6, '최종 타임라인과 읽는 법', finale(r)),
  ].filter(Boolean).join('');

  return `
    <details class="rp" open>
      <summary class="rp-sum">통합 해석 문서 — 열다섯 체계를 한 장으로</summary>
      <div class="rp-doc">
        <div class="rp-cover">
          <h2 class="rp-title">${esc(v.who?.name ?? form.name ?? '')} 명반 통합 해석</h2>
          <p class="rp-sub-t">열다섯 체계의 풀이를 하나로 모은 기록 · ${esc(today)}</p>
          <p class="rp-note">사주·자미두수·서양점성술·베딕·숙요·홍국기문·주역·수비학 등
            서로 다른 상징 체계의 해석을 통합한 기록입니다. 과학적으로 검증된 예측이
            아니며, 실제 이직·투자·건강·관계 결정에서는 현실 조건과 객관적 자료를
            먼저 보셔야 합니다.</p>
        </div>
        ${body}
      </div>
    </details>`;
}
