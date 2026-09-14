/**
 * compat.js — 궁합
 *
 * 개인 운세가 한 사람의 판을 세우는 일이라면, 궁합은 두 판을 겹쳐 놓고
 * 어디가 맞물리고 어디가 어긋나는지를 보는 일이다.
 *
 * 체계마다 궁합 보는 법이 따로 있다. 베딕은 여덟 항목 36점짜리 표가 있고,
 * 숙요는 스물일곱 자리 사이의 거리로 열한 가지 관계를 나누며,
 * 사주는 천간이 손을 잡는지 지지가 부딪치는지를 본다.
 * 그래서 각 모듈이 자기 방식대로 `compare(a, b)`를 내놓고,
 * 여기서는 그 점수와 판정만 모아 겹쳐 본다.
 *
 * 중요한 건 평균이 아니라 **갈리는 지점**이다.
 * 열다섯이 다 좋다고 하면 그냥 좋은 것이고,
 * 절반은 좋다 하고 절반은 어렵다 하면 그 이유가 진짜 정보다.
 */

import { prepareInput, SYSTEMS } from './engine.js';

/** 점수를 다섯 단계로 나눈다 */
export function toVerdict(score) {
  if (score >= 78) return { label: '아주 좋음', tone: 2 };
  if (score >= 62) return { label: '좋음', tone: 1 };
  if (score >= 45) return { label: '무난', tone: 0 };
  if (score >= 30) return { label: '주의', tone: -1 };
  return { label: '어려움', tone: -2 };
}

/**
 * 두 사람의 궁합을 본다.
 * @param {object} formA 첫 번째 사람 (engine.readFortune과 같은 형식)
 * @param {object} formB 두 번째 사람
 */
export function compareFortune(formA, formB) {
  const A = prepareInput(formA);
  const B = prepareInput(formB);
  const bothTimed = A.input.timeKnown && B.input.timeKnown;

  const results = [];
  const skipped = [];
  const errors = [];

  for (const sys of SYSTEMS) {
    if (!sys.compare) {
      skipped.push({ system: sys.meta.name, reason: '이 체계에는 두 사람을 견주는 산법이 없습니다' });
      continue;
    }
    if (sys.meta.requiresTime && !bothTimed) {
      skipped.push({ system: sys.meta.name, reason: '두 사람 모두의 출생 시각이 필요합니다' });
      continue;
    }
    try {
      const r = sys.compare(A.input, B.input);
      r.verdict = r.verdict ?? toVerdict(r.score).label;
      r.tone = toVerdict(r.score).tone;
      results.push(r);
    } catch (e) {
      errors.push({ system: sys.meta.name, message: e.message });
    }
  }

  return {
    A, B,
    results,
    synthesis: synthesizeCompat(results, A.input.name, B.input.name),
    skipped,
    errors,
  };
}

function synthesizeCompat(results, nameA, nameB) {
  if (!results.length) {
    return { score: 0, verdict: '판정 불가', text: '견줄 수 있는 체계가 없습니다.', buckets: {}, split: null, best: [], worst: [] };
  }

  const weights = results.map((r) => r.weight ?? 1);
  const total = weights.reduce((a, b) => a + b, 0);
  const score = Math.round(results.reduce((a, r, i) => a + r.score * weights[i], 0) / total);
  const v = toVerdict(score);

  const buckets = { 좋음: [], 무난: [], 어려움: [] };
  for (const r of results) {
    const key = r.tone > 0 ? '좋음' : r.tone < 0 ? '어려움' : '무난';
    buckets[key].push(r.name);
  }

  const sorted = [...results].sort((a, b) => b.score - a.score);
  const best = sorted.slice(0, 3);
  const worst = sorted.slice(-3).reverse();

  // 의견이 갈리는가 — 좋다는 쪽과 어렵다는 쪽이 둘 다 두툼하면 그 자체가 결론이다
  const good = buckets['좋음'].length;
  const bad = buckets['어려움'].length;
  const split = good >= 3 && bad >= 3;

  const sentences = [];

  sentences.push(
    split
      ? `열다섯 체계의 의견이 갈립니다. ${good}개는 잘 맞는다 하고 ${bad}개는 어렵다고 합니다. ` +
        '이런 조합은 "애매하다"가 아니라 "어떤 면은 아주 잘 맞고 어떤 면은 계속 부딪친다"는 뜻에 가깝습니다. ' +
        '아래에서 어느 쪽이 무엇을 보고 그렇게 말하는지 확인하는 편이 점수보다 쓸모 있습니다.'
      : good > bad * 2
      ? `견준 ${results.length}개 체계 가운데 ${good}개가 잘 맞는 조합이라고 봅니다. 크게 어긋나는 지점 없이 서로를 편하게 하는 관계입니다.`
      : bad > good * 2
      ? `견준 ${results.length}개 체계 가운데 ${bad}개가 쉽지 않다고 봅니다. 다만 이 잣대들은 대부분 혼인을 전제로 만들어진 것이라 항목이 까다롭습니다. 맞지 않는다기보다 서로 신경 써야 할 지점이 많다는 쪽으로 읽으시는 편이 맞습니다.`
      : `잘 맞는다는 쪽이 ${good}개, 무난이 ${buckets['무난'].length}개, 쉽지 않다는 쪽이 ${bad}개입니다. 한쪽으로 쏠리지 않은 평범한 분포입니다.`
  );

  if (best.length) {
    sentences.push(
      `가장 후하게 본 쪽은 ${best.map((r) => `${r.name}(${r.score}점)`).join(', ')}입니다.`
    );
  }
  if (worst.length && worst[0].tone < 1) {
    sentences.push(
      `가장 박하게 본 쪽은 ${worst.map((r) => `${r.name}(${r.score}점)`).join(', ')}입니다. 여기서 지적하는 부분이 실제로 부딪칠 지점일 가능성이 큽니다.`
    );
  }

  return {
    score, verdict: v.label, tone: v.tone,
    buckets, split, best, worst,
    summary: sentences,
    count: results.length,
    names: [nameA, nameB],
  };
}
