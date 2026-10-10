/**
 * body.js — 몸의 어느 자리인가
 *
 * "건강운이 안 좋다"에서 멈추지 않고 **부위**까지 옮기는 층이다.
 * 여기 있는 표는 전부 **문헌에 있는 고정 표**이고, 이 파일에서 새로 만든
 * 대응은 하나도 없다. 표를 지어내면 그 순간 점술이 아니라 창작이 된다.
 *
 * ── 어느 유파를 쓰는가 ─────────────────────────────────────
 *
 * 1. 서양 — **멜로테시아**. 프톨레마이오스 『테트라비블로스』 III권의 사인-신체
 *    배당이고, 이후 서양 점성술에서 사실상 단일 기준이다. 유파 차이가 거의 없는
 *    드문 표라서 이것을 축으로 삼았다.
 *    **좌표는 트로피컬**(이 저장소의 서양 계산이 쓰는 그대로)이다.
 *
 * 2. 사주 — **황제내경**의 오행-장부·오체 배당.
 *    목=간담/근, 화=심소장/혈맥, 토=비위/기육, 금=폐대장/피모, 수=신방광/골.
 *    장부 배당 자체는 표준이다.
 *
 * 3. 베딕 — **미구현.** 칼라푸루샤의 사인-신체 배당은 순서가 서양과 같지만
 *    **사이드리얼이라 같은 도수가 다른 사인이 된다**(아야남사만큼, 약 24°).
 *    트로피컬로 염소(무릎)인 자리가 사이드리얼로는 사수(허벅지)가 된다.
 *    둘을 섞으면 어느 쪽 부위인지 말할 수 없게 되므로 **한쪽만 쓴다.**
 *    베딕 부위를 넣으려면 먼저 어느 좌표로 볼지 정하고 그것만 써야 한다.
 *
 * 4. 자미두수 — **미구현.** 질액궁의 별을 부위로 옮기는 표는 유파 차이가 크고
 *    검증 가능한 단일 기준을 찾지 못했다. 임의로 만들지 않는다.
 *
 * ── 결합 규칙은 돌려 보기 전에 고정했다 ─────────────────────
 *
 * 부위를 사후에 짜맞추면 어떤 답이든 그럴듯한 사슬이 만들어진다(실제로
 * 그렇게 틀린 적이 있다). 그래서 무게를 먼저 적고 그다음에 돌렸다.
 *
 *   · 6하우스(질병·치료)를 **도수로 얼마나 차지하는 사인인가** — 그 비중이 무게
 *   · 그 사인의 **주인 행성 상태** — 흉성과 합이거나 트랜싯에 걸리면 가중
 *   · 6하우스 **안에 실제로 든 행성** — 그 행성이 고전적으로 맡는 부위
 *   · 상승점 사인 — 몸 전체의 바탕. 부위가 아니라 체질이라 무게를 낮게 둔다
 *
 * 사주는 **치우침의 크기**로만 센다. 고른 분포는 20%이므로 거기서 벗어난 만큼이
 * 그 오행 장부의 부담이다. 과다와 결핍을 둘 다 낸다 — 과다는 그 장부가
 * 혹사되는 쪽, 결핍은 받쳐 주지 못하는 쪽이라 뜻이 다르다.
 *
 * 두 체계를 하나의 점수로 합치지 않는다. 각각 내고 **겹치는 부위를 표시**한다.
 * 합치면 어느 체계가 말한 것인지 사라진다.
 */

import { PLANET_ORDER, houseOf } from '../core/planets.js';
import { ELEMENTS } from '../core/ganzhi.js';

// ─────────────────────────────────────────────────────────────
// 표 — 문헌 그대로. 여기를 고칠 일은 없다
// ─────────────────────────────────────────────────────────────

/** 멜로테시아 — 프톨레마이오스 『테트라비블로스』 III권. 사인 12에 몸을 위에서 아래로 배당한다 */
export const MELOTHESIA = [
  { sign: '양자리', parts: ['머리', '얼굴', '뇌'] },
  { sign: '황소', parts: ['목', '인후', '갑상선'] },
  { sign: '쌍둥이', parts: ['어깨', '팔', '손', '폐'] },
  { sign: '게', parts: ['가슴', '위', '갈비'] },
  { sign: '사자', parts: ['심장', '등', '척추'] },
  { sign: '처녀', parts: ['배', '소장', '소화'] },
  { sign: '천칭', parts: ['허리', '신장', '골반'] },
  { sign: '전갈', parts: ['생식기', '방광', '직장'] },
  { sign: '사수', parts: ['엉덩이', '허벅지', '좌골'] },
  { sign: '염소', parts: ['무릎', '뼈', '관절', '피부'] },
  { sign: '물병', parts: ['종아리', '발목', '순환'] },
  { sign: '물고기', parts: ['발', '림프'] },
];

/** 사인의 주인 — 고전(7행성) 배당. 현대 배당을 섞지 않는다 */
const SIGN_RULER = ['화성', '금성', '수성', '달', '태양', '수성',
                    '금성', '화성', '목성', '토성', '토성', '목성'];

/** 행성이 고전적으로 맡는 몸 — 이것도 고전 표준 배당이다 */
export const PLANET_BODY = {
  토성: { parts: ['뼈', '관절', '무릎', '치아', '피부'], mode: '만성·굳음' },
  화성: { parts: ['근육', '염증', '열', '상처'], mode: '급성·수술' },
  목성: { parts: ['간', '지방', '허벅지'], mode: '과잉' },
  금성: { parts: ['신장', '목', '정맥'], mode: '느슨함' },
  수성: { parts: ['신경', '폐', '장'], mode: '불안정' },
  달: { parts: ['체액', '위', '가슴'], mode: '붓고 빠짐' },
  태양: { parts: ['심장', '눈', '활력'], mode: '기력' },
};

/** 황제내경 — 오행에 장부와 오체(몸의 결)를 배당한다. 순서는 ELEMENTS 와 같다 */
export const WUXING_BODY = [
  { el: '목', organs: ['간', '담'], tissue: '근(힘줄)', sense: '눈' },
  { el: '화', organs: ['심장', '소장'], tissue: '혈맥', sense: '혀' },
  { el: '토', organs: ['비장', '위'], tissue: '기육(살)', sense: '입' },
  { el: '금', organs: ['폐', '대장'], tissue: '피부·털', sense: '코' },
  { el: '수', organs: ['신장', '방광'], tissue: '뼈', sense: '귀' },
];

/** 흉성 — 주인의 상태를 볼 때 쓴다 */
const MALEFIC = ['토성', '화성'];

const norm = (d) => ((d % 360) + 360) % 360;
const signOf = (lon) => Math.floor(norm(lon) / 30);

// ─────────────────────────────────────────────────────────────
// 서양 — 6하우스를 도수로 갈라 본다
// ─────────────────────────────────────────────────────────────

/**
 * 6하우스를 차지하는 사인들을 **도수 비중**으로 나눈다.
 *
 * 커스프의 사인만 보면 안 된다. 플라시두스에서 한 하우스가 30°를 넘는 일이
 * 흔하고, 그때는 커스프 사인보다 **뒤에 오는 사인이 하우스의 절반 이상**을
 * 차지하기도 한다. 실제로 그런 명반이 있었다.
 */
export function houseSigns(fromLon, toLon) {
  const width = norm(toLon - fromLon) || 360;
  const out = [];
  let cur = norm(fromLon);
  let left = width;
  while (left > 1e-9) {
    const s = signOf(cur);
    const toSignEnd = (s + 1) * 30 - norm(cur);
    const span = Math.min(left, toSignEnd <= 0 ? 30 : toSignEnd);
    out.push({ sign: s, deg: Math.round(span * 10) / 10, share: Math.round((span / width) * 1000) / 1000 });
    cur = norm(cur + span);
    left -= span;
  }
  // 같은 사인이 두 번 나오면 합친다 (하우스가 360°를 넘는 병리적 경우)
  const merged = new Map();
  for (const x of out) {
    const p = merged.get(x.sign);
    if (p) { p.deg += x.deg; p.share += x.share; } else merged.set(x.sign, { ...x });
  }
  return [...merged.values()].sort((a, b) => b.share - a.share);
}

/** 그 행성이 흉성과 붙었는가 — 주인의 상태를 보는 가장 단순하고 고전적인 잣대 */
function afflicted(N, planet) {
  const lon = N.pos[planet]?.lon;
  if (lon == null) return null;
  for (const m of MALEFIC) {
    if (m === planet) continue;
    const o = Math.abs(norm(N.pos[m].lon - lon + 180) - 180);
    if (o <= 8) return { by: m, orb: Math.round(o * 100) / 100 };
  }
  return null;
}

/**
 * 서양 쪽 부위 후보.
 *
 * @param {object} N natalPack 결과
 * @param {Array} transitHits 그 시기 트랜싯 (선택) — 주인이 걸려 있으면 가중
 */
export function westernParts(N, transitHits = []) {
  if (!N?.cusps) return null;
  const c6 = N.cusps[6], c7 = N.cusps[7];
  const items = [];

  // ① 6하우스를 차지하는 사인 — 도수 비중이 그대로 무게
  for (const seg of houseSigns(c6, c7)) {
    const mel = MELOTHESIA[seg.sign];
    const ruler = SIGN_RULER[seg.sign];
    const aff = afflicted(N, ruler);
    const hit = transitHits.find((h) => h.planet === ruler);
    let w = seg.share;
    const basis = [`6하우스의 ${Math.round(seg.share * 100)}%가 ${mel.sign}(${seg.deg}°)`];
    if (aff) { w *= 1.4; basis.push(`그 사인의 주인 ${ruler}이 ${aff.by}과 합 ${aff.orb}°`); }
    if (hit) { w *= 1.3; basis.push(`지금 트랜싯 ${hit.planet}-${hit.target} ${hit.aspect} ${hit.orb}°`); }
    items.push({ parts: mel.parts, sign: mel.sign, ruler, weight: w, basis, from: '6하우스 사인' });
  }

  // ② 6하우스 안에 실제로 든 행성 — 그 행성이 맡는 부위
  for (const p of PLANET_ORDER.slice(0, 7)) {
    const lon = N.pos[p]?.lon;
    if (lon == null || !PLANET_BODY[p]) continue;
    if (houseOf(lon, N.cusps) !== 6) continue;
    items.push({
      parts: PLANET_BODY[p].parts, sign: MELOTHESIA[signOf(lon)].sign, ruler: p,
      weight: 0.5, from: '6하우스 안 행성',
      basis: [`${p}이 6하우스에 있다 (${PLANET_BODY[p].mode})`],
    });
  }

  // ③ 상승점 — 부위가 아니라 체질이라 무게를 낮게 둔다
  const asc = MELOTHESIA[signOf(N.asc)];
  items.push({
    parts: asc.parts, sign: asc.sign, ruler: SIGN_RULER[signOf(N.asc)], weight: 0.25,
    from: '상승점(체질)', basis: [`상승점이 ${asc.sign} — 부위라기보다 몸의 바탕`],
  });

  // 부위별로 모은다. 같은 부위를 여러 자리가 가리키면 그만큼 두텁다.
  //
  // **무게를 부위 개수로 나누지 않는다.** 처음에는 나눴는데, 그러면 표의 한 줄에
  // 낱말을 몇 개 적었느냐가 답을 가른다. 염소(무릎·뼈·관절·피부) 네 낱말이
  // 사수(엉덩이·허벅지·좌골) 세 낱말에 밀려, 하우스를 54% 차지한 사인이
  // 46% 차지한 사인보다 낮게 나왔다. 명반이 가리키는 것은 **구역(사인)**이고
  // 낱말은 그 구역을 부르는 이름일 뿐이다. 구역의 무게를 그대로 준다.
  const byPart = new Map();
  for (const it of items) {
    for (const part of it.parts) {
      const cur = byPart.get(part) ?? { part, weight: 0, basis: [], from: new Set() };
      cur.weight += it.weight;
      cur.basis.push(...it.basis);
      cur.from.add(it.from);
      byPart.set(part, cur);
    }
  }
  const total = [...byPart.values()].reduce((t, x) => t + x.weight, 0) || 1;
  return [...byPart.values()]
    .map((x) => ({
      part: x.part,
      share: Math.round((x.weight / total) * 1000) / 1000,
      basis: [...new Set(x.basis)],
      from: [...x.from],
    }))
    .sort((a, b) => b.share - a.share);
}

// ─────────────────────────────────────────────────────────────
// 사주 — 치우침의 크기로만 센다
// ─────────────────────────────────────────────────────────────

/**
 * 오행 치우침을 장부로 옮긴다.
 *
 * 고른 분포는 각 20%다. 거기서 벗어난 만큼이 그 오행 장부의 부담이고,
 * **과다와 결핍은 뜻이 다르다** — 과다는 그 장부가 혹사되는 쪽,
 * 결핍은 받쳐 주지 못해 무너지는 쪽이다. 둘 다 낸다.
 *
 * @param {number[]} pct ELEMENTS 순서의 백분율
 */
export function baziParts(pct) {
  if (!Array.isArray(pct) || pct.length !== 5) return null;
  const even = 100 / 5;
  return pct.map((v, i) => ({
    el: ELEMENTS[i],
    pct: Math.round(v * 10) / 10,
    gap: Math.round((v - even) * 10) / 10,
    kind: v >= even * 1.5 ? '과다' : v <= even * 0.5 ? '결핍' : '보통',
    organs: WUXING_BODY[i].organs,
    tissue: WUXING_BODY[i].tissue,
  }))
    .filter((x) => x.kind !== '보통')
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
}

// ─────────────────────────────────────────────────────────────
// 합치지 않고 나란히 놓는다
// ─────────────────────────────────────────────────────────────

/**
 * 두 체계가 **같은 부위를 가리키는지**만 본다. 점수를 합치지 않는다 —
 * 합치면 어느 체계가 말한 것인지 사라지고, 한쪽만 말한 것도 두터워 보인다.
 */
export function bodyRead(N, pct, transitHits = []) {
  const west = westernParts(N, transitHits);
  const saju = baziParts(pct);
  if (!west) return { unavailable: '출생 시각을 알아야 하우스를 세울 수 있습니다. 부위는 보지 않는다.' };

  // 사주 쪽이 말한 몸의 결(뼈·근·살·피부·혈맥)이 서양 쪽 부위와 겹치는가
  const sajuWords = new Set((saju ?? []).flatMap((x) => [...x.organs, x.tissue]));
  const agree = west.filter((w) =>
    [...sajuWords].some((s) => s.includes(w.part) || w.part.includes(s.replace(/\(.*\)/, ''))));

  // 부위를 실제로 가르기는 하는가. 1위가 중간과 붙어 있으면 못 가리는 것이다
  const shares = west.map((w) => w.share);
  const typical = shares[Math.floor(shares.length / 2)] ?? 0;
  const spread = Math.round((shares[0] - typical) * 1000) / 10;

  return {
    west, saju, agree: agree.map((a) => a.part),
    spread,
    flat: spread < 6,
    school: '서양=멜로테시아(트로피컬) · 사주=황제내경 오행장부 · 베딕·자미두수 부위는 미구현',
  };
}

/** 문맥용 글. 계산 사실과 해석을 섞지 않는다 */
export function formatBody(r) {
  if (!r || r.unavailable) return r?.unavailable ?? '';
  const out = ['### [A~D] 몸의 어느 자리인가'];
  out.push(`기준: ${r.school}`);
  if (r.flat) {
    out.push(`※ **이 명반에서는 부위가 갈리지 않는다** (1위가 중간보다 ${r.spread}%p 높을 뿐). ` +
      '부위를 짚지 말고 "특정 자리로 좁혀지지 않는다"고 말할 것.');
  }
  out.push('서양(멜로테시아) — 6하우스를 도수로 가른 것:');
  for (const w of r.west.slice(0, 5)) {
    out.push(`  ${w.part} ${Math.round(w.share * 100)}% — ${w.basis.join(' / ')}`);
  }
  if (r.saju?.length) {
    out.push('사주(황제내경) — 오행 치우침:');
    for (const s of r.saju) {
      out.push(`  ${s.el} ${s.pct}% (${s.kind}, 고른값 대비 ${s.gap > 0 ? '+' : ''}${s.gap}) → ${s.organs.join('·')} / ${s.tissue}`);
    }
  }
  out.push(r.agree.length
    ? `두 체계가 같이 가리키는 자리: ${r.agree.join('·')}`
    : '두 체계가 같이 가리키는 자리 없음 — 한쪽만 말한 것을 두텁다고 하지 말 것.');
  out.push('※ 이 층은 **검증되지 않았다.** 부위는 기저율이 높아(허리·무릎·위장은 누구에게나 흔하다) ' +
    '맞아도 명반이 맞힌 것인지 흔해서 맞은 것인지 가릴 수 없다. 진단으로 말하지 말 것.');
  return out.join('\n');
}
