/**
 * ui.js — 화면 그리기
 *
 * 계산은 engine.js가 전부 한다. 여기서는 폼을 읽고 결과를 그린다.
 *
 * **이 파일은 첫 화면에 받지 않는다.** boot.js 가 '풀이 보기'를 누를 때
 * (또는 폼에 처음 손을 댈 때 미리) 받아온다. 여기서 import 하는 것은 전부
 * 그 덩이에 딸려 온다는 뜻이니, 가벼운 것을 새로 쓸 일이 생기면 boot.js
 * 쪽에 두는 편이 낫다.
 */

import { readFortune, prepareInput } from './engine.js';
import { compareFortune } from './compat.js';
import { lunarToSolar } from './core/lunar.js';
import { elementDistribution } from './core/ganzhi.js';
import { j } from './core/josa.js';
import { encodeState, decodeState } from './share.js';
import { readForecast, areaText } from './forecast.js';
import { renderReport, renderPairReport } from './report.js';
import { buildView, buildCompatView } from './viewmodel.js';
import { SYSTEM_META, TIER_LABEL, SOURCE_LABEL } from './meta.js';
import { loadProfile, saveProfile, deleteProfile, loginUrl } from './profile.js';
import { aiSection, initAI, initCompatAI } from './ai.js';

/** 방금 본 결과. 주소 갱신과 프로필 저장이 다시 쓴다 */
let last = null;
/** 그 결과를 화면용으로 가공한 것. AI 추천 질문이 이걸 본다 */
let lastView = null;

const $ = (s) => document.querySelector(s);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ─────────────────────────────────────────────────────────────
// boot.js 가 부르는 입구
// ─────────────────────────────────────────────────────────────

/**
 * 폼을 읽어 계산하고 결과를 그린다.
 *
 * 진행 표시(progressShell·stepper)는 boot.js 가 이미 띄워 두었다. 여기서는
 * 단계가 끝날 때마다 `next()` 를 불러 표시만 넘긴다.
 *
 * @param {'solo'|'pair'} mode
 * @param {HTMLElement} box   결과를 그릴 자리
 * @param {() => Promise<void>} next 한 단계 끝났음을 알린다
 */
export async function run(mode, box, next) {
  const form = collect('', mode);
  const formB = mode === 'pair' ? collect('b-', mode) : null;

  if (mode === 'pair') {
    prepareInput(form); prepareInput(formB);
    await next();
    const c = compareFortune(form, formB);
    await next();
    box.innerHTML = renderCompat(form, formB, c);
    initCompatAI(form, formB, c);
    await next();
    await next();
  } else {
    prepareInput(form);
    await next();
    const r = readFortune(form);
    await next();
    const f = readForecast(form);
    await next();
    box.innerHTML = render(form, r, f);
    initAI(form, r, f);
    await next();
    fillProfileCard(form);
    await next();
  }

  // 주소를 지금 보고 있는 결과에 맞춰 둔다.
  // 새로고침해도 같은 결과가 나오고, 주소창을 그대로 복사해도 된다.
  history.replaceState(null, '', encodeState(last.mode, last.formA, last.formB));
}

/** 모드를 바꾸면 방금 본 결과를 잊는다. 프로필 저장 버튼이 이걸 본다 */
export function reset() {
  last = null;
  lastView = null;
}

function collect(p, mode) {
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
    // 결혼 여부는 첫 사람 칸에만 있다(궁합의 두 번째 사람 칸에는 없다). 고르지 않으면 null
    marital: $(`#${p}marital`)?.value || null,
  };
}

// ─────────────────────────────────────────────────────────────
// 운세 흐름 화면
// ─────────────────────────────────────────────────────────────

/**
 * 궁합 화면 — 먼저 종합을 읽고 AI 질문으로 이어진 뒤, 필요할 때만 축별 기록을 펼친다.
 * 판정 개수·근거·양 끝은 싣지 않는다.
 */
function renderCompat(formA, formB, r) {
  last = { mode: 'pair', formA, formB, result: r };
  const v = buildCompatView(formA, formB, r);

  return `
    <div class="result-header">
      <p class="result-kicker">분석 기록 · 궁합</p>
      <h2 class="hero-title">${esc(formA.name)} <span style="color:var(--gold-soft)">×</span> ${esc(formB.name)}</h2>
      <p class="result-meta">두 사람의 출생 기준을 열다섯 체계로 나란히 살폈습니다.</p>
    </div>

    <div class="section-label">계산값 · 두 사람의 기준</div>
    <div class="card pair-calculation">
      <dl>
        <div><dt>${esc(formA.name)}</dt><dd>${esc(`${formA.year}.${String(formA.month).padStart(2, '0')}.${String(formA.day).padStart(2, '0')}`)} · ${formA.hour == null ? '시각 미상' : `${String(formA.hour).padStart(2, '0')}:${String(formA.minute).padStart(2, '0')}`} · ${esc(formA.birthPlace)}</dd></div>
        <div><dt>${esc(formB.name)}</dt><dd>${esc(`${formB.year}.${String(formB.month).padStart(2, '0')}.${String(formB.day).padStart(2, '0')}`)} · ${formB.hour == null ? '시각 미상' : `${String(formB.hour).padStart(2, '0')}:${String(formB.minute).padStart(2, '0')}`} · ${esc(formB.birthPlace)}</dd></div>
      </dl>
    </div>

    <div class="section-label">관계 데이터 분석</div>
    ${renderPairReport(formA, formB, r, v, {
      a: elementDistribution(r.A?.chart?.pillars ?? {}).count,
      b: elementDistribution(r.B?.chart?.pillars ?? {}).count,
    })}

    <div class="section-label">AI 명반 해석</div>
    ${aiSection('pair', v)}

    <details class="compat-details" open>
      <summary>관계 축별 해석 <span>여덟 가지 관계의 읽기</span></summary>
      <div class="compat-prose">
        ${v.eightAxes.map((a) => `
          <p class="say-text"><strong>${esc(a.label)}</strong> — ${esc([a.conclusion, a.reality, a.good, a.bad].filter(Boolean).join(' '))}</p>
        `).join('')}
      </div>
      ${v.strong?.text || v.friction?.text ? `
      <div class="compat-extremes">
        ${v.strong?.text ? `<p class="say-text"><strong>가장 좋게 보는 자리</strong> — ${esc(v.strong.text)}</p>` : ''}
        ${v.friction?.text ? `<p class="say-text"><strong>가장 어렵게 보는 자리</strong> — ${esc(v.friction.text)}</p>` : ''}
      </div>` : ''}
    </details>


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

  // 펼치지 않아도 보이는 한 줄 — 점성술 태양·달·상승점, 자미 명궁
  const val = (sys, k) => sys?.facts.find((x) => x.label === k)?.value;
  const brief = [
    ['태양', val(by('astrology'), '태양')],
    ['달', val(by('astrology'), '달')],
    ['상승점', val(by('astrology'), '상승점')],
    ['자미 명궁', val(by('jamidusu'), '명궁')],
  ].filter(([, x]) => x && x !== '—')
    .map(([k, x]) => `${k} ${String(x).replace(/ [\d.]+°$/, '')}`).join(' · ');

  return `
    <div class="section-label">계산값 · 명반 요약</div>
    <div class="card">
      <div class="pillars">${pillar}</div>
      ${brief ? `<p class="mb-brief">${esc(brief)}</p>` : ''}

      <details class="pool" open>
        <summary>명반 자세히 보기</summary>
        ${group('점성술 네이탈', `<dl class="mb-grid">${
          cells(by('astrology'), ['태양', '달', '상승점', '중천'])}</dl>`)}
        ${group('자미두수 명반', `<dl class="mb-grid">${
          cells(by('jamidusu'), ['명궁', '부처궁', '재백궁', '관록궁', '질액궁', '천이궁'])}</dl>`)}
        ${group('타로', `<dl class="mb-grid">${
          cells(by('tarot'), ['생일 카드', '상황', '과제', '조언'])}</dl>`)}
        ${group(`나머지 ${rest.length}개 체계`, `<dl class="facts">${
          rest.map((x) => `<div class="fact"><dt>${esc(x.name)}</dt><dd>${esc(x.headline)}</dd></div>`).join('')}</dl>`)}
        <p class="area-src" style="margin-top:12px">
          천문 계산으로 구한 값만 적었습니다. 뜻이 궁금하면 아래에서 AI 에게 물어보세요.
        </p>
      </details>
    </div>
  `;
}

/**
 * 개인 운세 화면.
 *
 * 명반 → 오늘의 운세 / 이달의 운세 두 탭 → 프로필 저장 → AI 에게 묻기.
 * 더 깊은 이야기는 AI 에게 물어 꺼내게 하고, 화면에는 그 둘만 둔다.
 *
 * 화면에 쓰는 문장은 전부 엔진이 이미 쓴 것이다(viewmodel·forecast).
 * 여기서 새로 짓지 않는다.
 */
function render(form, r, f) {
  last = { mode: 'solo', formA: form, formB: null, result: r, forecast: f };
  const v = buildView(form, r, f);
  lastView = v;

  // 오늘·이달의 운세도 아래 결과지(report.js)와 같은 카드 모양 — 이모지 + 이름 + 한두 문장
  const item = (icon, label, text) => text
    ? `<li><span class="rp-ic" aria-hidden="true">${icon}</span><div><b>${esc(label)}</b><p>${esc(text)}</p></div></li>`
    : '';
  const AREA_ICON = { 총운: '🌐', 애정운: '💗', 금전운: '💰', 직장운: '💼', 건강운: '🌿' };
  const areaItems = (block_, kind) => ['총운', '애정운', '금전운', '직장운', '건강운']
    .map((a) => block_.areas[a]?.score == null ? ''
      : item(AREA_ICON[a], a === '총운' ? '전체 흐름' : a.replace('운', ''), areaText(a, block_.areas[a].score, kind)))
    .join('');
  const todayInfo = v.month.days.find((x) => x.d === f.today.d);

  const pane = (id, on, html) =>
    `<div class="tab-pane" data-tab="${id}" ${on ? '' : 'hidden'}>${html}</div>`;

  const dayList = (arr) => arr.length ? `${arr.slice().sort((a, b) => a - b).join(', ')}일` : '';
  const L = v.month.lucky;

  const dayRows = v.month.days.map((x) => `
    <tr class="${x.d === f.today.d ? 'now' : ''}">
      <td class="dt">${x.d}<small>${esc(x.weekday)}</small></td>
      <td class="ln">${esc(x.line)}</td>
      <td class="gd ${x.cls}">${esc(x.grade)}</td>
    </tr>`).join('');

  return `
    <div class="result-header">
      <p class="result-kicker">분석 기록 · 개인 명반</p>
      <h2 class="hero-title">${esc(v.who.name)} 님</h2>
      <p class="result-meta">${esc(v.who.born)} · 계산 기준은 아래 명반 요약에서 확인할 수 있습니다.</p>
    </div>

    ${chartPanel(r)}

    <div class="tabs">
      <button type="button" class="on" data-tab="today">오늘의 운세</button>
      <button type="button" data-tab="month">이달의 운세</button>
    </div>

    ${pane('today', true, `
      <section class="rp-card rp-card-solo">
        <h3 class="rp-card-h"><span aria-hidden="true">☀️</span> 오늘의 운세 · ${f.today.m}월 ${f.today.d}일${todayInfo?.weekday ? `(${esc(todayInfo.weekday)})` : ''}</h3>
        ${v.now.grade ? `<p class="rp-chips"><span>오늘의 컨디션 · ${esc(v.now.grade)}</span></p>` : ''}
        ${v.now.line ? `<blockquote class="rp-quote">${esc(v.now.line)}</blockquote>` : ''}
        <ul class="rp-bul">${areaItems(f.day, 'day')}</ul>
      </section>`)}

    ${pane('month', false, `
      <section class="rp-card rp-card-solo">
        <h3 class="rp-card-h"><span aria-hidden="true">🗓️</span> ${esc(v.month.label)}의 운세</h3>
        <ul class="rp-bul">${areaItems(f.month, 'month')}</ul>
        <h4 class="rp-h4">📌 이달의 날짜 가이드</h4>
        <ul class="rp-bul">
          ${item('🚚', '이동·이사', dayList(L.move))}
          ${item('📝', '계약·면접·문서', dayList(L.contract))}
          ${item('💰', '돈이 도는 날', dayList(L.money))}
          ${item('🤝', '사람 만나기', dayList(L.love))}
          ${item('🙌', '도와줄 사람이 붙는 날', dayList(L.helper))}
          ${item('⏸️', '미루면 좋은 날', L.avoid.length ? `${dayList(L.avoid)} — 기운이 넘쳐 무리하기 쉬운 날입니다.${L.worst.length ? ` 그다음은 ${dayList(L.worst)}.` : ''}` : '')}
        </ul>
        <p class="rp-fine">이미 잡힌 수술·계약·면접 일정을 이 날짜 때문에 바꾸실 필요는 없습니다. 고를 수 있을 때 참고만 하세요.</p>
      </section>
      <details class="why" style="margin-top:14px" open>
        <summary>${esc(v.month.label)} 일자별로 보기</summary>
        <div class="daytable-wrap" style="margin-top:12px">
          <table class="daytable">
            <thead><tr><th>날</th><th>풀이</th><th>등급</th></tr></thead>
            <tbody>${dayRows}</tbody>
          </table>
        </div>
      </details>`)}

    <div class="section-label">인생 데이터 분석</div>
    ${renderReport(form, r, f, v)}

    <div class="section-label">AI 명반 해석</div>
    ${aiSection('solo', v)}

    <div class="profile-card" id="profileCard">
      <p class="agree-note" style="margin:0">프로필 저장 여부를 확인하는 중…</p>
    </div>
  `;
}

/**
 * 프로필 저장 칸. 로그인한 사람에게만 저장 버튼을 준다.
 * 화면을 먼저 그리고 로그인 여부는 뒤에 채운다 — 백엔드가 느려도 결과는 바로 보인다.
 */
async function fillProfileCard(form) {
  const el = $('#profileCard');
  if (!el) return;
  const { loggedIn, profile } = await loadProfile();
  if (!el.isConnected) return;

  if (!loggedIn) {
    el.innerHTML = `
      <p class="agree-note" style="margin:0">
        <a href="${esc(loginUrl())}">로그인</a>하면 이 출생 정보를 프로필로 저장해 두고 다음에 바로 불러올 수 있습니다.
      </p>`;
    return;
  }

  const same = profile && profile.year === form.year && profile.month === form.month &&
    profile.day === form.day && profile.hour === form.hour && profile.name === form.name;
  el.innerHTML = `
    <div class="sharebar" style="margin:0">
      <button type="button" data-act="profile-save">${same ? '저장된 프로필과 같습니다' : profile ? '이 정보로 프로필 바꾸기' : '내 프로필로 저장'}</button>
      ${profile ? '<button type="button" data-act="profile-delete">저장된 프로필 삭제</button>' : ''}
    </div>
    <p class="agree-note" style="margin-top:12px">
      저장하면 이름·성별·생년월일·태어난 시각·태어난 곳·사는 곳이 책도장 서버에 보관됩니다.
      언제든 여기서 삭제할 수 있고, 회원 탈퇴 시 함께 삭제됩니다.
      <a href="/privacy">개인정보처리방침</a>
    </p>`;
  if (same) el.querySelector('[data-act="profile-save"]').disabled = true;
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

// '칸으로 펼쳐 보기'(`composePanel.js`)와 '앞일 묻기'(`scenarioPanel.js`)는
// 화면에서 내렸다. 모듈과 그 아래 층(`semantic/compose`·`semantic/scenario`)은
// 그대로 남아 있고 테스트도 돈다 — 다시 붙이려면 여기서 `import()` 로 부르는
// 칸과 `renderSolo` 의 자리 두 군데만 되살리면 된다.

$('#result').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  const act = btn?.dataset.act;
  if (!act || !last) return;
  if (act !== 'profile-save' && act !== 'profile-delete') return;
  btn.disabled = true;
  try {
    if (act === 'profile-save') {
      await saveProfile(last.formA);
      toast('프로필을 저장했습니다');
    } else {
      await deleteProfile();
      toast('저장된 프로필을 삭제했습니다');
    }
  } catch (err) {
    toast(err.message, false);
  }
  await fillProfileCard(last.formA);
});

/**
 * 링크로 들어온 경우 그대로 되살린다.
 *
 * 주소를 푸는 decodeState 가 share.js 에 있고 share.js 는 해석문을 끌고
 * 들어오므로, 이 함수는 첫 화면 쪽(boot.js)에 둘 수 없다. 대신 주소에
 * 결과가 담겨 있을 때만 boot.js 가 이쪽을 부른다.
 */
export function restoreFromHash() {
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
    if ($(`#${p}marital`)) set('marital', f.marital ?? '');
  };

  if (st.mode === 'pair') document.querySelector('[data-mode="pair"]').click();
  fill('', st.formA);
  if (st.formB) fill('b-', st.formB);
  $('#form').requestSubmit();
}
