/**
 * forecast.js — 시기 운세
 *
 * 지금까지의 두 기능과 보는 것이 다르다.
 *   개인 운세 — 타고난 명반. 평생 바뀌지 않는다.
 *   궁합      — 두 명반을 겹친 것.
 *   시기 운세 — 명반에 "지금"을 얹은 것. 날마다 달마다 바뀐다.
 *
 * 동양 명리에서는 이걸 대운·세운·월운·일운이라 부르고,
 * 서양 점성술에서는 트랜싯이라 부른다. 이름은 달라도 방식은 같다.
 * 고정된 원국에 움직이는 지금을 대보고, 어디가 맞물리고 어디가 부딪치는지 본다.
 *
 * 각 체계는 `forecast(input, chart, period)` 로 그 시기에 대한 점수를 낸다.
 * 여기서는 그걸 여섯 영역으로 모은다.
 */

import { toJD, toJDN, fromJD, prevSolarTermJD, solarTermSector, solarTermJD } from './core/astro.js';
import { j } from './core/josa.js';
import { ganzhiName, yearPillar, STEMS_KR, BRANCHES_KR } from './core/ganzhi.js';
import { prepareInput, SYSTEMS } from './engine.js';

/** 여섯 영역. 총운은 나머지를 아우르는 자리다 */
export const AREAS = ['총운', '애정운', '금전운', '직장운', '학업운', '건강운'];

export const AREA_DESC = {
  총운: '그 시기 전체의 기운',
  애정운: '인연과 관계',
  금전운: '돈이 들고 나는 흐름',
  직장운: '일과 자리',
  학업운: '배움과 시험',
  건강운: '몸과 체력',
};

export const zeroAreas = () => ({ 총운: null, 애정운: null, 금전운: null, 직장운: null, 학업운: null, 건강운: null });

// ─────────────────────────────────────────────────────────────
// 시기 만들기
// ─────────────────────────────────────────────────────────────

const KST = 9 / 24;

/** 한국 시각 기준 오늘 */
export function todayKST(now = new Date()) {
  const k = new Date(now.getTime() + 9 * 3600000);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth() + 1, d: k.getUTCDate() };
}

/**
 * 시기 하나를 만든다.
 *
 * 날짜는 그날 정오(한국 시각)를 대표 시각으로 잡는다.
 * 달과 해는 절기를 기준으로 삼는다 — 명리에서 한 해는 입춘에,
 * 한 달은 절기에 바뀌지 달력 1일에 바뀌지 않기 때문이다.
 *
 * @param {'day'|'month'|'year'} kind
 * @param {{y:number,m:number,d:number}} on
 */
export function makePeriod(kind, on, atJD = null) {
  // 절기 경계를 다룰 때는 정오가 아니라 절입 직후 시각을 받아야 한다.
  // 절입이 그날 오후면 정오는 아직 이전 달이라 한 칸씩 밀린다.
  const jd = atJD ?? (toJD(on.y, on.m, on.d ?? 15, 12) - KST);
  const jdn = toJDN(on.y, on.m, on.d ?? 15);

  // 그 시점이 속한 사주 연도 (입춘 기준)
  const sajuYear = fromJD(prevSolarTermJD(315, jd) + KST).y;
  const sector = solarTermSector(jd);

  const yearGZ = yearPillar(sajuYear);
  const monthBranch = (sector.index + 2) % 12;
  const monthStem = (((yearGZ.stem % 5) * 2 + 2) % 10 + sector.index) % 10;
  const monthGZ = ganzhiName(monthStem, monthBranch);
  const dayGZ = ganzhiName((jdn + 9) % 10, (jdn + 1) % 12);

  const WD = ['일', '월', '화', '수', '목', '금', '토'][(jdn + 1) % 7];

  const label =
    kind === 'day' ? `${on.y}년 ${on.m}월 ${on.d}일 (${WD})`
    : kind === 'month' ? `${on.y}년 ${on.m}월`
    : `${on.y}년`;

  return {
    kind, label, on, jd, jdn, weekday: WD,
    sajuYear, sectorIndex: sector.index,
    gz: { year: yearGZ, month: monthGZ, day: dayGZ },
    // 그 시기를 대표하는 간지 — 일운은 일진, 월운은 월건, 연운은 세운
    ruling: kind === 'day' ? dayGZ : kind === 'month' ? monthGZ : yearGZ,
  };
}

/** 한 해의 열두 절기월을 만든다. 달력 달이 아니라 절기 기준이다 */
export function monthsOfYear(year) {
  const out = [];
  // 입춘 직전에서 출발해 절기를 차례로 밟아 나간다.
  // 마지막 축월(소한)은 이듬해 1월로 넘어가는데, 이렇게 걸어가면 저절로 맞는다.
  let from = toJD(year, 1, 20) - KST;
  for (let i = 0; i < 12; i++) {
    const lon = (315 + i * 30) % 360;
    const start = solarTermJD(lon, from);
    const t = fromJD(start + KST);
    // 절입 시각 바로 뒤를 대표 시각으로 삼는다
    const p = makePeriod('month', { y: t.y, m: t.m, d: t.d }, start + 0.02);
    p.termStart = { y: t.y, m: t.m, d: t.d, h: t.h, mi: t.mi };
    p.branchName = BRANCHES_KR[(i + 2) % 12];
    out.push(p);
    from = start + 1;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// 돌리기
// ─────────────────────────────────────────────────────────────

/**
 * 한 시기에 대해 열다섯 체계를 돌린다.
 */
export function forecastPeriod(input, chart, period) {
  const results = [];
  const errors = [];
  for (const sys of SYSTEMS) {
    if (!sys.forecast) continue;
    if (sys.meta.requiresTime && !input.timeKnown) continue;
    try {
      const r = sys.forecast(input, chart, period);
      if (r) results.push(r);
    } catch (e) {
      errors.push({ system: sys.meta.name, message: e.message });
    }
  }
  return { period, results, errors, ...synthesizeAreas(results, period) };
}

/**
 * 열다섯을 그냥 평균 내면 점수가 전부 50 언저리로 뭉개진다.
 * 서로 다른 신호를 많이 더할수록 가운데로 몰리는 건 당연한 일이라,
 * 그대로 보여주면 여섯 영역이 다 55쯤 나와 아무 정보가 없다.
 *
 * 그래서 평균에서 50만큼 떨어진 거리를 일정 비율로 벌린다.
 * 순위는 그대로 두고 눈금만 늘리는 것이라 없는 차이를 만들어내지는 않는다.
 * 벌리기 전 원점수와 체계별 점수 범위도 함께 들고 다닌다.
 */
// 중심과 배율은 손으로 고른 값이 아니라 실측해서 맞춘 것이다.
// 1950~2005년생 여러 명을 여러 날짜로 돌려 원점수를 1,152건 모아 보니
// 평균 52.3, 표준편차 2.65 였다. 효과 표들이 조금씩 후한 쪽으로 기울어
// 중심이 50이 아니라 52.3 이었던 것이다.
//   중심을 52.3 으로 옮기고 4.5배로 벌리면 50 중심에 표준편차 12쯤이 된다.
// 순위는 그대로 두고 눈금만 바꾸는 일이라 없는 차이를 만들지는 않는다.
// 표를 고칠 때는 scripts/calibrate.mjs 를 다시 돌려 이 값을 갱신할 것.
const CENTER = 52.3;
const SPREAD = 4.5;
const amplify = (v) => Math.max(5, Math.min(95, Math.round(50 + (v - CENTER) * SPREAD)));

/** 여섯 영역으로 모은다 */
function synthesizeAreas(results, period) {
  const areas = {};
  for (const a of AREAS) {
    let sum = 0, w = 0;
    const voices = [];
    for (const r of results) {
      const v = r.areas?.[a];
      if (v == null) continue;
      const weight = r.weight ?? 1;
      sum += v * weight; w += weight;
      voices.push({ name: r.name, score: v });
    }
    voices.sort((x, y) => y.score - x.score);
    const raw = w ? sum / w : null;
    areas[a] = raw == null
      ? { score: null, raw: null, voices: [], count: 0, range: null }
      : {
          score: amplify(raw),
          raw: Math.round(raw * 10) / 10,
          voices,
          count: voices.length,
          range: [voices[voices.length - 1].score, voices[0].score],
        };
  }

  // 총운은 따로 말한 체계가 적으면 나머지 다섯의 평균으로 메운다
  const others = AREAS.slice(1).map((a) => areas[a].raw).filter((v) => v != null);
  if (areas.총운.count < 3 && others.length) {
    const raw = others.reduce((a, b) => a + b, 0) / others.length;
    areas.총운 = { ...areas.총운, raw: Math.round(raw * 10) / 10, score: amplify(raw), derived: true };
  }

  const scored = AREAS.map((a) => ({ area: a, ...areas[a] })).filter((x) => x.score != null);
  const best = [...scored].sort((a, b) => b.score - a.score)[0];
  const worst = [...scored].sort((a, b) => a.score - b.score)[0];

  // 이 시기를 좋게 본 체계와 그렇지 않은 체계
  const votes = results
    .map((r) => ({ name: r.name, score: r.areas?.총운 ?? null }))
    .filter((v) => v.score != null);
  const good = votes.filter((v) => v.score >= 60).length;
  const bad = votes.filter((v) => v.score < 45).length;

  return {
    areas, best, worst,
    agreement: { good, bad, total: votes.length },
    overall: areas.총운.score,
  };
}

// ─────────────────────────────────────────────────────────────
// 영역별 문장
// ─────────────────────────────────────────────────────────────

/** 점수 구간마다 다른 문장을 쓴다. 시기(오늘·달·해)에 따라 말투도 바뀐다 */
const AREA_TEXT = {
  총운: {
    high: ['전반적으로 잘 풀리는 날입니다. 미뤄둔 연락이나 결정을 오늘 처리하세요.',
           '흐름이 순한 달입니다. 벌여도 좋고, 벌인 것을 키워도 좋습니다.',
           '큰 흐름이 받쳐주는 해입니다. 미뤄둔 일을 올해 안에 꺼내는 편이 낫습니다.'],
    mid: ['특별히 좋지도 나쁘지도 않은 날입니다. 하던 대로 하면 됩니다.',
          '평탄한 달입니다. 큰 사건 없이 지나가니 정비하기 좋습니다.',
          '무난한 해입니다. 크게 벌이기보다 하던 것을 다지는 쪽이 맞습니다.'],
    low: ['기운이 눌리는 날입니다. 새로 벌이기보다 마무리에 쓰세요.',
          '버티는 달입니다. 무리하지 않는 것만으로 절반은 넘깁니다.',
          '힘이 드는 해입니다. 확장보다 지키는 쪽으로 방향을 잡으세요.'],
  },
  애정운: {
    high: ['사람이 다가오는 날입니다. 먼저 말을 거는 쪽이 이득입니다.',
           '관계가 따뜻해지는 달입니다. 오래 미룬 자리를 만들기 좋습니다.',
           '인연이 움직이는 해입니다. 만남도 정리도 이 해에 일어나기 쉽습니다.'],
    mid: ['관계에 큰 변화가 없는 날입니다. 평소대로 지내면 됩니다.',
          '조용한 달입니다. 관계를 새로 만들기보다 있는 것을 돌보세요.',
          '관계가 크게 요동치지 않는 해입니다.'],
    low: ['말이 어긋나기 쉬운 날입니다. 예민한 이야기는 미루세요.',
          '서운함이 쌓이기 쉬운 달입니다. 확인하고 넘어가는 습관이 필요합니다.',
          '관계에 힘이 드는 해입니다. 기대치를 낮추면 덜 다칩니다.'],
  },
  금전운: {
    high: ['돈이 들어오는 쪽으로 기울어 있습니다. 미뤄둔 청구나 정산을 오늘 챙기세요.',
           '수입이 늘거나 묶인 돈이 풀리는 달입니다.',
           '재물이 붙는 해입니다. 다만 들어오는 만큼 나갈 자리도 함께 커집니다.'],
    mid: ['특별한 변동이 없습니다. 들어오고 나가는 것이 평소대로입니다.',
          '큰 지출도 큰 수입도 없는 달입니다.',
          '무난한 해입니다. 저축이나 정리에 어울립니다.'],
    low: ['새는 자리가 생기기 쉬운 날입니다. 큰 결제는 하루 미루세요.',
          '지출이 앞서는 달입니다. 보증이나 빌려주는 일은 특히 조심하세요.',
          '재물이 눌리는 해입니다. 벌이기보다 지키는 쪽으로 방향을 잡으세요.'],
  },
  직장운: {
    high: ['일이 손에 붙는 날입니다. 어려운 안건을 오늘 꺼내세요.',
           '인정과 기회가 오는 달입니다. 드러내는 쪽으로 힘을 쓰세요.',
           '자리가 오르거나 판이 바뀌는 해입니다. 책임이 커지는 만큼 소모도 큽니다.'],
    mid: ['평소대로 흘러가는 날입니다.',
          '큰 변화 없이 지나가는 달입니다. 실무를 다지기 좋습니다.',
          '직장에 큰 변동이 없는 해입니다.'],
    low: ['윗선과 부딪치기 쉬운 날입니다. 보고는 짧고 명확하게 하세요.',
          '압박이 커지는 달입니다. 혼자 떠안지 말고 나누세요.',
          '일이 무겁게 눌리는 해입니다. 버티는 것이 곧 성과입니다.'],
  },
  학업운: {
    high: ['머리가 맑은 날입니다. 어려운 것부터 손대세요.',
           '집중이 붙는 달입니다. 시험이나 자격 준비에 좋습니다.',
           '배움이 쌓이는 해입니다. 자격·시험·문서에 힘이 실립니다.'],
    mid: ['평소만큼 됩니다. 무리하지 않아도 유지는 됩니다.',
          '꾸준히 하면 유지되는 달입니다.',
          '학업에 큰 기복이 없는 해입니다.'],
    low: ['집중이 흩어지는 날입니다. 새 내용보다 복습이 낫습니다.',
          '진도가 안 나가는 달입니다. 분량을 줄이고 반복하세요.',
          '성과가 늦게 나오는 해입니다. 조급해지면 더 안 됩니다.'],
  },
  건강운: {
    high: ['몸 상태가 좋은 날입니다. 미뤄둔 운동이나 검진에 어울립니다.',
           '회복이 잘 되는 달입니다.',
           '체력이 받쳐주는 해입니다.'],
    mid: ['특별한 이상 없이 지나갑니다. 평소 리듬을 지키세요.',
          '큰 문제 없는 달입니다.',
          '건강에 큰 기복이 없는 해입니다.'],
    low: ['무리가 가기 쉬운 날입니다. 잠과 끼니를 먼저 챙기세요.',
          '몸이 신호를 보내는 달입니다. 미루던 검진을 잡으세요.',
          '소모가 큰 해입니다. 쉬는 것을 일정에 넣어야 버팁니다.'],
  },
};

const KIND_IDX = { day: 0, month: 1, year: 2 };

/** 점수를 문장으로 */
export function areaText(area, score, kind) {
  const band = score >= 62 ? 'high' : score >= 42 ? 'mid' : 'low';
  return AREA_TEXT[area][band][KIND_IDX[kind] ?? 0];
}

/** 그 시기 전체를 한 줄로 */
export function periodSummary(f) {
  const { best, worst, agreement, period } = f;
  const n = agreement.total;
  const parts = [];
  if (best && worst && best.area !== worst.area) {
    parts.push(`${j(best.area, '이')} 가장 높고 ${j(worst.area, '이')} 가장 낮습니다.`);
  }
  parts.push(
    agreement.good > agreement.bad * 2
      ? `${n}개 체계 가운데 ${agreement.good}개가 이 시기를 좋게 봅니다.`
      : agreement.bad > agreement.good * 2
      ? `${n}개 체계 가운데 ${agreement.bad}개가 이 시기를 조심스럽게 봅니다.`
      : `좋게 본 체계 ${agreement.good}개, 조심스럽게 본 체계 ${agreement.bad}개로 갈립니다.`
  );
  return parts.join(' ');
}

// ─────────────────────────────────────────────────────────────
// 바깥에서 쓰는 입구
// ─────────────────────────────────────────────────────────────

/**
 * 오늘·이번 달·올해를 한 번에 본다.
 * @param {object} form 개인 운세와 같은 형식
 */
export function readForecast(form, now = new Date()) {
  const { input, chart, birth, lunar } = prepareInput(form);
  const t = todayKST(now);

  const day = forecastPeriod(input, chart, makePeriod('day', t));
  const month = forecastPeriod(input, chart, makePeriod('month', t));
  const year = forecastPeriod(input, chart, makePeriod('year', { y: t.y, m: t.m, d: t.d }));

  // 올해 열두 달의 흐름
  const timeline = monthsOfYear(day.period.sajuYear).map((p) => {
    const f = forecastPeriod(input, chart, p);
    return {
      branch: p.branchName,
      gz: p.gz.month,
      from: p.termStart,
      score: f.overall,
      areas: f.areas,
      best: f.best?.area ?? null,
      worst: f.worst?.area ?? null,
    };
  });

  return { input, chart, birth, lunar, today: t, day, month, year, timeline };
}
