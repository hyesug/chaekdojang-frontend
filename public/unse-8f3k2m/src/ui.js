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
  chartText, compatText, copyText, downloadText,
} from './share.js';
import { pickNumbers } from './lotto.js';
import { LOTTO_MODEL } from './data/lotto-model.js';
import { readForecast } from './forecast.js';
import { aiSection, initAI, initCompatAI } from './ai.js';
import { buildView, sensitivity, buildCompatView } from './viewmodel.js';
import { SYSTEM_META, TIER_LABEL, SOURCE_LABEL, ENGINE_VERSION, CALC_CHANGES } from './meta.js';

/** 방금 본 결과. 이미지 카드와 공유 링크를 만들 때 다시 쓴다 */
let last = null;
/** 그 결과를 화면용으로 가공한 것. AI 추천 질문이 이걸 본다 */
let lastView = null;

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

      ${week.shape.swapped ? `
      <p class="poolnote">
        ${esc(String(week.shape.before.hits[0] ?? '흔한 모양이라'))} —
        그래서 ${week.shape.swapped.from}번을 ${week.shape.swapped.to}번으로 바꿨습니다.
        당첨 확률과는 무관합니다. 당첨됐을 때 같은 번호를 고른 사람이 많으면
        나눠 갖게 되어서, 눈에 띄는 모양만 살짝 피한 것입니다.
      </p>` : ''}

      <details class="pool">
        <summary>"지난 회차 통계"는 정말 쓸모가 없을까 — 직접 재봤습니다</summary>
        <p class="poolnote">${esc(week.statsNote)}</p>
        ${lottoVerdicts()}
      </details>

      <p class="lotto-warn">
        로또는 어떤 방법으로도 예측되지 않습니다. 매 회차가 독립 시행이라
        지난 회차 통계도, 명반도, 그 무엇도 다음 추첨에 대해 아무것도 말해주지 않습니다.
        이건 맞히는 방법이 아니라 <strong>고르는 방법</strong>입니다 —
        아무 번호나 찍는 대신 자기 명반에서 나온 번호로 고르는 것, 딱 그만큼의 의미입니다.
      </p>
    </div>`;
}

/**
 * 통계 검증 결과.
 *
 * 핫넘버니 이월수니 하는 것들을 그대로 만들어 놓고, 과거 회차로 무작위보다
 * 나은지 실제로 재본 결과다. 거의 언제나 "아니다"가 나오고 그게 정상이다.
 * 믿어달라고 하는 대신 수치를 보여주려고 넣었다.
 */
function lottoVerdicts() {
  const v = LOTTO_MODEL.verdicts ?? [];
  if (!v.length) {
    return `<p class="poolnote">회차 데이터를 넣고 <code>node scripts/lotto-verify.mjs</code> 를
      돌리면 신호별 검증 결과가 여기 나옵니다.</p>`;
  }
  return `
    <dl class="facts">
      ${v.map((x) => `
        <div class="fact">
          <dt>${x.weight > 0 ? '○' : '×'}</dt>
          <dd>${esc(x.name)}<small>${esc(x.note)}</small></dd>
        </div>`).join('')}
    </dl>
    <p class="poolnote">
      ${LOTTO_MODEL.drawCount}개 회차로 확인했습니다. 과거를 맞히는지가 아니라
      <strong>아직 보지 않은 회차</strong>를 맞히는지를 봤고, 공정한 추첨을 흉내 낸
      가짜 데이터에 같은 방법을 돌려 나오는 우연 수준과 비교했습니다.
    </p>`;
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
/**
 * 근거는 본문에 붙이지 않는다.
 *
 * 예전에는 문장 끝에 "(사주, 홍국기문, 구성학, 토정비결)"처럼 체계 이름을
 * 줄줄이 달았다. 읽는 사람에게는 알아볼 수 없는 낱말이 네 개 더 붙는
 * 것이고, 정작 '그 체계가 무슨 값을 보고 그렇게 말했는가'는 여전히 없다.
 *
 * 그래서 본문은 읽히는 글만 두고, 근거는 '왜 이렇게 나왔나요' 안으로
 * 내렸다. 거기에는 이름뿐 아니라 그 체계가 세운 값이 함께 있다.
 */
const cite = () => '';

/**
 * 궁합 화면.
 *
 * 예전에는 '사주 좋음 / 자미 주의 / 베딕 어려움'처럼 체계별 판정을
 * 늘어놓았다. 그런데 사람이 궁금한 건 체계가 아니라 축이다 - 끌리는가,
 * 같이 살 만한가, 돈 이야기가 되는가, 말이 통하는가, 오래 가는가.
 *
 * 계산은 이미 축마다 가중치를 달리 매겨 두었으므로, 그 가중치를 그대로
 * 뒤집어 축마다 '어느 체계가 이 축을 주로 보는가'를 근거로 붙인다.
 */
function renderCompat(formA, formB, r) {
  last = { mode: 'pair', formA, formB, result: r };
  const v = buildCompatView(formA, formB, r);
  const p2 = (n) => String(n).padStart(2, '0');
  const when = (f) => `${f.year}.${p2(f.month)}.${p2(f.day)}` +
    (f.hour == null ? ' 시각 미상' : ` ${p2(f.hour)}:${p2(f.minute)}`);

  const block = (label, text, sources) => text
    ? `<div class="say">${label ? `<div class="say-name">${esc(label)}</div>` : ''}
         <p class="say-text">${esc(text)}${cite(sources)}</p></div>`
    : '';

  const axisCard = (a) => `
    <div class="section-label">${esc(a.label)}</div>
    <div class="card">
      <div class="lv lv-${a.band === 'hi' ? 'strong' : a.band === 'mid' ? 'mid' : 'weak'}">
        ${esc(a.conclusion)}
      </div>
      <div class="say"><div class="say-name">현실에서는</div><p class="say-text">${esc(a.reality)}</p></div>
      <div class="say"><div class="say-name">잘 맞는 조건</div><p class="say-text">${esc(a.good)}</p></div>
      <div class="say"><div class="say-name">갈등이 커지는 조건</div><p class="say-text">${esc(a.bad)}</p></div>
      <details class="why">
        <summary>근거 ${a.evidence.length}개 보기</summary>
        ${a.evidence.map((e) => `
          <div class="ev">
            <span class="ev-dot ${e.tone > 0 ? 'on' : ''}"></span>
            <div>
              <div class="ev-name">${esc(e.name)} — ${esc(e.verdict)}${e.lead ? ' · 이 축을 주로 보는 체계' : ''}</div>
              <div class="ev-head">${esc(e.headline)}</div>
              <div class="ev-facts">${esc(e.facts.join(' · '))}</div>
            </div>
          </div>`).join('')}
        <p class="agree-note">${esc(a.note)}. 이 축을 원래 무엇을 보라고 만든 체계인지에 따라 무게를 달리 줍니다.</p>
      </details>
    </div>`;

  return `
    <div class="hero">
      <div class="hero-who">궁합</div>
      <h2 class="hero-title">${esc(formA.name)} <span style="color:var(--gold-soft)">×</span> ${esc(formB.name)}</h2>
      <p class="hero-born">${esc(when(formA))} &nbsp;·&nbsp; ${esc(when(formB))}</p>

      <div class="hero-label">체계별 판정</div>
      <p class="hero-theme">${esc(v.counts.text)}</p>

      ${v.core ? `
        <div class="hero-label">한눈에</div>
        ${['좋음', '무난', '어려움'].map((k) => `
          <div class="agree-row">
            <span class="agree-name">${k}</span>
            ${`<div class="dots">${Array.from({ length: 4 }, (_, i) =>
              `<i class="${i < v.core[k].length ? 'on' : ''}"></i>`).join('')}</div>`}
            <span class="agree-n">핵심 ${v.core[k].length} · 전체 ${v.counts.all[k]}</span>
          </div>`).join('')}
        <p class="agree-note">
          요일 하나로 보는 잣대와 여덟 항목을 따지는 잣대를 같은 한 표로 세면
          실제보다 평평해 보입니다. 개수만 볼 때는 이쪽을 먼저 보세요.
        </p>` : ''}
    </div>

    ${v.eightAxes.map(axisCard).join('')}

    ${v.strong || v.friction ? `
    <div class="section-label">양 끝</div>
    <div class="card">
      ${v.strong ? block('가장 후하게 본 곳', v.strong.text, v.strong.sources) : ''}
      ${v.friction ? block('가장 어렵게 본 곳', v.friction.text, v.friction.sources) : ''}
    </div>` : ''}

    ${r.skipped.length ? `
      <div class="card" style="margin-top:14px">
        <p class="agree-note" style="margin:0">
          ${esc(r.skipped.map((x) => x.system).join(', '))} — ${esc(r.skipped[0].reason)}
        </p>
      </div>` : ''}

    <div class="card" style="margin-top:14px">
      <div class="sharebar" style="margin:0">
        <button type="button" data-act="chart-copy">두 사람 명반 텍스트 복사</button>
        <button type="button" data-act="chart-save">텍스트 파일로 저장</button>
      </div>
      <p class="agree-note" style="margin-top:12px">
        두 사람의 명반과 열다섯 체계가 견준 결과가 전부 글자로 담깁니다.
      </p>
    </div>

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

/**
 * 계산 기준 보기.
 *
 * "왜 다른 사이트와 값이 다른가"에 답할 수 있어야 한다. 어떤 시각을
 * 썼는지, 어떤 하우스 방식인지, 어느 아야남샤인지를 감추지 않는다.
 */
function receiptPanel(v) {
  const { r } = v.raw;
  const b = r.birth;
  const p2 = (n) => String(n).padStart(2, '0');
  const astro = r.results.find((x) => x.id === 'astrology');
  const ved = r.results.find((x) => x.id === 'vedic');
  const houseFact = astro?.facts.find((x) => x.label === '하우스 방식');
  const ayanFact = ved?.facts.find((x) => x.label === '아야남샤');

  const row = (k, val) => val
    ? `<div class="rc"><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>` : '';

  return `
    <details class="why" style="margin-top:6px">
      <summary>계산 기준 보기</summary>
      <dl class="receipt">
        ${row('출생 시각', `${r.input.year}.${p2(r.input.month)}.${p2(r.input.day)}` +
          (r.input.timeKnown ? ` ${p2(r.input.hour)}:${p2(r.input.minute)} KST` : ' (시각 미상)'))}
        ${row('출생지', `${r.input.birthPlace} · 동경 ${r.input.place.lon.toFixed(2)}° 북위 ${r.input.place.lat.toFixed(2)}°`)}
        ${r.input.timeKnown ? row('진태양시', `${p2(b.tst.h)}:${p2(b.tst.mi)} · 경도·균시차 ${b.totalShiftMinutes >= 0 ? '+' : '−'}${Math.abs(b.totalShiftMinutes).toFixed(0)}분`) : ''}
        ${row('음력', `${r.lunar.year}.${r.lunar.isLeap ? '윤' : ''}${p2(r.lunar.month)}.${p2(r.lunar.day)}`)}
        ${row('사주 기준', '절기 · 연주는 입춘, 월주는 절입')}
        ${row('서양 하우스', houseFact ? houseFact.value : '—')}
        ${row('베딕 아야남샤', ayanFact ? `라히리 ${ayanFact.value}` : '—')}
        ${row('엔진', ENGINE_VERSION)}
      </dl>
      <details class="why" style="margin-top:10px">
        <summary>값이 달라진 수정 이력</summary>
        ${CALC_CHANGES.map((c) => `
          <div class="ev">
            <span class="ev-dot on"></span>
            <div>
              <div class="ev-name">계산 v${esc(c.version)} · ${esc(c.at)}</div>
              <div class="ev-facts">${esc(c.fields.join(' · '))}</div>
              <div class="ev-head">${esc(c.why)}</div>
            </div>
          </div>`).join('')}
        <p class="agree-note">
          값이 달라질 수 있는 수정만 적었습니다. 문장만 다듬은 것은 넣지 않습니다 —
          넣기 시작하면 목록이 길어져 정작 값이 바뀐 자리를 못 찾습니다.
        </p>
      </details>
      <p class="agree-note">
        진태양시는 사주에만 씁니다. 서양점성술과 베딕은 표준시(KST)와 출생지 경위도를
        그대로 넣어 계산합니다. 같은 시각을 두 번 보정하지 않기 위해서입니다.
      </p>
    </details>`;
}

/**
 * 출생 시각을 얼마나 믿을 수 있는가.
 *
 * 시각을 분 단위로 아는 사람은 드물다. 그런데 값마다 시각에 흔들리는
 * 정도가 전혀 다르다. 상승점은 두 시간에 한 별자리씩 넘어가 15분으로도
 * 바뀌고, 사주 네 기둥은 두 시간 단위라 웬만해선 그대로다. 그 차이를
 * 감추면 사람은 모든 값을 같은 무게로 믿게 된다.
 */
function sensitivityPanel(form) {
  const sn = sensitivity(form, (x) => readFortune(x), 30);
  if (!sn) return '';
  return `
    <div class="section-label">출생 시각을 ±${sn.minutes}분 흔들면</div>
    <div class="card">
      <dl class="receipt">
        ${sn.rows.map((r) => `
          <div class="rc">
            <dt>${esc(r.key)}</dt>
            <dd>
              <span class="tag-${r.stable ? 'fix' : 'shaky'}">${r.stable ? '그대로' : '바뀜'}</span>
              ${esc(r.value)}${r.range ? `<small>${esc(r.range)}</small>` : ''}
            </dd>
          </div>`).join('')}
      </dl>
      <p class="agree-note">
        ${sn.shaky === 0
          ? '앞뒤로 삼십 분을 흔들어도 위 값이 모두 그대로입니다. 시각을 정확히 모르셔도 이 결과는 흔들리지 않습니다.'
          : `앞뒤로 삼십 분을 흔들면 ${sn.shaky}개가 바뀝니다. 태어난 시각이 확실하지 않다면 그 항목에서 나온 풀이는 한 겹 물려서 보세요. 나머지는 시각이 조금 달라도 같습니다.`}
        상승점은 두 시간에 한 별자리씩 넘어가 가장 예민하고, 사주 네 기둥은 두 시간 단위라 웬만해선 그대로입니다.
      </p>
    </div>`;
}

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

      <div class="sharebar" style="margin-top:16px">
        <button type="button" data-act="chart-copy">명반 텍스트 복사</button>
        <button type="button" data-act="chart-save">텍스트 파일로 저장</button>
      </div>

      <p class="area-src" style="margin-top:12px">
        천문 계산으로 구한 값만 적었습니다. 뜻은 아래 풀이에 있으니
        이 표를 이해하실 필요는 없습니다. 복사하면 열다섯 체계가 세운 값이
        전부 글자로 담깁니다 — 다른 곳에 물어보거나 기록으로 남길 때 쓰세요.
      </p>
    </div>
  `;
}

/**
 * 개인 운세 화면.
 *
 * 순서가 뜻을 만든다. 예전에는 계산한 차례대로 늘어놓았는데, 사람이
 * 궁금한 차례는 다르다 - 나는 어떤 사람인가, 지금 왜 이런가, 여러 체계가
 * 어디서 같은 말을 하는가, 왜 그렇게 읽었는가.
 *
 * 그래서 맨 위는 올해 한 줄과 체계 일치도, 그다음이 이 명반에서 드문 것,
 * 그다음이 겹친 것과 갈린 것이다. 나머지는 탭 안으로 넣는다.
 *
 * 화면에 쓰는 문장은 전부 reading.js 가 이미 쓴 것이다. 여기서 새로 짓지
 * 않는다. viewmodel.js 가 고르고 이 함수는 배치만 한다.
 */
function render(form, r, f) {
  last = { mode: 'solo', formA: form, formB: null, result: r, forecast: f };
  const v = buildView(form, r, f);
  lastView = v;

  const block = (label, text, sources) => text
    ? `<div class="say">${label ? `<div class="say-name">${esc(label)}</div>` : ''}
         <p class="say-text">${esc(text)}${cite(sources)}</p></div>`
    : '';

  const dots = (on, of_) => `<div class="dots">${
    Array.from({ length: of_ }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</div>`;

  // 왜 이렇게 나왔는지 - 핵심 넷이 세운 값을 그대로 보여준다
  const why = (area, label) => `
    <details class="why">
      <summary>왜 이렇게 나왔나요</summary>
      ${v.evidence(area).map((e) => `
        <div class="ev">
          <span class="ev-dot ${e.lit ? 'on' : ''}"></span>
          <div>
            <div class="ev-name">${esc(e.name)}${e.lit ? ' - 이 주제를 앞세움' : ''}</div>
            <div class="ev-head">${esc(e.headline)}</div>
            <div class="ev-facts">${esc(e.facts.join(' · '))}</div>
          </div>
        </div>`).join('')}
      <p class="agree-note">
        ${esc(label)} 항목에서 핵심 체계가 각자 어디를 앞세웠는지입니다.
        채워진 점은 그 체계가 여섯 영역 가운데 이 주제를 위에 둔 경우입니다.
      </p>
    </details>`;

  const pane = (id, on, html) =>
    `<div class="tab-pane" data-tab="${id}" ${on ? '' : 'hidden'}>${html}</div>`;

  const dayList = (arr) => arr.slice().sort((a, b) => a - b).join(', ');
  const L = v.month.lucky;

  const dayRows = v.month.days.map((x) => `
    <tr class="${x.d === f.today.d ? 'now' : ''}">
      <td class="dt">${x.d}<small>${esc(x.weekday)}</small></td>
      <td class="sl">${x.sinsal.map((n) => `<span class="sinsal">${esc(n)}</span>`).join('')}</td>
      <td class="ln">${esc(x.line)}</td>
      <td class="gd ${x.cls}">${esc(x.grade)}</td>
    </tr>`).join('');

  const yearRows = v.ahead.timeline.map((x) => `
    <tr class="${x.year === f.today.y ? 'now' : ''}${x.past ? '' : ' ahead'}">
      <td class="dt">${x.year}${x.daeunFrom ? '<small>큰 흐름 바뀜</small>' : ''}</td>
      <td class="sl">${x.age}세</td>
      <td class="yk">${esc(x.tag)}${x.bond ? '<span class="sinsal">인연</span>' : ''}</td>
      <td class="ln">${esc(x.text)}</td>
    </tr>`).join('');

  return `
    <div class="hero">
      <div class="hero-who">${v.who.year}년 종합 운세</div>
      <h2 class="hero-title">${esc(v.who.name)} 님</h2>
      <p class="hero-born">${esc(v.who.born)}</p>

      ${v.hero.tag ? `<div class="hero-tag">${esc(v.hero.tag)}</div>` : ''}
      <div class="hero-label">올해의 주제</div>
      <p class="hero-theme">${esc(v.hero.theme)}</p>

      ${v.hero.keywords.length ? `
        <div class="hero-label">여러 체계가 함께 든 낱말</div>
        <div class="kw">${v.hero.keywords.map((w) => `<span>${esc(w)}</span>`).join('')}</div>` : ''}

      <div class="hero-label">핵심 ${v.hero.themes[0].of}개 체계가 같은 주제를 가리키는 정도</div>
      ${v.hero.themes.map((t) => `
        <div class="agree-row">
          <span class="agree-name">${esc(t.label)}</span>
          ${dots(t.on, t.of)}
          <span class="agree-n">${t.on} / ${t.of}</span>
        </div>`).join('')}
      <p class="agree-note">
        운이 몇 점인지가 아닙니다. 명반을 통째로 세우는 체계(사주·자미두수·점성술·베딕)가
        각자 여섯 영역 가운데 어디를 위에 두었는지 세어, 같은 곳을 가리키는 횟수를 표시한 것입니다.${
          v.hero.themes[0].of < 4 ? ' 출생 시각을 몰라 자미두수는 세지 못했습니다.' : ''}
      </p>
      ${receiptPanel(v)}
    </div>

    <div class="tabs">
      <button type="button" class="on" data-tab="me">나라는 사람</button>
      <button type="button" data-tab="now">지금의 나</button>
      <button type="button" data-tab="work">일과 돈</button>
      <button type="button" data-tab="love">사랑과 관계</button>
      <button type="button" data-tab="ahead">앞으로의 흐름</button>
      <button type="button" data-tab="month">이번 달</button>
      <button type="button" data-tab="chart">명반 근거</button>
      <button type="button" data-tab="play">재미로 보기</button>
    </div>

    ${pane('me', true, `
      <div class="section-label">${v.me.systemCount}체계가 본 나 · 한눈에</div>
      <div class="card system-view">
        ${v.me.systems.map((s) => `
          <div class="system-view-row">
            <div class="system-view-name">
              ${esc(s.name)}
              ${s.core ? '<span class="system-core">핵심</span>' : ''}
            </div>
            <div class="system-view-text">${esc(s.line)}</div>
          </div>`).join('')}
        <p class="agree-note">
          각 체계가 원래 계산에서 낸 성향 태그를 짧은 생활 언어로만 바꾼 요약입니다.
          사주·자미두수·점성술·베딕은 <strong>핵심</strong>으로 표시하고, 아래 상세 리딩에서는
          여러 체계가 실제로 겹친 특징만 다시 풉니다.
        </p>
      </div>

      <div class="section-label">여러 체계에서 반복되는 특징</div>
      ${v.me.lenses.length ? v.me.lenses.map((l) => `
        <div class="card trait-card">
          <h3 class="trait-title">${esc(l.conclusion)}</h3>
          <div class="trait-confidence trait-${l.level}">${esc(l.text)}</div>
          ${l.detail ? `
            <div class="say"><div class="say-name">현실에서는</div><p class="say-text">${esc(l.reality)}</p></div>
            <div class="say"><div class="say-name">잘 쓰면</div><p class="say-text">${esc(l.strength)}</p></div>
          ` : ''}
          <div class="say"><div class="say-name">과해지면</div><p class="say-text">${esc(l.caution)}</p></div>
          ${l.detail ? '' : `
            <p class="agree-note">
              핵심 명반 체계에서 겹침이 아직 적어서, 어떤 상황에서 어떻게 움직이는지까지
              단정하지 않습니다.
            </p>`}
          <details class="why">
            <summary>근거 ${l.evidence.length}개 보기</summary>
            ${l.evidence.map((e) => `
              <div class="ev">
                <span class="ev-dot ${e.core ? 'on' : ''}"></span>
                <div>
                  <div class="ev-name">${esc(e.name)}${e.core ? ' · 핵심 체계' : ''}</div>
                  <div class="ev-head">${esc(e.headline)}</div>
                  <div class="ev-facts">${esc(e.facts.join(' · '))}</div>
                </div>
              </div>`).join('')}
          </details>
        </div>`).join('') : `
        <div class="card">
          <p class="mark-text">두 체계 이상에서 반복되는 특징이 뚜렷하지 않습니다. 한 가지 성향으로 잘라 말하기보다 상황에 따라 다른 면이 나오는 명반으로 보는 편이 맞습니다.</p>
        </div>`}
      <p class="agree-note common-note">
        이곳은 두 체계 이상에서 반복된 특징만 자세히 풉니다. 한 체계의 단독 해석과 원자료는
        <strong>명반 근거</strong> 탭에서 확인할 수 있습니다.
      </p>
    `)}

    ${pane('now', false, `
      <div class="card synth">
        <div class="scope">올해와 이레 · 세운·일진</div>
        <h3>오늘 - ${f.today.m}월 ${f.today.d}일<span class="hanja">${esc(f.day.period.gz.day.hanja)} · ${esc(v.now.grade)}</span></h3>
        ${block(null, v.now.line, [])}
        ${block('이레', `${f.week.label} 가운데 ${f.week.bestDay.on.m}월 ${f.week.bestDay.on.d}일 쪽이 낫고, ${f.week.worstDay.on.m}월 ${f.week.worstDay.on.d}일 쪽이 무겁습니다.`, [])}
        ${v.now.year ? block(`${v.who.year}년`, v.now.year.text, v.now.year.sources) : ''}
        ${why('총운', '전체')}
      </div>
      ${v.twist ? `
        <div class="section-label">올해 체계가 갈리는 부분</div>
        <div class="card">
          ${block(null, v.twist.text, v.twist.sources)}
          <p class="agree-note">이견을 감추지 않고, 올해 흐름에서 서로 다른 체계가 반대로 보는 부분만 따로 표시합니다.</p>
        </div>` : ''}
    `)}

    ${pane('work', false, `
      <div class="card">
        <div class="scope">일하는 방식은 원국 · 올해 항목은 세운</div>
        ${block('일하는 방식', v.work.career, [])}
        ${v.work.job ? block('올해의 일', v.work.job.text, v.work.job.sources) : ''}
        ${v.work.money ? block('올해의 돈', v.work.money.text, v.work.money.sources) : ''}
        ${why('직장운', '일')}
      </div>`)}

    ${pane('love', false, `
      <div class="card">
        <div class="scope">관계의 결은 원국 · 올해 항목은 세운</div>
        ${block('관계의 결', v.love.spouse, [])}
        ${v.love.area ? block('올해의 관계', v.love.area.text, v.love.area.sources) : ''}
        ${why('애정운', '관계')}
        <p class="agree-note">
          두 사람을 견주려면 맨 위의 <strong>궁합</strong>에서 상대의 생년월일을 넣으세요.
        </p>
      </div>`)}

    ${pane('ahead', false, `
      <div class="card">
        <div class="scope">해마다 바뀌는 흐름 · 세운</div>
        <p class="agree-note" style="margin:0 0 14px">
          작년이 맞는지 먼저 보세요. 지난 해가 맞으면 앞의 세 해도 같은 잣대로 읽힙니다.
          한 해는 양력 1월 1일이 아니라 입춘(2월 4일 무렵)에 바뀝니다.
        </p>
        <div class="daytable-wrap">
          <table class="daytable yeartable">
            <thead><tr><th>해</th><th>나이</th><th>주제</th><th>풀이</th></tr></thead>
            <tbody>${yearRows}</tbody>
          </table>
        </div>
        ${v.ahead.bond.length ? block('인연이 정해지기 쉬운 해', `${v.ahead.bond.join(', ')}년입니다. 관계가 한 단계 정해지는 자리가 이 해들에 몰립니다. 다만 어떤 형태가 될지는 정해져 있지 않습니다.`, []) : ''}
      </div>
      <details class="why" style="margin-top:14px">
        <summary>큰 흐름 자세히 보기 - 초년·중년·말년</summary>
        <div style="margin-top:12px">
          ${block('초년', v.life.early, [])}
          ${block('중년', v.life.middle, [])}
          ${block('말년', v.life.late, [])}
          ${block('형제', v.life.sibling, [])}
          ${block('자식', v.life.child, [])}
          ${block('타고난 리듬', v.life.body, [])}
        </div>
      </details>`)}

    ${pane('month', false, `
      <div class="card">
        <div class="scope">이번 달 · 일진</div>
        ${block('좋은 날', `자리 이동이나 이사에 좋은 날은 ${dayList(L.move)}일이고, 문서와 계약·면접에 좋은 날은 ${dayList(L.contract)}일입니다. 재물의 흐름이 좋은 날은 ${dayList(L.money)}일이며, 사람을 만나기 좋은 날은 ${dayList(L.love)}일입니다.`, [])}
        ${L.helper.length ? block('귀인이 드는 날', `돕는 사람이 붙는 날은 ${dayList(L.helper)}일입니다.`, []) : ''}
        ${block('우선순위를 낮출 날', `${dayList(L.avoid)}일은 기운이 넘쳐 도리어 무리하기 쉬운 날이고, 그다음으로 조심할 날은 ${dayList(L.worst)}일입니다. 다른 날을 고를 수 있다면 뒤로 미루시라는 뜻이지, 이미 잡힌 수술이나 계약·면접 일정을 이 표 때문에 바꾸실 일은 아닙니다.`, [])}
      </div>
      <details class="why" style="margin-top:14px">
        <summary>${esc(v.month.label)} 일자별로 보기</summary>
        <div class="daytable-wrap" style="margin-top:12px">
          <table class="daytable">
            <thead><tr><th>날</th><th>신살</th><th>풀이</th><th>등급</th></tr></thead>
            <tbody>${dayRows}</tbody>
          </table>
        </div>
      </details>`)}

    ${pane('chart', false, chartPanel(r) + sensitivityPanel(form))}

    ${pane('play', false, `
      <div class="card play">
        <p class="play-note">
          아래는 핵심 분석이 아닙니다. 전통에서 쓰던 상징을 그대로 옮긴 것이라
          앞의 풀이와 같은 무게로 보지 마세요.
        </p>
        ${block('행운의 색과 숫자', `모자란 기운을 채우는 색은 ${L.color.join('·')}이고 숫자는 ${L.num.join(', ')}, 방향은 ${L.dir}입니다. 이름의 첫 자음이 ${L.consonant.join('·')}인 사람과 결이 맞는다고 보는데, 이 대목은 사주가 아니라 한글 자음을 오행에 배정하는 성명학 쪽 규칙이라 참고로만 보세요.`, [])}
      </div>
      ${lottoSection(r.input, r.chart)}`)}

    ${aiSection('solo', v)}

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

// 결과 탭 - 길게 스크롤하는 대신 필요한 데로 바로 간다
$('#result').addEventListener('click', (e) => {
  const btn = e.target.closest('.tabs button[data-tab]');
  if (!btn) return;
  const id = btn.dataset.tab;
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === btn));
  document.querySelectorAll('.tab-pane').forEach((x) => { x.hidden = x.dataset.tab !== id; });
  document.querySelector('.tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  if (act === 'chart-copy' || act === 'chart-save') {
    // 궁합은 두 사람 명반을 그때 세운다. 화면을 그릴 때 미리 해두면
    // 복사하지 않는 사람에게까지 계산 값을 물리게 된다.
    const pair = last.mode === 'pair';
    const text = pair
      ? compatText(last.formA, last.formB, last.result,
                   readFortune(last.formA), readFortune(last.formB))
      : chartText(last.formA, last.result);
    const name = pair
      ? `명반_${last.formA.name}_${last.formB.name}.txt`
      : `명반_${last.formA.name}.txt`;
    if (act === 'chart-save') {
      downloadText(text, name);
      toast('텍스트 파일로 저장했습니다');
    } else {
      copyText(text).then((ok) => toast(
        ok ? '명반을 복사했습니다' : '복사가 막혀 있습니다. 창에 뜬 글을 직접 복사하세요', ok));
    }
  }
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

// 화면 아래에 판 번호를 박아 둔다. "예전과 다른데요"라는 말이 나올 때
// 어느 판을 보고 있는지부터 맞춰야 이야기가 된다.
{
  const el = $('#ver');
  if (el) {
    const last = CALC_CHANGES[0];
    el.textContent = `${ENGINE_VERSION} · 계산이 마지막으로 달라진 날 ${last ? last.at : '—'}`;
  }
}
