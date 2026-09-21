/**
 * loo.js — **사람 단위** 한 명 빼고 배우기
 *
 * ── 사람 전체를 뺀다 ───────────────────────────────────────
 * P01 의 직업으로 배우고 P01 의 결혼을 채점하면 그것도 누수다. 같은
 * 사람의 다른 칸은 서로 독립이 아니다(같은 명반, 같은 세대, 같은 생활권).
 * 그래서 **분야가 아니라 사람을 통째로** 뺀다.
 *
 * ── 무엇을 '배우는가' ──────────────────────────────────────
 * 이 설계에서 배우는 것은 **체계×분야의 실측 무게 하나뿐**이다. 규칙도
 * 표도 축도 배우지 않는다. 그래야 배운 것이 열한 명에 들러붙지 않는다.
 * 그 무게마저 1.0 쪽으로 강하게 끌어당긴다(reliability.js).
 *
 * ── 비교 대상을 함께 낸다 ──────────────────────────────────
 * 숫자 하나만 보면 좋은지 나쁜지 알 수 없다. 넷과 나란히 놓는다.
 *
 *   고르게 찍기      아무것도 모를 때
 *   한계분포         명반을 안 보고 '흔한 답'만 찍을 때  ← 가장 중요한 기준선
 *   남의 명반        명반을 섞었을 때
 *   최고 단독 체계   합친 것이 정말 나은지
 */

import { interpretSystems } from '../semantic/systems.js';
import { ensemble, poolDomain, perSystemCategories } from '../semantic/ensemble.js';
import { buildWeights } from '../semantic/reliability.js';
import { SYSTEM_IDS } from '../semantic/extract.js';
import { categorize, CATEGORY_SETS } from '../semantic/categories.js';
import {
  scoreOne, summarize, marginalDist, uniformDist, multiLabel, permutationP,
} from './scoring.js';
import { isScorable } from './labels.js';

/**
 * 사람마다 엔진을 한 번만 돌린다.
 *
 * 체계별 축 벡터는 **무게와 무관**하므로 폴드마다 다시 계산할 필요가 없다.
 * 폴드가 바꾸는 것은 합칠 때의 무게뿐이다.
 *
 * @param {Array} people 정답표
 * @param {(birth) => object} run readFortune + stackAt 을 감싼 함수
 */
export function precompute(people, run) {
  return people.map((person) => {
    const { fortune, stack } = run(person.birth);
    const interpreted = interpretSystems(fortune, stack);
    return { id: person.id, person, interpreted };
  });
}

/** 그 분야의 범주 키 목록 */
const keysOf = (domain, output) => Object.keys(CATEGORY_SETS[domain]?.[output] ?? {});

/** 정답 하나를 꺼낸다. 채점 불가면 null */
function truthOf(person, domain, output) {
  const l = person.labels?.[domain];
  if (!isScorable(l)) return null;
  if (domain === 'career' && output === 'industry') return l.category ?? null;
  if (domain === 'career' && output === 'employmentForm') return l.employmentForm ?? null;
  if (domain === 'children' && output === 'count') return l.band ?? null;
  if (domain === 'education' && output === 'path') return l.path ?? null;
  if (domain === 'residence' && output === 'mode') return l.mode ?? null;
  if (domain === 'wealth' && output === 'shape') return l.shape ?? null;
  if (domain === 'relationship' && output === 'unionTiming') return l.unionTiming ?? null;
  return null;
}

/**
 * 훈련 쪽 사람들로 체계×분야 실측 무게를 만든다.
 *
 * 체계 하나가 그 분야에서 정답을 얼마나 위쪽에 놓았는지(순위백분위)의
 * 평균이다. 0.5 가 우연이다. 이 값을 그대로 쓰지 않고 reliability.js 가
 * 1.0 쪽으로 끌어당긴다.
 */
export function calibrateFrom(trainRows, domainOutputs) {
  const acc = {};
  for (const id of SYSTEM_IDS) acc[id] = {};

  for (const { person, interpreted } of trainRows) {
    for (const [domain, output] of domainOutputs) {
      const truth = truthOf(person, domain, output);
      if (!truth) continue;
      for (const s of perSystemCategories(interpreted.byDomain[domain], domain)) {
        const dist = s.categories[output]?.dist;
        if (!dist) continue;
        const sc = scoreOne(dist, truth);
        if (!sc) continue;
        (acc[s.system][domain] ??= []).push(sc.rankPercentile);
      }
    }
  }

  const out = {};
  for (const id of SYSTEM_IDS) {
    out[id] = {};
    for (const [domain, xs] of Object.entries(acc[id])) {
      out[id][domain] = {
        meanRankPercentile: xs.reduce((a, b) => a + b, 0) / xs.length,
        n: xs.length,
      };
    }
  }
  return out;
}

/**
 * 사람 단위 LOO.
 *
 * @param {Array} rows precompute 결과
 * @param {Array<[string,string]>} domainOutputs [['career','industry'], …]
 * @param {object} opts { shuffleRounds }
 */
export function leaveOnePersonOut(rows, domainOutputs, opts = {}) {
  const report = {};

  for (const [domain, output] of domainOutputs) {
    const keys = keysOf(domain, output).concat(
      domain === 'career' && output === 'industry' ? ['other'] : []);
    const pooled = [], uni = [], marg = [], shuffled = [], attrs = [];
    const bySystem = Object.fromEntries(SYSTEM_IDS.map((id) => [id, []]));
    const perPerson = [];
    let atLeastOneTop1 = 0, scorable = 0;

    for (const row of rows) {
      const truth = truthOf(row.person, domain, output);
      if (!truth) continue;
      scorable++;

      // ── 이 사람을 뺀 나머지로만 배운다 ──
      const train = rows.filter((r) => r.id !== row.id);
      const calibration = calibrateFrom(train, domainOutputs);
      const weights = buildWeights(calibration);

      const pool = poolDomain(row.interpreted.byDomain[domain], domain, weights);
      const dist = pool.categories?.[output]?.dist ?? null;
      const s = dist ? scoreOne(dist, truth) : null;
      if (s) pooled.push(s);

      // 기준선 — 한계분포도 **훈련 쪽 라벨만** 본다
      const trainTruths = train.map((r) => truthOf(r.person, domain, output)).filter(Boolean);
      uni.push(scoreOne(uniformDist(keys), truth));
      marg.push(scoreOne(marginalDist(keys, trainTruths), truth));

      // 체계별 단독
      const singles = perSystemCategories(row.interpreted.byDomain[domain], domain);
      let anyTop1 = false;
      for (const sys of singles) {
        const d = sys.categories[output]?.dist;
        if (!d) continue;
        const sc = scoreOne(d, truth);
        if (!sc) continue;
        bySystem[sys.system].push(sc);
        if (sc.top1) anyTop1 = true;
      }
      if (anyTop1) atLeastOneTop1++;

      // 속성 채점 (직업만)
      if (domain === 'career' && output === 'industry' && row.person.labels.career?.attributes) {
        const m = multiLabel(pool.features, row.person.labels.career.attributes);
        if (m) attrs.push(m);
      }

      perPerson.push({
        id: row.id, truth,
        p: s?.p ?? null, rank: s?.rank ?? null, n: s?.n ?? null,
        top1: s?.top1 ?? null,
        predicted: pool.categories?.[output]?.ranked?.slice(0, 3).map((x) => `${x.label} ${x.p}`) ?? [],
      });
    }

    // ── 남의 명반 기준선 ──
    // 사람 i 의 예측을 사람 j 의 정답으로 채점한다. 명반이 그 사람의
    // 것이라는 사실이 기여하는지 보는 자리다.
    const cal = calibrateFrom(rows, domainOutputs);
    const w = buildWeights(cal);
    const dists = rows.map((r) => ({
      id: r.id,
      truth: truthOf(r.person, domain, output),
      dist: poolDomain(r.interpreted.byDomain[domain], domain, w).categories?.[output]?.dist ?? null,
    })).filter((x) => x.truth && x.dist);
    for (const a of dists) for (const b of dists) {
      if (a.id === b.id) continue;
      const sc = scoreOne(a.dist, b.truth);
      if (sc) shuffled.push(sc);
    }

    // ── 순열검정 — 라벨을 섞어도 이만큼 나오는가 ──
    const rounds = opts.shuffleRounds ?? 2000;
    const realLogLoss = summarize(pooled).logLoss;
    const shuffledMeans = [];
    const labels = dists.map((d) => d.truth);
    for (let i = 0; i < rounds; i++) {
      const sh = labels.slice();
      for (let j = sh.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1)); [sh[j], sh[k]] = [sh[k], sh[j]];
      }
      const xs = dists.map((d, idx) => scoreOne(d.dist, sh[idx])).filter(Boolean);
      const m = summarize(xs).logLoss;
      if (m != null) shuffledMeans.push(m);
    }

    report[`${domain}.${output}`] = {
      categories: keys.length,
      scorable,
      pooled: summarize(pooled),
      baselines: {
        uniform: summarize(uni),
        marginal: summarize(marg),
        shuffledChart: summarize(shuffled),
      },
      permutationP: realLogLoss == null ? null : permutationP(realLogLoss, shuffledMeans, true),
      bySystem: Object.fromEntries(SYSTEM_IDS.map((id) => [id, summarize(bySystem[id])])),
      // 폐기한 채점법. 대조용으로만 남긴다
      contrastAtLeastOneTop1: scorable ? Math.round((atLeastOneTop1 / scorable) * 100) / 100 : null,
      attributes: attrs.length ? {
        n: attrs.length,
        precision: avg(attrs.map((a) => a.precision)),
        recall: avg(attrs.map((a) => a.recall)),
        f1: avg(attrs.map((a) => a.f1)),
        brier: avg(attrs.map((a) => a.brier)),
      } : null,
      perPerson,
    };
  }
  return report;
}

const avg = (xs) => {
  const v = xs.filter((x) => x != null);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 1000) / 1000 : null;
};

export { ensemble, categorize };
