import test from 'node:test';
import assert from 'node:assert/strict';

import { readFortune } from '../../public/unse/src/engine.js';
import { readForecast } from '../../public/unse/src/forecast.js';
import { compareFortune } from '../../public/unse/src/compat.js';
import { elementDistribution } from '../../public/unse/src/core/ganzhi.js';
import { buildCompatView, buildView } from '../../public/unse/src/viewmodel.js';
import { renderPairReport, renderReport } from '../../public/unse/src/report.js';

const A = {
  name: '보고서 개인', year: 1990, month: 6, day: 15, hour: 12, minute: 0,
  birthPlace: '서울', homePlace: '서울', gender: 'male',
};
const B = {
  name: '보고서 상대', year: 1992, month: 8, day: 20, hour: 9, minute: 30,
  birthPlace: '부산', homePlace: '부산', gender: 'female',
};
const rx = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
/** 화면에 보이는 글만 — 태그를 걷어낸다 */
const visible = (html) => html.replace(/<[^>]+>/g, ' ');

/**
 * 이 문서는 처음 보는 사람이 읽는다. 계산 근거로 쓰이는 용어·한자·강조 표시가
 * 화면 글에 남으면 안 된다. (계산 근거는 명반 계산 화면과 AI 문맥이 따로 갖고 있다)
 */
const JARGON = /[一-鿿]|(?:명|부처|자녀|재백|관록|천이|복덕)궁|하우스|대운|사화|다샤|일간|관성|재성|식상|라그나|삼형|육합|\*\*|p=|°/;

const personal = (form) => {
  const r = readFortune(form);
  const f = readForecast(form);
  return renderReport(form, r, f, buildView(form, r, f));
};
const pair = (a, b) => {
  const c = compareFortune(a, b);
  return renderPairReport(a, b, c, buildCompatView(a, b, c), {
    a: elementDistribution(c.A.chart.pillars).count,
    b: elementDistribution(c.B.chart.pillars).count,
  });
};

test('개인 리포트는 나만의 특징·키워드·커리어·인생 흐름·실행 순서의 결과지로 시작한다', () => {
  const html = personal(A);
  const order = [
    '보고서 개인님의 인생 데이터 분석 리포트',
    '나만의 특징 — 사람들 사이에서 드문 것부터',
    '한눈에 보는 내 인생의 핵심 키워드',
    '타고난 강점', '사회적 역할', '주의할 패턴',
    '커리어 &amp; 재물: 나의 시장 가치와 돈 버는 법',
    '어떤 일을 할 때 빛나는가', '수익 스타일',
    '인생의 큰 흐름 — 십 년마다 무엇이 오는가',
    ' · 지금',
    '당장 실행해볼 수 있는 Action Item 3가지',
    '더 자세히 보기',
  ];
  let at = -1;
  for (const heading of order) {
    const i = html.indexOf(heading);
    assert.ok(i > at, `순서가 어긋났거나 없음: ${heading}`);
    at = i;
  }
  for (const tag of ['DO', 'KEY']) assert.match(html, rx(`>${tag}<`));
  // 자세한 장은 접어 두고, 겹치던 장(사업·로또, 질문별 색인)은 다시 넣지 않는다
  for (const chapter of ['일과 돈', '사랑과 가족', '방향과 이동', '내면의 패턴', '시기 한눈에 보기']) {
    assert.match(html, rx(chapter));
  }
  for (const gone of ['2-2. 책도장', '로또 분석과 횡재운', '질문별 답변 통합 색인', '세부 계산 보기']) {
    assert.doesNotMatch(html, rx(gone));
  }
});

test('개인 리포트는 키워드보다 먼저 명반 고유의 핵심 구조와 경계를 보여준다', () => {
  const r = readFortune(A);
  const f = readForecast(A);
  const v = buildView(A, r, f);
  const html = renderReport(A, r, f, v);

  const heading = html.indexOf('명반을 가르는 핵심 구조');
  assert.ok(heading >= 0, '첫머리에 핵심 구조가 없다');
  assert.ok(heading < html.indexOf('한눈에 보는 내 인생의 핵심 키워드'));
  for (const item of v.signature) {
    assert.match(html, rx(item.title));
    assert.match(html, rx(item.conclusion));
    assert.match(html, rx(item.condition));
  }
});

test('사례 부족 시기 예측은 근거 문구 없이 신호만 제시한다', () => {
  const html = personal(A);

  assert.doesNotMatch(html, /잠정 선택|사전 후보|사람별 검증/);
  assert.match(html, /일에서 가장 큰 기회와 변화가 오는 때는 <strong>/);
  assert.match(html, /돈이 가장 크게 들어오는 때는 <strong>/);
  // 결혼·출산 연도는 검증에서 떨어져 내지 않는다
  assert.doesNotMatch(html, /인연·관계가 가장 무르익는 때는 <strong>/);
  assert.doesNotMatch(html, /출산·가족 확장 신호가 높은 때는 <strong>/);
});

test('개인 리포트 화면 글에는 전문용어·한자·강조 표시가 남지 않는다', () => {
  for (const form of [A, { ...A, gender: 'female' }, { ...B, hour: null }]) {
    const text = visible(personal(form));
    const hit = text.match(JARGON);
    assert.equal(hit, null, `남은 용어: ${hit?.[0]} — ${hit ? text.slice(Math.max(0, hit.index - 30), hit.index + 30) : ''}`);
  }
});

test('배우자 문장은 번역투 없이 쓴다', () => {
  const text = visible(personal({ ...A, gender: 'female' }));
  assert.doesNotMatch(text, /자리에 힘이 여러 갈래로 실립니다/);
});

test('궁합 리포트는 두 사람 결과지와 관계 축을 쉬운 말로 싣는다', () => {
  const c = compareFortune(A, B);
  const view = buildCompatView(A, B, c);
  const html = pair(A, B);
  for (const heading of ['보고서 개인 · 보고서 상대 관계 분석 리포트', '한눈에 보는 두 사람',
    '두 사람의 기본 성향', '감정과 끌림', '생활의 궁합', '더 자세히 보기']) {
    assert.match(html, rx(heading));
  }
  assert.match(html, /점술은 상징적 해석 도구/);
  for (const key of ['생활', '돈', '역할분담', '끌림', '감정', '대화', '장기유지']) {
    const axis = view.eightAxes.find((item) => item.key === key);
    assert.ok(axis, `${key} 축이 없습니다`);
    assert.match(html, rx(axis.conclusion.slice(0, 12)));
  }
  const hit = visible(html).match(JARGON);
  assert.equal(hit, null, `남은 용어: ${hit?.[0]}`);
});

test('같은 리포트 형식도 출생 정보가 바뀌면 내용이 달라진다', () => {
  const other = { ...A, month: 1, day: 3, hour: 4 };
  assert.notEqual(personal(A), personal(other));
  assert.notEqual(pair(A, B), pair(other, B));
});

test('좋은 방향과 피할 방향에 같은 방위가 함께 나오지 않는다', () => {
  for (const form of [A, B, { ...A, year: 1975 }, { ...B, year: 2001 }]) {
    const html = personal(form);
    const list = (label) => (html.match(new RegExp(`<dt>${label}</dt><dd>([^<]*)</dd>`))?.[1] ?? '')
      .split(', ').filter(Boolean);
    const good = list('좋은 방향');
    const bad = list('피할 방향');
    assert.deepEqual(good.filter((d) => bad.includes(d)), [], `겹침: ${good} / ${bad}`);
  }
});
