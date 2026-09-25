/**
 * pair.js — 두 사람의 결혼 시기를 겹쳐 본다
 *
 * 한 사람 명반만 보면 "이 사람에게 결혼운이 있다"까지만 나온다. 그런데
 * 혼인은 혼자 하는 일이 아니다. **두 사람 모두 같은 기간에 결혼·주거·책임
 * 신호가 켜지는가**가 실제 조건이다. 그것을 여기서 센다.
 *
 * 무엇을 겹치는가
 *   · 양쪽 다샤 — 결혼을 여는 행성(7궁주·다라카라카·금성·목성)이 돌아왔는가
 *   · 양쪽 자미 부처궁 — 대한·유년에서 그 자리가 켜졌는가
 *   · 양쪽 사주 — 일지와 그 해 간지가 맺히는가
 *   · 합성 차트 — 관계 자체의 시계에 느린 행성이 걸렸는가
 *   · 시너스트리·아쉬타쿠타 — 관계의 성질 (기존 compare 를 그대로 쓴다)
 *
 * 여기서도 새 계산식을 만들지 않는다. 이미 있는 모듈이 구한 값을 두 벌
 * 만들어 같은 시간 축에 놓고 겹치는 해를 셀 뿐이다.
 */

import { toJD } from '../core/astro.js';
import { yearPillar, tenGod, TEN_GOD_GROUP, branchRelations } from '../core/ganzhi.js';
import * as WS from './western.js';
import * as WE from './westernExt.js';
import * as VD from './vedic.js';
import * as VE from './vedicExt.js';
import * as ZW from './ziwei.js';
import * as ZE from './ziweiExt.js';

/** 결혼을 여는 자리 — 이 행성의 다샤가 돌면 그 주제가 무대에 오른다 */
function marriageActivators(input) {
  const mp = VE.marriagePack(input);
  if (!mp) return [];
  return [...new Set([...(mp.activators ?? []), '금성', '목성'].filter(Boolean))];
}

/** 한 사람의 한 해 — 결혼 쪽이 몇 갈래에서 켜졌는가 */
function personYear(input, chart, year, ctx) {
  const jd = toJD(year, 7, 1, 12);
  const hits = [];

  // ① 베딕 다샤 — 결혼을 여는 행성이 MD/AD/PD 에 들었는가
  const d = VD.dashaAt(input, ctx.tree, jd);
  const lords = [d.md?.lord, d.ad?.lord, d.pd?.lord].filter(Boolean);
  const onStage = lords.filter((l) => ctx.activators.includes(l));
  if (onStage.length) {
    hits.push({ system: '베딕', tech: '다샤', w: onStage.length >= 2 ? 2 : 1.2,
      why: `다샤 ${lords.join('–')} 가운데 ${onStage.join('·')}가 결혼 자리를 연다` });
  }

  // ② 서양 프로펙션 — 그 해 무대가 7하우스(짝)인가
  const prof = WE.profection(input, ctx.N, Math.max(0, year - input.year));
  if (prof && [7, 5, 4].includes(prof.house)) {
    hits.push({ system: '점성술', tech: '프로펙션', w: prof.house === 7 ? 2 : 1,
      why: `프로펙션이 ${prof.house}하우스(${prof.topic}) · 그 해 주인 ${prof.timeLord}` });
  }

  // ③ 솔라 아크 — 큰 사건의 해를 좁히는 자리
  const sa = WE.solarArcAt(input, ctx.N, jd);
  const saHit = sa.hits.filter((h) =>
    /금성|목성|DSC|ASC|달/.test(h.from) || /금성|목성|하강점|상승점|달/.test(h.to));
  if (saHit.length) {
    hits.push({ system: '점성술', tech: '솔라아크', w: 1.5,
      why: `솔라 아크 ${saHit[0].from}→${saHit[0].to} ${saHit[0].aspect}` });
  }

  // ④ 자미 — 유년 부처궁이 켜졌는가
  const st = ZW.stackAt(input, year);
  const spouse = ZE.domainPalaces(input, '결혼', st.layers).find((x) => x.palace === '부처궁');
  if (spouse) {
    const lit = spouse.rows.filter((r) => r.sihwa.length || r.lucky.length);
    if (lit.length >= 2 || spouse.repeated.length) {
      hits.push({ system: '자미두수', tech: '유년사화', w: spouse.repeated.length ? 2 : 1.2,
        why: `부처궁이 ${lit.length}개 층에서 켜짐` +
          (spouse.repeated.length ? ` · ${spouse.repeated.map((x) => x.branchName).join(',')}에 겹침` : '') });
    }
  }

  // ⑤ 사주 — 그 해 간지가 일지(배우자 자리)와 맺히는가
  const gz = yearPillar(year);
  const rel = branchRelations(chart.pillars.day.branch, gz.branch);
  const god = TEN_GOD_GROUP[tenGod(chart.dayStem, gz.stem)];
  if (rel.some((x) => x.good)) {
    hits.push({ system: '사주', tech: '세운', w: 1.5,
      why: `세운 ${gz.hanja}가 일지와 ${rel.filter((x) => x.good).map((x) => x.kind).join('·')}` });
  }
  if (god === '관성' || god === '재성') {
    hits.push({ system: '사주', tech: '세운', w: 1,
      why: `세운 천간이 ${god} — 배우자·현실 조건이 무대에 오른다` });
  }

  const systems = [...new Set(hits.map((h) => h.system))];
  const techs = [...new Set(hits.map((h) => h.tech))];
  return {
    year, hits, systems, techs,
    score: Math.round(hits.reduce((t, h) => t + h.w, 0) * 10) / 10,
    dasha: d.label, profection: prof ? `${prof.house}H ${prof.timeLord}` : null,
  };
}

/** 한 사람 몫의 준비물 — 해마다 다시 만들지 않으려고 미리 한 번만 만든다 */
function contextOf(input) {
  return {
    N: WS.natalPack(input),
    tree: VD.dashaTree(input, 3),
    activators: marriageActivators(input),
  };
}

/**
 * 두 사람의 결혼 시기 — 같은 해에 양쪽이 다 켜지는가.
 *
 * @param {object} A {input, chart} 첫 번째 사람
 * @param {object} B {input, chart} 두 번째 사람
 * @param {number} fromYear
 * @param {number} years
 */
export function marriageWindow(A, B, fromYear, years = 6) {
  const ctxA = contextOf(A.input);
  const ctxB = contextOf(B.input);

  const rows = [];
  for (let i = 0; i < years; i++) {
    const y = fromYear + i;
    const a = personYear(A.input, A.chart, y, ctxA);
    const b = personYear(B.input, B.chart, y, ctxB);
    const shared = a.systems.filter((s) => b.systems.includes(s));
    // 두 사람이 **같은 체계에서** 켜진 해만 뜻이 있다.
    //
    // 원래는 `a.systems.length > 0 && b.systems.length > 0` 이었다. 그런데
    // 각자 아무 체계나 하나씩만 켜지면 통과라서, 짝 8쌍 × 20년 = 160 해를
    // 재 보니 **한 번도 걸리지 않았다**. "같이 켜지는 해가 없으면 없다고
    // 말한다"는 장치가 말만 남고 실제로는 늘 열려 있었다는 뜻이다.
    // 주석이 말하는 '겹침'은 공통 체계다. 코드를 주석에 맞춘다.
    const both = shared.length > 0;
    rows.push({
      year: y, a, b, both,
      sharedSystems: shared,
      // 겹친 점수 — 한쪽이 0이면 곱해서 0이 된다. 그것이 이 모델의 핵심이다
      joint: both ? Math.round(Math.min(a.score, b.score) * 10) / 10 : 0,
    });
  }

  const ranked = rows.slice().filter((r) => r.both).sort((x, y) => y.joint - x.joint);
  const best = ranked[0] ?? null;
  const second = ranked[1] ?? null;

  return {
    rows, best, second,
    // 어느 해에도 양쪽이 같이 켜지지 않으면 그렇다고 말한다. 만들지 않는다
    converges: !!best,
  };
}

/** 관계 자체의 시계 — 합성 차트와 데이비슨 */
export function relationshipCharts(A, B, years = []) {
  const comp = WE.compositeChart(A.input, B.input);
  const dav = WE.davisonChart(A.input, B.input);
  const transits = years.map((y) => ({
    year: y,
    hits: WE.compositeTransits(comp, toJD(y, 7, 1, 12)).slice(0, 4),
  })).filter((x) => x.hits.length);
  return { composite: comp, davison: dav, transits };
}

/** D9 를 나란히 놓는다 — 베딕에서 혼인은 D9 로 본다 */
export function navamsaPair(A, B) {
  const a = VE.chart(A.input, 'D9');
  const b = VE.chart(B.input, 'D9');
  if (!a || !b) return null;
  const line = (d) => d.lagna == null ? null : {
    lagna: d.lagnaSign,
    seventh: d.lordOf(7),
    venus: d.planets.금성.signName,
    jupiter: d.planets.목성.signName,
  };
  const A9 = line(a), B9 = line(b);
  return {
    A: A9, B: B9,
    // 두 D9 라그나가 같은 자리이거나 마주 보면 전통적으로 맞물린다고 본다
    lagnaLink: (a.lagna != null && b.lagna != null)
      ? (a.lagna === b.lagna ? '같은 라그나'
        : ((a.lagna - b.lagna + 12) % 12 === 6 ? '마주 보는 라그나' : null))
      : null,
  };
}

/** 프롬프트용 — 두 사람이 겹치는 해를 한 덩이로 */
export function formatPair(mw, rel, nav, nameA, nameB) {
  const out = ['## 두 사람의 결혼 시기 — 양쪽이 같은 체계에서 켜지는 해만 센 것'];
  out.push('겹치는 체계가 없는 해는 0으로 둔다. 혼인은 두 사람의 시계가 같이 돌아야 일어난다고 보는 모델이다.');
  // 이 모델은 아직 검증되지 않았다. 실측 한 건(실제 교제 시작 달)에서
  // 여자 쪽 명반은 144달 중 11위, 남자 쪽은 97위, 두 사람 합산은 12해 중
  // 5위였다 — 합산이 한쪽보다 나아지지 않았다. 사례가 하나뿐이라 결론은
  // 못 내리지만, **합산이 더 믿을 만하다고 말해서는 안 된다.**
  out.push('※ 이 합산 모델은 실측 사례가 하나뿐이고, 그 한 건에서 **합산이 한쪽 명반보다 낫지 않았다.** ' +
    '겹친 해를 근거로 삼되 "두 사람이 같이 켜졌으니 더 확실하다"고는 말하지 말 것.');
  for (const r of mw.rows) {
    if (!r.both) { out.push(`${r.year}: 겹치는 체계 없음 — ${nameA} ${r.a.systems.join('·') || '없음'} / ${nameB} ${r.b.systems.join('·') || '없음'}`); continue; }
    out.push(`${r.year}: 양쪽 켜짐 (겹친 체계 ${r.sharedSystems.join('·') || '없음'})`);
    out.push(`  ${nameA} — ${r.a.hits.map((h) => h.why).join(' / ')}`);
    out.push(`  ${nameB} — ${r.b.hits.map((h) => h.why).join(' / ')}`);
  }
  if (mw.best) {
    out.push(`가장 두터운 해: ${mw.best.year}${mw.second ? `, 그다음 ${mw.second.year}` : ''}`);
  } else {
    out.push('이 기간 안에 양쪽이 같이 켜지는 해가 없다. 시기를 만들어내지 말 것.');
  }
  if (rel) {
    out.push(`합성 차트 ASC ${rel.composite.asc ?? '—'} MC ${rel.composite.mc ?? '—'} · 태양 ${rel.composite.planets.태양}`);
    out.push(`데이비슨 ${rel.davison.at.y}.${rel.davison.at.m} ASC ${rel.davison.asc ?? '—'} · 태양 ${rel.davison.planets.태양}`);
    for (const t of rel.transits) {
      out.push(`  ${t.year} 합성 트랜싯: ${t.hits.map((h) => `${h.planet}-${h.target} ${h.aspect}(${h.orb}°)`).join(', ')}`);
    }
  }
  if (nav) {
    out.push(`D9 ${nameA} 라그나 ${nav.A?.lagna ?? '—'} 7궁주 ${nav.A?.seventh?.lord ?? '—'} / ` +
      `${nameB} 라그나 ${nav.B?.lagna ?? '—'} 7궁주 ${nav.B?.seventh?.lord ?? '—'}` +
      (nav.lagnaLink ? ` · ${nav.lagnaLink}` : ''));
  }
  return out.join('\n');
}
