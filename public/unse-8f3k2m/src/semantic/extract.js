/**
 * extract.js — LEVEL 1 → LEVEL 2. **기호를 집는 자리**
 *
 * 계산은 하지 않는다. `readFortune` 과 `hires/` 가 이미 구한 값에서
 * "그 전통이 이 질문을 보라고 지정한 자리"의 기호 하나씩을 꺼낼 뿐이다.
 *
 * ── 없으면 없다고 한다 ────────────────────────────────────
 * 기호를 못 꺼내는 경우가 세 가지다. 셋을 **구별해서** 적는다.
 *
 *   unavailable      시각 미상처럼 재료가 없어 판을 못 세운다
 *   not_applicable   그 전통에 이 질문을 보는 자리가 아예 없다
 *   empty            자리는 섰는데 비었다 (공궁 등)
 *
 * 셋을 뭉뚱그려 '없음'으로 적으면 나중에 채점할 때 **모르는 것과 답이
 * 없는 것이 같은 칸**에 들어간다. 그러면 침묵이 오답으로 세어진다.
 */

import * as ZE from '../hires/ziweiExt.js';
import * as VE from '../hires/vedicExt.js';
import * as WS from '../hires/western.js';
import * as IN from '../hires/interpret.js';
import { DOMICILE } from '../hires/classical.js';
import { houseOf } from '../core/planets.js';
import { tenGod, TEN_GOD_GROUP, elementDistribution } from '../core/ganzhi.js';

/** 열다섯 체계의 id — 화면 순서와 같다 */
export const SYSTEM_IDS = [
  'saju', 'jamidusu', 'astrology', 'vedic',
  'juyeok', 'yukim', 'hongguk', 'taeeul',
  'gujeong', 'sukyo', 'tojeong',
  'kabbalah', 'mahabote', 'thai', 'tarot',
];

export const SYSTEM_NAME = {
  saju: '사주', jamidusu: '자미두수', astrology: '점성술', vedic: '베딕',
  juyeok: '주역', yukim: '육임', hongguk: '홍국기문', taeeul: '태을신수',
  gujeong: '구성학', sukyo: '숙요', tojeong: '토정비결',
  kabbalah: '카발라', mahabote: '마하보테', thai: '태국 점성술', tarot: '타로',
};

/**
 * 분야마다 **그 전통에 전용 자리가 있는 체계**.
 *
 * `src/interpretation/capabilities.js` 가 같은 취지로 먼저 적어 둔 것을
 * 분야 이름만 새 축에 맞춰 옮겼다. 여기 없는 체계는 '틀렸다'가 아니라
 * **원래 그것을 보는 물건이 아니다**(not_applicable).
 */
export const DOMAIN_SEATS = {
  career: SYSTEM_IDS,   // 직업만은 열다섯이 모두 자기 표를 가지고 있다
  relationship: ['saju', 'jamidusu', 'astrology', 'vedic'],
  children: ['saju', 'jamidusu', 'vedic'],
  education: ['saju'],
  residence: ['jamidusu', 'vedic'],
  wealth: ['saju', 'jamidusu'],
  health: ['saju', 'jamidusu'],
};

const NA = (systemId, domain, why) => ({
  system: systemId, domain, status: 'not_applicable', why,
});
const UNAVAIL = (systemId, domain, why) => ({
  system: systemId, domain, status: 'unavailable', why,
});

const safe = (fn) => { try { return fn(); } catch { return null; } };

// ─────────────────────────────────────────────────────────────
// 사주 — 십성 무리를 센다
// ─────────────────────────────────────────────────────────────

/** 천간 넷의 십성 무리 분포 + 월간 격. interpret.js 의 sajuRead 와 같은 독법 */
export function sajuFacts(chart) {
  if (!chart?.pillars?.month) return null;
  const dist = {};
  for (const k of ['year', 'month', 'day', 'hour']) {
    const p = chart.pillars[k];
    if (!p) continue;
    const g = TEN_GOD_GROUP?.[tenGod(chart.dayStem, p.stem)];
    if (g) dist[g] = (dist[g] ?? 0) + 1;
  }
  const stemGod = tenGod(chart.dayStem, chart.pillars.month.stem);
  const monthGroup = TEN_GOD_GROUP?.[stemGod] ?? null;
  const top = Object.entries(dist).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  const el = elementDistribution(chart.pillars);
  return {
    dist, stemGod, monthGroup, top,
    lead: monthGroup ?? top,
    // 오행이 얼마나 쏠려 있는가. 부위·질환을 말하는 값이 아니다
    elementSpread: el ? Math.max(...el.pct) - Math.min(...el.pct) : null,
  };
}

// ─────────────────────────────────────────────────────────────
// 자미두수 — 궁마다 주성을 꺼낸다
// ─────────────────────────────────────────────────────────────

/**
 * 궁 하나의 원국 층을 읽는다. 공궁이면 대궁(마주 보는 궁)을 빌린다 —
 * 두수 표준 독법이고 `interpret.js` 가 이미 같은 방식을 쓴다.
 */
function palaceRow(input, stack, domain, name) {
  const rows = ZE.domainPalaces(input, domain, stack.layers).find((x) => x.palace === name)?.rows ?? [];
  const row = rows.find((r) => /원국/.test(r.layer ?? '')) ?? null;
  if (!row) return null;
  let main = row.main ?? [];
  let borrowed = false;
  if (!main.length && row.branch != null) {
    const opp = ZE.trineSquare(row.branch).opposite;
    const board = stack.board?.board ?? null;
    if (board?.[opp]) {
      main = board[opp].filter((s) => IN.ZIWEI_TRADE[s]);
      borrowed = main.length > 0;
    }
  }
  return { ...row, main, borrowed };
}

export function ziweiFacts(input, stack) {
  if (!stack) return null;
  return {
    career: safe(() => palaceRow(input, stack, '직업', '관록궁')),
    spouse: safe(() => palaceRow(input, stack, '결혼', '부처궁')),
    child: safe(() => palaceRow(input, stack, '자녀', '자녀궁')),
    home: safe(() => palaceRow(input, stack, '주거', '전택궁')),
    money: safe(() => palaceRow(input, stack, '재물', '재백궁')),
    illness: safe(() => palaceRow(input, stack, '건강', '질액궁')),
  };
}

// ─────────────────────────────────────────────────────────────
// 점성술 — 하우스와 그 주인
// ─────────────────────────────────────────────────────────────

const QUALITY = ['활동', '고정', '변통'];
const signOf = (lon) => Math.floor((((lon % 360) + 360) % 360) / 30);

export function westernFacts(input) {
  if (!input?.timeKnown) return null;
  const N = safe(() => WS.natalPack(input));
  if (!N?.cusps) return null;
  const mc = signOf(N.cusps[10]);
  // 7하우스 이른/늦은 쪽 — interpret.js 의 marriageRead 와 **같은 규칙**이다.
  // 두 자리에 같은 규칙을 두 번 쓰지 않으려고 여기서는 근거만 세고,
  // 방향을 정하는 일은 rules.js 의 seventh:early / seventh:late 가 한다.
  const sign7 = signOf(N.cusps[7]);
  const lord = DOMICILE[sign7] ?? null;
  return { N, mcSign: mc, mcSignName: IN.SIGN_NAME[mc], mcQuality: QUALITY[mc % 3], sign7, lord };
}

// ─────────────────────────────────────────────────────────────
// 베딕 — 분할도
// ─────────────────────────────────────────────────────────────

const BENEFIC = new Set(VE.NATURAL_BENEFIC);
const MALEFIC = new Set(VE.NATURAL_MALEFIC);

export function vedicFacts(input) {
  const wp = safe(() => VE.wealthPack(input));
  const mp = safe(() => VE.marriagePack(input));
  const cp = safe(() => VE.childrenPack(input));
  const hp = safe(() => VE.homePack(input));
  if (!wp && !mp && !cp && !hp) return null;
  return { wp, mp, cp, hp };
}

// ─────────────────────────────────────────────────────────────
// 분야별 추출 — 체계 하나가 무엇을 말하는가
// ─────────────────────────────────────────────────────────────

/**
 * 직업 — 열다섯이 전부 말한다.
 * @returns {Array<{system, domain, status, symbols?, basis?, why?}>}
 */
export function careerReads(f) {
  const out = [];

  // 사주
  out.push(f.saju?.lead
    ? { system: 'saju', domain: 'career', status: 'ok', symbols: [f.saju.lead],
        basis: `월간 ${f.saju.stemGod}(${f.saju.monthGroup ?? '—'}) · 천간 최다 ${f.saju.top ?? '—'}` }
    : UNAVAIL('saju', 'career', '월주를 세우지 못했다'));

  // 자미두수
  if (!f.ziwei) out.push(UNAVAIL('jamidusu', 'career', '출생 시각을 알아야 판을 세운다'));
  else if (!f.ziwei.career?.main?.length) out.push({ system: 'jamidusu', domain: 'career', status: 'empty', why: '관록궁이 비었고 대궁도 비었다' });
  else out.push({ system: 'jamidusu', domain: 'career', status: 'ok', symbols: f.ziwei.career.main,
    basis: f.ziwei.career.borrowed ? `원국 관록궁 공궁 → 대궁 ${f.ziwei.career.main.join('·')}` : `원국 관록궁 ${f.ziwei.career.main.join('·')}` });

  // 점성술
  out.push(f.western
    ? { system: 'astrology', domain: 'career', status: 'ok', symbols: [f.western.mcSignName],
        form: f.western.mcQuality, basis: `10하우스 ${f.western.mcSignName}(${f.western.mcQuality})` }
    : UNAVAIL('astrology', 'career', '출생 시각을 알아야 하우스를 세운다'));

  // 베딕 — D10 라그나주와 10궁주
  const lords = [f.vedic?.wp?.d10_1?.lord, f.vedic?.wp?.d10_10?.lord].filter(Boolean);
  out.push(lords.length
    ? { system: 'vedic', domain: 'career', status: 'ok', symbols: [...new Set(lords)],
        basis: `D10 라그나 ${f.vedic.wp.d10Lagna ?? '—'} 주인 ${f.vedic.wp.d10_1?.lord ?? '—'} · D10 10궁주 ${f.vedic.wp.d10_10?.lord ?? '—'}` }
    : UNAVAIL('vedic', 'career', '차트를 세우지 못했다'));

  // 나머지 열하나 — 기호를 집는 일은 interpret.js 가 한다
  for (const s of f.aux) {
    out.push(s.unavailable
      ? UNAVAIL(s.id, 'career', s.unavailable)
      : { system: s.id, domain: 'career', status: 'ok', symbols: [s.symbol], basis: s.basis });
  }
  return out;
}

/** 조건 하나를 만든다 — rules.js 의 condition 키와 짝이 맞아야 한다 */
const cond = (system, domain, condition, basis) => ({ system, domain, status: 'ok', condition, basis });

const countBand = (n) => (n === 0 ? '0' : n === 1 ? '1' : '2+');

export function relationshipReads(f, gender) {
  const out = [];

  // 사주 — 여자는 관성, 남자는 재성 (명리 표준)
  const want = IN.SAJU_SPOUSE_GOD[gender];
  if (!f.saju || !want) out.push(UNAVAIL('saju', 'relationship', '배우자 십성을 세지 못했다'));
  else {
    const n = f.saju.dist[want] ?? 0;
    out.push(cond('saju', 'relationship', `spouseGod:${countBand(n)}`, `천간 ${want} ${n}개`));
  }

  // 자미 — 부처궁 정성/동성
  if (!f.ziwei) out.push(UNAVAIL('jamidusu', 'relationship', '출생 시각을 알아야 판을 세운다'));
  else {
    const stars = f.ziwei.spouse?.main ?? [];
    const shaky = stars.some((s) => IN.ZIWEI_MARRY_SHAKY.includes(s));
    const stable = stars.some((s) => IN.ZIWEI_MARRY_STABLE.includes(s));
    out.push(!stars.length ? { system: 'jamidusu', domain: 'relationship', status: 'empty', why: '부처궁 공궁' }
      : shaky && !stable ? cond('jamidusu', 'relationship', 'spouse:shaky', `부처궁 ${stars.join('·')}`)
      : stable && !shaky ? cond('jamidusu', 'relationship', 'spouse:stable', `부처궁 ${stars.join('·')}`)
      : { system: 'jamidusu', domain: 'relationship', status: 'empty', why: `부처궁 ${stars.join('·')} — 정성과 동성이 섞였다` });
  }

  // 점성 — 7하우스·주인·혼인 자연지표
  if (!f.western) out.push(UNAVAIL('astrology', 'relationship', '출생 시각을 알아야 하우스를 세운다'));
  else {
    const m = seventhHouseTone(f.western, gender);
    out.push(m.dir
      ? cond('astrology', 'relationship', `seventh:${m.dir}`, m.basis)
      : { system: 'astrology', domain: 'relationship', status: 'empty', why: `7하우스 표시가 팽팽하다 — ${m.basis}` });
  }

  // 베딕 — 7궁주 자리와 7궁 거주 행성
  const d7 = f.vedic?.mp?.d1_7 ?? null;
  if (!d7) out.push(UNAVAIL('vedic', 'relationship', '차트를 세우지 못했다'));
  else {
    if ([6, 8, 12].includes(d7.lordIn)) out.push(cond('vedic', 'relationship', 'seventhLord:dusthana', `D1 7궁주 ${d7.lord} ${d7.lordIn}하우스`));
    else if ([1, 4, 7, 10].includes(d7.lordIn)) out.push(cond('vedic', 'relationship', 'seventhLord:angle', `D1 7궁주 ${d7.lord} ${d7.lordIn}하우스(앵글)`));
    const occ = d7.occupants ?? [];
    if (occ.some((p) => MALEFIC.has(p))) out.push(cond('vedic', 'relationship', 'seventh:malefic', `D1 7궁 ${occ.filter((p) => MALEFIC.has(p)).join('·')}`));
    if (occ.some((p) => BENEFIC.has(p))) out.push(cond('vedic', 'relationship', 'seventh:benefic', `D1 7궁 ${occ.filter((p) => BENEFIC.has(p)).join('·')}`));
    if (![6, 8, 12, 1, 4, 7, 10].includes(d7.lordIn) && !occ.length) {
      out.push({ system: 'vedic', domain: 'relationship', status: 'empty', why: `D1 7궁주 ${d7.lord} ${d7.lordIn}하우스 — 전통이 방향을 정해 둔 자리가 아니다` });
    }
  }
  return out;
}

/**
 * 7하우스가 이른 쪽인가 늦는 쪽인가.
 *
 * `interpret.js` 의 `marriageRead` 와 **같은 전통 규칙**이다. 그쪽은 문장을
 * 만들고 이쪽은 방향만 낸다. 규칙이 갈라지지 않도록 테스트가 두 결과를
 * 맞대어 본다 (`tests/unse/semantic.test.mjs`).
 */
function seventhHouseTone(w, gender) {
  const { N, sign7, lord } = w;
  const inSeventh = Object.entries(N.pos)
    .filter(([, v]) => houseOf(v.lon, N.cusps) === 7).map(([k]) => k);
  let late = 0, early = 0;
  const why = [];
  for (const p of inSeventh) {
    if (p === '토성' || p === '화성') { late++; why.push(`7하우스 ${p}`); }
    if (p === '금성' || p === '목성' || p === '달') { early++; why.push(`7하우스 ${p}`); }
  }
  const lordLon = lord ? N.pos?.[lord]?.lon : null;
  const lordHouse = lordLon == null ? null : houseOf(lordLon, N.cusps);
  if (lordHouse != null) {
    if ([6, 8, 12].includes(lordHouse)) { late++; why.push(`7주인 ${lord} ${lordHouse}하우스`); }
    if ([1, 4, 7, 10].includes(lordHouse)) { early++; why.push(`7주인 ${lord} ${lordHouse}하우스(앵글)`); }
  }
  if (lord && N.pos?.[lord]?.retrograde) { late++; why.push(`7주인 ${lord} 역행`); }
  const kara = gender === 'male' ? '금성' : '화성';
  const karaHouse = N.pos?.[kara] ? houseOf(N.pos[kara].lon, N.cusps) : null;
  if (karaHouse != null) {
    if ([6, 8, 12].includes(karaHouse)) { late++; why.push(`${kara} ${karaHouse}하우스`); }
    if ([1, 4, 7, 10].includes(karaHouse)) { early++; why.push(`${kara} ${karaHouse}하우스(앵글)`); }
  }
  const basis = `7하우스 ${IN.SIGN_NAME[sign7]} · 주인 ${lord ?? '—'}` + (why.length ? ` · ${why.join(', ')}` : '');
  return { dir: early > late ? 'early' : late > early ? 'late' : null, basis, early, late };
}

export function childrenReads(f) {
  const out = [];
  if (!f.saju) out.push(UNAVAIL('saju', 'children', '천간을 세지 못했다'));
  else {
    const n = f.saju.dist[IN.SAJU_CHILD_GOD] ?? 0;
    out.push(cond('saju', 'children', `childGod:${countBand(n)}`, `천간 식상 ${n}개`));
  }

  if (!f.ziwei) out.push(UNAVAIL('jamidusu', 'children', '출생 시각을 알아야 판을 세운다'));
  else {
    const stars = f.ziwei.child?.main ?? [];
    const many = stars.some((s) => IN.ZIWEI_CHILD_MANY.includes(s));
    const few = stars.some((s) => IN.ZIWEI_CHILD_FEW.includes(s));
    out.push(!stars.length ? { system: 'jamidusu', domain: 'children', status: 'empty', why: '자녀궁 공궁' }
      : many && !few ? cond('jamidusu', 'children', 'child:many', `자녀궁 ${stars.join('·')}`)
      : few && !many ? cond('jamidusu', 'children', 'child:few', `자녀궁 ${stars.join('·')}`)
      : { system: 'jamidusu', domain: 'children', status: 'empty', why: `자녀궁 ${stars.join('·')} — 갈리지 않는다` });
  }

  const d5 = f.vedic?.cp?.d1_5 ?? null;
  if (!d5) out.push(UNAVAIL('vedic', 'children', '차트를 세우지 못했다'));
  else {
    const occ = d5.occupants ?? [];
    const mal = occ.filter((p) => MALEFIC.has(p));
    const ben = occ.filter((p) => BENEFIC.has(p));
    if (mal.length) out.push(cond('vedic', 'children', 'fifth:malefic', `D1 5궁 ${mal.join('·')}`));
    if (ben.length) out.push(cond('vedic', 'children', 'fifth:benefic', `D1 5궁 ${ben.join('·')}`));
    if (!mal.length && !ben.length) out.push({ system: 'vedic', domain: 'children', status: 'empty', why: 'D1 5궁이 비었다' });
  }
  return out;
}

export function educationReads(f) {
  if (!f.saju) return [UNAVAIL('saju', 'education', '천간을 세지 못했다')];
  const n = f.saju.dist[IN.SAJU_SCHOOL_GOD] ?? 0;
  return [cond('saju', 'education', n > 0 ? 'schoolGod:1+' : 'schoolGod:0', `천간 인성 ${n}개`)];
}

export function residenceReads(f) {
  const out = [];
  if (!f.ziwei) out.push(UNAVAIL('jamidusu', 'residence', '출생 시각을 알아야 판을 세운다'));
  else {
    const row = f.ziwei.home;
    let stars = row?.main ?? [];
    if (!stars.length && row?.branch != null) stars = [];
    const own = stars.filter((s) => IN.ZIWEI_HOME_OWN.includes(s));
    const move = stars.filter((s) => IN.ZIWEI_HOME_MOVE.includes(s));
    out.push(own.length && !move.length ? cond('jamidusu', 'residence', 'home:own', `전택궁 ${stars.join('·')}`)
      : move.length && !own.length ? cond('jamidusu', 'residence', 'home:move', `전택궁 ${stars.join('·')}`)
      : { system: 'jamidusu', domain: 'residence', status: 'empty', why: `전택궁 ${stars.join('·') || '공궁'} — 가르지 못한다` });
  }

  const hp = f.vedic?.hp ?? null;
  if (!hp) out.push(UNAVAIL('vedic', 'residence', '차트를 세우지 못했다'));
  else {
    const travel = [hp.d1_3, hp.d1_9, hp.d1_12].reduce((t, h) => t + (h?.occupants?.length ?? 0), 0);
    const fourth = (hp.d1_4?.occupants?.length ?? 0) + ([1, 4, 7, 10].includes(hp.d1_4?.lordIn) ? 1 : 0);
    out.push(travel >= 3 ? cond('vedic', 'residence', 'travelHouses:strong', `D1 3·9·12 거주 ${travel}개`)
      : fourth >= 2 ? cond('vedic', 'residence', 'fourth:strong', `D1 4궁 거주·주인 ${fourth}`)
      : { system: 'vedic', domain: 'residence', status: 'empty', why: '이동·정착 어느 쪽도 두드러지지 않는다' });
  }
  return out;
}

export function wealthReads(f) {
  const out = [];
  if (!f.saju) out.push(UNAVAIL('saju', 'wealth', '천간을 세지 못했다'));
  else {
    const d = f.saju.dist;
    const said = [];
    if ((d['재성'] ?? 0) >= 2) said.push(cond('saju', 'wealth', 'wealthGod:2+', `천간 재성 ${d['재성']}개`));
    else if ((d['재성'] ?? 0) === 1) said.push(cond('saju', 'wealth', 'wealthGod:1', '천간 재성 1개'));
    if ((d['식상'] ?? 0) >= 1) said.push(cond('saju', 'wealth', 'outputGod:1+', `천간 식상 ${d['식상']}개`));
    if ((d['비겁'] ?? 0) >= 2) said.push(cond('saju', 'wealth', 'peerGod:2+', `천간 비겁 ${d['비겁']}개`));
    if ((d['관성'] ?? 0) >= 1) said.push(cond('saju', 'wealth', 'officerGod:1+', `천간 관성 ${d['관성']}개`));
    out.push(...(said.length ? said : [{ system: 'saju', domain: 'wealth', status: 'empty', why: '천간에 재물 자리가 서지 않았다' }]));
  }

  if (!f.ziwei) out.push(UNAVAIL('jamidusu', 'wealth', '출생 시각을 알아야 판을 세운다'));
  else {
    const stars = f.ziwei.money?.main ?? [];
    const shaky = stars.some((s) => IN.ZIWEI_MARRY_SHAKY.includes(s));   // 동성(파군·칠살·탐랑·염정)
    const stable = stars.some((s) => IN.ZIWEI_MARRY_STABLE.includes(s)); // 정성
    out.push(!stars.length ? { system: 'jamidusu', domain: 'wealth', status: 'empty', why: '재백궁 공궁' }
      : shaky && !stable ? cond('jamidusu', 'wealth', 'money:shaky', `재백궁 ${stars.join('·')}`)
      : stable && !shaky ? cond('jamidusu', 'wealth', 'money:stable', `재백궁 ${stars.join('·')}`)
      : { system: 'jamidusu', domain: 'wealth', status: 'empty', why: `재백궁 ${stars.join('·')} — 갈리지 않는다` });
  }
  return out;
}

export function healthReads(f) {
  const out = [];
  if (f.saju?.elementSpread == null) out.push(UNAVAIL('saju', 'health', '오행을 세지 못했다'));
  else out.push(cond('saju', 'health',
    f.saju.elementSpread >= 25 ? 'elementSpread:high' : 'elementSpread:low',
    `오행 최다−최소 ${f.saju.elementSpread.toFixed(1)}%p`));

  if (!f.ziwei) out.push(UNAVAIL('jamidusu', 'health', '출생 시각을 알아야 판을 세운다'));
  else {
    const evil = f.ziwei.illness?.evil ?? [];
    out.push(evil.length
      ? cond('jamidusu', 'health', 'illness:evil', `질액궁 ${evil.join('·')}`)
      : { system: 'jamidusu', domain: 'health', status: 'empty', why: '질액궁에 살성이 없다' });
  }
  return out;
}

/**
 * 한 사람의 모든 분야를 한 번에 꺼낸다.
 *
 * @param {object} fortune `readFortune` 결과
 * @param {object|null} stack `ZW.stackAt` 결과 (시각 미상이면 null)
 */
export function extractAll(fortune, stack) {
  const { input, chart, results } = fortune;
  const f = {
    saju: safe(() => sajuFacts(chart)),
    ziwei: safe(() => ziweiFacts(input, stack)),
    western: safe(() => westernFacts(input)),
    vedic: safe(() => vedicFacts(input)),
    aux: safe(() => IN.auxSymbols(results ?? [])) ?? [],
  };

  const byDomain = {
    career: careerReads(f),
    relationship: relationshipReads(f, input.gender),
    children: childrenReads(f),
    education: educationReads(f),
    residence: residenceReads(f),
    wealth: wealthReads(f),
    health: healthReads(f),
  };

  // 자리가 없는 체계는 **not_applicable 로 분명히 적는다.** 빈칸으로 두면
  // 나중에 '말하지 않았다'와 '볼 자리가 없다'가 구별되지 않는다.
  for (const [domain, seats] of Object.entries(DOMAIN_SEATS)) {
    const said = new Set(byDomain[domain].map((x) => x.system));
    for (const id of SYSTEM_IDS) {
      if (said.has(id)) continue;
      byDomain[domain].push(seats.includes(id)
        ? UNAVAIL(id, domain, '이번 계산에서 값이 나오지 않았다')
        : NA(id, domain, '이 전통에는 이 분야를 따로 보는 자리가 없다'));
    }
  }
  return { facts: f, byDomain };
}
