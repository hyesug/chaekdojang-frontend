/**
 * viewmodel.js — 계산 결과를 '읽는 순서'로 다시 세운다
 *
 * 계산은 engine/forecast/reading 이 이미 다 해두었다. 이 파일은 아무것도
 * 새로 점치지 않는다. 있는 값을 골라 순서를 바꾸고 이름을 붙일 뿐이다.
 * 여기서 운세 문장을 새로 지어내면 그 순간 이 구조의 뜻이 사라진다.
 *
 * 왜 필요한가 —
 * 예전 화면은 계산한 차례대로 늘어놓았다. 사람이 궁금한 차례는 다르다.
 * "나는 어떤 사람인가 → 지금 왜 이런가 → 올해 뭐가 중요한가 → 왜 그렇게
 * 읽었나" 순이고, 열다섯을 돌린 값어치는 목록이 아니라 '어디서 겹치고
 * 어디서 갈리는가'에 있다.
 */

import { AREAS } from './forecast.js';
import { traitLenses, verdictSummary, compatAxes } from './lens.js';
import { lifeReading, yearTimeline, consensusReading, areaProse,
         monthDays, luckyDays, compatReading,
         PAIR_WEIGHT, PAIR_AREAS } from './reading.js';

/**
 * 명반을 통째로 세우는 넷.
 *
 * 나머지 열하나가 쓸모없다는 뜻이 아니다. 다만 요일 하나로 보는 잣대와
 * 여덟 글자를 세우는 잣대를 같은 한 표로 세면 '몇 개가 같은 말을 하는가'가
 * 뜻을 잃는다. 일치도를 말할 때는 이 넷을 기준으로 센다.
 */
export const CORE_IDS = ['saju', 'jamidusu', 'astrology', 'vedic'];
export const CORE_NAMES = ['사주', '자미두수', '점성술', '베딕'];

/** 한 체계가 여섯 영역 가운데 몇 개를 '앞세운다'고 볼 것인가 */
const TOP_N = 2;

/**
 * 각 체계가 어느 영역을 앞세우는지 미리 추린다.
 *
 * 절대 점수로 자르면 안 된다. 체계마다 점수를 매기는 버릇이 달라서, 후한
 * 체계는 여섯 영역이 다 켜지고 박한 체계는 하나도 안 켜진다. 그러면
 * '몇 개가 같은 곳을 가리키는가'가 체계의 성격만 재게 된다.
 *
 * 그래서 각 체계 안에서 줄을 세우고 위 둘만 '앞세운 영역'으로 본다.
 * 척도가 아니라 순위를 보는 것이라 체계끼리 견줄 수 있다.
 */
function litAreas(block) {
  const byName = new Map();
  for (const area of AREAS) {
    if (area === '총운') continue;
    for (const v of block?.areas?.[area]?.voices ?? []) {
      if (!CORE_NAMES.includes(v.name)) continue;
      if (!byName.has(v.name)) byName.set(v.name, []);
      byName.get(v.name).push({ area, score: v.score });
    }
  }
  const lit = new Map();
  for (const [name, rows] of byName) {
    rows.sort((a, b) => b.score - a.score);
    lit.set(name, new Set(rows.slice(0, TOP_N).map((x) => x.area)));
  }
  return lit;
}

/**
 * 몇 개 체계가 이 주제를 동시에 앞세우는가.
 *
 * 이건 '운이 몇 점인가'가 아니다. 서로 다른 잣대가 같은 곳을 가리키는
 * 횟수다. 넷 중 셋이 같은 곳을 짚으면 점수보다 훨씬 말이 된다.
 */
function activation(lit, area) {
  const names = [...lit.entries()].filter(([, set]) => set.has(area)).map(([n]) => n);
  return { on: names.length, of: lit.size, names };
}

const AREA_LABEL = {
  총운: '전체', 애정운: '관계', 금전운: '돈',
  직장운: '일', 학업운: '배움', 건강운: '몸',
};

/**
 * 열다섯 체계가 각자 어떤 성향을 가장 먼저 들었는지 한 줄로 보여준다.
 *
 * 여기서는 새 해석을 만들지 않는다. 각 체계가 종합용으로 이미 낸 tags를
 * 사람이 바로 읽을 수 있는 짧은 표현으로만 바꾼다. 아래의 공통 리딩은
 * 이 한 줄들 가운데 실제로 여러 체계가 겹친 것만 다시 자세히 푼다.
 */
const TAG_SYSTEM_LINE = {
  독립: '자기 기준을 세우는 편',
  주도: '먼저 방향을 잡는 편',
  결단: '판단 뒤 정리가 빠른 편',
  실행: '생각을 행동으로 옮기는 편',
  책임: '맡은 것을 오래 붙드는 편',
  표현: '생각을 밖으로 꺼내는 편',
  사교: '사람 사이에서 힘을 얻는 편',
  자유: '선택권과 자율성을 중시',
  변화: '익숙함보다 변화를 향하는 편',
  내향: '안에서 정리한 뒤 움직이는 편',
  직관: '설명보다 감각이 먼저 오는 편',
  감수성: '분위기와 감정 변화에 민감',
  돌봄: '주변 사람을 챙기는 편',
  분석: '조건과 근거를 확인하는 편',
  학습: '배우고 연결하는 힘이 두드러짐',
  완벽: '기준을 높게 잡고 다듬는 편',
  인내: '시간을 들여 버티는 힘이 있음',
  안정: '흔들리지 않는 기반을 중시',
  재물: '자원과 실리를 따지는 감각',
  명예: '역할과 인정의 의미를 중시',
};

function systemPortraits(r) {
  return r.results.map((sys) => {
    const tags = (sys.signals?.tags ?? []).slice(0, 2);
    const line = tags.map((t) => TAG_SYSTEM_LINE[t]).filter(Boolean).join(' · ')
      || sys.readings?.[0]?.title
      || sys.headline
      || '뚜렷한 한 줄 특징 없음';
    return {
      id: sys.id,
      name: sys.name,
      core: CORE_IDS.includes(sys.id),
      line,
      tags,
      headline: sys.headline,
    };
  });
}

/** 공통 리딩은 실제로 두 체계 이상이 같은 태그를 든 것만 남긴다. */
function commonTraitLenses(r, n = 4) {
  return traitLenses(r, 20)
    .filter((x) =>
      x.coreCount >= 2 ||
      (x.coreCount === 1 && x.total >= 2) ||
      (x.coreCount === 0 && x.total >= 3)
    )
    .slice(0, n);
}

/** 지금 가장 세게 켜져 있는 주제. 점수 순이 아니라 합의 순이다 */
function currentThemes(f) {
  const lit = litAreas(f.year);
  return AREAS.filter((a) => a !== '총운')
    .map((area) => ({ area, label: AREA_LABEL[area], ...activation(lit, area) }))
    .sort((a, b) => b.on - a.on || AREAS.indexOf(a.area) - AREAS.indexOf(b.area));
}

/** 그 주제를 뒷받침한 근거 — 어느 체계의 무슨 값인지 */
function evidenceOf(r, f, area) {
  const lit = litAreas(f.year);
  const out = [];
  for (const id of CORE_IDS) {
    const sys = r.results.find((x) => x.id === id);
    if (!sys) continue;
    out.push({
      name: sys.name,
      headline: sys.headline,
      facts: sys.facts.slice(0, 2).map((x) => `${x.label} ${x.value}`),
      lit: lit.has(sys.name) ? lit.get(sys.name).has(area) : null,
    });
  }
  return out;
}


/**
 * 출생 시각을 얼마나 믿을 수 있는가.
 *
 * 태어난 시각을 분 단위로 아는 사람은 드물다. 병원 기록이 있어도 적는
 * 사람에 따라 몇 분씩 다르고, 대개는 "아침 무렵"처럼 기억으로 남는다.
 *
 * 그런데 시각에 따라 크게 흔들리는 값과 꿈쩍도 하지 않는 값이 나뉜다.
 * 상승점은 두 시간에 한 별자리씩 넘어가니 15분 차이로도 바뀔 수 있고,
 * 사주 네 기둥은 두 시간 단위라 웬만해선 그대로다. 그 차이를 감추면
 * 사람은 모든 값을 같은 무게로 믿게 된다.
 *
 * 그래서 앞뒤로 흔들어 보고 무엇이 바뀌는지 그대로 보여준다.
 *
 * @param {function} calc  시각을 바꿔 다시 계산하는 함수 (ui 가 넘긴다)
 */
export function sensitivity(form, calc, minutes = 30) {
  if (form.hour == null) return null;

  const shift = (delta) => {
    const total = form.hour * 60 + (form.minute ?? 0) + delta;
    if (total < 0 || total >= 24 * 60) return null;     // 날짜를 넘기면 다른 이야기가 된다
    return calc({ ...form, hour: Math.floor(total / 60), minute: total % 60 });
  };

  const base = calc(form);
  const lo = shift(-minutes);
  const hi = shift(minutes);
  if (!lo || !hi) return null;

  const pick = (r) => {
    const f = (id, label) => {
      const sys = r.results.find((x) => x.id === id);
      if (!sys) return '—';
      const hit = sys.facts.find((x) => x.label === label);
      return hit ? hit.value : '—';
    };
    return {
      '사주 시주': r.chart.pillars.hour ? r.chart.pillars.hour.hanja : '—',
      '자미 명궁': f('jamidusu', '명궁'),
      '서양 상승점': f('astrology', '상승점'),
      '서양 중천': f('astrology', '중천'),
      '베딕 라그나': f('vedic', '라그나'),
      '베딕 나크샤트라': f('vedic', '나크샤트라'),
    };
  };

  const b = pick(base), l = pick(lo), h = pick(hi);
  // 별자리 이름만 견준다. 도수는 당연히 바뀌므로 비교해봐야 다 '바뀜'이 된다.
  const nameOnly = (x) => String(x).split(' ')[0];
  const rows = Object.keys(b).map((k) => ({
    key: k,
    value: b[k],
    stable: nameOnly(l[k]) === nameOnly(b[k]) && nameOnly(h[k]) === nameOnly(b[k]),
    range: nameOnly(l[k]) === nameOnly(h[k]) ? null : `${nameOnly(l[k])} ~ ${nameOnly(h[k])}`,
  }));

  return { minutes, rows, shaky: rows.filter((x) => !x.stable).length };
}

/**
 * 결과 전체를 화면이 읽을 수 있는 모양으로.
 *
 * @param {object} form  사용자 입력
 * @param {object} r     readFortune 결과
 * @param {object} f     readForecast 결과
 */
export function buildView(form, r, f) {
  const s = r.synthesis;
  const life = lifeReading(r.input, r.chart, s);
  const con = consensusReading(r, f.year);
  const timeline = yearTimeline(r.input, r.chart, f.today.y - 1, f.today.y + 2);
  const thisYear = timeline.find((x) => x.year === f.today.y) ?? timeline[0];
  const days = monthDays(r.input, r.chart, f.today.y, f.today.m);
  const lucky = luckyDays(days, life.meta.weak);
  const today = days.find((x) => x.d === f.today.d) ?? days[0];

  const themes = currentThemes(f);
  const top = themes[0];

  const sharedCore = s.sharedTags
    .map((t) => ({ ...t, core: t.from.filter((n) => CORE_NAMES.includes(n)).length }))
    .sort((a, b) => b.core - a.core || b.count - a.count);

  const p2 = (n) => String(n).padStart(2, '0');

  return {
    who: {
      name: form.name,
      year: f.today.y,
      born: `${form.year}.${p2(form.month)}.${p2(form.day)}` +
        (form.hour == null ? ' · 시각 미상' : ` ${p2(form.hour)}:${p2(form.minute)}`) +
        ` · ${form.birthPlace}`,
    },

    hero: {
      theme: thisYear ? thisYear.text : '',
      tag: thisYear ? thisYear.tag : '',
      keywords: sharedCore.slice(0, 4).map((t) => t.word),
      agree: { on: top ? top.on : 0, of: top ? top.of : CORE_IDS.length, area: top ? top.label : '' },
      themes,
    },

    twist: con['갈림'] || null,
    evidence: (area) => evidenceOf(r, f, area),

    me: {
      systems: systemPortraits(r),
      lenses: commonTraitLenses(r, 4),
      systemCount: r.results.length,
    },
    now: {
      today, line: today ? today.line : '', grade: today ? today.grade : '',
      week: f.week, year: areaProse(f.year, '총운', form.day + form.month, r.chart),
    },
    work: {
      career: life.career,
      money: areaProse(f.year, '금전운', 7, r.chart),
      job: areaProse(f.year, '직장운', 11, r.chart),
    },
    love: { spouse: life.spouse, area: areaProse(f.year, '애정운', 3, r.chart) },
    ahead: { timeline, bond: timeline.filter((x) => x.bond).map((x) => x.year) },
    month: { days, lucky, label: `${f.today.m}월` },
    life,
    raw: { r, f },
  };
}

/* ═══════════════════════════════════════════════════════════
   궁합 - 체계별 결론을 주제별 결론으로 되돌린다
   ═══════════════════════════════════════════════════════════ */

/** 축마다 사람이 실제로 궁금해하는 말 */
const AXIS_LABEL = {
  끌림: '서로 끌리는 힘',
  현실: '같이 사는 일',
  돈: '돈에 대해',
  대화: '말이 통하는가',
  오래: '오래 가는가',
};

/**
 * 궁합 결과를 주제 축으로 다시 세운다.
 *
 * 예전 화면은 '사주 좋음 / 자미 주의 / 베딕 어려움'처럼 체계별 판정을
 * 늘어놓았다. 그런데 사람이 궁금한 것은 체계가 아니라 축이다 - 끌리는가,
 * 같이 살 만한가, 돈 이야기가 되는가, 말이 통하는가, 오래 가는가.
 *
 * 계산은 이미 축마다 가중치를 달리 매겨 두었다(PAIR_WEIGHT). 여기서는
 * 그 가중치를 그대로 근거로 뒤집어, 축마다 '어느 체계가 이 축을 주로
 * 보는가'와 '그 체계가 무엇을 근거로 그렇게 말하는가'를 붙인다.
 */
export function buildCompatView(formA, formB, c) {
  const cr = compatReading(c);
  const s = c.synthesis;

  // 다섯 축의 점수를 먼저 구한다. 여덟 축은 이걸 겹쳐 읽는다.
  const scores = {};
  const evidenceByAxis = {};
  PAIR_AREAS.forEach((area, i) => {
    let sum = 0, w = 0;
    const ranked = c.results
      .map((r) => ({ r, w: (PAIR_WEIGHT[r.id]?.[i] ?? 0.5) * (r.weight ?? 1) }))
      .sort((a, b) => b.w - a.w);
    for (const { r, w: rw } of ranked) { sum += r.score * rw; w += rw; }
    scores[area] = w ? sum / w : 50;

    const lead = ranked.filter((x) => CORE_IDS.includes(x.r.id)).slice(0, 4);
    evidenceByAxis[area] = (lead.length ? lead : ranked.slice(0, 3)).map(({ r, w: rw }) => ({
      name: r.name, verdict: r.verdict, tone: r.tone, headline: r.headline,
      facts: r.facts.slice(0, 2).map((x) => `${x.label} ${x.value}`),
      lead: rw >= 1,
    }));
  });

  const eightAxes = compatAxes(scores, (k) => evidenceByAxis[k] ?? []);
  if (globalThis.__AXIS_PROBE) globalThis.__AXIS_PROBE.push({ ...scores });

  const axes = PAIR_AREAS.map((area, i) => {
    // 이 축을 주로 보는 체계 순으로. 가중치는 이미 정해져 있다.
    const ranked = c.results
      .map((r) => ({ r, w: (PAIR_WEIGHT[r.id]?.[i] ?? 0.5) * (r.weight ?? 1) }))
      .sort((a, b) => b.w - a.w);

    const lead = ranked.filter((x) => CORE_IDS.includes(x.r.id)).slice(0, 4);
    const evidence = (lead.length ? lead : ranked.slice(0, 3)).map(({ r, w }) => ({
      name: r.name,
      verdict: r.verdict,
      tone: r.tone,
      headline: r.headline,
      facts: r.facts.slice(0, 2).map((x) => `${x.label} ${x.value}`),
      // 이 축에서 그 체계의 말이 얼마나 무겁게 실렸는가
      lead: w >= 1,
    }));

    return {
      key: area,
      label: AXIS_LABEL[area] ?? area,
      text: cr[area] ? cr[area].text : '',
      evidence,
      // 갈린다고 말하려면 두 가지가 같이 있어야 한다. 한쪽은 좋다 하고
      // 다른 쪽은 어렵다고 할 것, 그리고 그 둘이 이 축을 주로 보는
      // 체계일 것. 핵심 넷 전체로 세면 어느 축에나 같은 표가 붙어서
      // 축마다 다른 말을 하지 못한다.
      split: (() => {
        const lead = evidence.filter((e) => e.lead);
        const pool = lead.length >= 2 ? lead : evidence;
        return pool.some((e) => e.tone > 0) && pool.some((e) => e.tone < 0);
      })(),
    };
  });

  return {
    who: { a: formA.name, b: formB.name },
    verdict: s.verdict,
    counts: verdictSummary(s.buckets, s.coreBuckets),
    eightAxes,
    core: s.coreBuckets ?? null,
    buckets: s.buckets,
    summary: cr['총평'] ? cr['총평'].text : '',
    axes,
    strong: cr['강점'] ?? null,
    friction: cr['부딪침'] ?? null,
    raw: { c },
  };
}
