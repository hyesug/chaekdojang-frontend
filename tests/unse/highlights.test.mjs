import test from 'node:test';
import assert from 'node:assert/strict';

import { readFortune } from '../../public/unse/src/engine.js';
import { readForecast } from '../../public/unse/src/forecast.js';
import { buildView } from '../../public/unse/src/viewmodel.js';
import { renderReport } from '../../public/unse/src/report.js';
import { loadDicts } from '../../public/unse/src/semantic/dict.js';
import { curate, meta, opposes, PageMemo } from '../../public/unse/src/semantic/curate.js';
import { buildHighlights, renderHighlights } from '../../public/unse/src/highlights.js';

await loadDicts();

/* ── 문장 후처리기 ──────────────────────────────────────── */

test('같은 뜻의 문장은 하나만 남긴다', () => {
  const out = curate([
    '회의에서 결정을 미루지 않고 먼저 말을 꺼내는 편입니다.',
    '회의에서 결정을 미루지 않고 먼저 말을 꺼내는 편이에요.',
  ], { max: 3 });
  assert.equal(out.length, 1);
});

test('양면화 문장과 누구에게나 맞는 문장은 뺀다', () => {
  const out = curate([
    '조용하지만 활발하기도 합니다.',
    '노력하면 좋은 결과가 있습니다.',
    '마감이 다가오면 혼자 끝까지 붙잡고 정리하는 편입니다.',
  ], { max: 3 });
  assert.deepEqual(out.map((m) => m.text), ['마감이 다가오면 혼자 끝까지 붙잡고 정리하는 편입니다.']);
  assert.ok(meta('조용하지만 활발하기도 합니다.').hedge);
  assert.ok(meta('노력하면 좋은 결과가 있습니다.').generic);
});

test('구체적인 문장일수록 구체성 점수가 높다', () => {
  const vague = meta('기운이 좋은 편입니다.');
  const concrete = meta('약속을 잡을 때 일정을 먼저 정해 두면 대화가 쉬워집니다.');
  assert.ok(concrete.specificity > vague.specificity);
  assert.ok(concrete.priority > vague.priority);
});

test('PageMemo 는 한 화면에서 이미 낸 문장·반대 결 문장을 막는다', () => {
  const memo = new PageMemo();
  const first = curate(['마감이 다가오면 혼자 끝까지 붙잡고 정리하는 편입니다.'], { memo });
  assert.equal(first.length, 1);
  assert.ok(memo.has('마감이 다가오면 혼자 끝까지 붙잡고 정리하는 편입니다.'));
  const again = curate(['마감이 다가오면 혼자 끝까지 붙잡고 정리하는 편입니다.'], { memo });
  assert.equal(again.length, 0);
});

test('반대 결 판정은 dict.js 의 결 사전을 그대로 쓴다', () => {
  const a = { themes: ['fast'] }, b = { themes: ['slow'] }, c = { themes: ['care'] };
  assert.ok(opposes(a, b));
  assert.ok(!opposes(a, c));
});

/* ── 핵심 요약 · 특이점 · 발견 ───────────────────────────── */

const PEOPLE = [
  { name: 'ㄱ', year: 1990, month: 6, day: 15, hour: 12, minute: 0, birthPlace: '서울', homePlace: '서울', gender: 'male' },
  { name: 'ㄴ', year: 1985, month: 2, day: 3, hour: 7, minute: 30, birthPlace: '부산', homePlace: '서울', gender: 'female' },
  { name: 'ㄷ', year: 1972, month: 11, day: 28, hour: 22, minute: 10, birthPlace: '대구', homePlace: '대구', gender: 'female' },
];
const build = (form) => {
  const r = readFortune(form);
  const f = readForecast(form);
  return { form, r, f, h: buildHighlights(r, f) };
};
const ALL = PEOPLE.map(build);

test('핵심 요약은 3~5장이고 화면 안에서 문장이 겹치지 않는다', () => {
  for (const { h } of ALL) {
    assert.ok(h.summary.length >= 3 && h.summary.length <= 5, `요약 ${h.summary.length}장`);
    const texts = [
      ...h.summary.map((x) => x.text),
      ...h.traits.map((x) => x.text),
      ...h.discover.flatMap((x) => (x.a ? [x.a[1], x.b[1]] : [x.text])),
    ];
    assert.equal(new Set(texts).size, texts.length, '같은 문장이 두 번 나온다');
  }
});

test('특이점·요약에 상위 %·정확도 같은 숫자 주장을 쓰지 않는다', () => {
  for (const { h } of ALL) {
    const html = renderHighlights(h);
    assert.doesNotMatch(html, /상위\s*\d|\d+\s*%|정확도/);
  }
});

test('발견 항목은 근거가 있는 것만 — 빈 칸을 내지 않는다', () => {
  for (const { h } of ALL) {
    for (const x of h.discover) {
      if (x.a) assert.ok(x.a[1] && x.b[1], x.title);
      else assert.ok(x.text?.trim(), x.title);
    }
  }
});

test('사람마다 핵심 요약이 다르다', () => {
  const keys = ALL.map(({ h }) => h.summary.map((x) => x.text).join('|'));
  assert.equal(new Set(keys).size, keys.length);
});

test('공유 문장은 세 줄 이하이고 출생 정보가 없다', () => {
  for (const { form, h } of ALL) {
    assert.ok(h.shareLines.length <= 3);
    const s = h.shareLines.join(' ');
    assert.ok(!s.includes(String(form.year)) && !s.includes(form.birthPlace));
  }
});

test('요약이 이미 낸 문장은 아래 상세 리포트에서 다시 나오지 않는다', () => {
  for (const { form, r, f, h } of ALL) {
    const shown = h.memo.items.map((x) => x.text);
    const html = renderReport(form, r, f, buildView(form, r, f), { memo: h.memo });
    // 상세 리포트의 '알아 두면 좋은 나'·'조심해야 할 것' 목록에는 요약에서 낸 문장이 없다
    const lists = [...html.matchAll(/<li>([^<]+)<\/li>/g)].map((m) => m[1]);
    for (const t of shown) assert.ok(!lists.includes(t), `겹침: ${t}`);
    // 맨 위 '현재 흐름'이 있으면 '지금 나는 어떤 시기에 있나' 카드는 빠진다
    assert.doesNotMatch(html, /지금 나는 어떤 시기에 있나/);
  }
});

test('두드러지는 조합은 같은 힘을 강하다·옅다로 동시에 말하지 않고, 새는 곳은 실제로 새는 문장만 쓴다', () => {
  for (const { h } of ALL) {
    const combo = h.traits.find((x) => x.label === '명반 안에서 특히 두드러지는 조합')?.text ?? '';
    const m = combo.match(/^(\S+)\S* .*유난히 강하고, (\S+)/);
    if (m) assert.notEqual(m[1].slice(0, 2), m[2].slice(0, 2), combo);
    const money = h.discover.find((x) => x.title.startsWith('돈을 벌 때'));
    if (money) assert.doesNotMatch(money.b[1], /적습니다|없습니다|않습니다/);
  }
});

/* ── 궁합 ─────────────────────────────────────────────── */
import { compareFortune } from '../../public/unse/src/compat.js';
import { buildCompatView } from '../../public/unse/src/viewmodel.js';
import { renderPairReport, pairDigestFor } from '../../public/unse/src/report.js';
import { buildPairHighlights } from '../../public/unse/src/highlights.js';

const pairOf = (a, b) => {
  const c = compareFortune(a, b);
  const v = buildCompatView(a, b, c);
  const people = { a: readFortune(a), b: readFortune(b) };
  const pd = pairDigestFor(a, b, c, v, people);
  return { a, b, c, v, people, pd, h: buildPairHighlights(pd) };
};
const PAIRS = [pairOf(PEOPLE[0], PEOPLE[1]), pairOf(PEOPLE[1], PEOPLE[2]), pairOf({ ...PEOPLE[0], marital: 'married' }, PEOPLE[2])];

test('궁합 핵심 요약은 3~5장이고 판정이 맨 앞, 문장이 겹치지 않는다', () => {
  for (const { h, pd } of PAIRS) {
    assert.ok(h.summary.length >= 3 && h.summary.length <= 5, `요약 ${h.summary.length}장`);
    assert.equal(h.summary[0].key, 'verdict');
    assert.equal(h.summary[0].text, pd.d.verdict.text);
    const texts = [...h.summary.map((x) => x.text), ...h.traits.map((x) => x.text),
      ...h.discover.flatMap((x) => (x.a ? [x.a[1], x.b[1]] : [x.text]))];
    assert.equal(new Set(texts).size, texts.length);
    assert.doesNotMatch(renderHighlights(h), /상위\s*\d|\d+\s*%|정확도/);
  }
});

test('부부면 판정 카드 이름이 부부용이다', () => {
  assert.equal(PAIRS[2].h.summary[0].label, '두 사람은 어떤 부부인가');
  assert.equal(PAIRS[0].h.summary[0].label, '연애 궁합인가, 결혼 궁합인가');
});

test('궁합 공유 문장에는 이름·출생 정보가 없다', () => {
  for (const { a, b, h } of PAIRS) {
    const s = h.shareLines.join(' ');
    for (const f of [a, b]) assert.ok(!s.includes(`${f.name}님`) && !s.includes(String(f.year)));
  }
});

test('궁합 요약이 낸 문장은 아래 리포트에서 다시 나오지 않고, 판정 카드는 요약으로 옮겨 간다', () => {
  for (const { a, b, c, v, people, pd, h } of PAIRS) {
    const shown = h.memo.items.map((x) => x.text);
    const html = renderPairReport(a, b, c, v, {}, people, { digest: pd, memo: h.memo });
    const texts = [...html.matchAll(/<(?:li|p)>([^<]+)<\/(?:li|p)>/g)].map((m) => m[1]);
    for (const t of shown) assert.ok(!texts.includes(t), `겹침: ${t}`);
    assert.doesNotMatch(html, /연애 궁합인가, 결혼 궁합인가|두 사람은 어떤 부부인가/);
  }
});

/* ── 공유 카드 · 사건 문장 반복 ───────────────────────────── */
import { eventWhat } from '../../public/unse/src/report.js';

test('공유 카드는 타입 이름·해시태그·여러 칸·안내가 있고(잠긴 항목 없이) 출생 정보가 없다', () => {
  for (const { form, h } of ALL) {
    const c = h.shareCard;
    assert.ok(c.type && !/undefined/.test(c.type), c.type);
    assert.ok(c.tags.length >= 1 && c.tags.length <= 3 && c.tags.every((t) => t.startsWith('#')));
    assert.ok(c.items.length >= 5, `칸 ${c.items.length}개`);
    assert.ok(c.cta.head && !('locked' in c.teaser));
    assert.equal(new Set(c.items.map((x) => x.text)).size, c.items.length);
    const all = JSON.stringify(c);
    assert.ok(!all.includes(String(form.year)) && !all.includes(form.birthPlace));
  }
  for (const { h } of PAIRS) {
    assert.ok(h.shareCard.type && h.shareCard.tags.length === 3 && h.shareCard.items.length >= 4 && h.shareCard.cta.head);
  }
});

test('사건 설명이 제목을 되풀이하면 그 문장은 뺀다', () => {
  const title = '권ㅇㅇ님에게 아이가 찾아오거나 함께 아이를 키우는 일';
  const what = '두 사람 사이에 아이가 생기거나, 아이를 키우는 일이 두 사람 생활의 중심이 되기 쉽습니다.';
  assert.equal(eventWhat(title, what, { keepAll: false }), '');
  assert.equal(eventWhat(title, what), what);   // 본문 칸은 비우지 않는다
  assert.equal(eventWhat(title, `${what} 양가의 도움을 미리 정해 두면 편합니다.`), '양가의 도움을 미리 정해 두면 편합니다.');
});

test('공유 카드의 앞으로 찾아올 일은 몇 년 뒤인지와 한 문장 풀이를 함께 쓴다', () => {
  for (const { h } of [...ALL, ...PAIRS]) {
    const t = h.shareCard.teaser;
    if (!t.head) continue;
    assert.match(t.label, /(\d+년 뒤|올해) · \d{4}년.* 찾아올 일$/);
    assert.ok(!t.sub || !t.sub.includes(t.head));
  }
});

/* ── 오행결: 겉에는 없지만 지장간에 있는 오행 ───────────────── */
import { readStructures } from '../../public/unse/src/semantic/structure/saju.js';

test('겉 여덟 글자에 없는 오행도 지장간에 있으면 "없다"고 하지 않는다 (辛未 辛丑 乙巳 甲申의 수)', () => {
  // 甲0 乙1 … 辛7 / 子0 丑1 … 巳5 … 未7 申8
  const chart = { dayStem: 1, pillars: {
    year: { stem: 7, branch: 7 }, month: { stem: 7, branch: 1 }, day: { stem: 1, branch: 5 }, hour: { stem: 0, branch: 8 } } };
  const { structures, facts } = readStructures(chart, { domain: 'health' });
  assert.deepEqual(facts.missing, []);
  assert.deepEqual(facts.hiddenOnly, ['수']);
  const t = structures.find((s) => s.id === 'element_missing')?.text ?? '';
  assert.match(t, /수는 겉으로 드러나지 않고 지장간 속에만 조금 있습니다/);
  assert.doesNotMatch(t, /수는 지장간까지 보아도 명식에 없습니다|수가 명식에 없습니다/);
});
