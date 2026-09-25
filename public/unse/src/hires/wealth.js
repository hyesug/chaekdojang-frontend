/**
 * wealth.js — 돈이 어디서 들어오는가를 갈라 본다
 *
 * "재물운이 좋다/나쁘다"로 끝내지 않는다. 같은 '큰돈'이라도 월급이 오른
 * 것과 계약이 터진 것과 상속을 받은 것과 복권에 당첨된 것은 전혀 다른
 * 사건이고, 명반에서도 다른 자리가 켜진다.
 *
 * 그래서 경로를 일곱으로 가른다.
 *   노동형 · 전문성형 · 사업형 · 투자형 · 관계형 · 횡재형 (· 혼합형)
 *
 * ── 반드시 지키는 세 가지 ──────────────────────────────────
 *
 * 1) **"큰돈이 들어온다"를 곧바로 "복권 당첨"으로 옮기지 않는다.**
 *    비정기 재물 신호가 잡히면 출처 후보를 먼저 나눈다. 복권은 그 여러
 *    후보 가운데 하나일 뿐이고, 대개 가장 약한 후보다.
 *
 * 2) **버는 것 · 모으는 것 · 횡재하는 것을 따로 본다.**
 *    많이 버는 사람, 많이 모으는 사람, 큰 횡재를 겪는 사람은 다르다.
 *    포춘이 강하다고 곧 로또형이 아니다 — 포춘이 10·11하우스와 이어지면
 *    직업적 성과이고, 7하우스면 계약, 3하우스면 정보·기술, 5하우스라야
 *    비로소 투기 쪽이다.
 *
 * 3) **점수를 확률처럼 내보내지 않는다.**
 *    아래 숫자는 경로끼리 견주기 위한 내부 비교값이다. 바깥으로는 순위와
 *    '강함/중간/약함'만 나간다.
 */

import {
  elementDistribution, tenGodDistribution, computeDaeun,
  yearPillar, tenGod, TEN_GOD_GROUP, isClash, branchRelations,
  STEM_ELEMENT, ELEMENTS, BRANCHES,
} from '../core/ganzhi.js';
import { j } from '../core/josa.js';
import * as CL from './classical.js';
import * as ZR from './zr.js';
import * as VE from './vedicExt.js';
import * as ZE from './ziweiExt.js';
import * as WE from './westernExt.js';

/** 돈이 들어오는 일곱 갈래 */
export const PATHS = {
  노동형: '직업과 근로로 꾸준히 는다. 월급·수당·승진',
  전문성형: '기술·자격·지식·콘텐츠·서비스로 는다',
  사업형: '고객·거래·제품·조직으로 는다. 계약과 매출',
  투자형: '금융자산·부동산처럼 값이 오르는 것으로 는다',
  관계형: '배우자·가족·파트너십·공동재정에서 들어온다',
  횡재형: '복권·상금·추첨처럼 예상 밖의 목돈',
};

/** 비정기 목돈의 출처 후보 — 신호가 잡혔을 때 여기서 고른다 */
export const WINDFALL_SOURCES = {
  직업: '성과급 · 이직 보상 · 스톡옵션 · 퇴직금',
  사업: '대형 계약 · B2B 고객 · 서비스 매출 · 지분 매각',
  투자: '주식 · 펀드 · 부동산 차익',
  제도: '지원금 · 보상금 · 보험금 · 환급',
  창작: '공모전 · 상금 · 저작권 · 인세',
  관계: '배우자 자산 · 공동재정 · 가족 자산 · 상속',
  순수횡재: '복권 · 추첨 · 우연한 당첨',
};

const add = (acc, path, w, why) => {
  if (!acc.score[path]) acc.score[path] = 0;
  acc.score[path] += w;
  acc.basis.push({ path, w, why });
};

// ─────────────────────────────────────────────────────────────
// 사주 — 재성의 모양
// ─────────────────────────────────────────────────────────────

/** 오행의 창고(庫). 목고=未 화고=戌 금고=丑 수고=辰. 토는 따로 두지 않는다 */
const VAULT = { 0: 7, 1: 10, 3: 1, 4: 4 };

/**
 * 사주에서 재물의 결을 읽는다.
 *
 * 명리는 돈을 재성으로 본다. 그 안에서도
 *   정재 — 꼬박꼬박 들어오는 돈 (월급·고정 수입)
 *   편재 — 크게 들고 나는 돈 (사업·투자·의외의 목돈)
 * 으로 갈라 보고, 식상이 재성을 낳으면(식상생재) 자기 재주로 버는 결,
 * 재성이 창고(辰戌丑未)에 들면 모이는 결로 본다.
 */
export function baziWealth(input, chart) {
  const acc = { score: {}, basis: [] };
  const gods = tenGodDistribution(chart.pillars, chart.dayStem);
  const dist = elementDistribution(chart.pillars);

  // 정재·편재를 따로 센다
  let jeongjae = 0, pyeonjae = 0;
  for (const d of gods.detail) {
    if (d.god === '정재') jeongjae += 1;
    if (d.god === '편재') pyeonjae += 1;
  }

  if (jeongjae) add(acc, '노동형', jeongjae * 1.5, `정재 ${jeongjae}개 — 꼬박꼬박 들어오는 결`);
  if (pyeonjae) {
    add(acc, '사업형', pyeonjae * 1.2, `편재 ${pyeonjae}개 — 크게 들고 나는 결`);
    add(acc, '투자형', pyeonjae * 0.8, `편재 ${pyeonjae}개 — 움직이는 돈을 다루는 결`);
  }

  // 식상생재 — 자기가 만들어 낸 것으로 번다
  const sik = gods.groups.식상 ?? 0;
  const jae = gods.groups.재성 ?? 0;
  if (sik >= 1 && jae >= 1) {
    add(acc, '전문성형', Math.min(sik, jae) * 1.6, `식상생재 (식상 ${sik} · 재성 ${jae}) — 재주가 돈이 되는 결`);
    add(acc, '사업형', Math.min(sik, jae) * 0.8, '식상생재 — 만들어 파는 결');
  }

  // 관성 + 재성 — 조직 안에서 자리로 번다
  const gwan = gods.groups.관성 ?? 0;
  if (gwan >= 1 && jae >= 1) {
    add(acc, '노동형', Math.min(gwan, jae) * 1.2, `재생관 (재성 ${jae} · 관성 ${gwan}) — 조직에서 자리로 버는 결`);
  }
  // 인성 + 재성 — 자격·문서로 번다
  const inseong = gods.groups.인성 ?? 0;
  if (inseong >= 1 && jae >= 1) add(acc, '전문성형', 1, `인성 ${inseong} — 자격·문서가 받치는 결`);

  // 비겁 과다 + 재성 약 — 돈을 두고 다툰다
  const bigyeop = gods.groups.비겁 ?? 0;
  const rivalry = bigyeop >= 3 && jae <= 1;
  if (rivalry) acc.basis.push({ path: null, w: 0, why: `비겁 ${bigyeop} 대비 재성 ${jae} — 돈이 새거나 나뉘기 쉬운 결` });

  // 재고 — 재성의 오행이 창고에 들어 있는가
  const myElement = STEM_ELEMENT[chart.dayStem];
  const wealthElement = (myElement + 2) % 5;          // 내가 극하는 것이 재성
  const vault = VAULT[wealthElement] ?? null;
  const branches = ['year', 'month', 'day', 'hour']
    .map((k) => chart.pillars[k]?.branch).filter((b) => b != null);
  const hasVault = vault != null && branches.includes(vault);
  if (hasVault) {
    add(acc, '투자형', 1.5, `재고 — ${ELEMENTS[wealthElement]} 재성의 창고 ${BRANCHES[vault]}가 원국에 있다`);
    add(acc, '횡재형', 0.8, '재고가 있다 — 창고가 열리는 해에 목돈이 움직이는 결');
  }

  return {
    ...acc,
    jeongjae, pyeonjae,
    dominant: gods.dominant,
    wealthElement: ELEMENTS[wealthElement],
    vault: hasVault ? BRANCHES[vault] : null,
    vaultBranch: hasVault ? vault : null,
    rivalry,
    weakest: ELEMENTS[dist.weakest],
  };
}

/** 그 해에 창고가 열리는가 — 충으로 열린다고 본다(開庫) */
export function vaultOpening(bw, chart, year) {
  if (bw.vaultBranch == null) return null;
  const gz = yearPillar(year);
  if (!isClash(bw.vaultBranch, gz.branch)) return null;
  return { year, gz: gz.hanja,
    why: `세운 ${gz.hanja}가 재고 ${BRANCHES[bw.vaultBranch]}를 충한다 — 창고가 열리는 해로 본다` };
}

// ─────────────────────────────────────────────────────────────
// 자미두수 — 재백·관록·복덕
// ─────────────────────────────────────────────────────────────

/** 재물 자리에 든 별이 가리키는 결 */
const STAR_PATH = {
  무곡: [['사업형', 1.5], ['투자형', 1.0]],
  천부: [['투자형', 1.5], ['노동형', 0.8]],
  태음: [['투자형', 1.4], ['노동형', 0.6]],
  자미: [['노동형', 1.2], ['사업형', 0.6]],
  태양: [['노동형', 1.2], ['전문성형', 0.5]],
  천동: [['노동형', 1.0]],
  천상: [['노동형', 1.0], ['관계형', 0.6]],
  천량: [['전문성형', 1.0], ['관계형', 0.5]],
  천기: [['전문성형', 1.2]],
  거문: [['전문성형', 1.4]],
  탐랑: [['횡재형', 1.2], ['사업형', 0.8]],
  염정: [['사업형', 0.8], ['횡재형', 0.4]],
  칠살: [['사업형', 1.2]],
  파군: [['사업형', 0.8], ['횡재형', 0.6]],
};

export function ziweiWealth(input, stack) {
  const acc = { score: {}, basis: [] };
  if (!stack) return { ...acc, unavailable: '출생 시각을 몰라 판이 서지 않는다' };

  const packs = ZE.domainPalaces(input, '재물', stack.layers);
  const seen = new Set();
  for (const p of packs) {
    for (const row of p.rows) {
      for (const star of row.main) {
        const key = `${p.palace}|${star}`;
        if (seen.has(key)) continue;
        seen.add(key);
        for (const [path, w] of STAR_PATH[star] ?? []) {
          add(acc, path, w, `${p.palace}에 ${star}`);
        }
      }
      // 화록은 돈과 기회가 붙는 표시다
      for (const s of row.sihwa) {
        if (s.endsWith('화록')) {
          const path = p.palace === '관록궁' ? '노동형' : p.palace === '복덕궁' ? '횡재형' : '사업형';
          add(acc, path, 1.2, `${row.layer} ${p.palace}에 ${s}`);
        }
        if (s.endsWith('화기')) {
          acc.basis.push({ path: null, w: 0, why: `${row.layer} ${p.palace}에 ${s} — 그 자리가 막히는 표시` });
        }
      }
      // 녹존은 봉급의 별이다
      if (row.lucky.includes('녹존')) add(acc, '노동형', 1.2, `${p.palace}에 녹존 — 먹을 것이 붙는 자리`);
      if (row.evil.length) {
        acc.basis.push({ path: null, w: 0, why: `${row.layer} ${p.palace}에 살성 ${row.evil.join('·')}` });
      }
    }
  }
  return acc;
}

// ─────────────────────────────────────────────────────────────
// 베딕 — 2·5·8·11궁, D2, 다나 요가
// ─────────────────────────────────────────────────────────────

export function vedicWealth(input) {
  const acc = { score: {}, basis: [] };
  const wp = VE.wealthPack(input);
  if (!wp) return { ...acc, unavailable: '차트를 세우지 못했다' };

  const d1 = VE.chart(input, 'D1');
  const l = (n) => d1.lordOf(n);

  // 2·11은 버는 돈, 5는 건 돈, 8은 남의 돈
  const h2 = l(2), h11 = l(11), h5 = l(5), h8 = l(8), h10 = l(10);
  if (h2?.lordIn === 10 || h2?.lordIn === 6) add(acc, '노동형', 1.5, `2궁주 ${j(h2.lord, '이')} ${h2.lordIn}하우스 — 일해서 버는 자리`);
  if (h2?.lordIn === 11) add(acc, '사업형', 1.5, `2궁주 ${j(h2.lord, '이')} 11하우스 — 이익으로 들어오는 자리`);
  if (h2?.lordIn === 7) add(acc, '관계형', 1.5, `2궁주 ${j(h2.lord, '이')} 7하우스 — 상대를 통해 드는 자리`);
  if (h2?.lordIn === 5) add(acc, '투자형', 1.2, `2궁주 ${j(h2.lord, '이')} 5하우스 — 건 돈으로 드는 자리`);
  if (h11?.lordIn === 2 || h11?.lordIn === 11) add(acc, '사업형', 1.2, `11궁주 ${j(h11.lord, '이')} ${h11.lordIn}하우스`);
  if (h10?.lordIn === 2 || h10?.lordIn === 11) add(acc, '노동형', 1.2, `10궁주 ${j(h10.lord, '이')} ${h10.lordIn}하우스 — 일이 돈으로`);

  for (const p of h5?.occupants ?? []) {
    if (p === '라후') add(acc, '횡재형', 1.5, '5하우스에 라후 — 투기·요행 쪽이 켜진 자리');
    if (p === '목성') add(acc, '투자형', 1.2, '5하우스에 목성');
    if (p === '금성') add(acc, '창작형', 0, '5하우스에 금성');   // 경로에 없으면 버려진다
  }
  for (const p of h8?.occupants ?? []) {
    if (p === '목성' || p === '금성') add(acc, '관계형', 1.2, `8하우스에 ${p} — 남의 돈이 받쳐지는 자리`);
    if (p === '라후') add(acc, '횡재형', 1.2, '8하우스에 라후 — 뜻밖의 목돈 쪽');
  }

  // D2 호라 — 태양 쪽은 스스로 버는 결, 달 쪽은 받아 버는 결
  if (wp.hora) {
    if (wp.hora.sunHora > wp.hora.moonHora) add(acc, '사업형', 1.2, `D2 호라 태양 쪽 ${wp.hora.sunHora}개 — 스스로 버는 결`);
    if (wp.hora.moonHora > wp.hora.sunHora) add(acc, '노동형', 1.2, `D2 호라 달 쪽 ${wp.hora.moonHora}개 — 받아 버는 결`);
  }
  // 다나 요가는 돈이 모이는 조합이다
  for (const y of wp.dhanaYogas) add(acc, '투자형', 1.0, `다나 요가 — ${y.note}`);
  for (const y of wp.rajaYogas.slice(0, 2)) add(acc, '노동형', 0.8, `라자 요가 — ${y.note}`);

  // 목성의 상태가 재물 전반을 받친다
  const jup = d1.planets.목성;
  if (jup?.dignity === '고양' || jup?.dignity === '자기 자리') {
    add(acc, '투자형', 1.0, `목성이 ${jup.dignity}`);
  }

  return { ...acc, a2: wp.arudha?.A2?.signName ?? null, hora: wp.hora, dhana: wp.dhanaYogas.length };
}

// ─────────────────────────────────────────────────────────────
// 고전 서양 — 로트와 재물 하우스
// ─────────────────────────────────────────────────────────────

/** 포춘이 어느 하우스에 놓였는가로 현실화되는 모양이 갈린다 */
const FORTUNE_HOUSE_PATH = {
  1: ['노동형', '몸과 이름으로 직접'],
  2: ['노동형', '내 소득과 재산으로'],
  3: ['전문성형', '정보·기술·콘텐츠로'],
  4: ['투자형', '집과 부동산으로'],
  5: ['횡재형', '투기·창작·위험을 건 쪽으로'],
  6: ['노동형', '매일의 노동으로'],
  7: ['관계형', '계약과 파트너십으로'],
  8: ['관계형', '남의 돈·공동재정·상속으로'],
  9: ['전문성형', '먼 길·배움·외국으로'],
  10: ['노동형', '직업적 성과로'],
  11: ['사업형', '이익·후원·집단으로'],
  12: ['투자형', '드러나지 않는 자리에서'],
};

export function classicalWealth(input) {
  const acc = { score: {}, basis: [] };
  const c = CL.classicalChart(input);
  if (c.unavailable) return { ...acc, unavailable: c.unavailable };

  const F = c.lots.fortune;
  const S = c.lots.spirit;

  // 포춘이 놓인 자리 — 여기서 물질이 현실화되는 모양이 갈린다
  const fp = FORTUNE_HOUSE_PATH[F.house];
  if (fp) add(acc, fp[0], 2.0, `포춘이 ${F.house}하우스 — ${fp[1]}`);
  // 포춘의 주인이 앉은 자리도 같은 무게로 본다
  const frp = FORTUNE_HOUSE_PATH[F.rulerHouse];
  if (frp) add(acc, frp[0], 1.5, `포춘의 주인 ${F.ruler}가 ${F.rulerHouse}하우스 — ${frp[1]}`);
  // 주인이 힘이 없으면 그 경로가 제 몫을 못 한다
  if (F.rulerDignity.score < 0) {
    acc.basis.push({ path: null, w: 0,
      why: `포춘의 주인 ${F.ruler}가 ${F.rulerDignity.labels.join('·')} — 그 경로가 쉽게 풀리지는 않는다` });
  }
  // 스피릿은 뜻과 직업 쪽이다
  const sp = FORTUNE_HOUSE_PATH[S.house];
  if (sp && (S.house === 10 || S.house === 11 || S.house === 6 || S.house === 2)) {
    add(acc, '노동형', 1.2, `스피릿이 ${S.house}하우스 — 뜻이 일 쪽으로 간다`);
  }

  // 재물 하우스마다
  const mh = c.moneyHouses;
  const pathOf = { 2: '노동형', 5: '횡재형', 8: '관계형', 10: '노동형', 11: '사업형' };
  for (const [n, x] of Object.entries(mh)) {
    const path = pathOf[n];
    if (!path) continue;
    const dg = x.rulerDignity;
    if (dg.score >= 2) add(acc, path, 1.2, `${n}하우스 주인 ${x.ruler}가 ${dg.labels.join('·')}`);
    if (x.benefics.length) add(acc, path, 0.8, `${n}하우스에 길성 ${x.benefics.join(',')}`);
    if (x.occupants.includes('목성') || x.occupants.includes('금성')) {
      add(acc, path, 1.0, `${n}하우스에 ${x.occupants.filter((p) => ['목성', '금성'].includes(p)).join('·')}`);
    }
    if (x.malefics.length && x.benefics.length === 0) {
      acc.basis.push({ path: null, w: 0, why: `${n}하우스에 흉성만 ${x.malefics.join(',')}` });
    }
  }

  // 섹트에 맞는 길성이 힘이 있으면 재물 전반이 받쳐진다
  const ben = c.dignities[c.sect.benefic];
  if (ben.essential.score >= 2) {
    add(acc, '투자형', 0.8, `섹트 길성 ${c.sect.benefic}이 ${ben.essential.labels.join('·')} (${c.sect.label})`);
  }

  return { ...acc, chart: c };
}

// ─────────────────────────────────────────────────────────────
// 합치기
// ─────────────────────────────────────────────────────────────

const SYSTEM_LABEL = { bazi: '사주', ziwei: '자미두수', vedic: '베딕', classical: '점성술(고전)' };

/**
 * 네 체계를 합쳐 경로 순위를 낸다.
 *
 * 점수는 경로끼리 견주기 위한 것이다. 바깥으로는 순위와 세기만 나간다.
 */
export function wealthPaths(input, chart, stack = null) {
  const parts = {
    bazi: baziWealth(input, chart),
    ziwei: ziweiWealth(input, stack),
    vedic: vedicWealth(input),
    classical: classicalWealth(input),
  };

  const total = {};
  const bySystem = {};
  const basis = [];
  for (const [key, part] of Object.entries(parts)) {
    bySystem[key] = { ...part.score };
    for (const [path, w] of Object.entries(part.score ?? {})) {
      if (!PATHS[path]) continue;                       // 경로 목록에 없는 것은 버린다
      total[path] = (total[path] ?? 0) + w;
    }
    for (const b of part.basis ?? []) basis.push({ system: SYSTEM_LABEL[key], ...b });
  }

  const ranked = Object.entries(total)
    .filter(([p]) => PATHS[p])
    .sort((a, b) => b[1] - a[1])
    .map(([path, score]) => ({
      path, score: Math.round(score * 10) / 10, desc: PATHS[path],
      // 몇 갈래가 이 경로를 지지했는가 — 이게 세기를 가른다
      systems: Object.entries(bySystem).filter(([, s]) => (s[path] ?? 0) > 0)
        .map(([k]) => SYSTEM_LABEL[k]),
    }));

  const top = ranked[0] ?? null;
  const second = ranked[1] ?? null;
  const mixed = top && second && (top.score - second.score) < top.score * 0.2;

  return {
    ranked,
    main: top,
    second,
    mixed,
    // 여러 갈래가 비슷하게 나오면 혼합형이라고 말한다. 억지로 하나를 고르지 않는다
    verdict: !top ? null
      : mixed ? `혼합형 — ${top.path}과 ${second.path}이 비슷한 무게로 잡힌다`
      : `${top.path} — ${top.desc}`,
    parts, basis,
    negatives: basis.filter((b) => b.path === null).map((b) => `${b.system}: ${b.why}`),
  };
}

// ─────────────────────────────────────────────────────────────
// 비정기 재물 · 횡재
// ─────────────────────────────────────────────────────────────

/**
 * 횡재형 신호를 셀 때 보는 자리들.
 *
 * **단일 지표로 판단하지 않는다.** 아래 여러 갈래가 동시에 켜질 때만
 * "비정기 재물이 평소보다 활성화되는 구간"이라고 말한다. 그 경우에도
 * 복권을 특정하지 않고 출처 후보를 나눈다.
 */
export function windfall(input, chart, stack, opts = {}) {
  const fromYear = opts.fromYear ?? input.currentYear;
  const years = opts.years ?? 12;

  const cw = classicalWealth(input);
  const bw = baziWealth(input, chart);
  const c = cw.chart ?? null;
  const N = opts.natal ?? null;

  // ── 타고난 구조 — 애초에 비정기 목돈이 들어올 자리가 있는가 ──
  const structural = [];
  if (c) {
    const F = c.lots.fortune;
    if ([5, 8].includes(F.house)) structural.push(`포춘이 ${F.house}하우스 — 위험을 건 돈·남의 돈 자리`);
    if ([5, 8].includes(F.rulerHouse)) structural.push(`포춘의 주인 ${F.ruler}가 ${F.rulerHouse}하우스`);
    const h5 = c.moneyHouses[5], h8 = c.moneyHouses[8], h11 = c.moneyHouses[11];
    if (h5.benefics.length) structural.push(`5하우스에 길성 ${h5.benefics.join(',')}`);
    if (h8.benefics.length) structural.push(`8하우스에 길성 ${h8.benefics.join(',')}`);
    if (h11.rulerDignity.score >= 2) structural.push(`11하우스 주인 ${j(h11.ruler, '이')} ${h11.rulerDignity.labels.join('·')}`);
    if (h5.occupants.includes('목성')) structural.push('5하우스에 목성');
    if (h8.occupants.includes('목성')) structural.push('8하우스에 목성');
  }
  if (bw.vault) structural.push(`사주 재고 ${bw.vault} — 목돈이 모였다 풀리는 구조`);
  if (bw.pyeonjae >= 2) structural.push(`편재 ${bw.pyeonjae}개 — 크게 들고 나는 결`);

  // 근거 문구에 체계 이름이 이미 들어 있으면 두 번 붙이지 않는다
  const label = (name, why) => (why.startsWith(name) ? why : `${name} ${why}`);
  for (const b of vedicWealth(input).basis ?? []) {
    if (b.path === '횡재형') structural.push(label('베딕', b.why));
  }
  for (const b of ziweiWealth(input, stack).basis ?? []) {
    if (b.path === '횡재형') structural.push(label('자미', b.why));
  }

  // ── 시기 — 어느 해에 그 자리가 켜지는가 ──
  const rows = [];
  for (let i = 0; i < years; i++) {
    const y = fromYear + i;
    const hits = [];

    // 프로펙션이 2·5·8·11하우스로 갈 때
    if (N) {
      const p = WE.profection(input, N, Math.max(0, y - input.year));
      if (p && [2, 5, 8, 11].includes(p.house)) {
        hits.push({ tech: '프로펙션', w: p.house === 5 || p.house === 8 ? 2 : 1.5,
          why: `그 해 무대가 ${p.house}하우스(${p.topic}) · 주인 ${p.timeLord}` });
      }
      // 솔라 아크가 재물 자리를 건드릴 때
      const sa = WE.solarArcAt(input, N, (input.jdUT + (y - input.year) * 365.2425));
      for (const hit of sa.hits) {
        if (/목성|금성/.test(hit.from) || /목성|금성/.test(hit.to)) {
          hits.push({ tech: '솔라아크', w: 1.2, why: `${hit.from}→${hit.to} ${hit.aspect}` });
          break;
        }
      }
    }
    // 사주 — 창고가 열리는 해
    const vo = vaultOpening(bw, chart, y);
    if (vo) hits.push({ tech: '재고충', w: 2, why: vo.why });
    // 사주 — 세운이 재성인 해
    const gz = yearPillar(y);
    const god = tenGod(chart.dayStem, gz.stem);
    if (TEN_GOD_GROUP[god] === '재성') {
      hits.push({ tech: '세운 재성', w: 1.2, why: `세운 ${gz.hanja} 천간이 ${god}` });
    }
    // 사주 — 일지와 합이면 실제로 손에 들어오는 결
    const rel = branchRelations(chart.pillars.day.branch, gz.branch);
    if (rel.some((x) => x.good) && TEN_GOD_GROUP[god] === '재성') {
      hits.push({ tech: '세운 합', w: 1, why: `세운 지지가 일지와 ${rel.filter((x) => x.good).map((x) => x.kind).join('·')}` });
    }

    const techs = [...new Set(hits.map((h) => h.tech))];
    rows.push({ year: y, hits, techs, score: Math.round(hits.reduce((t, h) => t + h.w, 0) * 10) / 10 });
  }

  const ranked = rows.slice().filter((r) => r.techs.length >= 2).sort((a, b) => b.score - a.score);

  // ── 출처 후보 — 여기가 핵심이다 ──
  const paths = wealthPaths(input, chart, stack);
  const sources = [];
  const push = (k, why) => sources.push({ source: k, detail: WINDFALL_SOURCES[k], why });
  const has = (p) => paths.ranked.some((x) => x.path === p && x.score > 0);
  const rank = (p) => paths.ranked.findIndex((x) => x.path === p);

  if (has('노동형')) push('직업', '노동·조직 경로가 상위에 있다');
  if (has('사업형')) push('사업', '거래·계약 경로가 상위에 있다');
  if (has('투자형')) push('투자', '자산·값이 오르는 쪽 경로가 잡힌다');
  if (has('관계형')) push('관계', '남의 돈·공동재정 자리가 켜져 있다');
  if (has('전문성형')) push('창작', '재주·지식으로 버는 경로가 잡힌다');
  if (c && (c.moneyHouses[8].benefics.length || c.moneyHouses[11].benefics.length)) {
    push('제도', '8·11하우스에 길성 — 받아서 들어오는 돈의 자리');
  }
  // 순수 횡재는 5하우스 계열이 실제로 켜졌을 때만 후보로 올린다
  const pureOK = c && ([5].includes(c.lots.fortune.house) || [5].includes(c.lots.fortune.rulerHouse)
    || c.moneyHouses[5].benefics.length > 0 || c.moneyHouses[5].occupants.includes('목성'));
  if (pureOK && has('횡재형')) push('순수횡재', '5하우스(위험을 건 돈) 계열이 실제로 켜져 있다');

  sources.sort((a, b) => {
    const order = { 직업: '노동형', 사업: '사업형', 투자: '투자형', 관계: '관계형', 창작: '전문성형', 순수횡재: '횡재형', 제도: '관계형' };
    return rank(order[a.source]) - rank(order[b.source]);
  });

  const windfallRank = rank('횡재형');
  return {
    structural,
    // 타고난 구조가 몇 갈래에서 잡히는가
    structuralStrength: structural.length >= 4 ? '강함' : structural.length >= 2 ? '중간' : '약함',
    years: rows,
    peaks: ranked.slice(0, 3),
    sources,
    // 순수 복권형이 후보 가운데 어디쯤인가 — 거의 언제나 아래쪽이다
    pureWindfallRank: windfallRank < 0 ? null : windfallRank + 1,
    pureWindfallPossible: !!pureOK,
    paths,
    caveat: '점술 계산으로 복권의 무작위 확률을 알 수는 없다. 여기서 세는 것은 ' +
      '"비정기 재물·투기·추첨과 관련된 영역이 평소보다 활성화되는가"이지 당첨 여부가 아니다.',
  };
}

// ─────────────────────────────────────────────────────────────
// 평생 재물 곡선
// ─────────────────────────────────────────────────────────────

/** 대운 십신이 그 십 년의 돈 성격을 가른다 */
const DAEUN_MONEY = {
  비겁: '내 힘으로 버는 십 년. 다만 나눠 갖는 자리도 함께 커진다',
  식상: '만들어 파는 십 년. 재주가 수입으로 바뀌는 구간',
  재성: '돈이 직접 움직이는 십 년. 벌이와 씀씀이가 함께 커진다',
  관성: '자리로 버는 십 년. 직책과 책임이 수입을 끌어올린다',
  인성: '쌓고 배우는 십 년. 당장의 수입보다 자격과 기반이 는다',
};

/**
 * 평생 재물 곡선 — 십 년 단위로 무엇이 중심인가.
 *
 * 사주 대운, 베딕 마하다샤, 조디악 릴리징 1단계를 같은 나이 축에 놓고
 * 십 년마다 무엇이 겹치는지 본다.
 */
export function lifetimeWealth(input, chart, opts = {}) {
  const daeun = computeDaeun(chart, input.isMale, input.jdUT, 9);
  const tree = opts.dashaTree ?? null;
  const cw = classicalWealth(input);
  const c = cw.chart ?? null;

  let relSpirit = null, relFortune = null;
  if (c) {
    relSpirit = ZR.releasing(c.lots.spirit.sign, '스피릿', 90);
    relFortune = ZR.releasing(c.lots.fortune.sign, '포춘', 90);
  }

  const decades = [];
  for (const from of [20, 30, 40, 50, 60]) {
    const mid = from + 5;
    const d = daeun.list.find((x) => mid >= x.fromExact && mid < x.toExact) ?? null;
    const md = tree ? tree.list.find((x) => mid >= x.fromAge && mid < x.toAge) ?? null : null;
    const zs = relSpirit ? ZR.atAge(relSpirit, mid) : null;
    const zf = relFortune ? ZR.atAge(relFortune, mid) : null;

    const notes = [];
    if (d) notes.push(`대운 ${d.hanja}(${d.god}) — ${DAEUN_MONEY[TEN_GOD_GROUP[d.god]] ?? ''}`);
    if (md) notes.push(`${md.lord} 마하다샤`);
    if (zs?.l1) notes.push(`스피릿 릴리징 ${zs.l1.signName}${zs.l1.angular ? ' (정점 구간)' : ''}`);
    if (zf?.l1) notes.push(`포춘 릴리징 ${zf.l1.signName}${zf.l1.angular ? ' (정점 구간)' : ''}`);

    decades.push({
      from, to: from + 9,
      years: `${input.year + from}~${input.year + from + 9}`,
      daeun: d ? { gz: d.hanja, god: d.god, group: TEN_GOD_GROUP[d.god] } : null,
      mahadasha: md?.lord ?? null,
      zrSpirit: zs?.l1 ? { sign: zs.l1.signName, angular: zs.l1.angular } : null,
      zrFortune: zf?.l1 ? { sign: zf.l1.signName, angular: zf.l1.angular } : null,
      // 그 십 년의 중심이 무엇인가
      center: d ? (DAEUN_MONEY[TEN_GOD_GROUP[d.god]] ?? null) : null,
      peak: !!(zs?.l1?.angular || zf?.l1?.angular),
      notes,
    });
  }

  return { decades, relSpirit, relFortune, daeun };
}

// ─────────────────────────────────────────────────────────────
// 프롬프트용
// ─────────────────────────────────────────────────────────────

export function formatWealth(paths, wf, life) {
  const out = [];
  out.push('### [A/B] 재물 — 돈이 어디서 들어오는가');
  out.push('경로 점수는 경로끼리 견주기 위한 내부 값이다. 확률로 옮기지 말 것.');
  out.push(`경로 순위: ${paths.ranked.map((r) => `${r.path}(${r.systems.length}갈래)`).join(' > ')}`);
  if (paths.verdict) out.push(`판정: ${paths.verdict}`);
  for (const r of paths.ranked.slice(0, 3)) {
    out.push(`  [${r.path}] ${r.desc} — 지지 ${r.systems.join('·')}`);
    for (const b of paths.basis.filter((x) => x.path === r.path).slice(0, 4)) {
      out.push(`    · ${b.system}: ${b.why}`);
    }
  }
  if (paths.negatives.length) {
    out.push(`막히는 자리: ${paths.negatives.slice(0, 5).join(' / ')}`);
  }
  out.push('');

  if (wf) {
    out.push('비정기 재물 · 횡재');
    out.push(`타고난 구조: ${wf.structuralStrength}` +
      (wf.structural.length ? ` — ${wf.structural.join(' / ')}` : ' — 잡히는 자리가 거의 없다'));
    if (wf.peaks.length) {
      out.push('여러 기법이 겹치는 해:');
      for (const p of wf.peaks) {
        out.push(`  ${p.year}년 (${p.techs.join('·')}) — ${p.hits.map((h) => h.why).join(' / ')}`);
      }
    } else {
      out.push('여러 기법이 겹치는 해 없음 — 비정기 재물 시기를 좁힐 근거가 부족하다.');
    }
    out.push(`돈의 출처 후보 (앞설수록 근거가 두텁다): ${wf.sources.map((s) => `${s.source}(${s.detail})`).join(' > ') || '후보 없음'}`);
    out.push(`순수 복권형: ${wf.pureWindfallPossible
      ? `후보에 올라 있으나 ${wf.pureWindfallRank ?? '—'}순위 — 다른 출처가 더 두텁다`
      : '5하우스 계열이 켜지지 않아 후보로 올리지 않는다'}`);
    out.push(`※ ${wf.caveat}`);
    out.push('');
  }

  if (life) {
    out.push('평생 재물 곡선 (십 년 단위)');
    for (const d of life.decades) {
      out.push(`  ${d.from}대 (${d.years}) ${d.peak ? '※정점 구간 ' : ''}${d.notes.join(' · ')}`);
    }
    out.push('');
  }

  out.push('재물을 말할 때 지킬 것:');
  out.push('- 버는 것 · 모으는 것 · 횡재하는 것은 따로다. 한 사람이 셋 다 강할 수도, 아닐 수도 있다.');
  out.push('- "큰돈이 들어온다"를 곧바로 "복권"으로 옮기지 말 것. 위 출처 후보 순서를 따를 것.');
  out.push('- 복권은 무작위다. 당첨 여부·날짜·번호·구입액을 말하지 말 것. 활성화되는 영역만 말할 것.');
  out.push('- 근거가 모이면 "이 시기에는 월급 밖의 돈이 크게 움직인다" 처럼 단언해도 된다. 다만 곧바로 출처를 구분해 적을 것.');

  return out.join('\n');
}
