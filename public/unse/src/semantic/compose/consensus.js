/**
 * consensus.js — **겹치면 단정, 갈리면 빼고, 하나뿐이면 보수적으로**
 *
 * 이 저장소는 열다섯을 합치는 방식을 여러 번 실패했다. 그런데 실패한 것은
 * 전부 **평균**이었다 — 상충하는 값을 섞으니 가장 흔한 답으로 수렴했고,
 * 다섯 사람이 전부 같은 직업으로 나온 적도 있다.
 *
 * 여기는 다른 연산이다.
 *
 *   겹친다   → 둘 이상이 같은 쪽. **단정해서 말한다**
 *   갈린다   → 반대쪽이 함께 있다. **아예 뺀다** (섞지 않는다)
 *   하나뿐   → 한 체계만 말한다. **보수적으로 말한다**
 *
 * 평균은 갈리는 것을 가운데로 끌어와 답을 만들지만, 여기는 **갈리는 것을
 * 버린다.** 버리면 남는 것이 적어지는데, 적어진 만큼 남은 것은 단정할 수 있다.
 * "애매하면 보수적, 애매하지 않으면 구체적으로"가 이 규칙의 전부다.
 *
 * ── 쓰는 법 ────────────────────────────────────────────────
 * 주장마다 **stance**(어느 쪽인가)를 붙여 넣는다. stance 가 없으면 견줄 수가
 * 없어 그냥 '하나뿐'으로 다룬다 — 없는 대립을 만들어 내지 않으려는 것이다.
 */

/** 같은 주제 안에서 서로 반대인 짝 */
export const OPPOSITE = {
  많음: '적음', 적음: '많음',
  이름: '늦음', 늦음: '이름',
  딸: '아들', 아들: '딸',
  조직: '자기판', 자기판: '조직',
  지킴: '움직임', 움직임: '지킴',
  쌓임: '샘', 샘: '쌓임',
  드러남: '숨음', 숨음: '드러남',
  하나: '여럿', 여럿: '하나',
};

/**
 * 한 주제에 대한 주장들을 종합한다.
 *
 * @param {{system:string, stance?:string, text:string, source?:string}[]} claims
 * @returns {{verdict:'겹침'|'갈림'|'하나'|'없음', stance:string|null,
 *            agree:object[], against:object[], all:object[], say:string}}
 */
export function consensusOf(claims) {
  const said = claims.filter((c) => c.stance);
  if (!said.length) {
    return { verdict: '없음', stance: null, agree: [], against: [], all: claims,
      say: '이 자리를 말하는 체계가 없습니다.' };
  }

  // 가장 많이 나온 쪽
  const tally = {};
  for (const c of said) tally[c.stance] = (tally[c.stance] ?? 0) + 1;
  const [top] = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const stance = top[0];
  const foe = OPPOSITE[stance];

  const agree = said.filter((c) => c.stance === stance);
  const against = foe ? said.filter((c) => c.stance === foe) : [];

  // 갈린다 — **빼는 것이 이 규칙의 핵심이다.** 섞어서 가운데를 만들지 않는다
  if (against.length) {
    return {
      verdict: '갈림', stance: null, agree, against, all: claims,
      say: `여기는 체계끼리 반대로 말합니다 — ${agree.map((c) => c.system).join('·')}는 "${stance}",`
        + ` ${against.map((c) => c.system).join('·')}는 "${foe}". `
        + `어느 쪽이 맞는지 가릴 근거가 없어 **이 자리는 말하지 않습니다.**`,
    };
  }

  if (agree.length >= 2) {
    return {
      verdict: '겹침', stance, agree, against: [], all: claims,
      say: `${agree.map((c) => c.system).join('·')} ${agree.length}갈래가 같은 쪽입니다.`,
    };
  }

  // 반대가 아닌 다른 말이 함께 있으면 **보완**이다 — 서로 다른 면을 말하는 것이지
  // 다투는 것이 아니다. 이걸 '하나뿐'으로 다루면 전부 물러서게 된다.
  //
  //   상관견관 "자기 기술로" + 관살혼잡 "여러 군데" + 태을 "자리를 지킬 때 유리"
  //   → 셋은 상충하지 않는다. 합치면 한 사람의 모양이 나온다.
  const others = said.filter((c) => c.stance !== stance);
  if (others.length) {
    return {
      verdict: '보완', stance, agree, against: [], others, all: claims,
      say: `${said.map((c) => c.system).join('·')}가 서로 다른 면을 말합니다. 반대말은 없어 합쳐서 봅니다.`,
    };
  }

  return {
    verdict: '하나', stance, agree, against: [], all: claims,
    say: `${agree[0].system} 한 곳에서만 나옵니다. 반대로 보는 곳은 없지만 받쳐 주는 곳도 없습니다.`,
  };
}

/**
 * 상충하지 않는 여러 면을 **한 문장으로 합친다.**
 *
 * 이게 "종합해서 구체적으로"의 실체다. 상충만 빼고 나머지는 이어 붙이면
 * 한 사람의 모양이 나온다 — 하나씩 따로 두고 각각 "한 곳에서만 나온
 * 말입니다"를 붙이면 아무 말도 아니게 된다.
 *
 * @param {{system:string, facet:string}[]} facets 상충 검사를 통과한 면들
 */
export function merge(facets) {
  const fs = facets.filter((f) => f?.facet);
  if (!fs.length) return null;
  if (fs.length === 1) return `${fs[0].facet} (${fs[0].system})`;
  const head = fs.slice(0, -1).map((f) => `${f.facet}(${f.system})`).join(', ');
  const tail = fs[fs.length - 1];
  return `${head}, 그리고 ${tail.facet}(${tail.system})`;
}

/**
 * 숫자 범위를 종합한다 — 자녀 수처럼 값이 견줄 수 있는 자리.
 *
 * **겹치는 구간이 있으면 그 구간만 남긴다.** 겹치지 않으면 갈린 것이고,
 * 갈리면 평균 내지 않는다 — 2명과 5명의 평균 3.5명은 어느 전통의 말도 아니다.
 */
export function consensusRange(ranges) {
  const rs = ranges.filter((r) => Array.isArray(r?.n) && r.n.length === 2);
  if (!rs.length) return { verdict: '없음', n: null, say: '수를 말하는 체계가 없습니다.' };
  if (rs.length === 1) {
    return { verdict: '하나', n: rs[0].n, from: [rs[0].system],
      say: `${rs[0].system} 한 곳에서만 나온 값입니다.` };
  }

  const lo = Math.max(...rs.map((r) => r.n[0]));
  const hi = Math.min(...rs.map((r) => r.n[1]));
  if (lo <= hi) {
    return {
      verdict: '겹침', n: [lo, hi], from: rs.map((r) => r.system),
      say: `${rs.map((r) => r.system).join('·')}가 겹치는 구간입니다.`,
    };
  }
  return {
    verdict: '갈림', n: null, from: rs.map((r) => r.system),
    say: `${rs.map((r) => `${r.system} ${r.n[0]}~${r.n[1]}`).join(' / ')} — 겹치는 구간이 없습니다.`
      + ' 평균을 내면 어느 전통의 말도 아니게 되므로 수를 말하지 않습니다.',
  };
}

/**
 * **범위 대신 순위.**
 *
 * `consensusRange` 는 겹치는 구간을 내는데, 그게 넓으면("2~5명") 답이 아니다.
 * 범위는 넓어질수록 뜻이 없어지지만 **순위는 넓어져도 1위가 남는다.**
 * 불확실한 것과 말하지 못하는 것은 다르다 — 불확실해도 순서는 매길 수 있다.
 *
 * 득표 수로만 줄을 세운다. 없는 가중치를 만들지 않는다.
 *
 * @param {{label:string, votes:{system:string, why?:string}[]}[]} options
 * @returns {{rows:object[], top:object|null, say:string|null}}
 */
export function rankOf(options) {
  const rows = (options ?? [])
    .filter((o) => o?.votes?.length)
    .map((o) => ({ ...o, n: o.votes.length }))
    .sort((a, b) => b.n - a.n);
  if (!rows.length) return { rows: [], top: null, say: null };

  const max = rows[0].n;
  for (const r of rows) {
    // 1위와 같으면 유력, 절반 위면 가능, 그 아래는 낮음. 확률이 아니라 득표다
    r.tier = r.n === max ? '유력' : r.n * 2 >= max ? '가능' : '낮음';
  }
  return {
    rows,
    top: rows[0],
    say: rows.map((r) => `${r.label} ${r.tier}(${r.n}표)`).join(' > '),
  };
}

/**
 * 여러 범위를 **순위로** 편다.
 *
 * 자미 자녀궁에 자미(2~3)·천부(3~5)가 들면 3이 두 표, 2·4·5가 한 표씩이다.
 * "2~5명"이라고 내는 것보다 "3명 유력, 2·4·5명 가능"이 훨씬 쓸모 있다.
 *
 * @param {{system:string, star?:string, n:[number,number]}[]} rows
 */
export function rankRange(rows, unit = '명') {
  const byValue = new Map();
  for (const r of rows ?? []) {
    if (!Array.isArray(r?.n)) continue;
    for (let v = r.n[0]; v <= r.n[1]; v++) {
      if (!byValue.has(v)) byValue.set(v, { label: `${v}${unit}`, value: v, votes: [] });
      byValue.get(v).votes.push({ system: r.system, why: r.star ?? '' });
    }
  }
  return rankOf([...byValue.values()].sort((a, b) => a.value - b.value));
}

/**
 * 종합 결과를 한 문장으로.
 *
 * **애매하지 않으면 구체적으로, 애매하면 보수적으로.** 말투를 바꾸는 것이지
 * 내용을 바꾸는 것이 아니다 — 겹쳤다고 없는 디테일을 붙이지 않는다.
 */
export function phrase(verdict, body) {
  switch (verdict) {
    case '겹침': return body;                                   // 단정
    case '하나': return `${body} 다만 한 곳에서만 나온 말입니다.`;   // 보수적
    case '갈림': return null;                                   // 빼기
    default: return null;
  }
}
