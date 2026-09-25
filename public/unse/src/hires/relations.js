/**
 * relations.js — 간지 관계를 낱낱이 따지는 층
 *
 * core/ganzhi.js 에 이미 육합·삼합·충·형·해·파·원진이 있다. 거기 있는 것은
 * 그대로 쓰고, 여기서는 시기 해석에 필요해서 없던 것만 더한다.
 *
 *   · 방합(方合) — 계절로 뭉치는 세 지지
 *   · 삼합을 셋(완전)·반합(왕지 포함 둘)·가합(왕지 없는 둘)으로 가름
 *   · 투간(透干) — 지지 속에 숨은 천간이 겉으로 드러났는가
 *   · 지장간 활성 — 들어온 지지가 원국의 어느 지장간을 건드리는가
 *
 * **유파 고지**: 삼합·방합의 부분 결합을 어디까지 인정하느냐는 유파마다 다르다.
 * 여기서는 널리 쓰이는 보수적인 기준 하나를 골라 일관되게 쓴다 —
 *   삼합: 왕지(子午卯酉)가 들어간 둘만 '반합'으로 인정하고,
 *         생지·고지끼리만 만난 둘은 '가합'으로 표시해 무게를 낮춘다.
 *   방합: **세 지지가 모두 모였을 때만** 인정한다. 둘만으로는 세지 않는다.
 *         두 글자 방합까지 세면 거의 모든 달에 방합이 걸려 신호가 아니라
 *         잡음이 된다. 실제로 한 사람의 열두 달을 돌려 보고 확인했다.
 * 새 계산식을 지어낸 것이 아니라, 기존 것을 나눠 이름을 붙이고
 * 인정 범위를 한쪽으로 고정한 것이다.
 */

import {
  STEMS, STEMS_KR, BRANCHES, BRANCHES_KR, ELEMENTS,
  STEM_ELEMENT, STEM_YIN, BRANCH_ELEMENT, HIDDEN_STEMS, MAIN_HIDDEN,
  SIX_HARMONY, TRIPLE_HARMONY, isClash, isHarm, isBreak, punishment,
  isStemCombine, isStemClash, tenGod, TEN_GOD_GROUP,
} from '../core/ganzhi.js';

/** 왕지 — 삼합의 한가운데. 이게 빠지면 합이 제 힘을 못 낸다 */
export const CARDINAL = [0, 3, 6, 9]; // 子卯午酉

/** 방합(方合) — 같은 계절의 세 지지가 한 오행으로 뭉친다 */
export const DIRECTIONAL = [
  { members: [2, 3, 4], element: 0, name: '동방 목' },   // 寅卯辰
  { members: [5, 6, 7], element: 1, name: '남방 화' },   // 巳午未
  { members: [8, 9, 10], element: 3, name: '서방 금' },  // 申酉戌
  { members: [11, 0, 1], element: 4, name: '북방 수' },  // 亥子丑
];

/** 지장간 배분 무게 — core/ganzhi.js 의 elementDistribution 과 같은 값을 쓴다 */
const HIDDEN_WEIGHT = (n) => (n === 2 ? [0.3, 1.0] : [0.2, 0.4, 1.0]);

/**
 * 지지 둘 사이의 관계를 전부 훑는다.
 *
 * core 의 branchRelations 와 달리 삼합을 완전/반합/가합으로 가르고,
 * 방합을 함께 본다. 무게(w)는 해석 레이어가 합산에 쓰는 상대값이다.
 */
export function branchPair(a, b) {
  const out = [];
  if (SIX_HARMONY[a] === b) {
    out.push({ kind: '육합', good: true, w: 1.0, element: null });
  }
  for (const t of TRIPLE_HARMONY) {
    if (t.members.includes(a) && t.members.includes(b) && a !== b) {
      const withCardinal = CARDINAL.includes(a) || CARDINAL.includes(b);
      out.push(withCardinal
        ? { kind: '반합', good: true, w: 0.9, element: t.element }
        : { kind: '가합', good: true, w: 0.4, element: t.element });
    }
  }
  // 방합은 셋이 다 모였을 때만 센다 (fullCombos 가 본다)
  if (isClash(a, b)) out.push({ kind: '충', good: false, w: 1.0, element: null });
  const pun = punishment(a, b);
  if (pun) out.push({ kind: pun, good: false, w: 0.7, element: null });
  if (isHarm(a, b)) out.push({ kind: '해', good: false, w: 0.5, element: null });
  if (isBreak(a, b)) out.push({ kind: '파', good: false, w: 0.4, element: null });
  return out;
}

/** 천간 둘 사이 */
export function stemPair(a, b) {
  if (isStemCombine(a, b)) return { kind: '천간합', good: true, w: 1.0 };
  if (isStemClash(a, b)) return { kind: '천간충', good: false, w: 1.0 };
  return null;
}

/**
 * 세 지지가 모두 모였는가 — 삼합·방합의 완성.
 *
 * 원국만으로 이미 완성돼 있는 합은 시기 신호가 아니다. 평생 그대로이므로
 * 달마다 되풀이 적으면 어느 달이 특별한지 가릴 수 없게 된다. 그래서
 * **들어온 층이 있어야 비로소 완성되는 것만** 돌려준다.
 *
 * @param {number[]} branches 원국 + 들어온 지지를 모두 담은 배열
 * @param {number[]} [natalOnly] 원국 지지만. 주면 원래 있던 합을 걸러낸다
 */
export function fullCombos(branches, natalOnly = null) {
  const set = new Set(branches);
  const base = natalOnly ? new Set(natalOnly) : null;
  const already = (members) => base && members.every((m) => base.has(m));

  const out = [];
  for (const t of TRIPLE_HARMONY) {
    if (t.members.every((m) => set.has(m)) && !already(t.members)) {
      out.push({ kind: '삼합', element: t.element, members: t.members, w: 1.4 });
    }
  }
  for (const d of DIRECTIONAL) {
    if (d.members.every((m) => set.has(m)) && !already(d.members)) {
      out.push({ kind: '방합', element: d.element, members: d.members, w: 1.2 });
    }
  }
  return out;
}

/**
 * 투간(透干) — 지지 속에 숨은 천간이 겉의 천간으로도 나왔는가.
 *
 * 지장간은 숨은 기운이라 그대로는 힘이 약하다. 같은 글자가 천간에 떠 있으면
 * 그 기운이 실제로 쓰인다고 본다. 시기 해석에서 "그 해에 실제로 일어나는가"를
 * 가르는 자리라 따로 센다.
 *
 * @param {number[]} stems    겉으로 드러난 천간들
 * @param {number[]} branches 지지들
 */
export function exposedHiddenStems(stems, branches) {
  const stemSet = new Set(stems);
  const out = [];
  for (const b of branches) {
    HIDDEN_STEMS[b].forEach((s, i, arr) => {
      if (!stemSet.has(s)) return;
      const role = i === arr.length - 1 ? '본기' : i === 0 ? '여기' : '중기';
      out.push({ branch: b, stem: s, role, weight: HIDDEN_WEIGHT(arr.length)[i] });
    });
  }
  return out;
}

/**
 * 들어온 지지가 원국 지지와 만나 어느 지장간을 깨우는가.
 *
 * 합이면 그 지지의 본기가 끌려 나오고, 충이면 지장간이 흔들려 드러난다.
 * 명리에서 "충으로 창고가 열린다(開庫)"고 하는 자리다.
 */
export function activatedHidden(natalBranches, incoming) {
  const out = [];
  for (const nb of natalBranches) {
    const rels = branchPair(nb, incoming);
    if (!rels.length) continue;
    const opened = rels.some((r) => !r.good);   // 충·형·해·파 — 흔들어 연다
    const pulled = rels.some((r) => r.good);    // 합 — 끌어낸다
    const hidden = HIDDEN_STEMS[nb];
    const w = HIDDEN_WEIGHT(hidden.length);
    hidden.forEach((s, i) => {
      // 충은 지장간 전체를 흔들고, 합은 본기만 끌어낸다
      if (opened || (pulled && i === hidden.length - 1)) {
        out.push({
          branch: nb, stem: s, weight: w[i],
          by: rels.map((r) => r.kind).join('·'),
          how: opened ? '충·형으로 열림' : '합으로 끌려 나옴',
        });
      }
    });
  }
  return out;
}

/**
 * 한 시점의 여러 층(원국·대운·세운·월운·일진)을 통째로 맞댄다.
 *
 * @param {Array<{key:string, label:string, stem:number, branch:number, weight:number}>} layers
 * @param {number} dayStem 일간 — 십신 판정 기준
 * @param {number[]} [natalBranches] 원국 지지. 주면 원국에 이미 선 합을 걸러낸다
 */
export function crossLayers(layers, dayStem, natalBranches = null) {
  const stemHits = [];
  const branchHits = [];

  for (let i = 0; i < layers.length; i++) {
    for (let k = i + 1; k < layers.length; k++) {
      const A = layers[i], B = layers[k];
      const sp = stemPair(A.stem, B.stem);
      if (sp) {
        stemHits.push({
          from: A.label, to: B.label, ...sp,
          weight: sp.w * A.weight * B.weight,
          text: `${STEMS[A.stem]}${STEMS[B.stem]} ${sp.kind}`,
        });
      }
      for (const r of branchPair(A.branch, B.branch)) {
        branchHits.push({
          from: A.label, to: B.label, ...r,
          weight: r.w * A.weight * B.weight,
          text: `${BRANCHES[A.branch]}${BRANCHES[B.branch]} ${r.kind}` +
            (r.element != null ? `(${ELEMENTS[r.element]})` : ''),
        });
      }
    }
  }

  const combos = fullCombos(layers.map((l) => l.branch), natalBranches);
  const gods = layers.map((l) => ({
    key: l.key, label: l.label,
    gz: STEMS[l.stem] + BRANCHES[l.branch],
    kr: STEMS_KR[l.stem] + BRANCHES_KR[l.branch],
    stemGod: tenGod(dayStem, l.stem),
    branchGod: tenGod(dayStem, MAIN_HIDDEN[l.branch]),
    stemGroup: TEN_GOD_GROUP[tenGod(dayStem, l.stem)],
    branchGroup: TEN_GOD_GROUP[tenGod(dayStem, MAIN_HIDDEN[l.branch])],
  }));

  const harmony = [...stemHits, ...branchHits].filter((x) => x.good)
    .reduce((t, x) => t + x.weight, 0);
  const friction = [...stemHits, ...branchHits].filter((x) => !x.good)
    .reduce((t, x) => t + x.weight, 0);

  return {
    gods,
    stemHits: stemHits.sort((a, b) => b.weight - a.weight),
    branchHits: branchHits.sort((a, b) => b.weight - a.weight),
    combos,
    harmony: Math.round(harmony * 100) / 100,
    friction: Math.round(friction * 100) / 100,
    net: Math.round((harmony - friction) * 100) / 100,
  };
}

/**
 * 여러 층을 합쳐 오행 분포를 다시 낸다.
 * 원국만 볼 때와 그 달을 얹었을 때가 어떻게 달라지는지 보려고 쓴다.
 * 배분 무게는 core/ganzhi.js 의 elementDistribution 과 같다.
 */
export function layeredElements(layers) {
  const count = [0, 0, 0, 0, 0];
  for (const l of layers) {
    const w = l.weight ?? 1;
    count[STEM_ELEMENT[l.stem]] += 1 * w;
    const hidden = HIDDEN_STEMS[l.branch];
    const hw = HIDDEN_WEIGHT(hidden.length);
    hidden.forEach((s, i) => { count[STEM_ELEMENT[s]] += hw[i] * w; });
  }
  const total = count.reduce((a, b) => a + b, 0);
  return {
    count: count.map((c) => Math.round(c * 10) / 10),
    pct: count.map((c) => (total ? Math.round((c / total) * 1000) / 10 : 0)),
    strongest: count.indexOf(Math.max(...count)),
    weakest: count.indexOf(Math.min(...count)),
  };
}

/** 관계 목록을 한 줄로 접는다 (프롬프트용) */
export function foldRelations(hits, max = 6) {
  return hits.slice(0, max)
    .map((x) => `${x.from}×${x.to} ${x.text}`)
    .join(', ');
}

export { STEMS, BRANCHES, STEMS_KR, BRANCHES_KR, ELEMENTS, STEM_ELEMENT, STEM_YIN, BRANCH_ELEMENT };
