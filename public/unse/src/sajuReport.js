/**
 * sajuReport.js — 명반 풀이(질문 카드)
 *
 * 사주 결과지 PDF의 형식을 빌렸다(사용자 요청 2026-11): 번호 붙은 질문 → 한 줄 답 → 짧은 풀이 → 근거.
 * 예전 '핵심 요약·발견'과 '상세 분석'을 이 카드들로 바꿨다 — 길게 늘어놓은 글은 읽히지 않았다.
 *
 * report.js 와 같은 원칙이다.
 *   · 문장은 엔진이 이미 쓴 것을 고르고 배열한다(futureDigest · seasonNow · careerRoles · periodFlow · lifeEventItems).
 *   · 새로 짓는 말은 계산값(용신 방위·천을귀인 자리·달 순위)을 옮기는 짧은 틀뿐이다.
 *   · 결혼·출산 연도, 이직 '가능성 몇 %' 같은 단정은 싣지 않는다 — 사례 검증을 통과하지 못했다.
 *   · 한자·십신 같은 계산 용어는 카드 맨 아래 '근거' 칸에만 둔다. 본문은 쉬운 말로만.
 */
import {
  STEMS, STEMS_KR, BRANCHES, BRANCHES_KR, ELEMENTS, ELEMENT_HANJA, STEM_ELEMENT, BRANCH_ELEMENT, MAIN_HIDDEN,
  TEN_GOD_GROUP, ZODIAC, tenGod, tenGodDistribution, computeDaeun, currentDaeun, branchRelations, yearPillar,
} from './core/ganzhi.js';
const ZODIAC_OF = (b) => ZODIAC[b];
import { CHEONEUL } from './core/sinsal.js';
import { usefulGod, colorAdvice } from './semantic/structure/yongsin.js';
import { monthsOfYear, forecastPeriod } from './forecast.js';
import { futureDigest, careerRoles, periodFlow, lifeEventItems, ELEM_FILL, ELEM_KEYS } from './report.js';
import { j } from './core/josa.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** 엔진 문장의 첫 문장만 — 한 줄 답으로 쓴다 */
const first = (t) => String(t ?? '').split(/(?<=[.!?])\s+/)[0];

const GROUP_HANJA = { 비겁: '比劫', 식상: '食傷', 재성: '財星', 관성: '官星', 인성: '印星' };
const POS_KR = { 년: '연', 월: '월', 일: '일', 시: '시' };
/** 오행 방위 — 목 동, 화 남, 토 가운데, 금 서, 수 북 */
const ELEM_DIR = ['동쪽', '남쪽', '가운데', '서쪽', '북쪽'];
/** 천을귀인이 앉은 자리마다 도움이 들어오는 쪽 */
const NOBLE_SCENE = {
  year: '윗사람·집안 어른, 오래 알고 지낸 사람', month: '직장 동료·같은 업계 사람',
  day: '배우자·가장 가까운 사람', hour: '후배·아랫사람, 내가 해 온 결과물',
};
const PILLAR_KR = { year: '연지', month: '월지', day: '일지', hour: '시지' };

// ─── 근거 칸 ─────────────────────────────────────────────
const stemChip = (s) => `<span class="sz-hz el-${STEM_ELEMENT[s]}">${STEMS[s]}</span>`;
const branchChip = (b) => `<span class="sz-hz el-${BRANCH_ELEMENT[b]}">${BRANCHES[b]}</span>`;
const elemChip = (e) => `<span class="sz-hz el-${e}">${ELEMENT_HANJA[e]}</span>`;
function basis(chips, title, sub = '') {
  return `<div class="sz-basis"><span class="sz-basis-l">근거</span><span class="sz-chips">${chips}</span>`
    + `<span class="sz-basis-t"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></div>`;
}
/** 천간·지지가 나에게 무엇인지 — "천간 정재 · 지지 정관 · 일지와 육합" */
function godLine(r, stem, branch) {
  const ds = r.chart.dayStem;
  const rel = branchRelations(r.chart.pillars.day.branch, branch).find((x) => !x.minor);
  return [`천간 ${tenGod(ds, stem)}`, `지지 ${tenGod(ds, MAIN_HIDDEN[branch])}`, rel ? `일지와 ${rel.kind}` : '']
    .filter(Boolean).join(' · ');
}
/** 십신 무리가 앉은 자리 — "연간 辛 · 월간 辛 · 시지 申" */
function groupSeats(r, group) {
  const P = r.chart.pillars;
  const key = { 년: 'year', 월: 'month', 일: 'day', 시: 'hour' };
  return tenGodDistribution(P, r.chart.dayStem).detail
    .filter((x) => TEN_GOD_GROUP[x.god] === group)
    .map((x) => {
      const p = P[key[x.pos[0]]];
      const isStem = x.pos[1] === '간';
      return { label: `${POS_KR[x.pos[0]]}${x.pos[1]} ${isStem ? STEMS[p.stem] : BRANCHES[p.branch]}`, chip: isStem ? stemChip(p.stem) : branchChip(p.branch) };
    });
}
function groupBasis(r, group) {
  const seats = groupSeats(r, group);
  if (!seats.length) return basis('', `${group}(${GROUP_HANJA[group]}) 0개`, '여덟 글자 겉에는 드러나지 않음');
  return basis(seats.map((x) => x.chip).join(''), `${group}(${GROUP_HANJA[group]}) ${seats.length}개`, seats.map((x) => x.label).join(' · '));
}

// ─── 카드 틀 ─────────────────────────────────────────────
/** 한 줄 답이 없으면 카드를 내지 않는다. 번호는 실린 카드끼리 붙인다 */
function card({ q, a, body = '', key = '', basis: b = '' }) {
  if (!a) return null;
  a = String(a).replace(/[.]$/, '');
  return (n) => `
    <section class="sz-card">
      <p class="sz-q"><span class="sz-n">${n}</span>${esc(q)}</p>
      <h3 class="sz-a">${esc(a)}</h3>
      ${body}
      ${key ? `<p class="sz-key">${esc(key)}</p>` : ''}
      ${b}
    </section>`;
}
const para = (xs) => xs.filter(Boolean).map((t) => `<p class="rp-t">${esc(t)}</p>`).join('');
const items = (rows) => {
  const li = rows.filter(([, t]) => t).map(([label, t]) =>
    `<li>${label ? `<b>${esc(label)}</b>` : ''}<p>${esc(t)}</p></li>`).join('');
  return li ? `<ul class="sz-list">${li}</ul>` : '';
};

// ─── 계산 ────────────────────────────────────────────────
/** 지금 지나는 10년 */
function daeunNow(r) {
  try {
    return currentDaeun(computeDaeun(r.chart, r.input.isMale, r.input.jdUT), r.input.elapsedYears ?? r.input.age);
  } catch { return null; }
}

/** 이번 달부터 열두 달 — 절기 기준 달마다 열다섯 체계의 흐름 점수와 그달의 결 */
export function nextMonths(r, today) {
  const all = [today.y - 1, today.y, today.y + 1].flatMap((y) => monthsOfYear(y))
    .sort((a, b) => a.jd - b.jd);
  const key = (t) => t.y * 10000 + t.m * 100 + t.d;
  const now = key(today);
  let i = all.findIndex((p, k) => key(p.termStart) <= now && (!all[k + 1] || key(all[k + 1].termStart) > now));
  if (i < 0) i = 0;
  return all.slice(i, i + 12).map((p) => {
    const block = forecastPeriod(r.input, r.chart, p);
    let fl = null;
    try { fl = periodFlow(r, block, 'month'); } catch { /* */ }
    return {
      y: p.termStart.y, m: p.termStart.m, d: p.termStart.d,
      gz: p.ruling, score: block.areas?.총운?.score ?? null, theme: fl?.theme ?? '', seat: fl?.seat ?? '',
    };
  }).filter((x) => x.score != null);
}

// ─── 카드들 ──────────────────────────────────────────────
function cardNature(r, d) {
  const ds = r.chart.dayStem;
  const level = usefulGod(r.chart).strength.level;
  const LV = { 신약: '돕는 기운보다 쓰는 기운이 많음', 신강: '쓰는 기운보다 돕는 기운이 많음', 중화: '돕는 기운과 쓰는 기운이 비슷함' };
  return card({
    q: '내 사주는 어떤 방식으로 풀리는가',
    a: d.know.p[0],
    body: para([d.know.p.slice(1, 3).join(' '), d.know.work[0]]),
    basis: basis(stemChip(ds), `일간 ${STEMS[ds]}(${STEMS_KR[ds]}) · ${level}`, `나를 뜻하는 글자 · ${LV[level] ?? ''}`),
  });
}

function cardSeason(r, d) {
  const sn = d.season;
  if (!sn) return null;
  const dae = daeunNow(r);
  return card({
    q: '지금 나는 어떤 시기를 지나고 있나',
    a: first(sn.cur.e.h),
    body: items([
      ['', sn.cur.e.h.slice(first(sn.cur.e.h).length).trim()],
      ['지금 힘을 쓸 곳', sn.cur.e.g],
      [sn.next ? `${sn.next.from}년(${sn.next.age}세)부터` : '', sn.next?.e?.h],
    ]),
    key: `${sn.cur.from}~${sn.cur.to}년의 흐름이에요.`,
    basis: dae ? basis(stemChip(dae.stem) + branchChip(dae.branch), `${dae.kr}대운 · ${dae.fromAge}~${dae.toAge}세`, godLine(r, dae.stem, dae.branch)) : '',
  });
}

function cardMonths(r, months) {
  if (months.length < 6) return null;
  const ranked = [...months].sort((a, b) => b.score - a.score);
  const good = ranked.slice(0, 3);
  const bad = ranked.slice(-2).filter((x) => !good.includes(x));
  const byTime = (xs) => xs.sort((a, b) => a.y * 12 + a.m - (b.y * 12 + b.m));
  const label = (x) => `${x.y}년 ${x.m}월`;
  const top = good[0];
  return card({
    q: '앞으로 열두 달, 움직일 달과 멈춰야 할 달',
    a: `${label(top)}에 흐름이 가장 강하게 움직여요`,
    body: `<h4 class="sz-h">움직일 달</h4>${items(byTime(good).map((x) => [`${label(x)} · ${x.d}일부터`, x.theme]))}`
      + (bad.length ? `<h4 class="sz-h">숨 고를 달</h4>${items(byTime(bad).map((x) => [`${label(x)} · ${x.d}일부터`, x.theme]))}` : ''),
    key: '달의 기운은 달력의 1일이 아니라 절기가 바뀌는 날(대개 5~8일)부터 움직여요.',
    basis: basis(stemChip(top.gz.stem) + branchChip(top.gz.branch), `${label(top)} · ${top.gz.kr}월(${top.gz.hanja}月)`, godLine(r, top.gz.stem, top.gz.branch)),
  });
}

function strongestGroup(r) {
  const g = tenGodDistribution(r.chart.pillars, r.chart.dayStem).groups;
  return Object.entries(g).sort((a, b) => b[1] - a[1])[0][0];
}

function cardCareer(r, d) {
  let roles = null;
  try { roles = careerRoles(r); } catch { /* */ }
  const a = roles?.lead || d.know.work[0];
  return card({
    q: '결국 나는 어떤 일로 자리를 잡는가',
    a: a ? a.replace(/[.]$/, '') : '',
    body: para([roles?.lead ? d.know.work[0] : d.know.work[1]]) + (roles?.basis ? `<p class="sz-note">${esc(roles.basis)}</p>` : ''),
    basis: groupBasis(r, strongestGroup(r)),
  });
}

function cardMoney(r, d) {
  return card({
    q: '돈은 어떻게 들어오고, 어디서 새는가',
    a: first(d.direction.earn[0]).replace(/[.]$/, ''),
    body: items([
      ['', d.direction.earn.slice(1).join(' ') || d.direction.earn[0].slice(first(d.direction.earn[0]).length).trim()],
      ['돈을 쓰는 습관', d.know.spend[0]],
    ]),
    basis: groupBasis(r, '재성'),
  });
}

function cardNoble(r, d, months) {
  const set = CHEONEUL[r.chart.dayStem] ?? [];
  const P = r.chart.pillars;
  const seats = ['year', 'month', 'day', 'hour'].filter((k) => P[k] && set.includes(P[k].branch));
  const now = Number(r.input.currentYear);
  const years = [];
  for (let y = now; y < now + 13 && years.length < 2; y++) if (set.includes(yearPillar(y).branch)) years.push(y);
  const soon = months.filter((x) => set.includes(x.gz.branch)).map((x) => `${x.y}년 ${x.m}월`);
  const a = seats.length
    ? `도움은 ${NOBLE_SCENE[seats[0]]} 쪽에서 들어와요`
    : '도움은 정해진 해와 달에 사람을 통해 들어와요';
  return card({
    q: '좋은 운은 어떤 모습으로 내 앞에 나타나는가',
    a,
    body: items([
      ['곁에 두면 좋은 사람', d.direction.drawn[0]],
      seats.length > 1 ? ['도움이 들어오는 또 다른 쪽', seats.slice(1).map((k) => NOBLE_SCENE[k]).join(', ')] : ['', ''],
      ['사람의 도움이 붙기 쉬운 해', years.length ? `${years.map((y) => `${y}년`).join(', ')} — 막힐 때 혼자 풀지 말고 아는 사람에게 먼저 물어보세요.` : ''],
      ['가까이는', soon.length ? `${soon.slice(0, 2).join(', ')}에 소개·연결이 붙기 쉬워요.` : ''],
    ]),
    basis: basis(set.map(branchChip).join(''), `천을귀인 · 일간 ${STEMS[r.chart.dayStem]} 기준 ${set.map((b) => BRANCHES[b]).join('·')}`,
      seats.length ? `명반 안 ${seats.map((k) => `${PILLAR_KR[k]} ${BRANCHES[P[k].branch]}`).join(' · ')}` : '명반 안에는 없고 해와 달로 들어옴'),
  });
}

function cardLuck(r, d) {
  let u = null; let ca = null;
  try { u = usefulGod(r.chart); ca = colorAdvice(r.chart); } catch { return null; }
  if (u?.yong == null) return null;
  const colors = (ca?.colors ?? []).join('·');
  const weak = ELEM_KEYS[u.weak ?? 0];
  const fill = ELEM_FILL[weak];
  return card({
    q: '운을 내 편으로 만드는 구체적인 행동',
    a: colors ? `${ELEM_DIR[u.yong]} 자리와 ${j(colors, '이')} 흐름을 받쳐 줘요` : `${ELEM_DIR[u.yong]} 자리가 흐름을 받쳐 줘요`,
    body: items([
      [fill ? `가장 옅은 ${fill.name} 기운 채우기` : '', fill?.how],
      ['지켜야 할 원칙', d.caution.principles.slice(0, 2).join(' ')],
      [ca?.avoid?.length ? '덜 쓰면 좋은 색' : '', ca?.avoid?.join('·')],
    ]),
    key: u.settled ? '' : '억부와 계절이 가리키는 기운이 갈려, 평생의 색이 아니라 지금 기준의 후보예요.',
    basis: basis(elemChip(u.yong) + (u.hee != null ? elemChip(u.hee) : ''),
      `용신 ${ELEMENTS[u.yong]}(${ELEMENT_HANJA[u.yong]})${u.hee != null ? ` · 희신 ${ELEMENTS[u.hee]}(${ELEMENT_HANJA[u.hee]})` : ''}`,
      u.settled ? '억부와 조후가 같은 쪽' : '억부와 조후가 갈려 지금 기준 후보'),
  });
}

function cardDont(r, d) {
  const xs = d.caution.careful;
  if (!xs.length) return null;
  const sn = d.season;
  let u = null;
  try { u = usefulGod(r.chart); } catch { /* */ }
  return card({
    q: '이것만은 하지 마세요',
    a: first(xs[0]).replace(/[.]$/, ''),
    body: items([
      ['', xs[0].slice(first(xs[0]).length).trim()],
      ...xs.slice(1, 3).map((t) => ['', t]),
      [sn?.cur?.e?.c ? `${sn.cur.from}~${sn.cur.to}년에는` : '', sn?.cur?.e?.c],
    ]),
    basis: u?.gi != null ? basis(elemChip(u.gi), `기신 ${ELEMENTS[u.gi]}(${ELEMENT_HANJA[u.gi]})`, '넘치면 흐름을 막는 기운') : '',
  });
}

function cardEvents(r) {
  let es = [];
  try { es = lifeEventItems(r); } catch { /* */ }
  const now = Number(r.input.currentYear);
  const up = es.filter((e) => e.y >= now).slice(0, 3);
  if (!up.length) return null;
  const e0 = up[0];
  const yp = yearPillar(e0.y);
  return card({
    q: '앞으로 마주할 중요한 일',
    a: `${e0.when}, ${e0.title.replace(/일$/, '일이 와요')}`,
    body: up.map((e) => `<div class="sz-ev"><p class="sz-ev-h"><b>${esc(e.when)}</b> ${esc(e.title)}</p>`
      + `${e.what ? `<p class="rp-t">${esc(e.what)}</p>` : ''}${e.prep ? `<p class="rp-t"><b>대비</b> — ${esc(e.prep)}</p>` : ''}</div>`).join(''),
    basis: basis(stemChip(yp.stem) + branchChip(yp.branch), `${e0.y}년 · ${yp.kr}년(${yp.hanja}年)`, godLine(r, yp.stem, yp.branch)),
  });
}

/**
 * 명반 풀이 카드 묶음.
 * @param {object} r readFortune 결과
 * @param {object} f readForecast 결과 — 오늘 날짜(f.today)로 열두 달을 잡는다
 */
export function renderSajuReport(r, f) {
  const d = futureDigest(r);
  let months = [];
  try { months = nextMonths(r, f.today); } catch (err) { console.warn('months', err); }
  const cards = [
    cardNature(r, d), cardSeason(r, d), cardMonths(r, months), cardCareer(r, d), cardMoney(r, d),
    cardNoble(r, d, months), cardLuck(r, d), cardDont(r, d), cardEvents(r),
  ].filter(Boolean).map((c, i) => c(i + 1)).join('');
  return `
    <section class="sz" aria-label="명반 풀이">
      ${cards}
      <p class="rp-note">여러 점술의 해석을 모은 기록이며 과학적으로 검증된 예측이 아닙니다.
        이직·투자·건강·관계 결정에서는 현실 조건과 객관적 자료를 우선해 주세요.</p>
    </section>`;
}

// ═══════════════════════════════════════════════════════════
// 궁합 — 같은 질문 카드 형식(사용자 요청 2026-11)
// 문장은 pairLoveDigest 가 이미 쓴 것(판정·관계·연애·결혼·함께 살 때·마음·고칠 점·자녀·사건)을 고르고,
// 근거 칸에는 두 사람의 글자끼리의 관계(천간 십신·지지 합충)를 적는다.
// ═══════════════════════════════════════════════════════════

/** 두 지지 사이 관계 한 마디 — 없으면 '특별한 합·충 없음' */
const branchRel = (a, b) => branchRelations(a, b).filter((x) => !x.minor).map((x) => x.kind).join('·') || '특별한 합·충 없음';
/** 문장에서 ' — ' 뒤 결론만 (궁합 사전의 "A는 '…', B는 '…' — 이 점이 닮아 …" 꼴) */
const tail = (t) => {
  const s = String(t ?? ''); const i = s.lastIndexOf(' — ');
  return first(i >= 0 ? s.slice(i + 3) : s).replace(/^이 점이 닮아/, '닮은 점이 있어').replace(/^이 차이로/, '성향 차이로');
};
/** 첫 문장이 "역할이 이렇게 나뉘면 좋습니다"처럼 뒤 문장을 가리키기만 하면 그 뒤 문장을 답으로 */
const lead = (t) => { const f = first(t); return /이렇게|다음과 같/.test(f) ? first(String(t).slice(f.length).trim()) || f : f; };

/** 두 사람의 열두 달 — 둘의 흐름 점수 평균으로 함께 움직일 달을 고른다 */
function pairMonths(rA, rB, today) {
  const a = nextMonths(rA, today); const b = nextMonths(rB, today);
  return a.map((x) => {
    const y = b.find((z) => z.y === x.y && z.m === x.m);
    return y ? { ...x, score: (x.score + y.score) / 2 } : null;
  }).filter(Boolean);
}

/**
 * @param {{A:string,B:string,rA:object,rB:object,d:object}} pd pairDigestFor 결과
 * @param {{ type?: string, today: {y,m,d} }} opt type 은 공유 카드의 궁합 이름
 */
export function renderPairSajuReport(pd, { type = '', today } = {}) {
  const { A, B, rA, rB, d } = pd;
  const PA = rA.chart.pillars; const PB = rB.chart.pillars;
  const dsA = rA.chart.dayStem; const dsB = rB.chart.dayStem;
  const gb = (good, bad) => (good.length ? `<h4 class="sz-h">좋은 점</h4>${items(good.map((t) => ['', t]))}` : '')
    + (bad.length ? `<h4 class="sz-h">아쉬운 점</h4>${items(bad.map((t) => ['', t]))}` : '');
  const cards = [];

  // 1. 어떤 궁합인가 — 판정·관계. 근거: 두 사람의 일간이 서로에게 무엇인지
  cards.push(card({
    q: '우리 두 사람은 어떤 궁합인가',
    a: type || first(d.verdict?.text),
    body: para([d.verdict?.text, d.relation]),
    basis: basis(stemChip(dsA) + stemChip(dsB), `일간 ${STEMS[dsA]}(${A}) · ${STEMS[dsB]}(${B})`,
      `${A}님에게 ${B}님은 ${tenGod(dsA, dsB)} · ${B}님에게 ${A}님은 ${tenGod(dsB, dsA)}`),
  }));

  // 2. 연애할 때 — 근거: 띠(연지)끼리
  cards.push(card({
    q: d.married ? '두 사람 사이의 설렘과 대화' : '연애할 때 우리는',
    a: tail(d.dating.good[0] ?? d.dating.bad[0]),
    body: gb(d.dating.good, d.dating.bad),
    basis: basis(branchChip(PA.year.branch) + branchChip(PB.year.branch),
      `연지 ${BRANCHES[PA.year.branch]} · ${BRANCHES[PB.year.branch]} (${ZODIAC_OF(PA.year.branch)}띠 · ${ZODIAC_OF(PB.year.branch)}띠)`, branchRel(PA.year.branch, PB.year.branch)),
  }));

  // 3. 결혼하면 — 근거: 배우자 자리(일지)끼리
  cards.push(card({
    q: d.married ? '함께 사는 일' : '결혼하면 우리는',
    a: lead(d.marriage.good[0] ?? d.marriage.bad[0]),
    body: gb(d.marriage.good, d.marriage.bad),
    basis: basis(branchChip(PA.day.branch) + branchChip(PB.day.branch), `배우자 자리(일지) ${BRANCHES[PA.day.branch]} · ${BRANCHES[PB.day.branch]}`,
      branchRel(PA.day.branch, PB.day.branch)),
  }));

  // 4. 함께 산다면 — 재산·육아·일. 근거: 두 사람의 재성 수
  const home = d.home ?? [];
  if (home.length) {
    const cnt = (r) => tenGodDistribution(r.chart.pillars, r.chart.dayStem).groups.재성;
    cards.push(card({
      q: d.married ? '함께 살며 — 재산·육아·일' : '함께 산다면 — 재산·육아·일',
      a: first(home[0][1]),
      body: items(home.map(([k, t], i) => [k, i ? t : t.slice(first(t).length).trim()])),
      basis: basis('', `재성(財星) ${A} ${cnt(rA)}개 · ${B} ${cnt(rB)}개`, '돈과 현실을 다루는 기운의 수'),
    }));
  }

  // 5. 서로 알아 둘 마음
  if (d.care?.length) {
    cards.push(card({
      q: '서로에게 바라는 것',
      a: `${B}님은 ${first(d.wants?.b ?? '')}`.replace(/님은 $/, ''),
      body: items(d.care),
    }));
  }

  // 6. 각자 고칠 점 — '이것만은 하지 마세요'
  if (d.fix?.length) {
    cards.push(card({
      q: '이것만은 하지 마세요',
      a: `${d.fix[0][0]}, ${first(d.fix[0][1])}`,
      body: items(d.fix.map(([who, t], i) => [who, i ? t : t.slice(first(t).length).trim()])),
    }));
  }

  // 7. 함께 움직일 달 — 둘의 흐름 평균
  let months = [];
  try { months = today ? pairMonths(rA, rB, today) : []; } catch (err) { console.warn('pair months', err); }
  if (months.length >= 6) {
    const ranked = [...months].sort((x, y) => y.score - x.score);
    const good = ranked.slice(0, 3); const bad = ranked.slice(-2).filter((x) => !good.includes(x));
    const byTime = (xs) => xs.sort((x, y) => x.y * 12 + x.m - (y.y * 12 + y.m));
    const label = (x) => `${x.y}년 ${x.m}월`;
    const top = good[0];
    const rel = (r) => branchRel(r.chart.pillars.day.branch, top.gz.branch);
    cards.push(card({
      q: '앞으로 열두 달, 둘이 함께 움직일 달',
      a: `${label(top)}에 두 사람의 흐름이 가장 잘 맞아요`,
      body: `<h4 class="sz-h">함께 움직일 달</h4>${items(byTime(good).map((x) => [`${label(x)} · ${x.d}일부터`, '중요한 대화·여행·결정을 이달에 잡아 보세요.']))}`
        + (bad.length ? `<h4 class="sz-h">숨 고를 달</h4>${items(byTime(bad).map((x) => [`${label(x)} · ${x.d}일부터`, '큰 결정은 미루고 서로의 컨디션을 먼저 살피세요.']))}` : ''),
      key: '두 사람 각자의 달 흐름을 평균해 고른 달이에요.',
      basis: basis(stemChip(top.gz.stem) + branchChip(top.gz.branch), `${label(top)} · ${top.gz.kr}월(${top.gz.hanja}月)`,
        `${A}님 일지와 ${rel(rA)} · ${B}님 일지와 ${rel(rB)}`),
    }));
  }

  // 8. 자녀 — 몇 명을 낳는다는 예측이 아니라 권하는 말(report.js kidsAdvice)
  if (d.kids?.length) {
    cards.push(card({
      q: d.married ? '아이가 두 사람에게 주는 의미' : '자녀와 함께라면',
      a: first(d.kids[0][1]),
      body: items(d.kids.map(([k, t], i) => (i ? [k, t] : ['', t.slice(first(t).length).trim()]))),
      basis: (PA.hour && PB.hour) ? basis(branchChip(PA.hour.branch) + branchChip(PB.hour.branch),
        `자녀 자리(시지) ${BRANCHES[PA.hour.branch]} · ${BRANCHES[PB.hour.branch]}`, branchRel(PA.hour.branch, PB.hour.branch)) : '',
    }));
  }

  // 9. 앞으로 마주할 일
  const now = Number(rA.input.currentYear);
  const up = (d.events ?? []).filter((e) => e.y >= now).slice(0, 3);
  if (up.length) {
    const yp = yearPillar(up[0].y);
    cards.push(card({
      q: '앞으로 두 사람이 마주할 중요한 일',
      a: `${up[0].when}, ${up[0].title.replace(/일$/, '일이 와요')}`,
      body: up.map((e) => `<div class="sz-ev"><p class="sz-ev-h"><b>${esc(e.when)}</b> ${esc(e.title)}</p>`
        + `${e.what ? `<p class="rp-t">${esc(e.what)}</p>` : ''}${e.prep ? `<p class="rp-t"><b>대비</b> — ${esc(e.prep)}</p>` : ''}</div>`).join(''),
      basis: basis(stemChip(yp.stem) + branchChip(yp.branch), `${up[0].y}년 · ${yp.kr}년(${yp.hanja}年)`,
        `${A}님 일지와 ${branchRel(PA.day.branch, yp.branch)} · ${B}님 일지와 ${branchRel(PB.day.branch, yp.branch)}`),
    }));
  }

  return `
    <section class="sz" aria-label="궁합 풀이">
      ${cards.filter(Boolean).map((c, i) => c(i + 1)).join('')}
      <p class="rp-note">점술은 상징적 해석 도구이며 실제 미래를 확정하지 않습니다.
        결혼·이별·임신·투자·건강과 관련된 결정은 두 사람의 대화와 전문가의 객관적 조언을 우선해 주세요.</p>
    </section>`;
}
