/**
 * ui.js — 화면 그리기
 *
 * 계산은 engine.js가 전부 한다. 여기서는 폼을 읽고 결과를 그린다.
 */

import { readFortune } from './engine.js';
import { compareFortune } from './compat.js';
import { CITIES } from './core/place.js';
import { lunarToSolar } from './core/lunar.js';
import { j } from './core/josa.js';
import {
  encodeState, decodeState, buildSoloCard, buildCompatCard, downloadCanvas,
} from './share.js';
import { pickNumbers } from './lotto.js';
import { readForecast, AREAS } from './forecast.js';
import { lifeReading, monthDays, luckyDays, periodProse, compatReading,
         consensusReading, structureReading, patternReading } from './reading.js';
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
$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const box = $('#result');
  try {
    const form = collect('');
    const formB = mode === 'pair' ? collect('b-') : null;
    box.innerHTML = mode === 'pair' ? renderCompat(form, formB) : render(form);
    box.classList.add('on');

    // 두 화면 모두 AI 구획이 있다. 개인은 명반과 시기 운세를 함께 넘겨야
    // AI 가 "지금"까지 알고 답한다. render 가 계산해 둔 것을 그대로 쓴다.
    if (last?.result) {
      if (mode === 'pair') initCompatAI(form, formB, last.result);
      else initAI(form, last.result, last.forecast);
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

function renderCompat(formA, formB) {
  const r = compareFortune(formA, formB);
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

function render(form) {
  const r = readFortune(form);
  const f = readForecast(form);
  const s = r.synthesis;
  last = { mode: 'solo', formA: form, formB: null, result: r, forecast: f };

  const life = lifeReading(r.input, r.chart, s);
  const con = consensusReading(r, f.year);
  const st = structureReading(r.input, r.chart);
  const pat = patternReading(r.input, r.chart);
  const days = monthDays(r.input, r.chart, f.today.y, f.today.m);
  const lucky = luckyDays(days, life.meta.weak);
  const today = days.find((x) => x.d === f.today.d) ?? days[0];

  const seed = form.day + form.month;
  const block = (label, text, sources) => text
    ? `<div class="say">${label ? `<div class="say-name">${esc(label)}</div>` : ''}
         <p class="say-text">${esc(text)}${cite(sources)}</p></div>`
    : '';

  const period = (blk, label, kind) => {
    const p = periodProse(blk, seed + label.length, r.chart);
    return AREAS.map((a) => p[a]?.text
      ? block(label === '오늘' ? a : `${label} ${a}`, p[a].text, p[a].sources) : '').join('');
  };

  const dayRows = days.map((x) => `
    <tr class="${x.d === f.today.d ? 'now' : ''}">
      <td class="dt">${x.d}<small>${esc(x.weekday)}</small></td>
      <td class="sl">${x.sinsal.map((n) => `<span class="sinsal">${esc(n)}</span>`).join('')}</td>
      <td class="ln">${esc(x.line)}</td>
      <td class="gd ${x.cls}">${esc(x.grade)}</td>
    </tr>`).join('');

  const dayList = (arr) => arr.slice().sort((a, b) => a - b).join(', ');

  return `
    <div class="section-label">오늘 — ${f.today.m}월 ${f.today.d}일 (${esc(today.weekday)})</div>
    <div class="card synth">
      <h3>${esc(form.name)} 님<span class="hanja">${esc(f.day.period.gz.day.hanja)} · ${esc(today.grade)}</span></h3>
      ${block('오늘 총평', today.line, [])}
      ${period(f.day, '오늘', 'day')}
    </div>

    <div class="section-label">이번 주</div>
    <div class="card">
      ${block('이레', `${f.week.label} 가운데 ${f.week.bestDay.on.m}월 ${f.week.bestDay.on.d}일 쪽이 낫고, ${f.week.worstDay.on.m}월 ${f.week.worstDay.on.d}일 쪽이 무겁습니다. 중요한 자리를 잡는다면 앞쪽 날로 미는 편이 낫습니다.`, [])}
      ${period(f.week, '이번 주', 'week')}
    </div>

    <div class="section-label">${f.today.m}월</div>
    <div class="card">
      ${period(f.month, '이번 달', 'month')}
    </div>

    <div class="section-label">${f.today.m}월 일자별</div>
    <div class="card">
      <div class="daytable-wrap">
        <table class="daytable">
          <thead><tr><th>날</th><th>신살</th><th>풀이</th><th>등급</th></tr></thead>
          <tbody>${dayRows}</tbody>
        </table>
      </div>
    </div>

    <div class="section-label">${f.today.m}월 길일과 처방</div>
    <div class="card">
      ${block('좋은 날', `자리 이동이나 이사에 좋은 날은 ${dayList(lucky.move)}일이고, 문서와 계약·면접에 좋은 날은 ${dayList(lucky.contract)}일입니다. 재물의 흐름이 좋은 날은 ${dayList(lucky.money)}일이며, 사람을 만나기 좋은 날은 ${dayList(lucky.love)}일입니다.`, [])}
      ${lucky.helper.length ? block('귀인이 드는 날', `운의 흐름과 관계없이 돕는 사람이 붙는 날은 ${dayList(lucky.helper)}일입니다. 아쉬운 말을 꺼내야 한다면 이 날을 쓰세요.`, []) : ''}
      ${block('피해야 할 날', `${dayList(lucky.avoid)}일은 기운이 넘쳐 도리어 다치기 쉬우니 반드시 피하시고, 그다음으로 조심할 날은 ${dayList(lucky.worst)}일입니다.`, [])}
      ${block('처방', `모자란 기운을 채우는 색은 ${lucky.color.join('·')}이고 숫자는 ${lucky.num.join(', ')}입니다. 방향은 ${lucky.dir}이며, 이름의 첫 자음이 ${lucky.consonant.join('·')}인 사람과 인연이 좋습니다.`, [])}
    </div>

    <div class="section-label">${f.day.period.sajuYear}년</div>
    <div class="card">
      ${period(f.year, '올해', 'year')}
    </div>

    ${(st.lines.length || pat.length) ? `
    <div class="section-label">타고난 구성</div>
    <div class="card">
      ${block(st.level === 'strong' ? '크게 치우친 사주입니다' : '치우친 자리', st.head, [])}
      ${st.lines.map((t) => block(null, t, [])).join('')}
      ${pat.map((x) => block(x.name, x.text, [])).join('')}
      <p class="area-src" style="margin-top:8px">
        이 대목은 열다섯을 평균 낸 값이 아니라 사주 원국을 그대로 읽은 것입니다.
        네 기둥은 각각 조상·부모·나·자식의 자리라, 같은 부딪침이라도 어느 자리에
        걸렸느냐에 따라 뜻이 달라집니다.
        시기에 따라 바뀌지 않는 결이라 시기 운세보다 무겁게 보셔도 됩니다.
      </p>
    </div>` : ''}

    <div class="section-label">열다섯이 말하는 것</div>
    <div class="card">
      ${block('여럿이 함께 가리킨 것', con.공통?.text, con.공통?.sources)}
      ${con.갈림 ? block('갈리는 지점', con.갈림.text, con.갈림.sources) : ''}
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
