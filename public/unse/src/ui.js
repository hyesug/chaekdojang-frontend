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
import { loadDicts } from './semantic/dict.js';
import { compareFortune } from './compat.js';
import { lunarToSolar } from './core/lunar.js';
import { elementDistribution } from './core/ganzhi.js';
import { j } from './core/josa.js';
import { encodeState, decodeState, shareLink, buildShareCard, saveCanvas } from './share.js';
import { buildHighlights, buildPairHighlights, renderHighlights } from './highlights.js';
import { attachFeedback } from './feedback.js';
import { readForecast, areaText } from './forecast.js';
import { renderReport, renderPairReport, pairDigestFor, periodFlow, pairEventsHtml } from './report.js';
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
    // 궁합 리포트도 두 사람 각자의 해석 사전을 쓴다. 못 불러와도 리포트는 그려진다
    await loadDicts().catch(() => null);
    await next();
    box.innerHTML = renderCompat(form, formB, c);
    attachFeedback(box, { mode: 'pair', names: [form.name, formB.name] });
    // 화면부터 띄우고, 무거운 계산(두 사람의 시기 → 사건 장, AI 문맥)은 그다음에 — 예전에는 둘 다 끝나야 화면이 떴다.
    // AI 문맥은 사건 장이 계산해 둔 시기를 출생 정보 캐시로 다시 쓰므로 뒤에 두면 금방 끝난다.
    setTimeout(() => {
      const p = last?.people ?? {};
      const el = box.querySelector('.rp-pair-events');
      const married = [form.marital, formB.marital].includes('married');
      if (el && p.a && p.b) el.innerHTML = pairEventsHtml(p.a, p.b, form.name, formB.name, { married });
      initCompatAI(form, formB, c);
      fillBooks(box);
    }, 30);
    await next();
    await next();
  } else {
    prepareInput(form);
    await next();
    const r = readFortune(form);
    await next();
    const f = readForecast(form);
    // 17체계 해석 사전 — 리포트 "나는 어떤 사람인가" 가 쓴다. 못 불러와도 리포트는 그려진다
    await loadDicts().catch(() => null);
    await next();
    box.innerHTML = render(form, r, f);
    attachFeedback(box, { mode: 'solo', names: [form.name] });
    fillBooks(box);
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
    // 결혼 여부는 궁합에서만 묻는다 — 개인 운세에서는 칸을 숨기고 값도 쓰지 않는다. 고르지 않으면 null
    marital: mode === 'pair' ? ($(`#${p}marital`)?.value || null) : null,
  };
}

// ─────────────────────────────────────────────────────────────
// 운세 흐름 화면
// ─────────────────────────────────────────────────────────────

/**
 * 궁합 화면 — 먼저 종합을 읽고 AI 질문으로 이어진 뒤, 필요할 때만 축별 기록을 펼친다.
 * 판정 개수·근거·양 끝은 싣지 않는다.
 */
/** 궁합 리포트에 쓸 두 사람 각자의 전체 풀이 — 사전 열쇠 가운데 체계 풀이에서 읽는 것(상승궁 등)이 있다 */
function pairPeople(formA, formB) {
  try { return { a: readFortune(formA), b: readFortune(formB) }; } catch { return {}; }
}

// '관계 축별 해석'(여덟 축 × 상·중·하마다 정해진 문단)은 뺐다 — 같은 구간의 쌍은 같은 글을 받았다
function renderCompat(formA, formB, r) {
  const people = pairPeople(formA, formB);
  last = { mode: 'pair', formA, formB, result: r, people };
  const v = buildCompatView(formA, formB, r);
  // 맨 위 핵심 요약·발견 — 궁합 재료를 한 번만 계산해 요약과 아래 리포트가 함께 쓴다
  let pd = null, h = null;
  try { pd = pairDigestFor(formA, formB, r, v, people); h = buildPairHighlights(pd); } catch (err) { console.warn('pair highlights', err); }
  last.shareCard = h?.shareCard?.items?.length
    ? { ...h.shareCard, kicker: `${formA.name || '나'} × ${formB.name || '상대'} 궁합 카드` } : null;

  return `
    <div class="result-header">
      <p class="result-kicker">분석 기록 · 궁합</p>
      <h2 class="hero-title">${esc(formA.name)} <span style="color:var(--gold-soft)">×</span> ${esc(formB.name)}</h2>
      <p class="result-meta">두 사람의 출생 기준을 열일곱 체계로 나란히 살폈습니다. 계산 기준은 맨 아래에 있습니다.</p>
      ${basisNote(people.a?.input ?? r.A?.input, formA.name)}${basisNote(people.b?.input ?? r.B?.input, formB.name)}
    </div>

    ${h ? renderHighlights(h) : ''}

    <div class="section-label">상세 분석</div>
    ${renderPairReport(formA, formB, r, v, {
      a: elementDistribution(r.A?.chart?.pillars ?? {}).count,
      b: elementDistribution(r.B?.chart?.pillars ?? {}).count,
    }, people, { digest: pd, memo: h?.memo })}

    ${shareBlock(!!last.shareCard)}

    <div class="section-label">AI 명반 해석</div>
    ${aiSection('pair', v)}

    <div class="section-label">체계별 상세 · 계산값 · 두 사람의 기준</div>
    <div class="card pair-calculation">
      <dl>
        <div><dt>${esc(formA.name)}</dt><dd>${esc(`${formA.year}.${String(formA.month).padStart(2, '0')}.${String(formA.day).padStart(2, '0')}`)} · ${formA.hour == null ? '시각 미상' : `${String(formA.hour).padStart(2, '0')}:${String(formA.minute).padStart(2, '0')}`} · ${esc(formA.birthPlace)}</dd></div>
        <div><dt>${esc(formB.name)}</dt><dd>${esc(`${formB.year}.${String(formB.month).padStart(2, '0')}.${String(formB.day).padStart(2, '0')}`)} · ${formB.hour == null ? '시각 미상' : `${String(formB.hour).padStart(2, '0')}:${String(formB.minute).padStart(2, '0')}`} · ${esc(formB.birthPlace)}</dd></div>
      </dl>
    </div>
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

/**
 * 시주 기준 안내 — 태어난 시각이 시 경계에 가까워 진태양시와 일반 만세력 방식(30분 고정 보정)의
 * 시주가 갈리는 사람에게만 둘 다 보여 준다. 다른 앱과 시주가 다르다는 문의가 이 경우였다.
 */
function basisNote(input, who = '') {
  const b = input?.pillarBasis;
  if (!b) return '';
  const t = b.tstClock;
  const clock = t ? ` · 진태양시 ${t.h}:${String(t.mi).padStart(2, '0')}` : '';
  const part = (x) => (b.dayDiffers ? `${x.day.hanja}일 ${x.hour.hanja}시` : `${x.hour.hanja}시`);
  return `
      <div class="basis-note" role="note">
        <b>⏱️ ${who ? `${esc(who)}님 ` : ''}시주 기준 안내</b>
        <p>태어난 시각이 시(時)의 경계에 가까워 기준에 따라 ${b.dayDiffers ? '일주·시주가' : '시주가'} 달라집니다.
          이 결과는 <b>진태양시</b>(태어난 곳의 실제 경도와 계절별 해의 빠르기를 반영${esc(clock)}) 기준 <b>${esc(part(b.tst))}</b>입니다.
          많은 만세력 앱이 쓰는 방식(표준시에서 30분 보정)으로는 <b>${esc(part(b.common))}</b>입니다.</p>
        <p class="basis-sub">태어난 시각이 몇 분만 달라도 바뀌는 자리라 어느 한쪽을 정답으로 단정하기 어렵습니다. 다른 앱과 시주가 다르다면 이 차이 때문입니다.</p>
      </div>`;
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
    <div class="section-label">체계별 상세 · 계산값 · 명반 요약</div>
    <div class="card">
      <div class="pillars">${pillar}</div>
      ${brief ? `<p class="mb-brief">${esc(brief)}</p>` : ''}

      <details class="pool">
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
 * 핵심 요약 → 개인 특이점·발견 → 현재 흐름(highlights.js) → 오늘/이달 → 상세 분석(report.js, 장은 접힘)
 * → 공유 → AI 에게 묻기 → 체계별 상세(명반 계산값) → 프로필 저장.
 * 모바일 첫 화면에 핵심 성향이 보이게 요약을 맨 위에 두고, 자세한 결과는 지우지 않고 아래로 내렸다.
 *
 * 화면에 쓰는 문장은 전부 엔진이 이미 쓴 것이다(viewmodel·forecast).
 * 여기서 새로 짓지 않는다.
 */
function render(form, r, f) {
  last = { mode: 'solo', formA: form, formB: null, result: r, forecast: f };
  const v = buildView(form, r, f);
  lastView = v;
  // 맨 위 핵심 요약·발견 — 한 번만 계산하고, 그 memo 로 아래 리포트가 같은 문장을 다시 내지 않게 한다
  let h = null;
  try { h = buildHighlights(r, f); } catch (err) { console.warn('highlights', err); }
  last.shareCard = h?.shareCard?.items?.length
    ? { ...h.shareCard, kicker: `${form.name ? `${form.name}님의` : '나의'} 명반 카드` } : null;

  // 오늘·이달의 운세도 아래 결과지(report.js)와 같은 카드 모양 — 이모지 + 이름 + 한두 문장
  const item = (icon, label, text) => text
    ? `<li><span class="rp-ic" aria-hidden="true">${icon}</span><div><b>${esc(label)}</b><p>${esc(text)}</p></div></li>`
    : '';
  const AREA_ICON = { 총운: '🌐', 애정운: '💗', 금전운: '💰', 직장운: '💼', 건강운: '🌿' };
  // 분야마다 점수 구간의 정해진 한 줄만 내던 것을, 그날·그달의 기운이 이 사람에게 무엇인지로 바꿨다(report.js periodFlow)
  const flowOf = (block_, kind) => { try { return periodFlow(r, block_, kind); } catch { return null; } };
  const areaItems = (block_, kind) => {
    const fl = flowOf(block_, kind);
    const rows = fl?.areas ?? ['총운', '애정운', '금전운', '직장운', '건강운']
      .filter((a) => block_.areas[a]?.score != null).map((a) => [a, areaText(a, block_.areas[a].score, kind)]);
    return rows.map(([a, t]) => item(AREA_ICON[a], a === '총운' ? '전체 흐름' : a.replace('운', ''), t)).join('');
  };
  const flowHead = (block_, kind) => {
    const fl = flowOf(block_, kind);
    return [fl?.theme, fl?.seat].filter(Boolean).map((t) => `<p class="rp-t">${esc(t)}</p>`).join('');
  };
  const todayInfo = v.month.days.find((x) => x.d === f.today.d);

  const pane = (id, on, html) =>
    `<div class="tab-pane" data-tab="${id}" ${on ? '' : 'hidden'}>${html}</div>`;

  // 이달의 일자별 표와 날짜 가이드는 뺐다(사용자 요청) — 날마다의 흐름은 '오늘의 운세'에서 매일 본다

  return `
    <div class="result-header">
      <p class="result-kicker">분석 기록 · 개인 명반</p>
      <h2 class="hero-title">${esc(v.who.name)} 님</h2>
      <p class="result-meta">${esc(v.who.born)} · 계산 기준은 맨 아래 체계별 상세에서 확인할 수 있습니다.</p>
      ${basisNote(r.input)}
    </div>

    ${h ? renderHighlights(h) : ''}

    <div class="tabs">
      <button type="button" class="on" data-tab="today">오늘의 운세</button>
      <button type="button" data-tab="month">이달의 운세</button>
    </div>

    ${pane('today', true, `
      <section class="rp-card rp-card-solo">
        <h3 class="rp-card-h"><span aria-hidden="true">☀️</span> 오늘의 운세 · ${f.today.m}월 ${f.today.d}일${todayInfo?.weekday ? `(${esc(todayInfo.weekday)})` : ''}</h3>
        ${v.now.grade ? `<p class="rp-chips"><span>오늘의 컨디션 · ${esc(v.now.grade)}</span></p>` : ''}
        ${v.now.line ? `<blockquote class="rp-quote">${esc(v.now.line)}</blockquote>` : ''}
        ${flowHead(f.day, 'day')}
        <ul class="rp-bul">${areaItems(f.day, 'day')}</ul>
      </section>`)}

    ${pane('month', false, `
      <section class="rp-card rp-card-solo">
        <h3 class="rp-card-h"><span aria-hidden="true">🗓️</span> ${esc(v.month.label)}의 운세</h3>
        ${flowHead(f.month, 'month')}
        <ul class="rp-bul">${areaItems(f.month, 'month')}</ul>
      </section>`)}


    <div class="section-label">상세 분석</div>
    ${renderReport(form, r, f, v, { memo: h?.memo })}

    ${shareBlock(!!last.shareCard)}

    <div class="section-label">AI 명반 해석</div>
    ${aiSection('solo', v)}

    ${chartPanel(r)}

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

/**
 * 책 추천 카드 채우기 — report.js 가 그 사람에게 필요한 주제와 이유를 카드에 담아 두면, 책도장 서버의
 * 주제 태그 추천(GET /api/books/recommend)으로 주제마다 책을 받아 넣는다. 서버가 늦거나 답하지 않거나
 * 맞는 책이 없으면 카드를 숨긴 채 둔다(리포트의 나머지는 그대로).
 */
/** 저자가 여럿이면 두 명까지만 — 긴 이름 줄이 카드를 화면 밖으로 밀어냈다 */
function shortAuthors(author) {
  const xs = String(author ?? '').split(/\s*[,，·]\s*/).filter(Boolean);
  return xs.length > 2 ? `${xs.slice(0, 2).join(', ')} 외 ${xs.length - 2}명` : xs.join(', ');
}

async function fillBooks(root) {
  for (const cardEl of root.querySelectorAll('.rp-books-card')) {
    let needs = [];
    try { needs = JSON.parse(cardEl.dataset.bookNeeds || '[]'); } catch { /* */ }
    if (!needs.length) continue;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const seed = Number(cardEl.dataset.bookSeed) || 0;
      const res = await fetch(`/api/books/recommend?themes=${encodeURIComponent(needs.map((n) => n.theme).join(','))}&perTheme=2&seed=${seed}`,
        { signal: ctrl.signal });
      if (!res.ok) continue;
      const groups = (await res.json())?.data ?? [];
      const html = needs.map((n) => {
        const books = groups.find((g) => g.theme === n.theme)?.books ?? [];
        if (!books.length) return '';
        return `<div class="rp-book-group"><p class="rp-t">${esc(n.reason)}</p><ul class="rp-book-list">${books.map((b) =>
          `<li><a href="/books/${encodeURIComponent(b.id)}">${b.thumbnail ? `<img src="${esc(b.thumbnail)}" alt="" loading="lazy">` : '<span class="rp-book-noimg" aria-hidden="true">📖</span>'}`
          + `<span class="rp-book-meta"><b>${esc(b.title)}</b><small>${esc(shortAuthors(b.author))}</small></span></a></li>`).join('')}</ul></div>`;
      }).join('');
      if (html) { cardEl.querySelector('.rp-books').innerHTML = html; cardEl.hidden = false; }
    } catch { /* 서버가 꺼져 있거나 늦으면 카드를 숨긴 채 둔다 */ }
    finally { clearTimeout(timer); }
  }
}

/**
 * 결과 공유 — 링크 하나만(이미지·PDF 저장은 결과가 길어 뺐다). 링크를 열면 같은 결과가 다시 계산된다.
 * 링크에 출생 정보가 담긴다는 것을 버튼 옆에 밝힌다.
 */
function shareBlock(withImage = false) {
  return `
    <div class="share-card">
      <div class="sharebar" style="margin:0">
        <button type="button" data-act="share">🔗 결과 링크 공유하기</button>
        ${withImage ? '<button type="button" data-act="share-image">🖼️ 이미지로 공유</button>' : ''}
      </div>
      ${withImage ? '<p class="agree-note" style="margin:8px 0 0">이미지에는 요약 카드만 담기고 생년월일·태어난 시각은 들어가지 않습니다.</p>' : ''}
      <p class="agree-note" style="margin:8px 0 0">링크를 받은 사람도 같은 결과를 볼 수 있습니다. 링크에 생년월일과 태어난 시각이 담기니 믿는 사람에게만 보내세요.</p>
    </div>`;
}

$('#result').addEventListener('click', async (e) => {
  if (e.target.closest('[data-act="share-image"]') && last?.shareCard) {
    try { openSharePreview(await buildShareCard(last.shareCard)); } catch { toast('이미지를 만들지 못했습니다.', false); }
    return;
  }
  const btn = e.target.closest('[data-act="share"]');
  if (!btn || !last) return;
  const url = location.origin + location.pathname + encodeState(last.mode, last.formA, last.formB);
  const title = last.mode === 'pair'
    ? `${last.formA.name || '나'} · ${last.formB.name || '상대'} 궁합 — 책도장`
    : `${last.formA.name || '나'}의 운세 — 책도장`;
  const how = await shareLink(url, title);
  if (how === 'copied') toast('링크를 복사했습니다. 원하는 곳에 붙여 넣어 보내세요.');
});

/** 공유 이미지 미리보기 — 먼저 보여 주고, 마음에 들면 저장·공유한다 */
function openSharePreview(cv) {
  document.querySelector('.share-preview')?.remove();
  const box = document.createElement('div');
  box.className = 'share-preview';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', '공유 이미지 미리보기');
  box.innerHTML = `
    <div class="share-preview-in">
      <img alt="공유 이미지 미리보기" src="${cv.toDataURL('image/png')}">
      <div class="sharebar">
        <button type="button" data-sp="save">📤 저장·공유하기</button>
        <button type="button" data-sp="close">닫기</button>
      </div>
    </div>`;
  const close = () => box.remove();
  box.addEventListener('click', async (ev) => {
    if (ev.target === box || ev.target.closest('[data-sp="close"]')) return close();
    if (ev.target.closest('[data-sp="save"]')) {
      try {
        const how = await saveCanvas(cv, 'chaekdojang-unse.png');
        if (how === 'download') toast('이미지를 저장했습니다.');
        if (how !== 'cancel') close();
      } catch { toast('이미지를 만들지 못했습니다.', false); }
    }
  });
  box.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); });
  document.body.appendChild(box);
  box.querySelector('[data-sp="save"]').focus();
}

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
