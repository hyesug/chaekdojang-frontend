import test from 'node:test';
import assert from 'node:assert/strict';

import { readFortune } from '../../public/unse/src/engine.js';
import { readForecast } from '../../public/unse/src/forecast.js';
import { compareFortune } from '../../public/unse/src/compat.js';
import { elementDistribution } from '../../public/unse/src/core/ganzhi.js';
import { buildCompatView, buildView } from '../../public/unse/src/viewmodel.js';
import { renderPairReport, renderReport } from '../../public/unse/src/report.js';
import { loadDicts } from '../../public/unse/src/semantic/dict.js';

// 화면과 같이 해석 사전을 먼저 불러온다 (ui.js run)
await loadDicts();

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

test('개인 리포트는 한눈에 보는 나·나는 어떤 사람인가·커리어·인생 흐름·실행 순서의 결과지로 시작한다', () => {
  const html = personal(A);
  const order = [
    '보고서 개인님의 인생 데이터 분석 리포트',
    // 앞으로를 말하는 순서 — 지금 시기 → 가야 할 방향 → 알아 둘 것 → 조심할 것 → 십 년 흐름 → 실행
    '지금 나는 어떤 시기에 있나', '지금 힘을 쓸 곳',
    '앞으로 가야 할 방향', '잘 맞는 일',
    '알아 두면 좋은 나', '나의 성격', '일할 때의 나',
    '조심해야 할 것', '늘 조심할 것', '지켜야 할 원칙',
    '인생의 큰 흐름 — 지금의 10년과 다음 10년',
    ' · 지금',
    '지금 바로 해 볼 것 — 분야별 하나씩',
    '더 자세히 보기',
  ];
  let at = -1;
  for (const heading of order) {
    const i = html.indexOf(heading);
    assert.ok(i > at, `순서가 어긋났거나 없음: ${heading}`);
    at = i;
  }
  // 분야별 하나씩 — 일·돈·사랑·건강
  for (const tag of ['💼 일', '💰 돈', '🌿 건강']) assert.match(html, rx(`>${tag}<`));
  // 인생의 큰 흐름은 지금의 10년과 다음 10년만 — 지나간 다섯 해는 싣지 않는다
  const flow = html.slice(html.indexOf('인생의 큰 흐름'), html.indexOf('지금 바로 해 볼 것'));
  const now = new Date().getFullYear();
  for (const m of flow.matchAll(/\((\d{4})~(\d{4})년\)/g)) assert.ok(Number(m[2]) >= now, `지난 시기가 남았다: ${m[0]}`);
  assert.ok([...flow.matchAll(/\((\d{4})~(\d{4})년\)/g)].length <= 4);
  // 자세한 장은 접어 두고, 겹치던 장(사업·로또, 질문별 색인)은 다시 넣지 않는다
  for (const chapter of ['일과 돈', '사랑과 가족', '건강', '앞으로 마주할 중요한 일', '어떤 일이 맞는가', '일하는 방식', '돈을 버는 방식', '쓰는 습관과 모으는 법', '타고난 몸의 결']) {
    assert.match(html, rx(chapter));
  }
  // 태어난 해 하나로 정해져 또래가 같은 글을 받던 칸과, 사전과 겹치던 칸은 다시 넣지 않는다
  for (const gone of ['2-2. 책도장', '로또 분석과 횡재운', '질문별 답변 통합 색인', '세부 계산 보기',
    '방향과 이동', '올해의 메인 테마', '타고난 기질', '타고난 요일의 성향', '사회에서 보이는 나',
    '한눈에 보는 내 인생의 핵심 키워드', '이 힘이 흔들리는 조건', '잘 되는 것 —',
    '명반을 가르는 핵심 구조', '어린 시절 집안 환경의 변화', '일자별로 보기',
    // "나는 어떤 사람인가" 중심의 옛 카드 — 수익 스타일 칸에 지출 습관이 섞여 나왔다
    '나는 어떤 사람인가', '수익 스타일', '커리어 &amp; 재물',
    // 사용자 요청으로 뺀 장 — 올해 장, 일이 풀리고 막히는 흐름 장
    '년, 어디가 움직이는가', '일이 풀리고 막히는 흐름']) {
    assert.doesNotMatch(html, rx(gone));
  }
});

test('"나는 어떤 사람인가"는 성격의 뼈대 체계를 먼저 쓰고 사건을 점치는 판은 쓰지 않는다', async () => {
  const { coreField } = await import('../../public/unse/src/semantic/dict.js');
  const es = [
    { label: '육임(결말)', share: 0.001, entry: { p: '일의 끝에 기쁜 결과와 재물이 따릅니다.' } },
    { label: '숙요', share: 0.01, entry: { p: '결단이 빠르고 행동이 앞섭니다.' } },
    { label: '서양 점성(달)', share: 0.08, entry: { p: '조용하고 혼자 생각하는 시간이 필요합니다.' } },
    { label: '사주', share: 0.08, entry: { p: '신중하고 차분하게 움직입니다.' } },
  ];
  const got = coreField(es, 'p', 4).map((x) => x.label);
  assert.equal(got[0], '사주');
  assert.ok(!got.includes('육임(결말)'), '사건을 점치는 판이 성격 칸에 들어갔다');
  assert.ok(!got.includes('숙요'), '앞서 고른 "신중·차분"과 반대 결인 "빠르다"가 함께 실렸다');
});

test('앞으로 마주할 중요한 일은 시기표가 아니라 사건·모양·대비로 쓴다', () => {
  const html = personal(A);

  assert.doesNotMatch(html, /잠정 선택|사전 후보|사람별 검증/);
  // '시기 한눈에 보기'(분야별 몇 년 몇 월 신호표)는 뺐다 — 사건마다 나이 무렵과 대비를 쓴다
  assert.doesNotMatch(html, /시기 한눈에 보기|가장 큰 기회와 변화가 오는 때는 <strong>/);
  assert.match(html, /<b>대비<\/b> — /);
  assert.match(html, /세 무렵/);
  // 결혼·출산 연도는 검증에서 떨어져 내지 않는다
  assert.doesNotMatch(html, /인연·관계가 가장 무르익는 때는 <strong>/);
  assert.doesNotMatch(html, /출산·가족 확장 신호가 높은 때는 <strong>/);
});

test('잘 맞는 일은 한 갈래로 모이고, 일을 키우려면도 같은 갈래일 때만 싣는다', async () => {
  const { careerFocus } = await import('../../public/unse/src/report.js');
  const r = readFortune(A);
  const focus = careerFocus(r);
  const html = personal(A);
  // 머리말("여러 점술이 함께 가리키는 쪽은")은 뺐다 — 고른 갈래의 분야만 싣는다
  assert.doesNotMatch(html, /여러 점술이 함께 가리키는 쪽은/);
  if (focus.verified.length) assert.match(html, rx(`${focus.verified.join(', ')} 분야가 가능성이 높습니다`));
  // 자미 관록궁 문장은 "어떤 일이 맞는가"에 — 위 갈래와 같은 갈래일 때만
  const { ziweiPalaceEntry } = await import('../../public/unse/src/semantic/dict.js');
  const work = ziweiPalaceEntry(r, 'career');
  if (work) assert.equal(html.includes(work.g), focus.workFits);
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

test('궁합 리포트는 두 사람의 명반을 맞댄 해석과 각자의 사전 문장을 쉬운 말로 싣는다', () => {
  const c = compareFortune(A, B);
  const view = buildCompatView(A, B, c);
  const html = pair(A, B);
  // 궁합에 맞는 순서 — 연애 궁합인가 결혼 궁합인가 → 연애할 때 → 결혼하면 → 배려 → 고칠 점 → 자녀 → 마주할 일
  let at = -1;
  for (const heading of ['보고서 개인 · 보고서 상대 관계 분석 리포트',
    '연애 궁합인가, 결혼 궁합인가', '연애할 때', '결혼하면', '서로 배려할 점', '각자 고쳐야 할 점', '자녀와 함께라면',
    '더 자세히 보기', '앞으로 두 사람이 마주할 중요한 일']) {
    const i = html.indexOf(heading);
    assert.ok(i > at, `순서가 어긋났거나 없음: ${heading}`);
    at = i;
  }
  // 개인 운세에 맞는 칸(각자의 지금 시기·지금 힘을 쓸 곳·기운 비교표)은 궁합에서 뺐다
  for (const gone of ['지금 두 사람은', '앞으로 함께 가야 할 방향', '지금 힘을 쓸 곳', '서로 채워주는 기운']) assert.doesNotMatch(html, rx(gone));
  // 자녀는 "몇 명을 낳게 된다"는 예측이 아니라, 두 사람 궁합으로 본 권하는 말(낳으면 어떤지·몇 명 정도가 잘 맞는지)로만
  assert.match(html, /아이를 낳으면/);
  assert.match(html, /몇 명이 좋을까/);
  assert.doesNotMatch(html, /\d명을 낳|낳게 됩니다|자녀는 \d명/);
  assert.match(html, /점술은 상징적 해석 도구/);
  // 여덟 축 × 상·중·하마다 정해진 문단은 다시 싣지 않는다 — 같은 구간의 쌍이 같은 글을 받았다
  for (const axis of view.eightAxes) assert.doesNotMatch(html, rx(axis.conclusion));
  // 두 사람의 일간 기운 짝 해석에 두 이름이 들어간다
  assert.match(html, /보고서 개인님|보고서 상대님/);
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

test('궁합에서 기혼을 고르면 부부용 리포트 — 결혼 여부를 다시 판정하지 않고, 결혼 자체를 앞날 사건으로 내지 않는다', () => {
  const married = pair({ ...A, marital: 'married' }, B);
  for (const heading of ['두 사람은 어떤 부부인가', '두 사람 사이의 설렘과 대화', '함께 사는 일', '함께 살며 — 재산·육아·일', '아이가 두 사람에게 주는 의미']) {
    assert.match(married, rx(heading));
  }
  for (const gone of ['연애 궁합인가, 결혼 궁합인가', '결혼해서 더 잘 맞는', '연애할 때 더 잘 맞는', '관계를 공식적으로 묶는 일', '몇 명이 좋을까']) {
    assert.doesNotMatch(married, rx(gone));
  }
  // 미혼·선택 안 함은 그대로, 재산·육아·일은 "함께 산다면"으로 보인다
  const single = pair(A, B);
  assert.match(single, /함께 산다면 — 재산·육아·일/);
  for (const k of ['재산은 이렇게 모으면 좋습니다', '육아는 누가', '둘 다 일할까']) assert.match(single, rx(k));
});

test('책 추천 — 그 사람에게 필요한 주제 셋을 이유와 함께 담고, 책은 서버 응답 뒤에 채운다', async () => {
  const { bookNeeds } = await import('../../public/unse/src/report.js');
  const needs = bookNeeds(readFortune(A));
  assert.equal(needs.length, 3);
  assert.equal(new Set(needs.map((x) => x.theme)).size, 3, '주제가 겹친다');
  for (const n of needs) assert.ok(n.reason.length > 10);
  // 카드는 자리만(숨김) — 서버가 꺼져 있어도 빈 카드가 보이지 않는다
  assert.match(personal(A), /class="rp-card rp-books-card" hidden data-book-seed="\d+" data-book-needs=/);
  assert.match(pair(A, B), /두 사람이 함께 읽으면 좋은 책/);
});

test('책 추천 주제는 같은 사람이라도 달마다 바뀐다(이번 달의 결 + 늘 필요한 것을 번갈아)', async () => {
  const { bookNeeds, futureDigest } = await import('../../public/unse/src/report.js');
  const r = readFortune(A);
  const at = (iso) => bookNeeds(r, futureDigest(r), readForecast(A, new Date(iso))).map((x) => x.theme).join(',');
  const months = ['2026-10-10', '2026-11-15', '2027-03-10', '2027-06-10'].map(at);
  assert.ok(new Set(months).size >= 3, `달마다 주제가 거의 같다: ${months.join(' / ')}`);
});
