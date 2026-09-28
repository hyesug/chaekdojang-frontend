/**
 * report.js — **AI 없이 쓰는 통합 해석 문서**
 *
 * AI 에게 물어 받던 긴 풀이를 화면이 직접 쓴다. 질문 한 번에 수백 원이
 * 나가는데, 알고 보면 모델이 하던 일의 대부분은 **엔진이 이미 써 둔 문장을
 * 골라 배열하는 것**이었다. 그 배열을 코드로 옮기면 값이 들지 않는다.
 *
 * ── 여기서 새 해석을 만들지 않는다 ─────────────────────────
 * 이 파일은 **문장을 짓지 않는다.** 각 체계의 `readings`, `forecast` 의 영역
 * 풀이, `viewmodel` 의 연도·평생 글을 그대로 가져다 문서 모양으로 놓을 뿐이다.
 * 새 문장을 여기서 지으면 어느 계산에서 나온 말인지 추적할 수 없게 된다.
 *
 * 구조는 사용자가 준 문서를 따른다 —
 *   0 한눈에 보는 결론 → 1 평생 흐름 → 2 올해 → 3 관계 → 4 방위
 *   → 5 기문·수비학 → 6 타임라인
 */
import { areaText } from './forecast.js';
import { yearTimeline } from './reading.js';
import { yearDirections } from './systems/gujeong.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 이름으로 체계 하나 꺼내기 */
const sys = (r, name) => Object.values(r.results ?? {}).find((v) => v?.name === name) ?? null;

/** 그 체계의 풀이 문단들 */
function readings(r, name, max = 99) {
  const s = sys(r, name);
  if (!s?.readings?.length) return '';
  return s.readings.slice(0, max)
    .map((x) => `<p class="rp-t"><strong>${esc(x.title)}</strong> — ${esc(x.text)}</p>`)
    .join('');
}

/** 두 칸짜리 표 */
const table2 = (head, rows) => !rows.length ? '' : `
  <table class="rp-tbl">
    <thead><tr><th>${esc(head[0])}</th><th>${esc(head[1])}</th></tr></thead>
    <tbody>${rows.map(([a, b]) =>
      `<tr><td class="k">${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody>
  </table>`;

/**
 * viewmodel 은 칸마다 모양이 다르다 — 어떤 것은 그냥 글이고 어떤 것은
 * `{text, sources}` 다. 넘겨짚고 쓰면 화면에 `[object Object]` 가 나간다.
 * 출처가 있으면 함께 돌려준다 — 몇 갈래가 같은 말을 하는지가 무게다.
 */
function txt(x) {
  if (!x) return null;
  if (typeof x === 'string') return { text: x, sources: null };
  if (typeof x.text === 'string') return { text: x.text, sources: x.sources ?? null };
  return null;
}
const withSrc = (x) => {
  const t = txt(x);
  if (!t) return null;
  return t.sources?.length ? `${t.text} (${t.sources.join('·')})` : t.text;
};

const sec = (n, title, body) => !body ? '' :
  `<section class="rp-sec"><h3 class="rp-h">${esc(n)}. ${esc(title)}</h3>${body}</section>`;
const sub = (title, body) => !body ? '' :
  `<div class="rp-sub"><h4 class="rp-h4">${esc(title)}</h4>${body}</div>`;
const para = (t) => t ? `<p class="rp-t">${esc(t)}</p>` : '';

/* ── 0. 한눈에 보는 결론 ─────────────────────────────────── */

function overview(v, f, r) {
  const rows = [];
  const add = (k, x) => { const t = withSrc(x); if (t) rows.push([k, t]); };
  add('올해 흐름', v.now?.year);
  // viewmodel 은 분야마다 다른 이름을 쓴다. text 라고 넘겨짚으면 조용히 빈다
  add('일', v.work?.career);
  add('돈', v.work?.money);
  add('관계', v.love?.spouse);
  add('자녀', v.life?.child);
  add('몸', v.life?.body);

  // 영역별 한 줄 — forecast 가 이미 쓴 문장을 그대로
  for (const a of ['총운', '금전운', '직장운', '애정운', '건강운']) {
    const s = f.year?.areas?.[a]?.score;
    if (s != null) rows.push([a.replace('운', '') + ' (올해)', areaText(a, s, 'year')]);
  }

  const ag = f.year?.agreement;
  const note = ag
    ? `열다섯 가운데 ${ag.good}곳이 올해를 좋게, ${ag.bad}곳이 어렵게 봅니다.`
    : '';
  return table2(['영역', '통합 결론'], rows) + para(note);
}

/* ── 1. 평생 흐름 ───────────────────────────────────────── */

function lifetime(v, r) {
  // v.ahead.timeline 은 네 해뿐이라 표가 세 줄로 끝난다. 열 해를 보려면
  // reading 쪽에서 직접 뽑는다 (문서의 '대운 기준' 표가 그 모양이다)
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

  return sub('앞으로 열 해', table2(['시기', '핵심 흐름'], rows))
    + sub('평생의 결', life)
    + sub('일의 자리', [withSrc(v.life?.career), withSrc(v.work?.job)].filter(Boolean).map(para).join(''))
    + sub('돈의 자리', para(withSrc(v.work?.money)))
    + sub('배우자의 자리', para(withSrc(v.life?.spouse)))
    + sub('자녀·아랫사람', para(withSrc(v.life?.child)))
    + sub('형제·또래', para(withSrc(v.life?.sibling)))
    + sub('몸', para(withSrc(v.life?.body)))
    + sub('사주가 보는 자리', readings(r, '사주', 6))
    + sub('자미두수 — 명궁·관록궁·재백궁', readings(r, '자미두수', 7))
    + sub('점성술 — 태양·상승·중천', readings(r, '점성술', 6))
    + sub('베딕 — 라그나와 다샤', readings(r, '베딕', 5));
}

/* ── 2. 올해 ────────────────────────────────────────────── */

function thisYear(v, f, r) {
  const y = f.year?.period;
  const head = y
    ? para(`${y.sajuYear}년 ${y.gz?.year?.hanja ?? ''}(${y.gz?.year?.kr ?? ''}) 기준입니다.`)
    : '';

  const areas = ['총운', '금전운', '직장운', '애정운', '학업운', '건강운']
    .map((a) => {
      const s = f.year?.areas?.[a]?.score;
      return s == null ? null : [a.replace('운', ''), areaText(a, s, 'year')];
    }).filter(Boolean);

  // 절기월 열두 달 — 간지와 점수는 계산값이다. 순위로 읽지 말라고 함께 적는다
  const months = (f.timeline ?? []).map((m) => [
    `${m.from.m}월 ${m.from.d}일~ ${m.gz?.hanja ?? ''}`,
    areaText('총운', m.areas?.총운?.score ?? m.score, 'month'),
  ]);

  return head
    + sub('올해 영역별', table2(['영역', '풀이'], areas))
    + sub('절기월 열두 달', table2(['달', '흐름'], months)
      + para('달마다의 간지는 역법으로 정해지는 값입니다. 다만 어느 달이 더 좋은지를 '
        + '가리는 힘은 저희가 재 봤을 때 기준선을 넘지 못했으니, 순위로 읽지 마시고 '
        + '"이 달에 무엇이 맞물리는가"까지만 보세요.'))
    + sub('토정비결', readings(r, '토정비결', 4))
    + sub('태을신수', readings(r, '태을신수', 3));
}

/* ── 3. 관계 ────────────────────────────────────────────── */

const relation = (r) =>
  sub('숙요 — 타고난 별자리', readings(r, '숙요', 4))
  + sub('태국 점성술 — 요일과 색', readings(r, '태국 점성술', 4))
  + sub('마하보테 — 요일이 정하는 자리', readings(r, '마하보테', 4));

/* ── 4. 방위 ────────────────────────────────────────────── */

function direction(r, f) {
  const input = r.input;
  let d = null;
  try { d = yearDirections(input.sajuYear, f.year?.period?.sajuYear ?? input.currentYear); }
  catch { /* 없으면 구성학 풀이만 */ }

  const rows = [];
  if (d?.good?.length) rows.push(['열린 방위', d.good.map((g) => `${g.dir}(${g.star})`).join(', ')]);
  if (d?.bad?.length) {
    rows.push(['피할 방위', d.bad.map((b) =>
      `${b.dir}(${b.kind}${b.overlap ? ` · 흉방 ${b.overlap}개 겹침` : ''})`).join(', ')]);
  }
  return table2(['구분', '방위'], rows)
    + (rows.length ? para('방위는 계산값이지만 실제 동네 이름은 그 방향을 지도에 대 본 '
      + '추정입니다. 세파는 구성 배치가 아니라 그 해 간지에서 나옵니다.') : '')
    + sub('구성학', readings(r, '구성학', 4))
    + sub('홍국기문', readings(r, '홍국기문', 4));
}

/* ── 5. 기문·수비학 ─────────────────────────────────────── */

const inner = (r) =>
  sub('카발라 — 라이프 패스와 개인년', readings(r, '카발라', 5))
  + sub('주역 — 타고난 괘', readings(r, '주역', 4))
  + sub('육임', readings(r, '육임', 3))
  + sub('타로', readings(r, '타로', 4));

/* ── 문서 전체 ──────────────────────────────────────────── */

/**
 * @param {object} form 입력
 * @param {object} r    readFortune 결과
 * @param {object} f    readForecast 결과
 * @param {object} v    buildView 결과 (ui 가 이미 만든 것을 넘겨받는다)
 */
export function renderReport(form, r, f, v) {
  const today = `${f.today.y}.${String(f.today.m).padStart(2, '0')}.${String(f.today.d).padStart(2, '0')}`;
  const body = [
    sec(0, '한눈에 보는 통합 결론', overview(v, f, r)),
    sec(1, '평생 흐름 — 일·재물·명예', lifetime(v, r)),
    sec(2, `${f.year?.period?.sajuYear ?? ''}년 흐름`, thisYear(v, f, r)),
    sec(3, '관계와 타고난 결', relation(r)),
    sec(4, '방위 — 이사·이직', direction(r, f)),
    sec(5, '안쪽 — 수비학·괘', inner(r)),
  ].filter(Boolean).join('');

  return `
    <details class="rp" open>
      <summary class="rp-sum">통합 해석 문서 — 열다섯 체계를 한 장으로</summary>
      <div class="rp-doc">
        <div class="rp-cover">
          <h2 class="rp-title">${esc(v.who?.name ?? form.name ?? '')} 명반 통합 해석</h2>
          <p class="rp-sub-t">열다섯 체계의 풀이를 한 문서로 모은 것 · ${esc(today)}</p>
          <p class="rp-note">사주·자미두수·점성술·베딕·숙요·홍국기문·주역·수비학 등
            서로 다른 상징 체계의 해석을 모은 기록입니다. 과학적으로 검증된 예측이
            아니며, 실제 이직·투자·건강·관계 결정에서는 현실 조건과 객관적 자료를
            먼저 보셔야 합니다.</p>
        </div>
        ${body}
      </div>
    </details>`;
}
