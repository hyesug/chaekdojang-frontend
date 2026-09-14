/**
 * synth.js — 종합 레이어
 *
 * 각 체계가 낸 결과를 합쳐 하나의 프로필로 만든다.
 * 원본 해석은 건드리지 않는다. 오직 signals(오행·기질·영역·낱말)만 본다.
 *
 * 여기서 중요한 건 평균이 아니라 일치도다.
 * 열 체계가 다 같은 방향을 가리키면 그건 강한 신호고,
 * 흩어져 있으면 "그 부분은 뚜렷하지 않다"가 정직한 결론이다.
 * 평균만 내면 이 둘이 구분되지 않는다.
 */

import { ELEMENT_NAMES, TRAIT_NAMES, DOMAIN_NAMES } from './systems/_base.js';
import { j } from './core/josa.js';

const TRAIT_POLES = {
  주도: ['따라가는', '이끄는'],
  외향: ['안으로 향하는', '밖으로 향하는'],
  감성: ['이성으로 판단하는', '감각으로 판단하는'],
  안정: ['움직이는', '머무르는'],
  실리: ['이상을 좇는', '실속을 챙기는'],
};

const TRAIT_SENTENCE = {
  주도: ['판을 직접 열기보다 좋은 판에 올라타는 편입니다.', '결국 자기가 키를 쥐어야 마음이 놓이는 사람입니다.'],
  외향: ['혼자 있는 시간에 충전되는 사람입니다.', '사람 속에서 힘을 얻는 사람입니다.'],
  감성: ['근거와 구조로 결정하는 쪽입니다.', '분위기와 느낌을 먼저 읽는 쪽입니다.'],
  안정: ['한자리에 오래 머물면 힘을 잃습니다.', '자리를 지키면서 쌓아 올리는 쪽이 맞습니다.'],
  실리: ['의미가 없으면 못 견디는 쪽입니다.', '손에 잡히는 것으로 확인해야 하는 쪽입니다.'],
};

const DOMAIN_LABEL = {
  재물: '재물과 자원',
  관계: '사람과 인연',
  직업: '일과 자리',
  건강: '몸과 체력',
  학업: '배움과 전문성',
};

/**
 * @param {Array} results 각 체계 모듈의 결과 배열
 */
export function synthesize(results) {
  const active = results.filter((r) => r.confidence > 0);
  const totalWeight = active.reduce((a, r) => a + r.confidence, 0) || 1;

  // ── 오행 합산 ──
  const elements = [0, 0, 0, 0, 0];
  for (const r of active) {
    r.signals.elements.forEach((v, i) => { elements[i] += v * r.confidence; });
  }
  const elemSum = elements.reduce((a, b) => a + b, 0) || 1;
  const elemPct = elements.map((v) => (v / elemSum) * 100);
  const strongest = elemPct.indexOf(Math.max(...elemPct));
  const weakest = elemPct.indexOf(Math.min(...elemPct));

  // 각 체계가 저마다 가리킨 오행. 몇 개가 같은 곳을 가리키는지가 일치도다.
  const votes = active
    .map((r) => {
      const e = r.signals.elements;
      const max = Math.max(...e);
      return max > 0 ? { id: r.id, name: r.name, element: e.indexOf(max), weight: r.confidence } : null;
    })
    .filter(Boolean);
  const agreeing = votes.filter((v) => v.element === strongest);
  const voteWeight = votes.reduce((sum, v) => sum + v.weight, 0);
  const agreement = voteWeight ? agreeing.reduce((sum, v) => sum + v.weight, 0) / voteWeight : 0;

  // ── 기질 합산 ──
  const traits = {};
  for (const k of TRAIT_NAMES) {
    let sum = 0;
    for (const r of active) sum += (r.signals.traits[k] ?? 0) * r.confidence;
    traits[k] = sum / totalWeight;
  }

  // ── 영역 점수 ── 말할 게 있는 체계만 센다
  const domains = {};
  for (const k of DOMAIN_NAMES) {
    let sum = 0, w = 0, speakers = [];
    for (const r of active) {
      const v = r.signals.domains[k];
      if (v == null) continue;
      sum += v * r.confidence;
      w += r.confidence;
      speakers.push(r.name);
    }
    domains[k] = w ? { score: Math.round(sum / w), speakers } : { score: null, speakers: [] };
  }
  const ranked = Object.entries(domains)
    .filter(([, v]) => v.score != null)
    .sort((a, b) => b[1].score - a[1].score);

  // ── 태그 ── 여기가 종합의 핵심이다
  // 계보가 다른 체계들이 같은 태그를 가리키면 그게 가장 믿을 만한 신호다.
  const freq = new Map();
  for (const r of active) {
    for (const t of new Set(r.signals.tags)) {
      if (!freq.has(t)) freq.set(t, { from: [], weight: 0 });
      const entry = freq.get(t);
      entry.from.push(r.name);
      entry.weight += r.confidence;
    }
  }
  const allTags = [...freq.entries()]
    .sort((a, b) => b[1].weight - a[1].weight)
    .map(([word, entry]) => ({ word, from: entry.from, count: entry.from.length, weight: entry.weight }));

  const sharedTags = allTags.filter((t) => t.count >= 2);
  const soloTags = allTags.filter((t) => t.count === 1);

  // ── 문장 만들기 ──
  const sentences = [];

  const strongTraits = Object.entries(traits)
    .filter(([, v]) => Math.abs(v) >= 0.25)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  for (const [k, v] of strongTraits.slice(0, 3)) {
    sentences.push(TRAIT_SENTENCE[k][v > 0 ? 1 : 0]);
  }
  if (!strongTraits.length) {
    sentences.push('어느 한쪽으로 뚜렷하게 기울지 않은 구조입니다. 상황에 따라 다른 얼굴을 쓸 수 있다는 뜻이기도 합니다.');
  }

  // 상위 태그 두엇을 문장으로도 풀어준다
  const TAG_SENTENCE = {
    독립: '남의 판에 오래 얹혀 있지 못하고 결국 자기 자리를 만드는 쪽입니다.',
    주도: '누가 키를 쥐고 있는지가 늘 신경 쓰이는 사람입니다.',
    결단: '재고 따지기보다 끊어내는 쪽이 편한 사람입니다.',
    실행: '생각을 오래 굴리기보다 일단 해보면서 아는 쪽입니다.',
    책임: '맡은 것을 안 놓는 대신 그 무게를 혼자 집니다.',
    표현: '안에 있는 것을 밖으로 꺼내야 풀리는 사람입니다.',
    사교: '사람 사이에 있을 때 일이 생기고 기회도 거기서 옵니다.',
    자유: '묶이는 조건에서 가장 크게 답답해합니다.',
    변화: '같은 자리에 오래 있으면 스스로 판을 흔듭니다.',
    내향: '혼자 있는 시간이 사치가 아니라 필수인 쪽입니다.',
    직관: '설명하기 전에 먼저 알아차리는 편이고, 대개 그 감이 맞습니다.',
    감수성: '남의 감정이 그대로 넘어와서 잘 알아채고 잘 지칩니다.',
    돌봄: '누군가를 챙기는 자리에 자꾸 놓이게 됩니다.',
    분석: '근거가 서지 않으면 못 움직이는 쪽입니다.',
    학습: '배우고 정리해서 자기 것으로 만드는 데 강합니다.',
    완벽: '어설픈 것을 그냥 지나치지 못해 스스로를 깎습니다.',
    인내: '빨리 가는 대신 오래 가는 쪽으로 이깁니다.',
    안정: '흔들리는 상황에서 기댈 곳이 되어주는 사람입니다.',
    재물: '손에 잡히는 것으로 확인해야 마음이 놓입니다.',
    명예: '무엇을 받느냐보다 어떻게 불리느냐가 더 중요한 쪽입니다.',
  };
  for (const t of sharedTags.slice(0, 2)) {
    if (t.count >= 3 && TAG_SENTENCE[t.word]) sentences.push(TAG_SENTENCE[t.word]);
  }

  const elementText =
    agreement >= 0.5
      ? `산법 성격을 반영한 가중 집계에서 ${Math.round(agreement * 100)}%가 ${j(ELEMENT_NAMES[strongest], '을')} 가리킵니다. 오행 환산 기준이 서로 다른데도 같은 쪽으로 모였습니다.`
      : `오행으로 환산했을 때는 방향이 갈립니다(가장 많은 쪽도 가중 ${Math.round(agreement * 100)}%). 체계마다 오행에 대응시키는 방식이 달라서 원래 잘 모이지 않는 지표입니다.`;

  // ── 합의도 ──
  // 오행보다 태그 쪽이 훨씬 읽을 만한 지표다. 체계마다 오행 환산 방식이
  // 제각각이라 오행 투표는 잘 모이지 않는 반면, 태그는 고정 어휘라 곧바로 겹친다.
  const taggers = active.filter((r) => r.signals.tags.length);
  const taggerWeight = taggers.reduce((sum, r) => sum + r.confidence, 0);
  const top = allTags[0];
  const consensus = top && taggerWeight ? top.weight / taggerWeight : 0;

  const consensusText = !top
    ? '태그를 낸 체계가 없습니다.'
    : consensus >= 0.45
    ? `산법 성격을 반영한 가중 집계의 ${Math.round(consensus * 100)}%가 '${top.word}'에서 만납니다. 서로 다른 계보가 같은 낱말을 가리킨다는 점은 눈여겨볼 만합니다.`
    : consensus >= 0.28
    ? `가중 집계의 ${Math.round(consensus * 100)}%가 '${top.word}'에서 만납니다. 과반은 아니지만 가장 강한 경향으로 참고할 만합니다.`
    : `가장 강한 낱말도 가중 ${Math.round(consensus * 100)}%인 '${top.word}'입니다. 한쪽으로 뚜렷하게 모이지 않는다는 뜻입니다.`;

  return {
    elements: {
      raw: elements.map((v) => Math.round(v * 100) / 100),
      pct: elemPct.map((v) => Math.round(v * 10) / 10),
      strongest, weakest,
      strongestName: ELEMENT_NAMES[strongest],
      weakestName: ELEMENT_NAMES[weakest],
    },
    // 화면 머리에 세우는 숫자 — 가장 많이 겹친 낱말의 비율
    consensus: {
      ratio: Math.round(consensus * 100),
      word: top?.word ?? null,
      count: top?.count ?? 0,
      total: taggers.length,
      from: top?.from ?? [],
      text: consensusText,
    },
    // 오행 쪽 합의는 참고용으로 따로 둔다
    elementAgreement: {
      ratio: Math.round(agreement * 100),
      total: votes.length,
      agreeing: agreeing.map((v) => v.name),
      dissenting: votes.filter((v) => v.element !== strongest)
        .map((v) => ({ name: v.name, element: ELEMENT_NAMES[v.element] })),
      text: elementText,
    },
    traits: Object.fromEntries(
      Object.entries(traits).map(([k, v]) => [k, {
        value: Math.round(v * 100) / 100,
        pole: TRAIT_POLES[k][v > 0 ? 1 : 0],
        strength: Math.abs(v),
      }])
    ),
    domains,
    ranked: ranked.map(([k, v]) => ({ key: k, label: DOMAIN_LABEL[k], ...v })),
    sharedTags,
    soloTags,
    summary: sentences,
    systemCount: active.length,
  };
}
