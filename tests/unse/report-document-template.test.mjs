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

test('개인 통합 해석은 참고 문서의 전체 목차를 계산 결과로 채운다', () => {
  const r = readFortune(A);
  const f = readForecast(A);
  const html = renderReport(A, r, f, buildView(A, r, f));
  const year = f.year.period.sajuYear;

  for (const heading of [
    '0. 한눈에 보는 통합 결론',
    '1. 평생 커리어·명예·재물 흐름',
    '2. 프로젝트·사업·수익화',
    '2-2. 책도장',
    '2-3. 로또 분석과 횡재운',
    '3. 관계·숙요',
    `4. ${year}년 흐름: 요일·다샤·점시·월운`,
    '5. 행운 요소·방위·이사/이직 방향',
    '6. 기문·수비학이 보여주는 평생 성패와 내적 과제',
    '7. 2026년 전반 신수: 건강·집안·사고·재물',
    '8. 질문별 답변 통합 색인',
    '9. 최종 타임라인과 실행 원칙',
  ]) assert.match(html, rx(heading));

  assert.match(html, /보고서 개인 명반 통합 해석/);
  assert.match(html, /사주/);
  assert.match(html, /점시 형식의 현재 흐름 \(별도 점시 아님\)/);
});

test('궁합 통합 보고서는 관계 보고서의 목차를 두 사람의 계산 결과로 채운다', () => {
  const c = compareFortune(A, B);
  const view = buildCompatView(A, B, c);
  const html = renderPairReport(A, B, c, view, {
    a: elementDistribution(c.A.chart.pillars).count,
    b: elementDistribution(c.B.chart.pillars).count,
  });
  const year = c.A.input.currentYear;

  for (const heading of [
    '1. 핵심 결론',
    '2. 해석에 사용한 핵심 계산값',
    '3. 사주 — 일간·오행·합충',
    '4. 서양 시나스트리 — 감정·끌림·지속성',
    '5. 자미두수 — 부처궁 교차와 상호 영향',
    '6. 27숙(숙요) — 위성 관계',
    '7. 요일·수호행성',
    '8. 베딕 아스타쿠타',
    '9. 구성학 본명성',
    '10. 생명의 나무',
    `11. ${year}년 결혼 점시 (출생정보 기준·별도 점시 아님)`,
    `12. ${year}년 두 사람의 공동운 (출생정보 기준)`,
    '13. 현재부터 3개월 관계 흐름 (월별 예측 아님)',
    `14. ${year}년 화합하기 좋은 시기: 주역·수리 (일정 판정 없음)`,
    '15. 여러 체계에서 반복되는 공통 패턴',
    '16. 최종 통합 판단',
    '부록. 해석 범위와 주의사항',
  ]) assert.match(html, rx(heading));

  assert.match(html, /보고서 개인 · 보고서 상대/);
  assert.match(html, /점술·점성 체계는 상징적 해석 도구/);
  assert.match(html, /11-4\. 태을신수/);
  assert.match(html, /11-5\. 토정비결/);
  assert.match(html, /11-6\. 타로/);
  for (const key of ['생활', '돈', '역할분담', '끌림', '감정', '대화', '장기유지']) {
    const axis = view.eightAxes.find((item) => item.key === key);
    assert.ok(axis, `${key} 축이 없습니다`);
    assert.match(html, rx(axis.conclusion));
  }
});

test('같은 보고서 형식도 출생 정보가 바뀌면 계산 해석이 달라진다', () => {
  const other = { ...A, month: 1, day: 3, hour: 4 };
  const r = readFortune(A);
  const f = readForecast(A);
  const otherR = readFortune(other);
  const otherF = readForecast(other);

  const personal = renderReport(A, r, f, buildView(A, r, f));
  const changedPersonal = renderReport(other, otherR, otherF, buildView(other, otherR, otherF));
  assert.notEqual(personal, changedPersonal);

  const c = compareFortune(A, B);
  const changed = compareFortune(other, B);
  const pair = renderPairReport(A, B, c, buildCompatView(A, B, c), {
    a: elementDistribution(c.A.chart.pillars).count,
    b: elementDistribution(c.B.chart.pillars).count,
  });
  const changedPair = renderPairReport(other, B, changed, buildCompatView(other, B, changed), {
    a: elementDistribution(changed.A.chart.pillars).count,
    b: elementDistribution(changed.B.chart.pillars).count,
  });
  assert.notEqual(pair, changedPair);
});
