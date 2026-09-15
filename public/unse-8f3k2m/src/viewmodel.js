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
import { lifeReading, structureReading, patternReading, innerReading,
         tabooReading, yearTimeline, consensusReading, areaProse,
         monthDays, luckyDays } from './reading.js';

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
 * 이 명반에서 눈에 띄는 것.
 *
 * 아무 사주에나 붙는 말은 넣지 않는다. 후보마다 '얼마나 드문가'를 적어
 * 두고 드문 것부터 고른다. 드묾은 어림이 아니라 규칙에서 나온다 —
 * 세운 간지가 일주와 같은 해는 예순 해에 한 번이다.
 */
function highlights(chart, f, pat, st, inner) {
  const out = [];
  const day = chart.pillars.day;
  const gz = (p) => `${p.hanja}(${p.kr})`;

  const yearGZ = f.year?.period?.ruling;
  if (yearGZ && yearGZ.stem === day.stem && yearGZ.branch === day.branch) {
    out.push({
      rarity: 60, tag: '같은 글자가 돌아온 해', value: gz(day),
      text: '올해의 간지가 태어난 날의 간지와 똑같습니다. 육십갑자가 한 바퀴 돌아 같은 자리에 선 해라, 예전에 한 번 겪은 것과 닮은 국면이 다시 옵니다.',
    });
  }

  for (const p of pat) {
    out.push({ rarity: 20, tag: p.name, value: '', text: p.text });
  }
  for (const line of st.lines.slice(0, 3)) {
    out.push({ rarity: 12, tag: '강하게 드러나는 자리', value: '', text: line });
  }

  // 고르게 퍼진 명반은 위의 어느 후보에도 걸리지 않는다. 그렇다고 이 칸을
  // 비워두면 '아무것도 없는 사람'처럼 보인다. 그럴 때는 원국에서 늘
  // 나오는 것 - 전체 구성과 속엣말 - 을 뒤에 세운다. 순위가 낮으므로
  // 걸린 것이 있으면 밀려난다.
  if (st.head) {
    out.push({ rarity: 3, tag: '전체 구성', value: '', text: st.head });
  }
  if (inner && inner.length) {
    out.push({ rarity: 2, tag: inner[0].title, value: '', text: inner[0].text });
  }
  return out.sort((a, b) => b.rarity - a.rarity).slice(0, 3);
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
  const st = structureReading(r.input, r.chart);
  const pat = patternReading(r.input, r.chart);
  const inner = innerReading(r.input, r.chart);
  const taboo = tabooReading(r.input, r.chart);
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

    highlights: highlights(r.chart, f, pat, st, inner),
    consensus: con['공통'] || null,
    twist: con['갈림'] || null,
    evidence: (area) => evidenceOf(r, f, area),

    me: { inner, taboo, structure: st, patterns: pat },
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
