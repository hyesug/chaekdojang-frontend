/**
 * report.js — **AI 없이 쓰는 통합 해석 문서**
 *
 * AI 에게 물어 받던 긴 풀이를 화면이 직접 쓴다. 질문 한 번에 수백 원이
 * 나갔는데, 모델이 하던 일의 대부분은 **엔진이 이미 써 둔 문장을 골라
 * 배열하는 것**이었다. 그 배열을 코드로 옮기면 값이 들지 않는다.
 *
 * ── 여기서 새 해석을 만들지 않는다 ─────────────────────────
 * 이 파일은 **문장을 짓지 않는다.** 각 체계의 `readings`, `forecast` 의 영역
 * 풀이, `viewmodel` 의 연도·평생 글을 그대로 가져다 문서 모양으로 놓을 뿐이다.
 * 새 문장을 여기서 지으면 어느 계산에서 나온 말인지 추적할 수 없게 된다.
 *
 * ── 절 구성은 사용자가 준 문서를 따른다 ────────────────────
 * 번호와 하위 절(1-1, 1-2 …)을 그대로 쓰고, **제목에 그 사람의 실제 명반
 * 값을 넣는다** — "홍국기문: 9궁 離 · 경문" 처럼. 제목만 읽어도 무엇을 보고
 * 한 말인지 알 수 있어야 한다.
 *
 * 문서에 있던 '프로젝트·책도장·로또'와 '질문별 색인'은 넣지 않았다. 그건
 * 그 대화에서 나온 이야기이지 명반에서 나오는 것이 아니다. 없는 것을
 * 만들어 채우면 이 파일이 지키는 선을 스스로 깨는 셈이 된다.
 */
import { areaText } from './forecast.js';
import { yearTimeline } from './reading.js';
import { yearDirections } from './systems/gujeong.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const sysOf = (r, name) => Object.values(r.results ?? {}).find((v) => v?.name === name) ?? null;
const headOf = (r, name) => sysOf(r, name)?.headline ?? '';

/** 그 체계의 풀이 문단들 */
function readings(r, name, max = 99) {
  const s = sysOf(r, name);
  if (!s?.readings?.length) return '';
  return s.readings.slice(0, max)
    .map((x) => `<p class="rp-t"><strong>${esc(x.title)}</strong> — ${esc(x.text)}</p>`)
    .join('');
}

/**
 * viewmodel 은 칸마다 모양이 다르다 — 어떤 것은 그냥 글이고 어떤 것은
 * `{text, sources}` 다. 넘겨짚고 쓰면 화면에 `[object Object]` 가 나간다.
 * 출처가 있으면 함께 붙인다 — 몇 갈래가 같은 말을 하는지가 곧 무게다.
 */
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
  `<div class="rp-sub"><h4 class="rp-h4">${esc(n)}. ${esc(title)}</h4>${body}</div>`;
/** 번호 없는 작은 묶음 */
const blk = (title, body) => !body ? '' :
  `<div class="rp-sub"><h4 class="rp-h4">${esc(title)}</h4>${body}</div>`;

/* ── 0. 한눈에 보는 통합 결론 ─────────────────────────────── */

function overview(v, f) {
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
  let rows = [];
  try {
    const now = r.input.currentYear;
    rows = yearTimeline(r.input, r.chart, now, now + 9).map((x) => [
      `${x.year} ${x.gz?.hanja ?? ''}${x.daeunFrom ? ' · 대운 시작' : ''}${x.bond ? ' · 인연' : ''}`,
      `[${x.tag}] ${x.text}${x.hit?.pair ? ` (${x.hit.pair})` : ''}`,
    ]);
  } catch { /* 표만 건너뛴다 */ }

  const life = [v.life?.early, v.life?.middle, v.life?.late]
    .map(withSrc).filter(Boolean).map(para).join('');

  return sub('1-1', `대운 기준 직장 이동과 재물 — ${headOf(r, '사주')}`,
      table2(['시기', '핵심 흐름'], rows)
      + [withSrc(v.life?.career), withSrc(v.work?.job), withSrc(v.work?.money)]
        .filter(Boolean).map(para).join(''))
    + sub('1-2', `태양·MC가 보여주는 사회적 잠재력 — ${headOf(r, '점성술')}`,
      readings(r, '점성술', 6))
    + sub('1-3', `자미두수 관록궁·재백궁 — ${headOf(r, '자미두수')}`,
      readings(r, '자미두수', 7))
    + sub('1-4', '평생의 결', life)
    + sub('1-5', `사주가 보는 자리 — ${headOf(r, '사주')}`, readings(r, '사주', 6));
}

/* ── 2. 관계 ────────────────────────────────────────────── */

const relations = (v, r) =>
  sub('2-1', '배우자의 자리', para(withSrc(v.life?.spouse)) + para(withSrc(v.love?.spouse)))
  + sub('2-2', '자녀와 아랫사람', para(withSrc(v.life?.child)))
  + sub('2-3', '형제·또래', para(withSrc(v.life?.sibling)))
  + sub('2-4', `숙요 — ${headOf(r, '숙요')}`, readings(r, '숙요', 4));

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
  catch { /* 없으면 풀이만 */ }

  const rows = [];
  if (d?.good?.length) rows.push(['열린 방위', d.good.map((g) => `${g.dir}(${g.star})`).join(', ')]);
  if (d?.bad?.length) {
    rows.push(['피할 방위', d.bad.map((b) =>
      `${b.dir}(${b.kind}${b.overlap ? ` · 흉방 ${b.overlap}개 겹침` : ''})`).join(', ')]);
  }
  return blk('올해 방위', table2(['구분', '방위'], rows)
      + (rows.length ? para('방위는 계산값이지만 실제 동네 이름은 그 방향을 지도에 대 본 '
        + '추정입니다. 세파는 구성 배치가 아니라 그 해 간지에서 나옵니다.') : ''))
    + blk(`구성학 — ${headOf(r, '구성학')}`, readings(r, '구성학', 4));
}

/* ── 5. 기문·수비학 ─────────────────────────────────────── */

const inner = (r) =>
  sub('5-1', `홍국기문 — ${headOf(r, '홍국기문')}`, readings(r, '홍국기문', 5))
  + sub('5-2', `수비학 — ${headOf(r, '카발라')}`, readings(r, '카발라', 5))
  + sub('5-3', `타고난 괘 — ${headOf(r, '주역')}`, readings(r, '주역', 4))
  + sub('5-4', `육임 — ${headOf(r, '육임')}`, readings(r, '육임', 3))
  + sub('5-5', `타로 — ${headOf(r, '타로')}`, readings(r, '타로', 4));

/* ── 6. 최종 타임라인 ───────────────────────────────────── */

function finale(v, r, f) {
  let arrow = '';
  try {
    const now = r.input.currentYear;
    arrow = yearTimeline(r.input, r.chart, now, now + 5)
      .map((x) => `${x.year} ${x.tag}`).join(' → ');
  } catch { /* 없으면 생략 */ }

  const turn = [];
  try {
    const now = r.input.currentYear;
    for (const x of yearTimeline(r.input, r.chart, now, now + 19)) {
      if (x.daeunFrom) turn.push([`${x.year} (${x.age}세)`, '대운이 바뀌는 해입니다.']);
      else if (x.hit?.kind === '충') turn.push([`${x.year} ${x.gz?.hanja ?? ''}`, x.hit.pair]);
    }
  } catch { /* 생략 */ }

  return (arrow ? blk('앞으로 여섯 해를 한 줄로', para(arrow)) : '')
    + blk('크게 움직이는 해', table2(['해', '무엇이 걸리는가'], turn.slice(0, 8)))
    + blk('읽는 법', para('이 문서의 값은 천문·역법 계산에서 나온 것이고, 풀이는 각 전통의 '
      + '독법을 옮긴 것입니다. 시기를 짚는 힘은 저희가 재 봤을 때 기준선을 넘지 못했으니, '
      + '"언제"보다 "무엇이 어떤 결로 흐르는가"를 보시는 편이 이 문서를 제대로 쓰는 길입니다.'));
}

/* ── 문서 전체 ──────────────────────────────────────────── */

export function renderReport(form, r, f, v) {
  const today = `${f.today.y}.${String(f.today.m).padStart(2, '0')}.${String(f.today.d).padStart(2, '0')}`;
  const yr = f.year?.period?.sajuYear ?? r.input.currentYear;
  const body = [
    sec(0, '한눈에 보는 통합 결론', overview(v, f)),
    sec(1, '평생 커리어·명예·재물 흐름', careerLife(v, r)),
    sec(2, '관계 — 배우자·자녀·형제·숙요', relations(v, r)),
    sec(3, `${yr}년 흐름 — 요일·다샤·괘·월운`, thisYear(v, f, r)),
    sec(4, '행운 요소·방위 — 이사와 이직', direction(r, f)),
    sec(5, '기문·수비학이 보는 평생 성패와 내적 과제', inner(r)),
    sec(6, '최종 타임라인과 읽는 법', finale(v, r, f)),
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
