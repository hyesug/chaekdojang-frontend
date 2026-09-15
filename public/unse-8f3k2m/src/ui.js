/**
 * ui.js — 화면 그리기
 *
 * 계산은 engine.js가 전부 한다. 여기서는 폼을 읽고 결과를 그린다.
 */

import { readFortune, prepareInput } from './engine.js';
import { compareFortune } from './compat.js';
import { CITIES } from './core/place.js';
import { lunarToSolar } from './core/lunar.js';
import { j } from './core/josa.js';
import {
  encodeState, decodeState, buildSoloCard, buildCompatCard, saveCanvas,
} from './share.js';
import { pickNumbers } from './lotto.js';
import { readForecast } from './forecast.js';
import { lifeReading, monthDays, luckyDays, compatReading,
         structureReading, patternReading,
         yearTimeline, innerReading, tabooReading } from './reading.js';
import { aiSection, initAI, initCompatAI } from './ai.js';

/** 방금 본 결과. 이미지 카드와 공유 링크를 만들 때 다시 쓴다 */
let last = null;

const shareBar = () => `
  <div class="sharebar">
    <button type="button" data-act="link">링크 복사</button>
    <button type="button" data-act="image">이미지로 저장</button>
    <button type="button" data-act="print">인쇄 · PDF</button>
  </div>
  <p class="sharenote">
    공유 링크에는 입력하신 생년월일과 출생지가 그대로 담깁니다.
    링크를 받은 사람은 같은 결과를 그대로 볼 수 있으니, 보낼 곳을 한 번 더 확인하세요.
  </p>`;

const $ = (s) => document.querySelector(s);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ── 도시 목록 채우기 ──
$('#cities').innerHTML = CITIES.map((c) => `<option value="${c.name}">`).join('');

// ── 두 번째 사람 칸 만들기 ──
// 첫 번째 사람 칸을 그대로 복제하고 id에만 b- 접두사를 붙인다.
// 칸이 늘어나거나 바뀌어도 한쪽만 고치면 된다.
{
  const src = $('#personA');
  const clone = src.cloneNode(true);
  clone.querySelectorAll('[id]').forEach((el) => { el.id = 'b-' + el.id; });
  clone.querySelectorAll('label[for]').forEach((el) => { el.htmlFor = 'b-' + el.htmlFor; });
  const b = $('#personB');
  b.innerHTML = clone.innerHTML;
  b.querySelector('.person-title').textContent = '두 번째 사람';
}

// ── 모드 전환 ──
let mode = 'solo';
document.querySelectorAll('.mode').forEach((btn) => {
  btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    document.querySelectorAll('.mode').forEach((x) => x.classList.toggle('on', x === btn));
    $('#personB').hidden = mode !== 'pair';
    document.querySelectorAll('.person-title').forEach((t) => { t.hidden = mode !== 'pair'; });
    $('.go').textContent = mode === 'pair' ? '궁합 보기' : '풀이 보기';
    $('#result').classList.remove('on');
    last = null;
    history.replaceState(null, '', location.pathname);
  });
});

// ── 시간 미상 토글 ──
function wireNoTime(prefix) {
  const box = $(`#${prefix}noTime`);
  if (!box) return;
  box.addEventListener('change', (e) => {
    const off = e.target.checked;
    for (const f of ['hour', 'minute']) {
      const el = $(`#${prefix}${f}`);
      el.disabled = off;
      el.style.opacity = off ? 0.4 : 1;
    }
  });
}
wireNoTime('');
wireNoTime('b-');

// ── 제출 ──
/**
 * 계산 과정을 보여준다.
 *
 * 전부 합쳐 0.3초면 끝나는 계산이라 예전에는 결과가 툭 튀어나왔다. 그러면
 * 무엇을 했는지가 전혀 보이지 않아서, 어딘가에서 글을 받아온 것처럼 보인다.
 * 실제로 하는 일을 순서대로 보여주는 편이 낫다.
 *
 * 체크 표시는 그 단계가 진짜로 끝났을 때만 켠다. 다만 사람이 읽을 수 있게
 * 단계마다 최소 시간을 준다 — 없는 일을 하는 척하지는 않는다.
 */
const SOLO_STEPS = [
  '태어난 곳의 경도와 균시차로 진태양시를 맞춥니다',
  '열다섯 체계의 명반을 세웁니다',
  '지금의 흐름을 얹습니다',
  '겹치는 것을 추려 풀이를 씁니다',
  '앞으로 120일의 일진을 계산합니다',
];
const PAIR_STEPS = [
  '두 사람의 진태양시를 각각 맞춥니다',
  '열다섯 체계로 두 명반을 견줍니다',
  '풀이를 씁니다',
  '두 사람에게 같이 맞는 날을 찾습니다',
];

const progressShell = (steps) => `
  <div class="card progress">
    <ol class="steps">
      ${steps.map((t) => `<li><span class="mark"></span>${esc(t)}</li>`).join('')}
    </ol>
  </div>`;

/** 한 단계가 끝날 때마다 부른다. 최소 시간을 채우고 다음으로 넘어간다 */
function stepper(minMs = 260) {
  const items = [...document.querySelectorAll('#result .steps li')];
  let i = 0, due = performance.now();
  if (items[0]) items[0].classList.add('doing');
  return async () => {
    const wait = due - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    items[i]?.classList.remove('doing');
    items[i]?.classList.add('done');
    i += 1;
    items[i]?.classList.add('doing');
    due = performance.now() + minMs;
    // 켜진 표시가 실제로 그려지도록 한 번 양보한다.
    // requestAnimationFrame 은 탭이 뒤로 가면 아예 멈춘다. 그러면 사용자가
    // 잠깐 다른 탭을 봤다 왔을 때 진행 화면에서 영영 끝나지 않는다.
    await new Promise((r) => setTimeout(r, 0));
  };
}

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const box = $('#result');
  try {
    const form = collect('');
    const formB = mode === 'pair' ? collect('b-') : null;

    box.innerHTML = progressShell(mode === 'pair' ? PAIR_STEPS : SOLO_STEPS);
    box.classList.add('on');
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const next = stepper();
    await new Promise((r) => setTimeout(r, 0));

    if (mode === 'pair') {
      prepareInput(form); prepareInput(formB);
      await next();
      const c = compareFortune(form, formB);
      await next();
      box.innerHTML = renderCompat(form, formB, c);
      await next();
      initCompatAI(form, formB, c);
      await next();
    } else {
      prepareInput(form);
      await next();
      const r = readFortune(form);
      await next();
      const f = readForecast(form);
      await next();
      box.innerHTML = render(form, r, f);
      await next();
      initAI(form, r, f);
      await next();
    }

    // 주소를 지금 보고 있는 결과에 맞춰 둔다.
    // 새로고침해도 같은 결과가 나오고, 주소창을 그대로 복사해도 된다.
    history.replaceState(null, '', encodeState(last.mode, last.formA, last.formB));
  } catch (err) {
    box.innerHTML = `<div class="error">${esc(err.message)}</div>`;
    box.classList.add('on');
  }
});

function collect(p) {
  const num = (id) => {
    const v = $(`#${p}${id}`).value.trim();
    return v === '' ? null : Number(v);
  };
  const who = p ? '두 번째 사람의' : (mode === 'solo' ? '' : '첫 번째 사람의');
  const year = num('year'), month = num('month'), day = num('day');
  if (!year || !month || !day) throw new Error(`${who} 생년월일을 모두 넣어주세요.`.trim());
  if (year < 1900 || year > 2100) throw new Error('1900년에서 2100년 사이만 계산할 수 있습니다.');
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) ||
      month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`${who} 생년월일을 올바르게 입력해주세요.`.trim());
  }

  const noTime = $(`#${p}noTime`).checked;
  const hour = num('hour') ?? 12;
  const minute = num('minute') ?? 0;
  if (!noTime && (!Number.isInteger(hour) || hour < 0 || hour > 23 ||
      !Number.isInteger(minute) || minute < 0 || minute > 59)) {
    throw new Error(`${who} 출생 시간을 올바르게 입력해주세요.`.trim());
  }

  // 음력으로 들어온 날짜는 먼저 양력으로 바꾼다
  const cal = $(`#${p}calendar`).value;
  let solar = { y: year, m: month, d: day };
  if (cal !== 'solar') {
    solar = lunarToSolar(year, month, day, cal === 'lunar-leap');
  }

  return {
    name: $(`#${p}name`).value.trim() || (p ? '두 번째 사람' : '첫 번째 사람'),
    gender: $(`#${p}gender`).value,
    year: solar.y, month: solar.m, day: solar.d,
    hour: noTime ? null : hour,
    minute: noTime ? 0 : minute,
    birthPlace: $(`#${p}birthPlace`).value.trim() || '서울',
    homePlace: $(`#${p}homePlace`).value.trim() || '서울',
    dst: $(`#${p}dst`).checked,
    inputCalendar: cal,
  };
}

// ─────────────────────────────────────────────────────────────
// 로또 번호
// ─────────────────────────────────────────────────────────────

/** 실제 로또 공 색 규칙 */
const ballClass = (n) =>
  n <= 10 ? 'b1' : n <= 20 ? 'b2' : n <= 30 ? 'b3' : n <= 40 ? 'b4' : 'b5';

function lottoPane(d) {
  return `
    <div class="lotto-pane" data-pane="${d.mode}" ${d.mode === 'life' ? 'hidden' : ''}>
      <p class="lotto-when">${d.mode === 'week'
        ? `${d.round}회 · 추첨 ${esc(d.drawText)}`
        : '회차와 무관하게 평생 바뀌지 않는 번호입니다'}</p>
      <div class="balls">
        ${d.numbers.map((x) => `<span class="ball ${ballClass(x.n)}">${x.n}</span>`).join('')}
      </div>
      <dl class="facts" style="margin-top:18px">
        ${d.numbers.map((x) => `
          <div class="fact"><dt><span class="ball mini ${ballClass(x.n)}">${x.n}</span></dt>
            <dd>${esc(x.system)}<small>${esc(x.why)}</small></dd></div>`).join('')}
      </dl>
    </div>`;
}

function lottoSection(input, chart) {
  const week = pickNumbers(input, chart, 'week');
  const life = pickNumbers(input, chart, 'life');

  return `
    <div class="section-label">로또 번호</div>
    <div class="card">
      <div class="lotto-tabs">
        <button type="button" class="lt on" data-lt="week">이번 주 번호</button>
        <button type="button" class="lt" data-lt="life">내 평생 번호</button>
      </div>

      ${lottoPane(week)}
      ${lottoPane(life)}

      <details class="pool">
        <summary>열다섯 체계의 후보 번호 전부 보기</summary>
        <p class="poolnote">
          여섯 자리는 아래 후보에서 골랐습니다. 서로 다른 숫자는 ${week.distinct}개뿐이라
          여러 게임을 뽑아도 번호가 겹칩니다. 더 필요하시면 여기서 직접 고르세요.
        </p>
        <dl class="facts">
          ${week.pool.map((c) => `
            <div class="fact ${c.picked ? 'ispick' : ''}">
              <dt><span class="ball mini ${ballClass(c.n)}">${c.n}</span></dt>
              <dd>${esc(c.system)}${c.picked ? ' <em>선택됨</em>' : ''}<small>${esc(c.why)}</small></dd>
            </div>`).join('')}
        </dl>
      </details>

      <p class="lotto-warn">
        로또는 어떤 방법으로도 예측되지 않습니다. 매 회차가 독립 시행이라
        지난 회차 통계도, 명반도, 그 무엇도 다음 추첨에 대해 아무것도 말해주지 않습니다.
        이건 맞히는 방법이 아니라 <strong>고르는 방법</strong>입니다 —
        아무 번호나 찍는 대신 자기 명반에서 나온 번호로 고르는 것, 딱 그만큼의 의미입니다.
      </p>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// 운세 흐름 화면
// ─────────────────────────────────────────────────────────────

/**
 * 근거 표시.
 *
 * 점수와 막대를 걷어냈으니 "왜 그렇게 보는가"는 이걸로 대신한다. 숫자는
 * 어차피 열다섯을 평균 낸 값이라 그 자체로 알려주는 게 적었고, 어느 체계가
 * 그렇게 말하는지가 훨씬 쓸모 있다.
 */
const cite = (names) => names && names.length
  ? ` <span class="cite">(${names.map(esc).join(', ')})</span>` : '';

/** 문장 한 덩이 */
const say = (name, html) =>
  `<div class="say">${name ? `<div class="say-name">${esc(name)}</div>` : ''}<p class="say-text">${html}</p></div>`;


// ─────────────────────────────────────────────────────────────
// 궁합 화면
// ─────────────────────────────────────────────────────────────

function renderCompat(formA, formB, r) {
  last = { mode: 'pair', formA, formB, result: r };
  const p = (n) => String(n).padStart(2, '0');
  const when = (f) => `${f.year}.${p(f.month)}.${p(f.day)}` +
    (f.hour == null ? ' 시간 미상' : ` ${p(f.hour)}:${p(f.minute)}`);

  const cr = compatReading(r);
  const block = (label, v) => v?.text
    ? `<div class="say"><div class="say-name">${esc(label)}</div>
         <p class="say-text">${esc(v.text)}${cite(v.sources)}</p></div>`
    : '';

  return `
    <div class="section-label">궁합</div>
    <div class="card synth">
      <h3>${esc(formA.name)} <span style="color:var(--gold-soft)">×</span> ${esc(formB.name)}</h3>
      <p class="headline">${esc(when(formA))} &nbsp;·&nbsp; ${esc(when(formB))}</p>

      ${block('총평', cr.총평)}
      ${block('끌리는 지점', cr.끌림)}
      ${block('같이 사는 일', cr.현실)}
      ${block('돈에 대해', cr.돈)}
      ${block('대화', cr.대화)}
      ${block('오래 가려면', cr.오래)}
      ${block('가장 든든한 자리', cr.강점)}
      ${block('가장 걸리는 자리', cr.부딪침)}

      <p class="area-src" style="margin-top:14px">
        열다섯 체계를 모두 견주되, 항목마다 그 주제를 보는 체계에 무게를 더 줍니다.
        괄호 안이 그 항목을 실제로 끈 체계입니다.
      </p>
    </div>

    ${r.skipped.length ? `
      <div class="card" style="margin-top:14px">
        <p class="area-src" style="margin:0">
          ${esc(r.skipped.map((x) => x.system).join(', '))} — ${esc(r.skipped[0].reason)}
        </p>
      </div>` : ''}

    ${aiSection('pair')}

    ${shareBar()}
  `;
}

// ─────────────────────────────────────────────────────────────


/**
 * 명반 — 계산된 값만 표로.
 *
 * 전에 이걸 뺐던 건 명반을 '글로 설명'하던 대목이 전문용어 범벅이라
 * 읽히지 않았기 때문이다. 표 자체는 다르다. 뜻을 몰라도 "이만큼 계산했구나"가
 * 보이고, 그게 뒤에 오는 풀이를 믿게 만든다. 그래서 여기서는 설명하지 않는다.
 *
 * 열다섯을 다 펼치지는 않는다. 눈에 보이는 형태가 있는 넷만 펼치고
 * 나머지 열하나는 한 줄씩 접어둔다. 다 펼치면 표만 두 화면이 된다.
 */
const SHOWN = ['saju', 'astrology', 'jamidusu', 'tarot'];

/** 체계의 facts 에서 원하는 항목만 골라 칸으로 */
function cells(sys, labels) {
  if (!sys) return '';
  return labels.map((k) => {
    const f = sys.facts.find((x) => x.label === k);
    if (!f || !f.value || f.value === '—') return '';
    return `<div class="mb-cell"><dt>${esc(k)}</dt><dd>${esc(f.value)}${
      f.note ? `<small>${esc(f.note)}</small>` : ''}</dd></div>`;
  }).join('');
}

function chartPanel(r) {
  const by = (id) => r.results.find((x) => x.id === id);
  const P = r.chart.pillars;
  const pillar = [['시', P.hour], ['일', P.day], ['월', P.month], ['년', P.year]]
    .map(([pos, g]) => `
      <div class="pillar${pos === '일' ? ' me' : ''}">
        <div class="pos">${pos}주${pos === '일' ? ' · 나' : ''}</div>
        <div class="gz">${g ? esc(g.hanja) : '—'}</div>
        <div class="kr">${g ? esc(g.kr) : '시간 미상'}</div>
      </div>`).join('');

  const group = (title, body) => body
    ? `<div class="mb-group"><div class="mb-head">${esc(title)}</div>${body}</div>` : '';

  const rest = r.results.filter((x) => !SHOWN.includes(x.id));

  return `
    <div class="section-label">명반</div>
    <div class="card">
      ${group('사주팔자', `<div class="pillars">${pillar}</div>`)}
      ${group('점성술 네이탈', `<dl class="mb-grid">${
        cells(by('astrology'), ['태양', '달', '상승점', '중천'])}</dl>`)}
      ${group('자미두수 명반', `<dl class="mb-grid">${
        cells(by('jamidusu'), ['명궁', '부처궁', '재백궁', '관록궁', '질액궁', '천이궁'])}</dl>`)}
      ${group('타로', `<dl class="mb-grid">${
        cells(by('tarot'), ['생일 카드', '상황', '과제', '조언'])}</dl>`)}

      <details class="pool">
        <summary>나머지 ${rest.length}개 체계가 세운 것</summary>
        <dl class="facts">
          ${rest.map((x) => `<div class="fact"><dt>${esc(x.name)}</dt>
            <dd>${esc(x.headline)}</dd></div>`).join('')}
        </dl>
      </details>

      <p class="area-src" style="margin-top:12px">
        천문 계산으로 구한 값만 적었습니다. 뜻은 아래 풀이에 있으니
        이 표를 이해하실 필요는 없습니다.
      </p>
    </div>
  `;
}

/**
 * 개인 운세 화면.
 *
 * 순서가 뜻을 만든다. 맨 위는 타고난 구성과 평생 — 원국을 그대로 읽은
 * 것이라 사람마다 다르고 시기에 따라 바뀌지도 않는다. 사람의 실제 삶에
 * 들어맞은 것도 늘 이쪽이었다.
 *
 * 시기 운세는 '언제'만 말한다. 예전에는 오늘·이레·이달·올해를 각각 여섯
 * 영역으로 풀었는데, 재보니 한 사람 안에서 여섯 중 5.9개가 같은 문장이었다.
 * 당연한 일이다 — 오늘은 이레 안에 있고 이레는 이달 안에 있어 같은 월건과
 * 세운을 쓴다. 시기끼리 정말로 비슷한 것이라 문장을 더 써도 고쳐지지 않는다.
 * 그래서 각 시기가 저만 말할 수 있는 것 — 어느 날, 어느 달 — 만 남겼다.
 */
function render(form, r, f) {
  const s = r.synthesis;
  last = { mode: 'solo', formA: form, formB: null, result: r, forecast: f };

  const life = lifeReading(r.input, r.chart, s);
  const st = structureReading(r.input, r.chart);
  const pat = patternReading(r.input, r.chart);
  const days = monthDays(r.input, r.chart, f.today.y, f.today.m);
  const lucky = luckyDays(days, life.meta.weak);

  const inner = innerReading(r.input, r.chart);
  const taboo = tabooReading(r.input, r.chart);
  // 작년·올해·내년·내후년 네 해만. 작년이 맞는지로 잣대를 확인하고
  // 앞의 세 해를 읽는 구성이다.
  const timeline = yearTimeline(r.input, r.chart, f.today.y - 1, f.today.y + 2);
  const bondYears = timeline.filter((x) => x.bond).map((x) => x.year);

  const p2 = (n) => String(n).padStart(2, '0');
  const born = `${form.year}.${p2(form.month)}.${p2(form.day)}` +
    (form.hour == null ? ' · 시간 미상' : ` ${p2(form.hour)}:${p2(form.minute)}`) +
    ` · ${form.birthPlace}`;

  const block = (label, text, sources) => text
    ? `<div class="say">${label ? `<div class="say-name">${esc(label)}</div>` : ''}
         <p class="say-text">${esc(text)}${cite(sources)}</p></div>`
    : '';

  const dayList = (arr) => arr.slice().sort((a, b) => a - b).join(', ');

  const yearRows = timeline.map((x) => `
    <tr class="${x.year === f.today.y ? 'now' : ''}${x.past ? '' : ' ahead'}">
      <td class="dt">${x.year}${x.daeunFrom ? '<small>큰 흐름 바뀜</small>' : ''}</td>
      <td class="sl">${x.age}세</td>
      <td class="yk">${esc(x.tag)}${x.bond ? '<span class="sinsal">인연</span>' : ''}</td>
      <td class="ln">${esc(x.text)}</td>
    </tr>`).join('');

  return `
    ${chartPanel(r)}

    <div class="section-label">타고난 구성</div>
    <div class="card synth">
      <h3>${esc(form.name)} 님</h3>
      <p class="headline">${esc(born)}</p>
      ${block(st.level === 'strong' ? '크게 치우친 사주입니다' : '치우친 자리', st.head, [])}
      ${st.lines.map((t) => block(null, t, [])).join('')}
      ${pat.map((x) => block(x.name, x.text, [])).join('')}
      <p class="area-src" style="margin-top:8px">
        이 대목은 열다섯을 평균 낸 값이 아니라 사주 원국을 그대로 읽은 것입니다.
        네 기둥은 각각 조상·부모·나·자식의 자리라, 같은 부딪침이라도 어느 자리에
        걸렸느냐에 따라 뜻이 달라집니다.
        시기에 따라 바뀌지 않는 결이라 시기 운세보다 무겁게 보셔도 됩니다.
      </p>
    </div>

    <div class="section-label">내면</div>
    <div class="card">
      ${inner.map((x) => block(x.title, x.text, [])).join('')}
      <p class="area-src" style="margin-top:8px">
        넘치는 자리가 불안의 모양을, 비어 있는 자리가 결핍의 모양을 만듭니다.
        앞날보다 지금 속을 먼저 읽은 것입니다.
      </p>
    </div>

    <div class="section-label">평생</div>
    <div class="card">
      ${block('초년운', life.early, [])}
      ${block('중년운', life.middle, [])}
      ${block('말년운', life.late, [])}
      ${block('형제운', life.sibling, [])}
      ${block('자식운', life.child, [])}
      ${block('부부운', life.spouse, [])}
      ${block('직업운', life.career, [])}
      ${block('나의 체질', life.body, [])}
      ${s.summary.length ? block('종합', s.summary.join(' '), s.consensus.from) : ''}
    </div>

    <div class="section-label">연도별로 맞춰보기</div>
    <div class="card">
      <p class="lotto-when" style="margin-bottom:14px">
        작년이 맞는지 먼저 보세요. 지난 해가 맞으면 앞의 세 해도 같은 잣대로 읽힙니다.
        한 해는 양력 1월 1일이 아니라 입춘(2월 4일 무렵)에 바뀝니다.
      </p>
      <div class="daytable-wrap">
        <table class="daytable yeartable">
          <thead><tr><th>해</th><th>나이</th><th>무슨 해</th><th>풀이</th></tr></thead>
          <tbody>${yearRows}</tbody>
        </table>
      </div>
      ${bondYears.length ? block('인연이 정해지기 쉬운 해', `${bondYears.join(', ')}년입니다. 만남이든 결혼이든 관계가 한 단계 정해지는 자리가 이 해들에 몰립니다.`, []) : ''}
    </div>

    <div class="section-label">절대 하면 안 되는 것</div>
    <div class="card">
      ${taboo.map((x) => block(x.head, x.text, [])).join('')}
      <p class="area-src" style="margin-top:8px">
        좋은 말만 늘어놓는 풀이는 쓸모가 적습니다. 원국에서 넘치는 자리와
        비어 있는 자리를 그대로 뒤집은 것이라, 이 항목은 평생 바뀌지 않습니다.
      </p>
    </div>

    <div class="section-label">${f.today.m}월 길일과 처방</div>
    <div class="card">
      ${block('좋은 날', `자리 이동이나 이사에 좋은 날은 ${dayList(lucky.move)}일이고, 문서와 계약·면접에 좋은 날은 ${dayList(lucky.contract)}일입니다. 재물의 흐름이 좋은 날은 ${dayList(lucky.money)}일이며, 사람을 만나기 좋은 날은 ${dayList(lucky.love)}일입니다.`, [])}
      ${lucky.helper.length ? block('귀인이 드는 날', `운의 흐름과 관계없이 돕는 사람이 붙는 날은 ${dayList(lucky.helper)}일입니다. 아쉬운 말을 꺼내야 한다면 이 날을 쓰세요.`, []) : ''}
      ${block('피해야 할 날', `${dayList(lucky.avoid)}일은 기운이 넘쳐 도리어 다치기 쉬우니 반드시 피하시고, 그다음으로 조심할 날은 ${dayList(lucky.worst)}일입니다.`, [])}
      ${block('처방', `모자란 기운을 채우는 색은 ${lucky.color.join('·')}이고 숫자는 ${lucky.num.join(', ')}입니다. 방향은 ${lucky.dir}이며, 이름의 첫 자음이 ${lucky.consonant.join('·')}인 사람과 인연이 좋습니다.`, [])}
    </div>

    ${lottoSection(r.input, r.chart)}

    ${aiSection('solo')}

    ${shareBar()}
  `;
}







// ─────────────────────────────────────────────────────────────
// 저장하고 나누기
// ─────────────────────────────────────────────────────────────

function toast(msg, ok = true) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = ok ? 'on' : 'on bad';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = ''; }, 3200);
}

async function copyLink() {
  const url = location.origin + location.pathname +
    encodeState(last.mode, last.formA, last.formB);
  try {
    await navigator.clipboard.writeText(url);
    toast('링크를 복사했습니다');
  } catch {
    // 클립보드를 막아둔 환경(구형 브라우저·비 HTTPS)에서는 직접 고르게 한다
    const box = document.createElement('input');
    box.value = url;
    box.style.cssText = 'position:fixed;top:50%;left:5%;width:90%;z-index:99;font-size:16px;padding:12px';
    document.body.appendChild(box);
    box.select();
    const done = document.execCommand?.('copy');
    box.remove();
    toast(done ? '링크를 복사했습니다' : '복사가 막혀 있습니다. 주소창의 링크를 직접 복사하세요', done);
    if (!done) location.hash = encodeState(last.mode, last.formA, last.formB).slice(1);
  }
}

async function saveImage() {
  toast('이미지를 만드는 중…');
  // 한글 글꼴이 다 올라온 뒤에 그려야 글자가 깨지지 않는다
  if (document.fonts?.ready) await document.fonts.ready;
  const cv = last.mode === 'pair'
    ? buildCompatCard(last.formA, last.formB, last.result)
    : buildSoloCard(last.formA, last.result, last.forecast);

  const name = last.mode === 'pair'
    ? `궁합_${last.formA.name}_${last.formB.name}.png`
    : `운세_${last.formA.name}.png`;

  showImage(cv, name);
}

/** 만든 이미지를 띄운다. 모바일에서는 길게 눌러 저장하는 편이 확실하다 */
function showImage(cv, filename) {
  const old = $('#imgmodal');
  if (old) old.remove();

  const wrap = document.createElement('div');
  wrap.id = 'imgmodal';
  wrap.innerHTML = `
    <div class="imgbox">
      <img alt="결과 카드">
      <div class="imgacts">
        <button type="button" data-x="dl">저장하기</button>
        <button type="button" data-x="close">닫기</button>
      </div>
      <p>저장이 막힌 브라우저라면 그림을 길게 눌러 저장하세요.</p>
    </div>`;
  wrap.querySelector('img').src = cv.toDataURL('image/png');
  document.body.appendChild(wrap);

  wrap.addEventListener('click', async (e) => {
    const x = e.target.dataset.x;
    if (x === 'dl') {
      try {
        const how = await saveCanvas(cv, filename);
        if (how === 'download') toast('이미지를 내려받았습니다');
        if (how === 'shared') wrap.remove();
      } catch (err) {
        toast('저장하지 못했습니다. 그림을 길게 눌러 저장해 주세요', false);
      }
      return;
    }
    if (x === 'close' || e.target === wrap) wrap.remove();
  });
}

// 흐름 탭
$('#result').addEventListener('click', (e) => {
  const ft = e.target.closest('[data-ft]')?.dataset.ft;
  if (!ft) return;
  document.querySelectorAll('.ft').forEach((b) => b.classList.toggle('on', b.dataset.ft === ft));
  document.querySelectorAll('.flow-pane').forEach((x) => { x.hidden = x.dataset.fp !== ft; });
});

// 로또 탭
$('#result').addEventListener('click', (e) => {
  const lt = e.target.closest('[data-lt]')?.dataset.lt;
  if (!lt) return;
  document.querySelectorAll('.lt').forEach((b) => b.classList.toggle('on', b.dataset.lt === lt));
  document.querySelectorAll('.lotto-pane').forEach((p) => { p.hidden = p.dataset.pane !== lt; });
});

$('#result').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act || !last) return;
  if (act === 'link') copyLink();
  if (act === 'image') saveImage().catch((err) => toast('이미지를 만들지 못했습니다: ' + err.message, false));
  if (act === 'print') {
    // 인쇄에는 접힌 카드까지 다 펼쳐서 내보낸다
    document.querySelectorAll('details.sys').forEach((d) => { d.dataset.was = d.open ? '1' : ''; d.open = true; });
    window.print();
    setTimeout(() => {
      document.querySelectorAll('details.sys').forEach((d) => { d.open = d.dataset.was === '1'; });
    }, 500);
  }
});

// ── 링크로 들어온 경우 그대로 되살린다 ──
(function restore() {
  const st = decodeState(location.hash);
  if (!st) return;

  const fill = (p, f) => {
    const set = (id, v) => { const el = $(`#${p}${id}`); if (el && v != null) el.value = v; };
    set('name', f.name);
    set('gender', f.gender);
    set('calendar', 'solar');       // 링크에는 이미 양력으로 바꿔 담았다
    set('year', f.year); set('month', f.month); set('day', f.day);
    const noTime = f.hour == null;
    $(`#${p}noTime`).checked = noTime;
    $(`#${p}noTime`).dispatchEvent(new Event('change'));
    if (!noTime) { set('hour', f.hour); set('minute', f.minute); }
    set('birthPlace', f.birthPlace);
    set('homePlace', f.homePlace);
    $(`#${p}dst`).checked = !!f.dst;
  };

  if (st.mode === 'pair') document.querySelector('[data-mode="pair"]').click();
  fill('', st.formA);
  if (st.formB) fill('b-', st.formB);
  $('#form').requestSubmit();
})();
