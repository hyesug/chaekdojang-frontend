/**
 * timing/selected.js — **리포트와 AI 상담이 같은 시기 창을 쓰도록** 한곳에 둔다.
 *
 * 분야마다 policy.js 가 고른 체계 하나(또는 쌍)만으로 15년 타임라인을 세우고, 점수가 높은 창을
 * 사람이 읽는 말("2027년 3~5월(37세)")로 바꾼다. 정책이 없는 분야(결혼·자녀)는 창을 내지 않는다.
 *
 * `r` 은 `readFortune` 결과 모양 — `{ input }` 만 있으면 된다.
 */
import { reportTimingPolicy } from './policy.js';
import { peakWindows, predictTimeline } from './timeline.js';

// 리포트의 한국어 제목과 15체계 공통 타임라인의 내부 분야를 잇는다.
// 같은 분야에서 여러 산법을 평균내지 않고, policy.js 가 고른 하나의 체계만 준다.
export const REPORT_TIMING_DOMAIN = {
  직업: 'career', 재물: 'wealth', 관계: 'relationship', 결혼: 'marriage',
  자녀: 'children', 이사: 'movement', 주거: 'residence', 건강: 'health',
  학업: 'education', '큰 전환': 'majorChange',
};
// 이 보고서가 실제로 시간 창을 표시하는 분야만 한 번에 계산한다. 나머지 분야도
// policy.js와 학습기에는 남아 있으나, 숨은 분야까지 계산해 첫 화면을 느리게 만들지 않는다.
const REPORT_VISIBLE_TIMING_LABELS = new Set(['직업', '재물', '이사', '건강']);
const reportTimelineCache = new WeakMap();

export function reportTimeline(r) {
  const cached = reportTimelineCache.get(r);
  if (cached) return cached;
  const from = Number(r.input.currentYear);
  const timingPolicy = {};
  for (const [label, domain] of Object.entries(REPORT_TIMING_DOMAIN)) {
    if (!REPORT_VISIBLE_TIMING_LABELS.has(label)) continue;
    const policy = reportTimingPolicy(label);
    if (policy) timingPolicy[domain] = policy;
  }
  try {
    const onlySystems = [...new Set(Object.values(timingPolicy).flatMap((policy) => policy.systems ?? []))];
    const value = predictTimeline({
      birth: r.input, from: `${from}-01`, to: `${from + 14}-12`,
      domains: Object.keys(timingPolicy), timingPolicy, onlySystems,
    });
    reportTimelineCache.set(r, value);
    return value;
  } catch { return null; }
}

/** 이미 결혼했다고 고른 사람인가. 고르지 않았으면 false — 추측하지 않는다 */
export const isMarried = (r) => r.input?.marital === 'married';

/**
 * 지나온 때의 결혼·자녀 신호. 이미 겪은 사람은 실제 시기와 대어 볼 수 있고,
 * 아닌 사람도 지난 인연·계획의 때를 확인할 수 있다. 만 18세부터 — 결혼한 사람의
 * 결혼 신호는 올해까지, 나머지는 앞으로의 신호와 겹치지 않게 작년까지 본다.
 */
const pastCache = new WeakMap();
export function pastWindows(r, label, count = 3) {
  const domain = REPORT_TIMING_DOMAIN[label];
  const cache = pastCache.get(r) ?? new Map();
  pastCache.set(r, cache);
  if (!cache.has(label)) {
    const policy = reportTimingPolicy(label);
    const from = Number(r.input.year) + 18;
    const to = Number(r.input.currentYear) - (label === '결혼' && isMarried(r) ? 0 : 1);
    let windows = [];
    if (domain && policy && from <= to) {
      try {
        const result = predictTimeline({
          birth: r.input, from: `${from}-01`, to: `${to}-12`, domains: [domain],
          timingPolicy: { [domain]: policy }, onlySystems: policy.systems ?? [],
        });
        windows = peakWindows(result, domain, 12, 80);
      } catch { /* 계산 실패 시 과거 신호는 생략 */ }
    }
    cache.set(label, windows);
  }
  return cache.get(label).slice(0, count);
}
export const PAST_DOMAINS = new Set(['결혼', '자녀']);

/** 리포트 화면에 없는 분야(관계·학업 …)는 AI 상담이 물을 때만 그 분야 하나로 세운다 */
const singleCache = new WeakMap();
function singleTimeline(r, label) {
  const cache = singleCache.get(r) ?? new Map();
  singleCache.set(r, cache);
  if (!cache.has(label)) {
    const domain = REPORT_TIMING_DOMAIN[label];
    const policy = reportTimingPolicy(label);
    const from = Number(r.input.currentYear);
    let value = null;
    try {
      value = predictTimeline({ birth: r.input, from: `${from}-01`, to: `${from + 14}-12`,
        domains: [domain], timingPolicy: { [domain]: policy }, onlySystems: policy.systems ?? [] });
    } catch { /* 계산 실패 시 창 없음 */ }
    cache.set(label, value);
  }
  return cache.get(label);
}

/** 한 체계 안에서도 점수가 높은 순서만 뽑되, 표시 범위를 벗어난 창은 버린다. */
export function selectedWindows(r, label, span = 15, count = 3) {
  const domain = REPORT_TIMING_DOMAIN[label];
  const policy = reportTimingPolicy(label);
  const result = !domain || !policy ? null
    : REPORT_VISIBLE_TIMING_LABELS.has(label) ? reportTimeline(r) : singleTimeline(r, label);
  if (!result) return [];
  const until = `${Number(r.input.currentYear) + span - 1}-12`;
  // 결혼과 자녀는 서로 다른 체계로 따로 고른 신호다. 순서를 서로 맞추지 않는다 —
  // 맞추려고 끼워 넣으면 검증된 순위가 아닌 약한 창이 앞에 나왔다(99년생 사례 피드백).
  return peakWindows(result, domain, 12, 80).filter((w) => w.from <= until).slice(0, count);
}

const monthsBetween = (a, b) => {
  const [ay, am] = a.split('-').map(Number); const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
};
const shiftMonth = (key, d) => {
  const [y, m] = key.split('-').map(Number); const n = y * 12 + (m - 1) + d;
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
};

/**
 * "2027-03~2027-05" → "2027년 3~5월(37세)".
 * 반년보다 긴 구간은 그대로 보이면 1년 반짜리 범위가 되어 쓸모가 없다(피드백) —
 * 가장 높은 달을 중심으로 앞뒤 석 달만 보인다: "2027년 7월 전후(2027년 4~10월, 28세)".
 */
export function selectedSpan(r, w) {
  let from = w.from, to = w.to, center = null;
  if (w.peakAt && monthsBetween(w.from, w.to) > 6) {
    center = w.peakAt;
    from = [shiftMonth(center, -3), w.from].sort().at(-1);
    to = [shiftMonth(center, 3), w.to].sort()[0];
  }
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const range = fy === ty
    ? (fm === tm ? `${fy}년 ${fm}월` : `${fy}년 ${fm}~${tm}월`)
    : `${fy}년 ${fm}월~${ty}년 ${tm}월`;
  const fromAge = fy - r.input.year;
  const toAge = ty - r.input.year;
  const age = fromAge === toAge ? `${fromAge}세` : `${fromAge}~${toAge}세`;
  if (center) {
    const [cy, cm] = center.split('-').map(Number);
    return `${cy}년 ${cm}월 전후(${range}, ${age})`;
  }
  return `${range}(${age})`;
}
