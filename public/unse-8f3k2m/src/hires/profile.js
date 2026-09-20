/**
 * profile.js — "결혼운이 있다"를 "어떤 사람과, 어떤 모양으로"까지 내린다
 *
 * events.js 가 **언제**를 좁힌다면 여기는 **무엇을·누구와**를 좁힌다.
 * 배우자·직업·자녀·주거를 각각 별도 모델로 읽는다.
 *
 * ── 이 파일이 지키는 선 ────────────────────────────────────
 * 여기서 만드는 것은 전부 **해석**이다. 계산이 아니다. 다만 아무 말이나
 * 지어내지 않도록 두 가지를 강제한다.
 *
 *   1) 모든 항목에 근거(basis)를 단다. 어느 체계의 어느 자리에서 나왔는지
 *      적지 못하면 그 항목은 만들지 않는다.
 *   2) 숫자는 **범위**로만 낸다. 나이차·인원·규모는 명반에서 직접 나오지
 *      않으므로 `estimate: true` 를 달고 범위로 표시한다. 하나의 정확한
 *      값으로 굳히지 않는다.
 *
 * 대응표는 각 전통이 원래 그렇게 읽으라고 지정해 둔 것만 쓴다.
 *   베딕 — 카라카(행성이 무엇을 관장하는가), 7궁·7궁주, 우파파다,
 *          다라카라카, D9·D7·D10·D4
 *   자미 — 부처궁·관록궁·자녀궁·전택궁의 주성과 길성·살성
 *   사주 — 십신(관성=배우자·직책, 재성=돈, 인성=문서·집)
 *   서양 — 7·10·4·5하우스, 금성·목성·토성
 */

import { j } from '../core/josa.js';
import * as VE from './vedicExt.js';
import * as ZE from './ziweiExt.js';
import { HOUSE_TOPIC } from './westernExt.js';

// ─────────────────────────────────────────────────────────────
// 단언의 등급 — 근거가 얼마나 모였는가
// ─────────────────────────────────────────────────────────────

/**
 * Tier — 답변에서 얼마나 세게 말해도 되는가.
 *
 * 단언은 **근거의 강도를 드러내는 표현 방식**이지, 빈자리를 채우는
 * 허가증이 아니다. 아래 등급은 그 선을 숫자로 고정한 것이다.
 *
 * @param {string[]} coreSystems 같은 쪽을 가리킨 핵심 체계 (사주·자미두수·점성술·베딕)
 * @param {string[]} timingTechs 시기를 같이 짚은 세부 기법 (다샤·솔라아크·프로펙션·유년사화 …)
 */
export function tierOf(coreSystems = [], timingTechs = []) {
  const c = new Set(coreSystems).size;
  const t = new Set(timingTechs).size;
  if (c >= 3 && t >= 2) {
    return { tier: 'S', voice: '단언',
      how: '"이 시기에 ~한다" 처럼 단언해도 된다. 답 말미에 한 번만 점술 모델의 최우선 시나리오라고 밝힌다.',
      core: c, timing: t };
  }
  if (c >= 2 && t >= 1) {
    return { tier: 'A', voice: '강한 단정',
      how: '"가장 강하게 나타나는 것은 ~이다", "실제로는 ~ 형태로 나타날 가능성이 높다" 로 쓴다.',
      core: c, timing: t };
  }
  if (c >= 1) {
    return { tier: 'B', voice: '조건부',
      how: '"두 번째 시나리오는 ~이다" 로 쓴다. 주 시나리오 자리에 놓지 않는다.',
      core: c, timing: t };
  }
  return { tier: 'C', voice: '추정',
    how: '"이 부분은 초구체화 추정이다" 라고 밝히고 쓴다.', core: c, timing: t };
}

/** 항목 하나 — 근거 없이 만들지 못하게 basis 를 필수로 받는다 */
const item = (axis, value, basis, opts = {}) => {
  const b = (basis ?? []).filter(Boolean);
  if (!b.length || value == null) return null;    // 근거가 없으면 항목 자체를 만들지 않는다
  return { axis, value, basis: b, estimate: !!opts.estimate, tier: opts.tier ?? null };
};

/** 두 쪽 표를 세어 한쪽을 고른다. 팽팽하면 null 을 돌려준다 */
function lean(scores) {
  const rows = Object.entries(scores).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return null;
  const total = rows.reduce((t, [, v]) => t + v, 0);
  const [name, top] = rows[0];
  const second = rows[1]?.[1] ?? 0;
  return {
    name, share: top / total,
    clear: top - second >= Math.max(1, total * 0.2),
    runnerUp: rows[1]?.[0] ?? null,
  };
}

// ─────────────────────────────────────────────────────────────
// 배우자 프로파일
// ─────────────────────────────────────────────────────────────

/** 행성이 관장하는 직업 결 — 베딕의 카라카 의미 그대로 */
const PLANET_TRADE = {
  태양: '공공·행정·관리직, 권위가 있는 자리',
  달: '돌봄·서비스·유통처럼 사람과 흐름을 다루는 일',
  화성: '기술·공학·의료·군경처럼 손과 판단이 곧 결과가 되는 일',
  수성: '상업·문서·IT·교육처럼 말과 셈을 다루는 일',
  목성: '교육·법률·금융·상담처럼 가르치고 판단해 주는 일',
  금성: '예술·디자인·미용·접객처럼 감각과 관계를 파는 일',
  토성: '제조·건설·행정처럼 오래 걸리고 책임이 무거운 일',
  라후: '신기술·외국·비정통 — 정해진 틀 밖의 일',
  케투: '기술 하나로 파고드는 일, 또는 드러나지 않는 자리',
};

/**
 * 자미 주성이 그리는 '일의 결'.
 *
 * `trade` 는 **어느 궁에서 읽느냐에 따라 누구의 일인지가 달라질 뿐** 같은 표다.
 * 부처궁에서 읽으면 상대의 일, 관록궁에서 읽으면 본인의 일이다. 오히려
 * 관록궁이 이 표의 본래 자리다.
 *
 * 원래는 부처궁에만 걸어 두어서, 엔진이 "배우자는 이런 일을 한다"는 말할 수
 * 있어도 "본인은 이런 일을 한다"는 못 했다. 같은 표를 관록궁에도 댄다.
 *
 * `older`·`stable`·`income` 은 **상대를 볼 때만** 뜻이 있다(나이 차·안정성·
 * 수입). 관록궁에서는 쓰지 않는다.
 */
const MAIN_STAR = {
  자미: { trade: '조직에서 자리를 맡는 사람', older: 1, stable: 2, income: 1 },
  천부: { trade: '모으고 지키는 실무·재무 쪽', older: 1, stable: 2, income: 2 },
  무곡: { trade: '돈과 기술을 직접 다루는 실무형', older: 0, stable: 1, income: 2 },
  천상: { trade: '조율하고 보좌하는 자리', older: 0, stable: 2, income: 1 },
  천량: { trade: '원칙을 세우고 돌보는 일, 연장자 같은 사람', older: 2, stable: 2, income: 0 },
  태양: { trade: '드러나는 자리, 공공·교육·영업', older: 1, stable: 1, income: 1 },
  태음: { trade: '섬세하게 쌓는 일, 재무·기획·연구', older: -1, stable: 1, income: 1 },
  천동: { trade: '모나지 않은 서비스·관리', older: -1, stable: 1, income: 0 },
  천기: { trade: '기획·분석처럼 머리 쓰는 일', older: -1, stable: 0, income: 0 },
  거문: { trade: '말과 전문성으로 먹고사는 일', older: 0, stable: 0, income: 1 },
  탐랑: { trade: '재주가 여럿인 사람, 영업·예술·사교', older: -1, stable: -1, income: 0 },
  염정: { trade: '원칙과 욕망의 낙차가 큰 사람', older: 0, stable: -1, income: 0 },
  칠살: { trade: '개척하는 일, 변동이 큰 자리', older: 1, stable: -2, income: 0 },
  파군: { trade: '판을 갈아엎는 일, 자기 사업 쪽', older: 0, stable: -2, income: 0 },
};

/** 7궁주가 어느 하우스에 앉았는가 → 어디서 만나는가 (베딕 표준 독법) */
const MEET_BY_HOUSE = {
  1: '스스로 움직여 만나는 쪽. 가까운 생활 반경 안에서',
  2: '집안·가족 쪽 연결이나 돈이 얽힌 자리에서',
  3: '소개·짧은 이동·연락이 오가는 자리에서',
  4: '집과 고향 쪽, 오래 알던 사이에서',
  5: '연애로 시작해 결혼으로 가는 쪽. 취미·모임에서',
  6: '일터의 일상, 같이 일하며 부딪치는 자리에서',
  7: '정식으로 소개받거나 맞선처럼 마주 앉는 자리에서',
  8: '깊게 얽히는 계기로. 위기나 돈 문제를 같이 넘으며',
  9: '먼 곳·배움·신념이 겹치는 자리에서. 타지 인연 가능성',
  10: '직장과 사회적 활동에서. 일로 만난 사이',
  11: '친구·동료 무리 안에서. 모임이나 소셜',
  12: '드러나지 않는 자리에서. 외국·온라인·병원처럼 일상 밖',
};

/**
 * 배우자상 한 벌.
 *
 * @param {object} input prepareInput 결과
 * @param {object} st    ziwei.stackAt 결과 (부처궁 층을 본다)
 */
export function spouseProfile(input, st = null) {
  const mp = VE.marriagePack(input);
  if (!mp) return null;

  const basis = [];
  const dk = mp.darakaraka?.planet ?? null;
  const l7 = mp.d1_7?.lord ?? null;
  const d9l7 = mp.d9_7?.lord ?? null;

  // ── 직업 결 ── 다라카라카 · 7궁주 · D9 7궁주 · 자미 부처궁 주성
  const trade = {};
  const add = (p, w, why) => {
    if (!p || !PLANET_TRADE[p]) return;
    trade[PLANET_TRADE[p]] = (trade[PLANET_TRADE[p]] ?? 0) + w;
    basis.push(why);
  };
  // 다라카라카는 도수 순서로만 정해진다. 그 순서가 흔들린다고 신고된 경우
  // 무게를 낮춘다 — 배우자상 전체가 이 한 행성에 매달려 있기 때문이다.
  const dkShaky = !!mp.darakaraka?.uncertain;
  add(dk, dkShaky ? 1 : 3, dkShaky ? `다라카라카 ${dk} (순서가 흔들릴 수 있어 무게를 낮춤)` : `다라카라카 ${dk}`);
  add(l7, 2.5, `D1 7궁주 ${l7}`);
  add(d9l7, 2, `D9 7궁주 ${d9l7}`);
  for (const p of mp.d1_7?.occupants ?? []) add(p, 1.5, `7궁에 든 ${p}`);

  // 자미 부처궁 주성
  let spouseStars = [];
  if (st) {
    const rows = ZE.domainPalaces(input, '결혼', st.layers)
      .find((x) => x.palace === '부처궁')?.rows ?? [];
    spouseStars = [...new Set(rows.flatMap((r) => r.main))];
    for (const s of spouseStars) {
      const d = MAIN_STAR[s];
      if (!d) continue;
      trade[d.trade] = (trade[d.trade] ?? 0) + 1.5;
      basis.push(`자미 부처궁 ${s}`);
    }
  }
  const tradeLean = lean(trade);

  // ── 나이차 결 ── 토성·천량 계열은 연상, 달·금성·수성·태음 계열은 연하·동년
  let older = 0, younger = 0;
  const ageBasis = [];
  const OLDER_P = ['토성', '태양', '목성'], YOUNGER_P = ['달', '금성', '수성'];
  for (const [p, why] of [[dk, `다라카라카 ${dk}`], [l7, `7궁주 ${l7}`], [d9l7, `D9 7궁주 ${d9l7}`]]) {
    if (!p) continue;
    if (OLDER_P.includes(p)) { older += 1; ageBasis.push(`${why} — 연상 쪽`); }
    if (YOUNGER_P.includes(p)) { younger += 1; ageBasis.push(`${why} — 동년·연하 쪽`); }
  }
  for (const s of spouseStars) {
    const d = MAIN_STAR[s];
    if (!d) continue;
    if (d.older > 0) { older += d.older; ageBasis.push(`자미 부처궁 ${s} — 연상 쪽`); }
    if (d.older < 0) { younger += -d.older; ageBasis.push(`자미 부처궁 ${s} — 동년·연하 쪽`); }
  }
  // 토성이 7궁을 보거나 들면 나이차가 벌어진다고 본다
  if ((mp.d1_7?.occupants ?? []).includes('토성') || (mp.d1_7?.aspects ?? []).includes('토성')) {
    older += 1.5; ageBasis.push('토성이 7궁에 들거나 7궁을 본다 — 나이차가 벌어지는 쪽');
  }

  const ageValue = older === 0 && younger === 0 ? null
    : older > younger + 1 ? '연상 쪽이 자연스럽다. 두세 살에서 예닐곱 살 위까지가 가장 무난한 범위'
    : younger > older + 1 ? '동갑이나 연하 쪽이 자연스럽다. 동갑에서 서너 살 아래까지'
    : '나이차가 크지 않은 쪽. 동갑 앞뒤 세 살 안쪽';

  // ── 경제력 방향 ── 우파파다 2궁(UL2)이 배우자의 재물 자리다
  const ul2 = mp.upapada2;
  const wealthBasis = [];
  let wealthValue = null;
  if (ul2) {
    const benefics = (ul2.occupants ?? []).filter((p) => VE.NATURAL_BENEFIC.includes(p));
    const malefics = (ul2.occupants ?? []).filter((p) => VE.NATURAL_MALEFIC.includes(p));
    wealthBasis.push(`우파파다 2궁 ${ul2.signName}${ul2.occupants.length ? ` (${ul2.occupants.join('·')})` : ' 비어 있음'}`);
    wealthValue = benefics.length > malefics.length
      ? '생활이 쪼들리는 쪽은 아니다. 크게 벌지는 않아도 밑이 받쳐지는 형'
      : malefics.length > benefics.length
      ? '초반에 돈 문제가 한 번 걸린다. 자리를 잡는 데 시간이 걸리는 형'
      : '평범하게 벌어 평범하게 사는 쪽. 한쪽으로 치우치지 않는다';
  }

  // ── 안정성 ──
  let stable = 0;
  const stableBasis = [];
  if (l7) stableBasis.push(`7궁주 ${j(l7, '이')} ${mp.d1_7.lordIn}하우스, 상태 ${mp.d1_7.lordDignity ?? '—'}`);
  if (mp.d1_7?.lordDignity === '고양' || mp.d1_7?.lordDignity === '자기 자리' || mp.d1_7?.lordDignity === '물라트리코나') {
    stable += 2; stableBasis.push(`7궁주 ${j(l7, '이')} ${mp.d1_7.lordDignity}`);
  }
  if (mp.d1_7?.lordDignity === '함몰') { stable -= 2; stableBasis.push(`7궁주 ${j(l7, '이')} 함몰`); }
  if (mp.d1_7?.lordCombust) { stable -= 1; stableBasis.push(`7궁주 ${j(l7, '이')} 태양에 묻힘(조합)`); }
  for (const s of spouseStars) {
    const d = MAIN_STAR[s];
    if (d) { stable += d.stable; if (d.stable) stableBasis.push(`자미 부처궁 ${s}`); }
  }

  // ── 만남 경로 ──
  const meetHouse = mp.d1_7?.lordIn ?? null;
  const meetBasis = meetHouse ? [`7궁주 ${j(l7, '이')} ${meetHouse}하우스에 앉음 (${HOUSE_TOPIC[meetHouse]})`] : [];

  // ── 장거리 인연인가 ──
  const farHouses = [9, 12, 3];
  const far = meetHouse != null && farHouses.includes(meetHouse);
  const rahuOn7 = (mp.d1_7?.occupants ?? []).includes('라후');

  const items = [
    item('직업 결', tradeLean?.name, [...new Set(basis)].slice(0, 5)),
    item('나이차', ageValue, [...new Set(ageBasis)].slice(0, 4), { estimate: true }),
    item('경제력', wealthValue, wealthBasis),
    item('성향', stable >= 2 ? '자기 자리가 분명한 실무형. 한번 정하면 오래 가는 쪽'
      : stable <= -2 ? '변동이 큰 사람. 자리를 여러 번 옮기거나 스스로 판을 만드는 쪽'
      : '크게 튀지 않는 보통. 상황에 맞춰 가는 쪽', stableBasis),
    item('만남 경로', meetHouse ? MEET_BY_HOUSE[meetHouse] : null, meetBasis),
    item('거리', far || rahuOn7 ? '같은 생활권 밖에서 올 가능성이 있다. 타지·외국 인연이 섞인다'
      : meetHouse != null ? '지금 생활 반경 안쪽에서 이어질 가능성이 높다' : null,
      [far ? `7궁주가 ${meetHouse}하우스(먼 곳·이면)` : null,
       rahuOn7 ? '7궁에 라후 — 낯선 쪽' : null,
       (!far && !rahuOn7 && meetHouse != null) ? `7궁주가 ${meetHouse}하우스로 생활 반경 안` : null]),
  ].filter(Boolean);

  // 근거가 몇 갈래에서 왔는가 — 이게 곧 단언의 세기다
  const systems = new Set();
  if (dk || l7) systems.add('베딕');
  if (spouseStars.length) systems.add('자미두수');

  return {
    kind: '배우자',
    items,
    darakaraka: dk,
    seventhLord: l7,
    upapada: mp.upapada?.signName ?? null,
    spouseStars,
    systems: [...systems],
    activators: mp.activators,
    // 계산 불확실성을 해석 층까지 끌고 올라온다
    darakarakaUncertain: dkShaky,
    caveat: dkShaky
      ? `다라카라카(${dk})는 도수 순서로 정해지는데 그 순서가 흔들릴 수 있다. ` +
        `${(mp.darakaraka?.uncertainWhy ?? []).join(' / ')} — 배우자상을 이 한 행성으로 단언하지 말 것.`
      : null,
    // 그림 하나로 묶어 쓸 때 쓰라고 미리 한 줄로 접어 둔다
    oneLine: items.length >= 3
      ? `${tradeLean?.name ?? '직업 결은 좁히기 어렵다'}. ` +
        `${ageValue ?? ''}${ageValue ? '. ' : ''}` +
        `${items.find((x) => x.axis === '만남 경로')?.value ?? ''}`
      : null,
  };
}

// ─────────────────────────────────────────────────────────────
// 직업 프로파일
// ─────────────────────────────────────────────────────────────

export function careerProfile(input, st = null) {
  const wp = VE.wealthPack(input);
  if (!wp) return null;
  const basis = [];

  const l10 = wp.d1_10?.lord ?? null;
  const l10In = wp.d1_10?.lordIn ?? null;

  // ── 수입의 모양 ── 어느 자리가 받쳐 주는가
  const income = {};
  const bump = (k, w, why) => { income[k] = (income[k] ?? 0) + w; basis.push(why); };
  const L10 = j(l10 ?? '', '이');
  if (l10In === 6 || l10In === 10) bump('월급형 — 조직에 소속되어 버는 쪽', 2, `10궁주 ${L10} ${l10In}하우스`);
  if (l10In === 7) bump('거래처형 — 상대가 있어야 도는 쪽', 2.5, `10궁주 ${L10} 7하우스(거래·동업)`);
  if (l10In === 11) bump('반복 매출형 — 쌓여서 들어오는 쪽', 2, `10궁주 ${L10} 11하우스(수입)`);
  if (l10In === 5 || l10In === 9) bump('지식·기술형 — 아는 것을 파는 쪽', 2, `10궁주 ${L10} ${l10In}하우스`);
  if (wp.d10_7?.occupants?.length) bump('거래처형 — 상대가 있어야 도는 쪽', 1.5, `D10 7하우스에 ${wp.d10_7.occupants.join('·')}`);
  if (wp.d10_6?.occupants?.length) bump('월급형 — 조직에 소속되어 버는 쪽', 1.5, `D10 6하우스에 ${wp.d10_6.occupants.join('·')}`);
  if (wp.dhanaYogas.length) bump('반복 매출형 — 쌓여서 들어오는 쪽', wp.dhanaYogas.length, `다나 요가 ${wp.dhanaYogas.length}개`);
  if (wp.hora?.sunHora > wp.hora?.moonHora) bump('사업·자기 판형', 1.5, `D2 호라가 태양 쪽 ${wp.hora.sunHora}개`);
  if (wp.hora?.moonHora > wp.hora?.sunHora) bump('월급형 — 조직에 소속되어 버는 쪽', 1.5, `D2 호라가 달 쪽 ${wp.hora.moonHora}개`);
  const incomeLean = lean(income);

  // ── 조직의 성격 ── 아루다 10궁(A10)이 세상에 보이는 직업의 모습
  const a10 = wp.arudha?.A10 ?? null;
  const orgBasis = [];
  let org = null;
  if (a10) {
    const q = VE.qualityOf(a10.sign);
    orgBasis.push(`A10(세상에 보이는 직업 자리) ${a10.signName} · ${q}궁`);
    org = q === '고정' ? '한번 자리 잡으면 오래 가는 조직. 제도가 잡힌 쪽'
      : q === '활동' ? '판을 새로 여는 조직. 앞에 나서는 자리'
      : '여러 갈래를 오가는 조직. 형태가 자주 바뀌는 쪽';
  }

  // ── 규모의 방향 ── 목성·토성이 10·2·11을 어떻게 건드리는가
  const big = [];
  for (const h of [10, 2, 11]) {
    const pack = h === 10 ? wp.d1_10 : h === 2 ? wp.d1_2 : wp.d1_11;
    for (const p of pack?.occupants ?? []) {
      if (p === '목성') big.push({ dir: 1, why: `목성이 ${h}하우스에` });
      if (p === '토성') big.push({ dir: 0, why: `토성이 ${h}하우스에 — 제도화·책임` });
    }
  }
  const scaleValue = big.length
    ? (big.some((x) => x.dir === 1)
      ? '지금보다 판이 커지는 쪽. 다루는 범위가 넓어진다'
      : '지금보다 제도가 잡힌 쪽. 규정과 역할이 분명해진다')
    : null;

  // ── 자미 관록궁 ──
  let careerStars = [];
  let natalStars = [];
  if (st) {
    const rows = ZE.domainPalaces(input, '직업', st.layers)
      .find((x) => x.palace === '관록궁')?.rows ?? [];
    careerStars = [...new Set(rows.flatMap((r) => r.main))];
    // 직업의 '결'은 **원국** 관록궁에서 읽는다. 층을 다 합치면 대한·유년이
    // 섞여, 평생의 직업 결과 올해의 국면이 한 덩어리가 된다.
    natalStars = rows.find((r) => /원국/.test(r.layer ?? ''))?.main ?? [];
  }

  // ── 직업의 결 ── 관록궁 주성 + 10궁주 행성의 카라카
  // 같은 표를 부처궁에서 읽으면 '상대의 일', 관록궁에서 읽으면 '본인의 일'이다.
  const trade = {};
  const tradeBasis = [];
  for (const s of natalStars) {
    const d = MAIN_STAR[s];
    if (!d) continue;
    trade[d.trade] = (trade[d.trade] ?? 0) + 2;
    tradeBasis.push(`자미 원국 관록궁 ${s}`);
  }
  if (l10 && PLANET_TRADE[l10]) {
    trade[PLANET_TRADE[l10]] = (trade[PLANET_TRADE[l10]] ?? 0) + 2.5;
    tradeBasis.push(`D1 10궁주 ${l10}`);
  }
  for (const p of wp.d1_10?.occupants ?? []) {
    if (!PLANET_TRADE[p]) continue;
    trade[PLANET_TRADE[p]] = (trade[PLANET_TRADE[p]] ?? 0) + 1.5;
    tradeBasis.push(`10하우스에 든 ${p}`);
  }
  for (const p of wp.d10_10?.occupants ?? []) {
    if (!PLANET_TRADE[p]) continue;
    trade[PLANET_TRADE[p]] = (trade[PLANET_TRADE[p]] ?? 0) + 1.5;
    tradeBasis.push(`D10 10하우스에 든 ${p}`);
  }
  const tradeLean = lean(trade);

  const systems = new Set(['베딕']);
  if (careerStars.length) systems.add('자미두수');

  return {
    kind: '직업',
    items: [
      // 직업의 결을 맨 앞에 둔다 — "무슨 일을 하는가"가 직업 질문의 본문이고
      // 수입 모양·조직 성격은 그 일이 어떤 모양인지를 덧붙이는 것이다
      item('직업의 결', tradeLean?.name, [...new Set(tradeBasis)].slice(0, 5),
        { tier: tradeLean?.clear ? null : 'C' }),
      item('다음 후보', tradeLean?.clear ? null : tradeLean?.runnerUp,
        tradeLean?.runnerUp ? ['1위와 크게 벌어지지 않아 함께 적는다'] : []),
      item('수입의 모양', incomeLean?.name, [...new Set(basis)].slice(0, 5)),
      item('조직의 성격', org, orgBasis),
      item('규모의 방향', scaleValue, big.map((x) => x.why)),
      item('직업 자리의 별', careerStars.length ? careerStars.join('·') : null,
        careerStars.length ? [`자미 관록궁 층별 주성 ${careerStars.join('·')}`] : []),
      item('라자 요가', wp.rajaYogas.length ? `${wp.rajaYogas.length}개 — 지위가 오르는 조합이 있다` : null,
        wp.rajaYogas.map((y) => y.note).slice(0, 3)),
    ].filter(Boolean),
    incomeShape: incomeLean?.name ?? null,
    runnerUpIncome: incomeLean?.runnerUp ?? null,
    trade: tradeLean?.name ?? null,
    tradeClear: !!tradeLean?.clear,
    tradeShare: tradeLean ? Math.round(tradeLean.share * 100) / 100 : null,
    systems: [...systems],
    activators: wp.activators,
  };
}

// ─────────────────────────────────────────────────────────────
// 자녀 프로파일
// ─────────────────────────────────────────────────────────────

export function childrenProfile(input, st = null) {
  const cp = VE.childrenPack(input);
  if (!cp) return null;

  const basis = [];
  let activity = 0;
  // 판정이 어느 쪽으로도 기울지 않더라도 무엇을 보고 그렇게 말하는지는 남긴다
  if (cp.d1_5?.lord) {
    basis.push(`5궁주 ${j(cp.d1_5.lord, '이')} ${cp.d1_5.lordIn}하우스, 상태 ${cp.d1_5.lordDignity ?? '—'}`);
  }
  if (cp.d1_5?.lordDignity === '고양' || cp.d1_5?.lordDignity === '자기 자리') {
    activity += 2; basis.push(`5궁주 ${j(cp.d1_5.lord, '이')} ${cp.d1_5.lordDignity}`);
  }
  if (cp.d1_5?.lordDignity === '함몰') { activity -= 2; basis.push(`5궁주 ${j(cp.d1_5.lord, '이')} 함몰`); }
  if ((cp.d1_5?.aspects ?? []).includes('목성')) { activity += 2; basis.push('목성이 5하우스를 본다'); }
  if ((cp.d1_5?.occupants ?? []).includes('목성')) { activity += 2; basis.push('목성이 5하우스에 들었다'); }
  if (cp.maleficsOn5.length) { activity -= cp.maleficsOn5.length; basis.push(`5하우스에 ${cp.maleficsOn5.join('·')}`); }
  if (cp.jupiter?.dignity === '고양') { activity += 1.5; basis.push('목성이 고양'); }
  if (cp.jupiter?.dignity === '함몰') { activity -= 1.5; basis.push('목성이 함몰'); }
  if (cp.d7_5?.occupants?.length) { activity += 1; basis.push(`D7 5하우스에 ${cp.d7_5.occupants.join('·')}`); }

  let childStars = [];
  if (st) {
    childStars = [...new Set(
      (ZE.domainPalaces(input, '학업', st.layers).find((x) => x.palace === '자녀궁')?.rows ?? [])
        .flatMap((r) => r.main))];
  }

  // 자녀 수와 성별은 강한 근거 없이 확정하지 않는다. 활성도와 간격만 말한다
  const spread = cp.d1_5?.quality ?? null;

  return {
    kind: '자녀',
    items: [
      item('자녀 자리의 활성도',
        activity >= 3 ? '받쳐지는 쪽. 때가 되면 자연스럽게 열린다'
        : activity <= -2 ? '눌리는 쪽. 시기가 늦어지거나 조건이 붙는다'
        : '한쪽으로 치우치지 않는다',
        [...new Set(basis)].slice(0, 5)),
      item('터울',
        spread === '고정' ? '한 번 자리 잡으면 간격이 벌어지는 쪽'
        : spread === '변통' ? '간격이 좁아질 수 있는 쪽' : null,
        spread ? [`D1 5하우스가 ${cp.d1_5.sign}(${spread}궁)`] : [], { estimate: true }),
      item('자녀 자리의 별', childStars.length ? childStars.join('·') : null,
        childStars.length ? [`자미 자녀궁 층별 주성 ${childStars.join('·')}`] : []),
    ].filter(Boolean),
    activity,
    systems: childStars.length ? ['베딕', '자미두수'] : ['베딕'],
    activators: cp.activators,
    caveat: '자녀 수와 성별은 계산에서 나오지 않는다. 묻더라도 만들지 않는다.',
  };
}

// ─────────────────────────────────────────────────────────────
// 주거 프로파일
// ─────────────────────────────────────────────────────────────

export function homeProfile(input, st = null) {
  const hp = VE.homePack(input);
  if (!hp) return null;
  const basis = [];

  let own = 0;
  if (hp.d1_4?.lord) {
    basis.push(`4궁주 ${j(hp.d1_4.lord, '이')} ${hp.d1_4.lordIn}하우스, 상태 ${hp.d1_4.lordDignity ?? '—'}`);
  }
  if (hp.d1_4?.lordDignity === '고양' || hp.d1_4?.lordDignity === '자기 자리') {
    own += 2; basis.push(`4궁주 ${j(hp.d1_4.lord, '이')} ${hp.d1_4.lordDignity}`);
  }
  if (hp.d1_4?.lordDignity === '함몰') { own -= 2; basis.push(`4궁주 ${j(hp.d1_4.lord, '이')} 함몰`); }
  if ((hp.d1_4?.occupants ?? []).includes('화성')) { own += 1.5; basis.push('화성이 4하우스에 — 부동산의 카라카'); }
  if ((hp.d1_4?.occupants ?? []).includes('목성')) { own += 1.5; basis.push('목성이 4하우스에'); }
  if ((hp.d1_4?.occupants ?? []).includes('토성')) { own -= 1; basis.push('토성이 4하우스에 — 늦게 이뤄지는 쪽'); }
  if (hp.d4_4?.occupants?.length) { own += 1; basis.push(`D4 4하우스에 ${hp.d4_4.occupants.join('·')}`); }

  // 한곳에 머무는가 옮겨 다니는가 — 3·9·12가 받쳐지면 이동이 잦다
  const moveHouses = [hp.d1_3, hp.d1_9, hp.d1_12].filter(Boolean);
  const moveLoad = moveHouses.reduce((t, h) => t + (h.occupants?.length ?? 0), 0);
  const stayLoad = (hp.d1_4?.occupants?.length ?? 0);

  let homeStars = [];
  if (st) {
    homeStars = [...new Set(
      (ZE.domainPalaces(input, '주거', st.layers).find((x) => x.palace === '전택궁')?.rows ?? [])
        .flatMap((r) => r.main))];
  }

  return {
    kind: '주거',
    items: [
      item('소유의 방향',
        own >= 2.5 ? '자기 집을 갖는 쪽으로 간다. 시기가 문제일 뿐 방향은 그쪽'
        : own <= -1.5 ? '한동안은 임대 쪽이 자연스럽다. 소유는 늦게 온다'
        : '소유와 임대 어느 쪽으로도 갈 수 있다. 조건이 결정한다',
        [...new Set(basis)].slice(0, 5)),
      item('정착인가 이동인가',
        moveLoad > stayLoad + 1 ? '한곳에 오래 머물기보다 생활권을 옮겨 가며 사는 쪽'
        : stayLoad > moveLoad ? '한번 자리 잡으면 오래 머무는 쪽' : null,
        [`3·9·12하우스에 ${moveLoad}개, 4하우스에 ${stayLoad}개`]),
      item('주거 자리의 별', homeStars.length ? homeStars.join('·') : null,
        homeStars.length ? [`자미 전택궁 층별 주성 ${homeStars.join('·')}`] : []),
    ].filter(Boolean),
    systems: homeStars.length ? ['베딕', '자미두수'] : ['베딕'],
    activators: hp.activators,
  };
}

// ─────────────────────────────────────────────────────────────
// 바깥에서 쓰는 입구
// ─────────────────────────────────────────────────────────────

const BUILDERS = {
  결혼: spouseProfile, 관계: spouseProfile,
  직업: careerProfile, 이직: careerProfile, 재물: careerProfile,
  자녀: childrenProfile, 학업: childrenProfile,
  주거: homeProfile, 이사: homeProfile,
};

/** 질문 분야에 맞는 프로파일 하나 */
export function profileFor(input, domain, st = null) {
  const f = BUILDERS[domain];
  if (!f) return null;
  try { return f(input, st); } catch { return null; }
}

/** 프롬프트용 — 항목마다 근거를 달아 편다 */
export function formatProfile(p) {
  if (!p || !p.items.length) return null;
  const out = [`${p.kind} 프로파일 (해석 — 계산이 아니다. 근거를 함께 적었다)`];
  for (const it of p.items) {
    out.push(`  ${it.axis}: ${it.value}` +
      `${it.estimate ? ' ※초구체화 추정 — 명반에서 이 숫자가 직접 나오는 것은 아니다' : ''}`);
    out.push(`    근거: ${it.basis.join(' / ')}`);
  }
  if (p.caveat) out.push(`  ※ ${p.caveat}`);
  return out.join('\n');
}

export { tierOf as tier };
export const describeTier = (t) => `Tier ${t.tier} (${t.voice}) — 핵심 ${t.core}개 · 타이밍 기법 ${t.timing}개. ${t.how}`;
export { j };
