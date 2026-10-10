/**
 * highlights.js — 결과 맨 위: 핵심 요약 · 당신에게 특히 두드러지는 특징 · 발견 · 현재 흐름
 *
 * 새 계산은 하지 않는다. 이미 있는 것을 다른 관점에서 다시 고른다.
 *   해석 사전 문장(semantic/dict.js coreField — 뼈대 체계 순, 여러 체계가 같은 결을 말하면 agree↑)
 *   드문 정도(DICT_SHARE — 무작위 출생 2천 명 표본에서 그 특징이 나온 비율. 인구 통계가 아니다)
 *   지금의 10년·이번 달(report.js seasonNow · periodFlow) · 앞으로의 사건(lifeEventItems)
 *   십신 분포·오행 분포(core/ganzhi.js)
 * 고른 문장은 curate.js 가 거른다 — 같은 말·반대 말·양면화·일반론·추상 문장을 빼고, 화면 전체에서 한 번만.
 * 우선순위 점수는 고르는 데만 쓰고 화면에는 숫자로 내지 않는다. "상위 몇 %" 같은 말도 만들지 않는다.
 */
import { dictEntries, coreField, ziweiPalaceEntry, themeContrast } from './semantic/dict.js';
import { curate, meta, PageMemo } from './semantic/curate.js';
import { futureDigest, seasonNow, periodFlow, lifeEventItems, eventWhat, GOD_FIELD, SEASON, STRONG_RULE, ELEM_FILL, ELEM_KEYS } from './report.js';
import { computeDaeun, currentDaeun, TEN_GOD_GROUP, tenGodDistribution, elementDistribution } from './core/ganzhi.js';
import { j } from './core/josa.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 결(THEMES)을 사람 말로 */
const THEME_PHRASE = {
  fast: '결정과 행동이 빠른 결', slow: '서두르지 않고 신중한 결', firm: '쉽게 물러서지 않는 끈기',
  soft: '상대에 맞춰 흐름을 읽는 유연함', out: '사람 앞에 드러나는 힘', in: '혼자 깊이 생각하는 힘',
  care: '사람을 챙기고 돌보는 마음', free: '내 방식대로 서려는 독립심',
};
const FIELD_NAME = { p: '성격', w: '일', m: '돈', r: '관계', c: '조심할 점' };
/** 십신 무리가 명반에서 유난히 강할 때 */
const GOD_PHRASE = {
  비겁: '내 힘으로 서려는 기운', 식상: '표현하고 만들어 내는 기운', 재성: '돈과 현실을 다루는 기운',
  관성: '책임과 자리의 기운', 인성: '배우고 받아들이는 기운',
};
/** 공유 카드의 타입 이름 — 여러 칸에서 되풀이되는 결(형용) + 명반에서 가장 강한 십신 무리(명사) */
const TYPE_ADJ = {
  fast: '빠르게 결단하는', slow: '신중하게 쌓아 가는', firm: '끝까지 버티는', soft: '흐름을 읽는',
  out: '사람 앞에서 빛나는', in: '혼자 깊어지는', care: '사람을 품는', free: '내 방식대로 가는',
};
const TYPE_NOUN = { 비겁: '개척자', 식상: '창작자', 재성: '실속가', 관성: '리더', 인성: '탐구자' };
const TYPE_TAG = { fast: '#결단력', slow: '#신중함', firm: '#끈기', soft: '#유연함', out: '#존재감', in: '#깊이', care: '#다정함', free: '#독립심' };
const GROUP_TAG = { 비겁: '#자립', 식상: '#표현력', 재성: '#현실감각', 관성: '#책임감', 인성: '#배움' };
const STRESS =/지치|혼자|참다|참는|떠안|걱정|불안|화가|화를|예민|잠을|압박|쌓/;
const REL = /상대|배우자|관계|말|서운|간섭|고집|표현|마음을|사랑/;
/** 돈이 실제로 새는 모양 — '손해가 적다'처럼 강점을 말하는 문장은 걸리지 않게 */
const LEAK = /새|낭비|충동|지출이|쓰기 쉽|써 버|빌려|보증|과소비|씀씀이|손해를 보|날리|큰돈을|한탕/;
const LEAK_NOT = /적습니다|적고|적은|드뭅|없습니다|않습니다/;
/** 두 말이 같은 힘을 가리키는가(어절 앞 두 글자, 흔한 말 제외) — '표현 기운이 강한데 표현 힘이 옅다' 같은 모순을 막는다 */
const sameForce = (a, b) => a.split(' ').filter((w) => w.length >= 3).some((w) => b.includes(w.slice(0, 2)));

/** 공유 카드 칸 — 빈 칸·같은 문장 빼기 */
const uniqItems = (rows) => rows.filter(([, t], i) => t && rows.findIndex(([, u]) => u === t) === i)
  .map(([label, text]) => ({ label, text }));
const firstSentence = (t) => String(t ?? '').split(/(?<=[.!?])\s/)[0];
/** 사건 한 줄 — 제목 + 설명 가운데 제목을 되풀이하지 않는 첫 문장(다 되풀이면 제목만).
 *  예) '아이가 찾아오거나 함께 아이를 키우는 일. 두 사람 사이에 아이가 생기거나 아이를 키우는 일이…' 같은 반복을 막는다 */
/**
 * 공유 카드의 '앞으로 찾아올 일' — 몇 년 뒤인지, 무슨 일인지, 한 문장 풀이.
 * ('33세 무렵, 내 재주로 목돈을 버는 일'만으로는 언제인지·무슨 뜻인지 알기 어려웠다)
 */
function teaserOf(e, now) {
  if (!e) return { label: '', head: '', sub: '' };
  const left = e.y != null ? e.y - now : null;
  const when = left == null ? e.when : left <= 0 ? `올해 · ${e.y}년` : `${left}년 뒤 · ${e.y}년 무렵`;
  return { label: `${when} 찾아올 일`, head: e.title, sub: firstSentence(eventWhat(e.title, e.what, { keepAll: false })) };
}
function eventLine(e) {
  const add = eventWhat(e.title, e.what, { keepAll: false });
  return add ? `${e.title}. ${firstSentence(add)}` : `${e.title}.`;
}

/**
 * @param {object} r readFortune 결과
 * @param {object} [f] readForecast 결과(이번 달·오늘)
 * @returns {{summary, traits, discover, flow, shareLines, memo}}
 */
export function buildHighlights(r, f = null) {
  const memo = new PageMemo();
  let es = [];
  try { es = dictEntries(r); } catch { /* */ }
  const d = futureDigest(r);
  const sn = seasonNow(r);
  let events = [];
  try { events = lifeEventItems(r); } catch { /* */ }
  const now = Number(r.input.currentYear);

  // 칸마다의 후보 문장(뼈대 체계 순·결이 겹치는 문장 앞)
  const field = (f, n = 8) => coreField(es, f, n);
  const pool = Object.keys(FIELD_NAME).flatMap((k) => field(k).map((x) => ({ ...x, field: k })));
  // 여러 칸(성격·일·관계…)에서 되풀이되는 결
  const themeFields = {};
  for (const x of pool) for (const t of x.themes) (themeFields[t] ??= new Set()).add(x.field);
  const recurring = Object.entries(themeFields).sort((a, b) => b[1].size - a[1].size)[0];
  const base = (x) => 0.45 + (x.tier === 0 ? 0.15 : x.tier === 1 ? 0.08 : 0) + Math.min(x.agree ?? 0, 3) * 0.05;
  const rareOf = (x) => Math.max(0, 0.12 - (x.share ?? 0.1)) / 0.12;

  // ── 핵심 요약 (3~5장) ──
  const summary = [];
  const one = (key, label, items, opts = {}) => {
    const [m] = curate(items, { max: 1, memo, ...opts });
    if (m) summary.push({ key, label, text: m.text });
  };
  one('strong', '가장 강하게 나타나는 성향', field('p').map((x) => ({ text: x.text, base: base(x) })));
  const rareSorted = pool.filter((x) => x.field === 'p' || x.field === 'w').sort((a, b) => (a.share ?? 1) - (b.share ?? 1));
  one('rare', '다른 사람에게서 잘 보이지 않는 특징', rareSorted.slice(0, 6).map((x) => ({ text: x.text, base: 0.5, rare: rareOf(x) })));
  if (sn?.cur?.e) one('now', '지금 가장 활발한 삶의 주제', [{ text: `${firstSentence(sn.cur.e.h)} ${sn.cur.e.g}`, base: 0.9 }], { minSpecificity: 0 });
  const near = events.filter((e) => e.y - now <= 5)[0];
  if (near) one('next', '가까운 시기의 변화 포인트', [{ text: `${near.when} — ${eventLine(near)}`, base: 0.9 }], { minSpecificity: 0 });
  const pattern = pool.filter((x) => x.field === 'c' && recurring && x.themes.includes(recurring[0]));
  one('pattern', '반복되기 쉬운 인생 패턴', (pattern.length ? pattern : field('c')).map((x) => ({ text: x.text, base: base(x) })));

  // ── 당신에게 특히 두드러지는 특징 ──
  const traits = [];
  // 요약의 '드문 특징'과 다른 칸(성격↔일)에서 고른다 — 둘 다 직업 이야기가 되지 않게
  const rareField = rareSorted.find((x) => x.text === summary.find((s) => s.key === 'rare')?.text)?.field;
  const rarePool = rareSorted.filter((x) => x.field !== rareField);
  const [rare2] = curate((rarePool.length ? rarePool : rareSorted).slice(0, 10).map((x) => ({ text: x.text, base: 0.5, rare: rareOf(x) })), { max: 1, memo });
  if (rare2) traits.push({ label: '비교적 드물게 나타나는 특징', text: rare2.text });
  if (recurring && recurring[1].size >= 2 && THEME_PHRASE[recurring[0]]) {
    const where = [...recurring[1]].map((k) => FIELD_NAME[k]).join('·');
    const [ex] = curate(pool.filter((x) => x.themes.includes(recurring[0])).map((x) => ({ text: x.text, base: base(x) })), { max: 1, memo });
    traits.push({ label: '여러 영역에서 반복해서 나타나는 특징', text: `${j(THEME_PHRASE[recurring[0]], '이')} ${where}에서 거듭 나타납니다.${ex ? ` ${ex.text}` : ''}` });
  }
  let top = null;
  try {
    const g = tenGodDistribution(r.chart.pillars, r.chart.dayStem).groups;
    top = Object.keys(g).sort((a, b) => g[b] - g[a])[0];
    const c = elementDistribution(r.chart.pillars).count;
    const weak = ELEM_KEYS[[0, 1, 2, 3, 4].reduce((x, i) => (c[i] < c[x] ? i : x), 0)];
    if (g[top] >= 3 && GOD_PHRASE[top]) {
      const weakMeans = ELEM_FILL[weak]?.means;
      // 강한 기운과 옅은 기운이 같은 힘을 가리키면(십신과 오행은 잣대가 달라 생긴다) 옅은 쪽 말은 뺀다
      const strong = j(GOD_PHRASE[top], '이');
      const head = weakMeans && !sameForce(GOD_PHRASE[top], weakMeans)
        ? `${strong} 유난히 강하고, ${j(weakMeans, '이')} 가장 옅은 명반입니다.`
        : `${strong} 유난히 강한 명반입니다.`;
      traits.push({ label: '명반 안에서 특히 두드러지는 조합', text: `${head} ${STRONG_RULE[top] ?? ''}`.trim() });
    }
  } catch { /* */ }

  // ── 발견 — 근거가 있는 것만 ──
  const discover = [];
  const pushVs = (title, a, b) => { if (memo.has(a[1]) || memo.has(b[1])) return; memo.add(a[1]); memo.add(b[1]); discover.push({ title, a, b }); };
  const byLabel = (re) => es.find((e) => re.test(e.label));
  const asc = byLabel(/상승/), moon = byLabel(/서양 점성\(달\)/) ?? byLabel(/사주 일주/);
  if (asc?.entry?.p && moon?.entry?.p && asc.entry.p !== moon.entry.p) {
    pushVs('처음 보는 나 vs 가까워진 뒤의 나', ['처음 만난 사람이 보는 나', asc.entry.p], ['가까워진 뒤에 보이는 나', moon.entry.p]);
    const clash = themeContrast([asc.entry.p], [moon.entry.p]).clash[0];
    if (clash) {
      discover.push({ title: '스스로 오해하기 쉬운 내 모습',
        text: `겉으로 드러나는 '${clash[0].replace(/[.]$/, '')}' 모습을 스스로도 나라고 여기기 쉽지만, 속은 '${clash[1].replace(/[.]$/, '')}' 쪽에 더 가깝습니다. 큰 결정은 속마음 쪽 기준으로 내리세요.` });
    }
  }
  const sp = ziweiPalaceEntry(r, 'spouse');
  const workMe = d.know.work.find((t) => !memo.has(t)), loveMe = d.know.rel.find((t) => !memo.has(t)) ?? sp?.h;
  if (workMe && loveMe) pushVs('일할 때의 나 vs 연애할 때의 나', ['일할 때', workMe], ['연애할 때', loveMe]);
  const earn = d.direction.earn[0];
  const leak = [...d.know.spend, ...d.caution.careful, ...pool.filter((x) => x.field === 'm' || x.field === 'c').map((x) => x.text)]
    .find((t) => LEAK.test(t) && !LEAK_NOT.test(t) && !memo.has(t));
  if (earn && leak) pushVs('돈을 벌 때의 강점 vs 돈이 새기 쉬운 패턴', ['버는 힘', earn], ['새기 쉬운 곳', leak]);
  const [stress] = curate(pool.filter((x) => x.field === 'c' && STRESS.test(x.text)).map((x) => ({ text: x.text, base: base(x) })), { max: 1, memo, minSpecificity: 0 });
  if (stress) discover.push({ title: '스트레스 받을 때 반복되는 패턴', text: stress.text });
  const relRisk = [sp?.c, ...pool.filter((x) => (x.field === 'r' || x.field === 'c') && REL.test(x.text)).map((x) => x.text)].filter(Boolean);
  const [rel] = curate(relRisk.map((t) => ({ text: t, base: 0.6 })), { max: 1, memo, minSpecificity: 0 });
  if (rel) discover.push({ title: '관계에서 반복하기 쉬운 패턴', text: rel.text });
  try {
    const ds = computeDaeun(r.chart, r.input.isMale, r.input.jdUT);
    const cur = currentDaeun(ds, r.input.elapsedYears ?? r.input.age);
    const later = (ds?.list ?? []).filter((x) => cur && x.fromAge > cur.fromAge).slice(0, 3);
    const count = {};
    for (const x of later) count[TEN_GOD_GROUP[x.god]] = (count[TEN_GOD_GROUP[x.god]] ?? 0) + 1;
    const g = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
    if (g && count[g] >= 2 && later[0]) {
      discover.push({ title: '나이가 들수록 강해지는 성향',
        text: `${later[0].fromAge}세 이후로 ${j(GOD_FIELD[g], '이')} 삶에서 점점 큰 주제가 됩니다. ${SEASON[g]?.good ?? ''}`.trim() });
    }
  } catch { /* */ }

  // ── 현재 흐름 — 지금의 다섯 해 · 이번 달 · 다음 변화 ──
  const flow = [];
  if (sn?.cur?.e) {
    // 지금 시기의 주제는 핵심 요약 카드가 이미 냈으면, 여기서는 이 시기에 조심할 것을 쓴다
    const nowShown = summary.some((x) => x.key === 'now');
    const t = nowShown ? (sn.cur.e.c && !memo.has(sn.cur.e.c) ? `이 시기에 조심할 것 — ${memo.add(sn.cur.e.c)}` : '')
      : `${firstSentence(sn.cur.e.h)} ${sn.cur.e.g}`;
    if (t) flow.push(['지금', `${sn.cur.from}~${sn.cur.to}년`, t]);
  }
  try {
    const m = f?.month ? periodFlow(r, f.month, 'month') : null;
    if (m?.theme) flow.push(['이번 달', f.month.period?.label ?? '', m.theme]);
  } catch { /* */ }
  if (sn?.next?.e) flow.push(['다음', `${sn.next.from}년부터`, firstSentence(sn.next.e.h)]);

  // 공유 카드 — 나를 설명하는 세 문장(개인정보 없이)
  const shareLines = summary.filter((x) => ['strong', 'rare', 'pattern', 'now'].includes(x.key)).slice(0, 3).map((x) => x.text);

  // 공유 이미지 — 타입 이름 · 해시태그 셋 · 짧은 세 칸. 생년월일·시각은 넣지 않는다
  const themeRank = Object.entries(themeFields).sort((a, b) => b[1].size - a[1].size).map(([k]) => k);
  const strongThemes = meta(summary.find((x) => x.key === 'strong')?.text ?? '').themes;
  const lead = themeRank[0] ?? strongThemes[0];
  const closeSide = discover.find((x) => x.title.startsWith('처음 보는 나'))?.b?.[1];
  const shareCard = {
    type: `${TYPE_ADJ[lead] ?? '타고난 결이 분명한'} ${TYPE_NOUN[top] ?? '사람'}`,
    tags: [...new Set([TYPE_TAG[lead], GROUP_TAG[top], TYPE_TAG[themeRank[1]] ?? TYPE_TAG[strongThemes[1]]].filter(Boolean))].slice(0, 3),
    // 짧은 것은 두 칸씩, 긴 것은 한 줄 전체(share.js 가 길이로 나눈다)
    items: uniqItems([
      ['나의 강점', summary.find((x) => x.key === 'strong')?.text],
      ['조심할 점', summary.find((x) => x.key === 'pattern')?.text],
      ['잘 맞는 일', d.direction.fields[0]],
      ['돈 버는 방식', d.direction.earn[0]],
      ['끌리는 사람', d.direction.drawn[0]],
      ['가까워져야 보이는 나', closeSide ?? summary.find((x) => x.key === 'rare')?.text],
      [sn?.cur ? `지금 · ${sn.cur.from}~${sn.cur.to}년` : '지금 나의 시기', sn?.cur?.e ? `${firstSentence(sn.cur.e.h)} ${sn.cur.e.g}` : ''],
    ]),
    // 궁금하게 만드는 칸 — 가장 가까운 일 하나만 보여 주고, 나머지는 사이트에 있다고 알린다
    teaser: {
      ...teaserOf(near, now),
      locked: [
        events.length > 1 ? `앞으로 마주할 중요한 일 ${events.length}가지` : '앞으로 마주할 중요한 일',
        '돈이 새기 쉬운 패턴', '지금의 10년과 다음 10년', '사랑과 가족 · 건강',
      ],
    },
    cta: { head: '나는 어떤 타입일까?', sub: '생년월일만 넣으면 무료 · 17가지 점술이 함께 보는 나' },
  };

  return { summary: summary.slice(0, 5), traits, discover, flow, shareLines, shareCard, memo };
}

/**
 * 궁합 맨 위 — 개인과 같은 방식. 새 계산 없이 궁합 리포트의 재료(report.js pairDigestFor → pairLoveDigest)를 다시 고른다.
 * @param {{A, B, d}} pd pairDigestFor 결과
 */
export function buildPairHighlights({ A, B, d, rA }) {
  const memo = new PageMemo();
  const named = (t) => t.includes(`${A}님`) || t.includes(`${B}님`);

  // ── 핵심 요약 ──
  const summary = [];
  const one = (key, label, items) => {
    const [m] = curate(items.filter(Boolean), { max: 1, memo, minSpecificity: 0 });
    if (m) summary.push({ key, label, text: m.text });
  };
  one('verdict', d.married ? '두 사람은 어떤 부부인가' : '연애 궁합인가, 결혼 궁합인가', [{ text: d.verdict.text, base: 1 }]);
  one('pull', '서로 가장 끌리는 지점', d.dating.good);
  // 사건을 묶은 줄('같이 살며 조심할 일: …')은 아래 흐름 카드가 맡는다
  one('clash', '가장 부딪치기 쉬운 지점', [...d.dating.bad, ...d.marriage.bad].filter((t) => !/^같이 살며/.test(t)));
  const now = Number(rA?.input?.currentYear) || new Date().getFullYear();
  const future = (d.events ?? []).filter((e) => e.y == null || e.y >= now).sort((a, b) => (a.y ?? 9999) - (b.y ?? 9999));
  const near = future.find((e) => e.y != null && e.y - now <= 5);
  if (near) one('next', '가까운 시기 두 사람에게 오는 일', [{ text: `${near.when} — ${eventLine(near)}`, base: 1 }]);
  if (d.relation) one('relation', '두 사람의 관계 모양', [d.relation]);

  // ── 두 사람에게 특히 두드러지는 점 ──
  const traits = [];
  const trait = (label, items) => {
    const [m] = curate(items.filter(Boolean), { max: 1, memo, minSpecificity: 0 });
    if (m) traits.push({ label, text: m.text });
  };
  trait('두 사람이 닮은 점', d.dating.good.filter((t) => /닮아/.test(t)));
  trait('가장 크게 다른 점', d.dating.bad.filter((t) => /차이로/.test(t)));
  trait('돈을 대하는 두 사람', [...d.marriage.good, ...d.marriage.bad].filter((t) => /돈 앞에서|돈을 대하는/.test(t)));

  // ── 두 사람에 대한 발견 ──
  const discover = [];
  if (d.wants?.a && d.wants?.b && !memo.has(d.wants.a) && !memo.has(d.wants.b)) {
    discover.push({ title: `${A}님이 바라는 것 vs ${B}님이 바라는 것`, a: [`${A}님`, memo.add(d.wants.a)], b: [`${B}님`, memo.add(d.wants.b)] });
    for (const [, t] of d.care) memo.add(t);   // 아래 '서로 배려할 점'과 같은 말
  }
  const fixA = d.fix.find(([k]) => k === `${A}님`)?.[1], fixB = d.fix.find(([k]) => k === `${B}님`)?.[1];
  if (fixA && fixB && !memo.has(fixA) && !memo.has(fixB)) {
    discover.push({ title: '다툼이 되풀이되기 쉬운 패턴', a: [`${A}님`, memo.add(fixA)], b: [`${B}님`, memo.add(fixB)] });
  }
  const money = d.home?.find(([k]) => k.startsWith('재산'))?.[1];
  if (money && !memo.has(money)) discover.push({ title: d.married ? '두 사람이 재산을 모으는 방법' : '함께 산다면 — 재산을 모으는 방법', text: memo.add(money) });

  // ── 두 사람의 흐름 — 요약에 낸 일 다음부터, 15년 안쪽만(먼 일은 아래 사건 장에) ──
  const flow = future.filter((e) => e !== near && (e.y == null || e.y - now <= 15)).slice(0, 3)
    .map((e) => [e.when, '', eventLine(e)]);

  const shareLines = summary.map((x) => x.text).filter((t) => !named(t)).slice(0, 3);
  // 공유 이미지 — 궁합 타입 · 해시태그 · 짧은 세 칸(이름은 넣되 생년월일·시각은 넣지 않는다)
  const kind = d.verdict.kind;
  const sum = (k) => summary.find((x) => x.key === k)?.text;
  const shareCard = {
    type: d.married
      ? { 연애: '대화로 빛나는 부부', 결혼: '살수록 손발이 맞는 부부', '둘 다': '설렘과 생활이 균형 잡힌 부부' }[kind]
      : { 연애: '설렘이 오래가는 연애형 궁합', 결혼: '살수록 맞는 결혼형 궁합', '둘 다': '설렘과 생활의 균형형 궁합' }[kind],
    tags: [
      { 연애: '#설렘', 결혼: '#안정감', '둘 다': '#균형' }[kind],
      d.dating.good.some((t) => /닮아/.test(t)) ? '#닮은꼴' : '#서로를채움',
      d.dating.bad.some((t) => /차이로/.test(t)) ? '#다른결' : '#편안함',
    ],
    items: uniqItems([
      ['이 궁합을 한 줄로', d.verdict.text],
      ['두 사람의 관계', sum('relation')],
      ['서로 끌리는 지점', sum('pull')],
      ['부딪치기 쉬운 지점', sum('clash')],
      [`${A}님이 바라는 것`, d.wants?.a],
      [`${B}님이 바라는 것`, d.wants?.b],
      [d.married ? '재산을 모으는 방법' : '함께 산다면 재산은', d.home?.find(([k]) => k.startsWith('재산'))?.[1]],
    ]),
    teaser: {
      ...teaserOf(near, now),
      locked: [
        d.events?.length > 1 ? `앞으로 두 사람이 마주할 일 ${d.events.length}가지` : '앞으로 두 사람이 마주할 일',
        d.married ? '아이가 주는 의미' : '아이는 낳으면 좋을까, 몇 명이 좋을까', '육아는 누가 · 둘 다 일할까', '서로 고쳐야 할 점',
      ],
    },
    cta: { head: '우리 둘은 어떤 궁합일까?', sub: '두 사람 생년월일만 넣으면 무료 · 연애·결혼·자녀까지' },
  };
  return {
    summary: summary.slice(0, 5), traits, discover, flow, shareLines, shareCard, memo,
    titles: { traits: '두 사람에게 특히 두드러지는 점', discover: '두 사람에 대한 발견', flow: '앞으로 두 사람의 흐름' },
  };
}

/** 카드 화면 */
export function renderHighlights(h) {
  const T = { traits: '당신에게 특히 두드러지는 특징', discover: '나에 대한 발견', flow: '현재 흐름', ...h.titles };
  const card = (icon, title, body, cls = '') => (body
    ? `<section class="rp-card ${cls}"><h3 class="rp-card-h"><span aria-hidden="true">${icon}</span> ${esc(title)}</h3>${body}</section>` : '');
  const summary = h.summary.length
    ? `<div class="hl-grid">${h.summary.map((x) => `<article class="hl-card hl-${x.key}"><p class="hl-label">${esc(x.label)}</p><p class="hl-text">${esc(x.text)}</p></article>`).join('')}</div>`
    : '';
  const traits = h.traits.map((x) => `<li><b>${esc(x.label)}</b><p>${esc(x.text)}</p></li>`).join('');
  const vs = (x) => (x.a
    ? `<div class="hl-vs"><div><p class="hl-label">${esc(x.a[0])}</p><p>${esc(x.a[1])}</p></div><div><p class="hl-label">${esc(x.b[0])}</p><p>${esc(x.b[1])}</p></div></div>`
    : `<p class="rp-t">${esc(x.text)}</p>`);
  const disc = (xs) => xs.map((x) => `<div class="hl-disc"><h4 class="rp-h4">${esc(x.title)}</h4>${vs(x)}</div>`).join('');
  const discover = h.discover.length
    ? disc(h.discover.slice(0, 3)) + (h.discover.length > 3
      ? `<details class="hl-more"><summary>더 발견하기 (${h.discover.length - 3})</summary>${disc(h.discover.slice(3))}</details>` : '')
    : '';
  const flow = h.flow.length
    ? `<ol class="hl-flow">${h.flow.map(([k, when, t]) => `<li><p class="hl-label">${esc(k)} <small>${esc(when)}</small></p><p>${esc(t)}</p></li>`).join('')}</ol>`
    : '';
  return card('✨', '핵심 요약', summary, 'hl-summary')
    + card('🔎', T.traits, traits ? `<ul class="hl-traits">${traits}</ul>` : '')
    + card('🧩', T.discover, discover)
    + card('🧭', T.flow, flow);
}

export { meta };
