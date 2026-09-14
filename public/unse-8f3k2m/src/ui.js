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
          <div class="reading"><h4>${a} · ${x.score}점</h4>
            <p>${esc(areaDetail(a, x.score, kind, x))}</p></div>`;
      }).join('')}
    </div>`;
}

function areaDetail(area, score, kind, data) {
  const period = { day: '오늘', week: '앞으로 7일', month: '이번 달', year: '올해' }[kind] ?? '이 시기';
  const level = score >= 62 ? 'high' : score >= 42 ? 'mid' : 'low';
  const detail = {
    high: {
      start: `${period} ${area}은 비교적 힘을 받습니다. ${areaText(area, score, kind)}`,
      middle: '평소보다 한 걸음 앞서 움직여도 되는 흐름이지만, 좋은 흐름은 준비한 사람에게 더 크게 돌아옵니다.',
      end: '무리해서 결과를 당기기보다, 잘되는 일을 골라 집중하면 이 시기의 장점을 살릴 수 있습니다.',
    },
    mid: {
      start: `${period} ${area}은 크게 흔들리지는 않습니다. ${areaText(area, score, kind)}`,
      middle: '눈에 띄는 반전보다 기본을 지키는 선택에서 차이가 납니다. 미뤄 둔 일과 생활 리듬을 정리하기 좋습니다.',
      end: '불안해서 판을 크게 바꾸기보다, 확인할 것을 확인하고 다음 기회를 준비하는 쪽이 낫습니다.',
    },
    low: {
      start: `${period} ${area}은 신경을 조금 더 써야 하는 흐름입니다. ${areaText(area, score, kind)}`,
      middle: '문제가 반드시 생긴다는 뜻은 아닙니다. 다만 피로·오해·지출처럼 작은 신호를 그냥 넘기지 않는 편이 좋습니다.',
      end: '일정을 비우고 우선순위를 줄이면 충분히 지나갈 수 있는 시기입니다. 중요한 결정은 한 번 더 확인하세요.',
    },
  }[level];
  const basis = data.voices?.slice(0, 2).map((v) => v.name).join('·');
  return `${detail.start} ${detail.middle} ${detail.end}${basis ? ` 이 항목은 ${basis} 등의 계산 결과를 종합한 읽기입니다.` : ''}`;
}

/**
 * 이레 화면.
 *
 * 명리에 주(週)가 없으므로 간지 한 줄로 요약할 수가 없다. 대신 이레치
 * 일운을 그대로 펼쳐 보여준다. 주간 운세에서 사람이 실제로 알고 싶은 건
 * 평균이 아니라 "어느 날에 하면 되나"이기도 하다.
 */
function weekPane(w, open) {
  return `
    <div class="flow-pane" data-fp="week" ${open ? '' : 'hidden'}>
      <p class="lotto-when">${esc(w.label)} · 이레</p>
      <p class="flow-sum">${esc(w.best.area)}이 가장 높고 ${esc(w.worst.area)}이 가장 낮습니다.
        이레 가운데 ${w.bestDay.on.m}월 ${w.bestDay.on.d}일(${esc(w.bestDay.weekday)})이 가장 낫고,
        ${w.worstDay.on.m}월 ${w.worstDay.on.d}일(${esc(w.worstDay.weekday)})이 가장 무겁습니다.</p>

      ${AREAS.map((a) => {
        const x = w.areas[a];
        if (x.score == null) return '';
        return `
          <div class="reading"><h4>${a} · ${x.score}점</h4>
            <p>${esc(areaDetail(a, x.score, 'week', x))}</p></div>`;
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

    <div class="section-label">${f.day.period.sajuYear}년 운세 흐름</div>
    <div class="card">
      <div class="reading"><h4>올해의 흐름</h4><p>${max - min >= 25 ? '월마다 기복이 비교적 큰 해입니다. 좋은 달에는 중요한 일을 밀고, 낮은 달에는 정리와 점검에 힘을 쓰는 편이 좋습니다.' : '올해는 월별 변동이 크지 않은 편입니다. 한 번에 승부 보기보다 꾸준한 리듬을 만드는 쪽이 맞습니다.'}</p></div>
      <div class="reading"><h4>가장 힘이 실리는 달</h4><p>${bestM.from.m}월 ${esc(bestM.gz.hanja)}부터의 흐름이 ${bestM.score}점으로 가장 높습니다. 특히 ${esc(bestM.best ?? '전반적인 일')} 쪽에서 기회를 확인해 보세요.</p></div>
      <div class="reading"><h4>조심해서 지나갈 달</h4><p>${worstM.from.m}월 ${esc(worstM.gz.hanja)}부터는 ${esc(worstM.worst ?? '생활 리듬')} 쪽을 조금 더 챙기세요. 확장보다 점검과 마무리에 맞는 달입니다.</p></div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 궁합 화면
// ─────────────────────────────────────────────────────────────

function compatReading(r) {
  const s = r.synthesis;
  const names = (list) => list.slice(0, 3).map((x) => x.name).join('·');
  const good = r.results.filter((x) => x.tone > 0);
  const hard = r.results.filter((x) => x.tone < 0);
  const neutral = r.results.filter((x) => x.tone === 0);
  const basisGood = names(good) || names(neutral);
  const basisHard = names(hard) || names(neutral);
  return [
    ['두 사람의 관계 흐름', `${s.summary[0] ?? '두 사람의 관계는 한쪽으로 단정하기보다 서로 다른 결을 이해하는 데서 답이 나옵니다.'} 처음에는 다른 방식이 낯설 수 있지만, 맞추는 법을 알면 서로에게 없는 부분을 채워 주는 관계가 될 수 있습니다. 함께 있을 때 편한 순간과 부딪히는 순간을 구분해 보는 것이 중요합니다. (${basisGood})`],
    ['잘 맞는 지점', good.length ? `두 사람은 편하게 이어지는 지점이 분명히 있습니다. 특히 대화의 리듬, 생활을 함께 꾸리는 방식, 서로를 응원하는 방식에서 장점을 찾기 쉽습니다. 좋은 흐름이 있을 때 당연하게 넘기지 말고 감사와 인정의 말을 자주 나누세요. 관계는 큰 사건보다 이런 작은 확인으로 오래 단단해집니다. (${basisGood})` : `서로를 쉽게 이해하는 부분보다, 천천히 알아가야 하는 부분이 더 많은 조합입니다. 그렇다고 맞지 않는 관계라는 뜻은 아닙니다. 공통점을 억지로 찾기보다 서로 다른 기질을 존중하면 오히려 관계가 안정됩니다. (${basisGood})`],
    ['조심할 지점', hard.length ? `가까워질수록 기대가 커져 말이 어긋날 수 있는 자리도 보입니다. 상대가 당연히 알아주기를 바라기보다, 서운한 일은 작을 때 말로 꺼내는 편이 좋습니다. 돈·가족·시간처럼 생활에 닿는 문제는 감정이 쌓이기 전에 기준을 맞추세요. 싸움에서 이기는 것보다 다시 편해지는 방식을 만드는 것이 더 중요합니다. (${basisHard})` : `크게 충돌하는 신호는 두드러지지 않습니다. 다만 편하다는 이유로 대화를 줄이면 관계가 무뎌질 수 있습니다. 서로가 지금 무엇을 바라는지 가끔 확인하고, 익숙함 속에서도 시간을 따로 만드는 편이 좋습니다. (${basisHard})`],
    ['오래 가는 방법', `이 관계는 한 사람이 끌고 다른 사람이 따라가는 식보다, 각자의 강점을 인정할 때 안정됩니다. 중요한 결정은 감정이 높아진 순간보다 충분히 쉬고 난 뒤에 함께 정하세요. 상대를 바꾸려 하기보다 “나는 이럴 때 힘들고, 이렇게 해 주면 편하다”처럼 구체적으로 말하면 갈등이 줄어듭니다. 관계의 장점은 키우고, 어려운 지점은 생활 규칙으로 보완하는 것이 가장 현실적인 방법입니다. (${names(r.results)})`],
  ];
}

function renderCompat(formA, formB) {
  const r = compareFortune(formA, formB);
  last = { mode: 'pair', formA, formB, result: r };
  return `
    <div class="section-label">궁합</div>
    <div class="card synth">
      <h3>${esc(formA.name)} <span style="color:var(--gold-soft)">×</span> ${esc(formB.name)}</h3>
      <p class="headline">두 사람의 계산 결과를 종합한 관계 풀이입니다</p>
      ${compatReading(r).map(([title, text]) => `<div class="reading"><h4>${title}</h4><p>${esc(text)}</p></div>`).join('')}
    </div>

    <div class="section-label">체계별 해석</div>
    <div class="card">
      ${r.errors.map((e) => `<div class="error">${esc(e.system)} 계산 실패: ${esc(e.message)}</div>`).join('')}
      ${r.results.map((x) => `
        <div class="reading"><h4>${esc(x.name)}</h4>
          <p>${esc(x.headline)}</p>
          ${x.readings.map((v) => `<p>${esc(v.text)}</p>`).join('')}
        </div>`).join('')}
    </div>
    ${shareBar()}
  `;
}

// ─────────────────────────────────────────────────────────────

function lifeReading(r) {
  const s = r.synthesis;
  const score = (key) => s.domains[key]?.score ?? 50;
  const strong = s.sharedTags.slice(0, 3).map((x) => x.word).join('·') || '균형';
  const trait = (key, positive, negative) => s.traits[key].value >= 0 ? positive : negative;
  const sections = [
    ['초년운', `어린 시절부터 자신의 방식이 분명한 편입니다. ${trait('외향', '사람 사이에서 배우고 기회를 얻는 기질', '혼자 생각을 정리하며 자기 기준을 만드는 기질')}이 있어, 주변의 기대보다 스스로 납득하는 길을 찾으려 합니다. 초년에는 비교보다 경험을 넓히는 일이 중요하며, 가까운 친구와 선생님이 이후 선택에 오래 영향을 줄 수 있습니다. 성적이나 평가는 한 번의 결과보다 꾸준히 쌓을 때 더 잘 드러나는 흐름입니다.`],
    ['중년운', `중년으로 갈수록 ${strong}의 강점이 실질적인 자리로 연결되기 쉽습니다. ${trait('주도', '남이 만든 판을 따르기보다 책임을 맡고 방향을 정할 때', '앞에 나서기보다 좋은 사람·환경과 손을 잡을 때')} 힘이 납니다. 일을 넓히는 시기에는 혼자 모든 것을 끌어안지 말고 역할을 나누는 것이 중요합니다. 관계와 일의 기준을 분명히 세우면 성과가 오래 남습니다.`],
    ['말년운', `후반으로 갈수록 속도보다 삶의 질과 정리가 중요한 흐름입니다. ${trait('안정', '쌓아 온 것을 지키고 전하는 역할', '새로운 배움과 변화로 활력을 유지하는 역할')}이 잘 맞습니다. 재정·건강·인간관계를 미리 단순하게 정리해 두면 마음의 여유가 커집니다. 자신이 익힌 것을 가족이나 다음 세대와 나누는 일이 큰 보람으로 남을 수 있습니다.`],
    ['형제·가족운', `가족 관계에서는 정을 표현하는 방식보다 약속을 지키는 태도가 더 중요하게 작용합니다. ${trait('감성', '감정을 먼저 읽는 편이라 서운함을 혼자 쌓아 두지 않는 것', '현실적으로 판단하는 편이라 말이 차갑게 들리지 않도록 한 번 더 설명하는 것')}이 필요합니다. 가까울수록 역할과 금전 문제를 애매하게 두지 말고, 서로 기대하는 범위를 일찍 맞추는 편이 편안합니다.`],
    ['부부·인연운', `관계운은 ${score('관계')}점으로 읽힙니다. 마음이 맞는 사람과는 깊게 가지만, 기준이 맞지 않는 관계에는 오래 머물기 어려운 편입니다. 처음의 설렘보다 생활 리듬과 대화 방식이 맞는지가 더 중요합니다. 상대를 고치려 하기보다 서로의 혼자 있는 시간과 책임 범위를 존중할 때 관계가 안정됩니다.`],
    ['자식운', `돌봄과 교육의 자리에서는 말보다 태도가 크게 남습니다. 기대를 높게 두기보다 아이가 스스로 선택하고 책임지는 경험을 만들어 주는 쪽이 좋습니다. 강점은 구체적으로 인정하고, 부족한 점은 비교 대신 연습의 문제로 다루면 관계가 훨씬 편해집니다. 가족 안에서도 각자의 기질이 다르다는 점을 받아들이는 것이 중요합니다.`],
    ['직업운', `직업운은 ${score('직업')}점으로 읽힙니다. ${trait('실리', '성과와 보상이 분명한 환경', '의미와 성장감이 있는 환경')}에서 오래 버틸 힘이 납니다. 일의 방향을 정할 때는 단기 조건만 보지 말고, 배울 사람과 다음 단계가 있는지를 함께 확인하세요. 한 번 맡은 일은 책임감 있게 끌고 가는 힘이 있으니, 과로만 관리하면 전문성이 자산으로 남습니다.`],
  ];
  return sections.map(([title, text]) => `<div class="reading"><h4>${title}</h4><p>${esc(text)}</p></div>`).join('');
}

function render(form) {
  const r = readFortune(form);
  const f = readForecast(form);
  last = { mode: 'solo', formA: form, formB: null, result: r, forecast: f };

  return `
    ${timeSection(form, f)}
    <div class="section-label">평생 운세</div>
    <div class="card synth">
      <h3>${esc(form.name)} 님</h3>
      <p class="headline">${r.synthesis.systemCount}개 계산 결과를 종합한 평생 흐름입니다</p>
      ${lifeReading(r)}
    </div>
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
