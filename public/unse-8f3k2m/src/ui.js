/**
 * ui.js — 화면 그리기
 *
 * 계산은 engine.js가 전부 한다. 여기서는 폼을 읽고 결과를 그린다.
 */

import { readFortune } from './engine.js';
import { compareFortune } from './compat.js';
import { CITIES } from './core/place.js';
import { lunarToSolar } from './core/lunar.js';
import { ELEMENT_NAMES, TRAIT_NAMES } from './systems/_base.js';
import {
  encodeState, decodeState, buildSoloCard, buildCompatCard, downloadCanvas,
} from './share.js';
import { pickNumbers } from './lotto.js';
import { readForecast, AREAS, areaText, periodSummary } from './forecast.js';
import { aiSection, initAI } from './ai.js';

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
const ELEM_VARS = ['--mok', '--hwa', '--to', '--geum', '--su'];

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
$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const box = $('#result');
  try {
    const form = collect('');
    box.innerHTML = mode === 'pair' ? renderCompat(form, collect('b-')) : render(form);
    box.classList.add('on');

    // 개인 운세 화면에만 AI 구획이 있다. 명반과 시기 운세를 함께 넘겨야
    // AI 가 "지금"까지 알고 답한다. render 가 이미 계산해 둔 것을 그대로 쓴다.
    if (mode === 'solo' && last?.result) {
      initAI(form, last.result, last.forecast);
    }
    // 주소를 지금 보고 있는 결과에 맞춰 둔다.
    // 새로고침해도 같은 결과가 나오고, 주소창을 그대로 복사해도 된다.
    history.replaceState(null, '', encodeState(last.mode, last.formA, last.formB));
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

const band = (n) => (n >= 62 ? 'hi' : n >= 42 ? 'mid' : 'lo');

function flowPane(f, kind, open) {
  const P = f.period;
  const gz = kind === 'day' ? P.gz.day : kind === 'month' ? P.gz.month : P.gz.year;
  return `
    <div class="flow-pane" data-fp="${kind}" ${open ? '' : 'hidden'}>
      <p class="lotto-when">${esc(P.label)} · ${esc(gz.hanja)}(${esc(gz.kr)})${
        kind !== 'year' ? ` · ${P.sajuYear}년 ${esc(P.gz.year.hanja)}` : ''}</p>
      <p class="flow-sum">${esc(periodSummary(f))}</p>
      ${AREAS.map((a) => {
        const x = f.areas[a];
        if (x.score == null) return '';
        return `
          <div class="area">
            <div class="area-head">
              <span class="area-name">${a}</span>
              <span class="area-score ${band(x.score)}">${x.score}</span>
            </div>
            <div class="area-track"><div class="area-fill ${band(x.score)}" style="width:${x.score}%"></div></div>
            <p class="area-text">${esc(areaText(a, x.score, kind))}</p>
            <p class="area-src">${x.count}개 체계 · 벌리기 전 ${x.raw}${
              x.range ? ` · 체계별 ${x.range[0]}~${x.range[1]}` : ''}</p>
          </div>`;
      }).join('')}

      <details class="pool">
        <summary>체계별로 이 시기를 어떻게 보는지</summary>
        <dl class="facts">
          ${f.results.slice().sort((a, b) => (b.areas?.총운 ?? 0) - (a.areas?.총운 ?? 0)).map((r) => `
            <div class="fact">
              <dt>${esc(r.name)}</dt>
              <dd>${esc(r.headline)}<small>${esc(r.text)}</small></dd>
            </div>`).join('')}
        </dl>
      </details>
    </div>`;
}

/**
 * 이레 화면.
 *
 * 명리에 주(週)가 없으므로 간지 한 줄로 요약할 수가 없다. 대신 이레치
 * 일운을 그대로 펼쳐 보여준다. 주간 운세에서 사람이 실제로 알고 싶은 건
 * 평균이 아니라 "어느 날에 하면 되나"이기도 하다.
 */
function weekPane(w, open) {
  const dayCol = (d) => `
    <div class="tl-col">
      <div class="tl-barwrap"><div class="tl-bar ${band(d.score)}" style="height:${Math.max(6, (d.score - 20) * 1.5)}px"></div></div>
      <div class="tl-score">${d.score}</div>
      <div class="tl-mon">${d.on.m}/${d.on.d}${d.today ? ' 오늘' : ''}</div>
      <div class="tl-gz">${esc(d.weekday)} ${esc(d.gz.hanja)}</div>
    </div>`;

  return `
    <div class="flow-pane" data-fp="week" ${open ? '' : 'hidden'}>
      <p class="lotto-when">${esc(w.label)} · 이레</p>
      <p class="flow-sum">${esc(w.best.area)}이 가장 높고 ${esc(w.worst.area)}이 가장 낮습니다.
        이레 가운데 ${w.bestDay.on.m}월 ${w.bestDay.on.d}일(${esc(w.bestDay.weekday)})이 가장 낫고,
        ${w.worstDay.on.m}월 ${w.worstDay.on.d}일(${esc(w.worstDay.weekday)})이 가장 무겁습니다.</p>

      <div class="tl" style="margin:16px 0 20px">${w.days.map(dayCol).join('')}</div>

      ${AREAS.map((a) => {
        const x = w.areas[a];
        if (x.score == null) return '';
        return `
          <div class="area">
            <div class="area-head">
              <span class="area-name">${a}</span>
              <span class="area-score ${band(x.score)}">${x.score}</span>
            </div>
            <div class="area-track"><div class="area-fill ${band(x.score)}" style="width:${x.score}%"></div></div>
            <p class="area-text">${esc(areaText(a, x.score, 'week'))}</p>
            <p class="area-src">이레 평균 · 벌리기 전 ${x.raw} · 날짜별 ${x.lo}~${x.hi}</p>
          </div>`;
      }).join('')}

      <p class="area-src" style="margin-top:14px">
        명리에는 주(週)라는 단위가 없습니다. 년·월·일·시뿐이라 주건(週建)에 해당하는 간지가
        없어서, 없는 간지를 지어내는 대신 이레치 일운을 실제로 계산해 묶었습니다.
        이레 평균은 좋은 날과 나쁜 날이 상쇄되어 폭이 좁아지므로 눈금을 따로 재어 벌렸습니다.
      </p>
    </div>`;
}

/** 오늘·이레·이달·올해를 한 묶음으로. 개인 운세 화면 맨 위에 온다 */
function timeSection(form, f) {
  const tl = f.timeline;
  const max = Math.max(...tl.map((m) => m.score));
  const min = Math.min(...tl.map((m) => m.score));
  const bestM = tl.reduce((a, b) => (b.score > a.score ? b : a));
  const worstM = tl.reduce((a, b) => (b.score < a.score ? b : a));
  const p2 = (n) => String(n).padStart(2, '0');

  return `
    <div class="section-label">시기 운세</div>
    <div class="card synth">
      <h3>${esc(form.name)} 님<span class="hanja">${f.today.y}.${p2(f.today.m)}.${p2(f.today.d)} 기준</span></h3>

      <div class="lotto-tabs" style="margin-top:16px">
        <button type="button" class="ft on" data-ft="day">오늘</button>
        <button type="button" class="ft" data-ft="week">앞으로 7일</button>
        <button type="button" class="ft" data-ft="month">이번 달</button>
        <button type="button" class="ft" data-ft="year">올해</button>
      </div>

      ${flowPane(f.day, 'day', true)}
      ${weekPane(f.week, false)}
      ${flowPane(f.month, 'month', false)}
      ${flowPane(f.year, 'year', false)}
    </div>

    <div class="section-label">${f.day.period.sajuYear}년 열두 달 흐름</div>
    <div class="card">
      <div class="tl">
        ${tl.map((m) => `
          <div class="tl-col">
            <div class="tl-barwrap"><div class="tl-bar ${band(m.score)}" style="height:${Math.max(6, (m.score - 20) * 1.5)}px"></div></div>
            <div class="tl-score">${m.score}</div>
            <div class="tl-mon">${m.from.m}/${m.from.d}~</div>
            <div class="tl-gz">${esc(m.gz.hanja)}</div>
          </div>`).join('')}
      </div>
      <p class="area-src" style="margin-top:16px">
        달력 달이 아니라 절기 기준입니다. 명리에서 한 달은 1일이 아니라 절기에 바뀝니다 —
        칸 아래 날짜가 그 달이 시작되는 절입일입니다.
      </p>
      <dl class="facts" style="margin-top:14px">
        <div class="fact"><dt>가장 높은 달</dt>
          <dd>${bestM.from.m}월 ${esc(bestM.gz.hanja)} · ${bestM.score}점<small>${esc(bestM.best ?? '')} 쪽이 특히 좋습니다</small></dd></div>
        <div class="fact"><dt>가장 낮은 달</dt>
          <dd>${worstM.from.m}월 ${esc(worstM.gz.hanja)} · ${worstM.score}점<small>${esc(worstM.worst ?? '')} 쪽을 특히 조심하세요</small></dd></div>
        <div class="fact"><dt>진폭</dt>
          <dd>${min} ~ ${max}<small>${max - min >= 25 ? '기복이 큰 해입니다' : max - min >= 12 ? '보통 정도의 기복입니다' : '평탄한 해입니다'}</small></dd></div>
      </dl>
    </div>

// ─────────────────────────────────────────────────────────────
// 궁합 화면
// ─────────────────────────────────────────────────────────────

function renderCompat(formA, formB) {
  const r = compareFortune(formA, formB);
  const s = r.synthesis;
  last = { mode: 'pair', formA, formB, result: r };
  const p = (n) => String(n).padStart(2, '0');
  const when = (f) => `${f.year}.${p(f.month)}.${p(f.day)}` +
    (f.hour == null ? ' 시간 미상' : ` ${p(f.hour)}:${p(f.minute)}`);

  const toneClass = (t) => t > 0 ? 'good' : t < 0 ? 'bad' : 'mid';

  return `
    <div class="section-label">궁합</div>
    <div class="card synth">
      <h3>${esc(formA.name)} <span style="color:var(--gold-soft)">×</span> ${esc(formB.name)}</h3>
      <p class="headline">${esc(when(formA))} &nbsp;·&nbsp; ${esc(when(formB))}</p>

      <div class="agree">
        <div class="agree-num">${s.score}<small>/ 100 · ${esc(s.verdict)}</small></div>
        <p>${esc(s.count)}개 체계를 견준 가중 평균입니다. 점수 자체보다 아래의 갈림을 보세요.</p>
      </div>

      ${s.summary.map((t) => `<div class="summary-line">${esc(t)}</div>`).join('')}

      <div class="section-label" style="margin-top:22px">체계별 판정</div>
      <div class="verdicts">
        ${['좋음', '무난', '어려움'].map((k) => `
          <div class="vgroup ${toneClass(k === '좋음' ? 1 : k === '어려움' ? -1 : 0)}">
            <div class="vcount">${s.buckets[k].length}</div>
            <div class="vname">${k}</div>
            <div class="vlist">${s.buckets[k].map(esc).join(', ') || '—'}</div>
          </div>`).join('')}
      </div>

      <div class="section-label" style="margin-top:22px">점수 순</div>
      ${r.results.slice().sort((x, y) => y.score - x.score).map((x) => `
        <div class="domain">
          <div class="domain-name">${esc(x.name)}</div>
          <div class="domain-track"><div class="domain-fill ${toneClass(x.tone)}" style="width:${x.score}%"></div></div>
          <div class="domain-val">${x.score}</div>
        </div>`).join('')}
      <p style="font-size:11.5px;color:var(--ink-3);margin:10px 0 0">
        점수 기준이 체계마다 다릅니다. 베딕의 아쉬타쿠타처럼 혼인을 전제로 만든 까다로운 잣대는
        낮게 나오기 쉽고, 요일이나 별 하나로 보는 체계는 후하게 나옵니다.
        가로로 견주기보다 각 체계가 무엇을 보고 그렇게 말했는지를 읽는 편이 낫습니다.
      </p>
    </div>

    ${shareBar()}

    <div class="section-label">체계별 풀이 — ${r.results.length}개</div>
    ${r.errors.map((e) => `<div class="error">${esc(e.system)} 계산 실패: ${esc(e.message)}</div>`).join('')}
    ${r.results.slice().sort((x, y) => y.score - x.score).map((x, i) => `
      <details class="sys" ${i === 0 ? 'open' : ''}>
        <summary>
          <span class="nm">${esc(x.name)}</span>
          <span class="hd">${esc(x.headline)}</span>
          <span class="vtag ${toneClass(x.tone)}">${x.score}</span>
          <span class="chev">▾</span>
        </summary>
        <div class="body">
          <dl class="facts">
            ${x.facts.map((f) => `
              <div class="fact"><dt>${esc(f.label)}</dt>
                <dd>${esc(f.value)}${f.note ? `<small>${esc(f.note)}</small>` : ''}</dd></div>`).join('')}
          </dl>
          ${x.readings.map((v) => `
            <div class="reading"><h4>${esc(v.title)}</h4>
              <p class="${v.mono ? 'mono' : ''}">${esc(v.text)}</p></div>`).join('')}
        </div>
      </details>`).join('')}

    ${r.skipped.length ? `
      <div class="section-label">견주지 못한 체계</div>
      <div class="card">
        <div class="planned">${r.skipped.map((x) => `<span>${esc(x.system)}</span>`).join('')}</div>
        <p style="font-size:12.5px;color:var(--ink-3);margin:14px 0 0">${esc(r.skipped[0].reason)}</p>
      </div>` : ''}
  `;
}

// ─────────────────────────────────────────────────────────────

function render(form) {
  const r = readFortune(form);
  // 시기 운세도 같은 화면에 들어간다. 여기서 한 번만 계산해 두고
  // AI 에도 그대로 넘긴다 (읽는 사람이 보는 값과 AI 가 받는 값이 같아야 한다).
  const f = readForecast(form);
  const s = r.synthesis;
  last = { mode: 'solo', formA: form, formB: null, result: r, forecast: f };
  const p = (n) => String(n).padStart(2, '0');

  return `
    ${timeSection(form, f)}

    <div class="section-label">평생 운세</div>
    <div class="card synth">
      <h3>${esc(form.name)} 님<span class="hanja">${form.year}.${p(form.month)}.${p(form.day)}
        ${r.input.timeKnown ? `${p(form.hour)}:${p(form.minute)}` : '시간 미상'} · ${esc(form.birthPlace)}</span></h3>
      <p class="headline">${s.systemCount}개 체계를 돌린 결과입니다</p>

      ${s.summary.map((t) => `<div class="summary-line">${esc(t)}</div>`).join('')}

      <div class="agree">
        <div class="agree-num">${s.consensus.ratio}%<small>산법 가중 합의도${s.consensus.word ? ` — ‘${esc(s.consensus.word)}’` : ''}</small></div>
        <p>${esc(s.consensus.text)}</p>
        ${s.consensus.from.length ? `<div class="tag-from">${s.consensus.from.map(esc).join(' · ')}</div>` : ''}
      </div>

      <div class="section-label" style="margin-top:22px">합산 오행</div>
      <div class="elembar">
        ${s.elements.pct.map((v, i) => v < 0.5 ? '' : `
          <div style="flex:${v};background:var(${ELEM_VARS[i]})">${v >= 8 ? ELEMENT_NAMES[i] : ''}</div>
        `).join('')}
      </div>
      <div class="elem-legend">
        ${ELEMENT_NAMES.map((n, i) =>
          `<span><i style="background:var(${ELEM_VARS[i]})"></i>${n} ${s.elements.pct[i]}%</span>`).join('')}
      </div>
      <p style="font-size:11.5px;color:var(--ink-3);margin:8px 0 0">${esc(s.elementAgreement.text)}</p>

      <div class="section-label" style="margin-top:22px">여러 체계가 함께 가리킨 것</div>
      ${s.sharedTags.length ? `
        <div class="tags">
          ${s.sharedTags.map((t) => `
            <span class="tag ${t.count >= 3 ? 'hot' : ''}">${esc(t.word)}<span class="n">${t.count}</span></span>
          `).join('')}
        </div>
        <div class="tag-from">
          ${s.sharedTags.slice(0, 3).map((t) => `${esc(t.word)} — ${t.from.map(esc).join(', ')}`).join(' &nbsp;·&nbsp; ')}
        </div>
      ` : `<p style="color:var(--ink-3);font-size:13.5px;margin:4px 0 0">
             겹치는 항목이 없습니다. 체계마다 다른 면을 비추고 있다는 뜻입니다.
           </p>`}
      ${s.soloTags.length ? `
        <div class="tags" style="margin-top:10px">
          ${s.soloTags.map((t) => `<span class="tag">${esc(t.word)}</span>`).join('')}
        </div>
        <div class="tag-from">위는 한 체계에서만 나온 항목입니다. 참고만 하세요.</div>
      ` : ''}

      <div class="section-label" style="margin-top:22px">기질</div>
      <div class="axis">
        ${TRAIT_NAMES.map((k) => {
          const t = s.traits[k];
          const pos = 50 + t.value * 50;
          return `<div class="axis-row">
            <span>${POLES[k][0]}</span>
            <div class="axis-track"><div class="axis-dot" style="left:${pos}%"></div></div>
            <span class="r">${POLES[k][1]}</span>
          </div>`;
        }).join('')}
      </div>

      <div class="section-label" style="margin-top:22px">영역별 힘</div>
      ${s.ranked.map((d) => `
        <div class="domain">
          <div class="domain-name">${esc(d.label)}</div>
          <div class="domain-track"><div class="domain-fill" style="width:${d.score}%"></div></div>
          <div class="domain-val">${d.score}</div>
        </div>
      `).join('')}
      <p style="font-size:11.5px;color:var(--ink-3);margin:8px 0 0">
        영역별 힘은 그 항목에 대해 말할 것이 있는 체계만 평균한 값입니다. 절대 점수가 아니라 서로 견준 순위로 보세요.
      </p>
    </div>

    <div class="section-label">계산에 쓴 값</div>
    <div class="card">
      <dl class="facts">
        <div class="fact"><dt>진태양시</dt><dd>${r.input.timeKnown
          ? `${p(r.birth.tst.h)}:${p(r.birth.tst.mi)} <small>벽시계 ${p(form.hour)}:${p(form.minute)}에서 ${r.birth.totalShiftMinutes >= 0 ? '+' : '−'}${Math.abs(r.birth.totalShiftMinutes).toFixed(0)}분</small>`
          : '<small>시간 미상 — 정오로 가정</small>'}</dd></div>
        <div class="fact"><dt>음력</dt><dd>${r.lunar.year}.${r.lunar.isLeap ? '윤' : ''}${r.lunar.month}.${r.lunar.day}
          <small>${r.lunar.isBigMonth ? '큰달' : '작은달'}</small></dd></div>
        <div class="fact"><dt>사주</dt><dd>${Object.values(r.chart.pillars).filter(Boolean).map((x) => x.hanja).join(' ')}
          <small>${r.chart.sajuYear}년 ${r.chart.zodiac}띠 · 입춘 기준</small></dd></div>
        <div class="fact"><dt>거주 방위</dt><dd>${esc(r.input.moveDirection)}
          <small>${esc(form.birthPlace)} → ${esc(form.homePlace)}</small></dd></div>
      </dl>
      <ul class="corrections">${r.birth.corrections.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    </div>

    <div class="section-label">체계별 풀이 — ${r.results.length}개</div>
    ${r.errors.map((e) => `<div class="error">${esc(e.system)} 계산 실패: ${esc(e.message)}</div>`).join('')}
    ${renderGroups(r)}

    ${r.skipped.length ? `
      <div class="section-label">계산하지 못한 체계</div>
      <div class="card">
        <div class="planned">
          ${r.skipped.map((x) => `<span>${esc(x.system)}</span>`).join('')}
        </div>
        <p style="font-size:12.5px;color:var(--ink-3);margin:14px 0 0">
          ${esc(r.skipped[0].reason)} 이 체계들은 시각으로 판을 세우기 때문에,
          시간을 모르면 근사치를 내는 대신 아예 내놓지 않는 편이 정직합니다.
        </p>
      </div>` : ''}

    ${lottoSection(r.input, r.chart)}

    ${aiSection()}

    ${shareBar()}
  `;
}

const POLES = {
  주도: ['따라가는', '이끄는'],
  외향: ['안으로', '밖으로'],
  감성: ['이성적', '감각적'],
  안정: ['움직이는', '머무는'],
  실리: ['이상', '실속'],
};

/** 체계를 성격별로 묶어 보여준다. 열다섯을 그냥 나열하면 읽기 어렵다 */
const GROUPS = [
  ['명반을 세우는 것', ['saju', 'jamidusu', 'astrology', 'vedic']],
  ['괘와 판을 뽑는 것', ['juyeok', 'yukim', 'hongguk', 'taeeul']],
  ['주기와 자리를 보는 것', ['gujeong', 'sukyo', 'tojeong']],
  ['수와 상징으로 보는 것', ['kabbalah', 'mahabote', 'thai', 'tarot']],
];

function renderGroups(r) {
  let first = true;
  return GROUPS.map(([label, ids]) => {
    const list = ids.map((id) => r.results.find((x) => x.id === id)).filter(Boolean);
    if (!list.length) return '';
    const html = list.map((sys) => {
      const open = first;
      first = false;
      return renderSystem(sys, open, r);
    }).join('');
    return `<p style="font-size:11.5px;color:var(--ink-3);margin:18px 0 8px">${esc(label)}</p>${html}`;
  }).join('');
}

function renderSystem(sys, open, r) {
  const isSaju = sys.id === 'saju';
  return `
    <details class="sys" ${open ? 'open' : ''}>
      <summary>
        <span class="nm">${esc(sys.name)}</span>
        <span class="hanja">${esc(sys.method.label)}</span>
        <span class="hd">${esc(sys.headline)}</span>
        <span class="chev">▾</span>
      </summary>
      <div class="body">
        ${isSaju ? renderPillars(r) : ''}
        <dl class="facts">
          ${sys.facts.map((f) => `
            <div class="fact">
              <dt>${esc(f.label)}</dt>
              <dd>${esc(f.value)}${f.note ? `<small>${esc(f.note)}</small>` : ''}</dd>
            </div>`).join('')}
        </dl>
        ${sys.readings.map((x) => `
          <div class="reading"><h4>${esc(x.title)}</h4>
            <p class="${x.mono ? 'mono' : ''}">${esc(x.text)}</p></div>
        `).join('')}
        ${sys.confidence < 1 ? `
          <p style="font-size:11.5px;color:var(--ink-3);margin-top:14px">
            이 체계는 종합에 ${Math.round(sys.confidence * 100)}%만 반영했습니다 —
            ${sys.method.kind === 'traditional'
              ? '출생 시각 등 계산 재료가 제한된 점을 반영했습니다.'
              : `${esc(sys.method.label)}이라는 산법 성격을 반영했습니다.`}
          </p>` : ''}
      </div>
    </details>`;
}

function renderPillars(r) {
  const P = r.chart.pillars;
  const cells = [['시', P.hour], ['일', P.day], ['월', P.month], ['년', P.year]];
  return `<div class="pillars">
    ${cells.map(([pos, g]) => `
      <div class="pillar ${pos === '일' ? 'me' : ''}">
        <div class="pos">${pos}주${pos === '일' ? ' · 나' : ''}</div>
        <div class="gz">${g ? esc(g.hanja) : '—'}</div>
        <div class="kr">${g ? esc(g.kr) : '시간 미상'}</div>
      </div>`).join('')}
  </div>`;
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
    : buildSoloCard(last.formA, last.result);

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
        <button type="button" data-x="dl">내려받기</button>
        <button type="button" data-x="close">닫기</button>
      </div>
      <p>휴대폰에서는 그림을 길게 눌러 저장하는 편이 확실합니다.</p>
    </div>`;
  wrap.querySelector('img').src = cv.toDataURL('image/png');
  document.body.appendChild(wrap);

  wrap.addEventListener('click', (e) => {
    const x = e.target.dataset.x;
    if (x === 'dl') downloadCanvas(cv, filename);
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
