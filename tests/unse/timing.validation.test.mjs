/**
 * 시기 **검증기**가 거짓말하지 않게 막는 검사들.
 *
 * 앞선 검증기에서 실제로 걸린 잘못을 하나씩 고정한다. 여기서 재는 것은
 * 엔진의 정확도가 아니라 **자(尺)의 정확도**다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  midRank, topK, windowSlice, seededRandom, RESOLUTION, WINDOW_MONTHS, DOMAINS,
} from '../../public/unse/src/semantic/timing/schema.js';
import {
  scoreEvent, scoreEventYearly, toYearly, permutationBaseline, personWeighted, personBootstrap,
  aggregateNull, prepareNullDraws, nullPosition, NULL_METRICS, scoreAtResolution, poolFor,
} from '../../public/unse/src/validation/timingMetrics.js';
import { predictTimeline } from '../../public/unse/src/semantic/timing/timeline.js';
import { scoreEvents } from '../../public/unse/src/semantic/timing/events.js';
import { SYSTEM_IDS } from '../../public/unse/src/semantic/extract.js';

const BIRTH = {
  name: 'x', gender: 'female', year: 1992, month: 1, day: 30,
  hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전',
};
let cached = null;
const run = () => (cached ??= predictTimeline({ birth: BIRTH, from: '2028-01', to: '2029-12' }));

const mk = (vals, from = 2020) => vals.map((v, i) => ({
  k: `${from + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`, v,
}));

// ── 1~3. 동점 ────────────────────────────────────────────────

test('1. 동점은 같은 순위·같은 백분위를 받는다', () => {
  const a = midRank([0.9, 0.8, 0.8, 0.8, 0.3], 0.8);
  assert.equal(a.tied, 3);
  assert.equal(a.rank, 3, '중간 순위 (1개 위 + (3+1)/2)');
  // 같은 값이면 어느 것을 target 으로 줘도 같다
  assert.deepEqual(midRank([0.9, 0.8, 0.8, 0.8, 0.3], 0.8), a);
});

test('2. 값이 전부 같으면 채점하지 않는다 (unscorable)', () => {
  assert.equal(midRank([0, 0, 0, 0], 0).percentile, null);
  assert.equal(midRank([0, 0, 0, 0], 0).allEqual, true);
  const s = scoreEvent(mk([0, 0, 0, 0, 0, 0]), '2020-03');
  assert.equal(s.unscorable, 'no_variation');
  assert.match(s.note, /구분하지 못한다/);
});

test('3. 배열 순서를 바꿔도 결과가 같다 — 첫 달이라고 유리하지 않다', () => {
  const vals = [0.5, 0.5, 0.5, 0.9, 0.5];
  const series = mk(vals);
  const first = scoreEvent(series, '2020-01');
  const last = scoreEvent(series, '2020-05');
  assert.equal(first.eventPercentile, last.eventPercentile,
    '같은 점수인 첫 달과 끝 달이 같은 백분위를 받는다');
  // 순서를 뒤집어도 같다
  const rev = scoreEvent(mk([0.5, 0.9, 0.5, 0.5, 0.5]), '2020-01');
  assert.equal(rev.eventPercentile, first.eventPercentile);
});

// ── 4. 원값 / 표시값 ──────────────────────────────────────────

test('4. 검증은 반올림하지 않은 원값을 쓴다', () => {
  const r = run();
  const k = Object.keys(r.timeline)[5];
  const d = r.timeline[k].domains.career;
  assert.ok('rawActivation' in d, '원값을 따로 남긴다');
  assert.ok('activation' in d, '표시값도 남긴다');
  // 표시값은 소수 셋째 자리, 원값은 그렇지 않을 수 있다
  assert.equal(d.activation, Math.round(d.rawActivation * 1000) / 1000);
  const sys = r.systemResults.saju.months[k];
  assert.ok(sys.rawActivations, '체계별도 원값을 남긴다');

  // 표시상 같아 보이는 값도 원값이 다르면 순위가 갈린다
  const a = scoreEvent(mk([0.41246, 0.41221, 0.41188, 0.1]), '2020-01');
  const b = scoreEvent(mk([0.412, 0.412, 0.412, 0.1]), '2020-01');
  assert.equal(a.unscorable, null);
  assert.ok(a.eventPercentile > b.eventPercentile,
    '원값으로 재면 1위, 반올림하면 동점이 되어 낮아진다');
});

// ── 5~6. unavailable vs 0 ────────────────────────────────────

test('5. 말할 근거가 없는 분야는 분모에서 빠진다', () => {
  const r = run();
  const k = Object.keys(r.timeline)[3];
  // 보조 체계는 이동·주거·자녀를 말할 자리가 없다 → null
  const tarot = r.systemResults.tarot.months[k];
  assert.equal(tarot.rawActivations.movement, null, '타로는 이동 시기를 말하지 않는다');
  assert.equal(tarot.domainAvailability.movement, false);
  assert.ok(Number.isFinite(tarot.rawActivations.career), '직업은 말한다');
  assert.equal(tarot.domainAvailability.career, true);
});

test('6. activation 0 과 unavailable 은 다른 것이다', () => {
  const r = run();
  const k = Object.keys(r.timeline)[3];
  const saju = r.systemResults.saju.months[k];
  // 사주는 이동을 말할 수 있다 — 값이 낮아도 null 이 아니다
  assert.ok(Number.isFinite(saju.rawActivations.movement));
  assert.equal(saju.domainAvailability.movement, true);
  // 기질·시기는 시기로 말하지 않는다 → null
  assert.equal(saju.rawActivations.personality, null);
  assert.equal(saju.domainAvailability.personality, false);
});

test('17. 보조 체계가 못 말하는 분야에 가짜 성능이 생기지 않는다', () => {
  const r = run();
  for (const id of ['tarot', 'juyeok', 'thai', 'kabbalah', 'taeeul', 'tojeong']) {
    for (const k of Object.keys(r.systemResults[id].months).slice(0, 4)) {
      const m = r.systemResults[id].months[k];
      if (!m?.rawActivations) continue;
      for (const d of ['movement', 'residence', 'children']) {
        assert.equal(m.rawActivations[d], null, `${id} 가 ${d} 시기를 말하면 안 된다`);
      }
    }
  }
});

// ── 7~8. 해상도 ──────────────────────────────────────────────

test('7. 해 단위 체계는 해로 접어서 잰다', () => {
  // 12달 같은 값 × 3해 — 달로 재면 구분 못 함, 해로 접으면 구분됨
  const flat12 = [...Array(12).fill(0.3), ...Array(12).fill(0.9), ...Array(12).fill(0.5)];
  const series = mk(flat12);
  assert.equal(scoreEvent(series, '2021-05').unscorable, null);
  const yearly = toYearly(series);
  assert.equal(yearly.length, 3);
  const y = scoreEventYearly(series, 2021);
  assert.equal(y.unscorable, null);
  assert.equal(y.eventPercentile, 100, '2021 이 가장 높은 해');
});

test('8. 시기 해상도가 없는 체계는 성능 계산에서 빠진다', () => {
  const r = run();
  for (const id of SYSTEM_IDS) {
    const m = Object.values(r.systemResults[id].months).find(Boolean);
    if (m?.resolution !== 'none') continue;
    assert.ok(m.why, `${id} 는 왜 눈금이 없는지 적는다`);
  }
  // 전부 같은 시계열은 채점 자체가 불가
  assert.equal(scoreEvent(mk(Array(24).fill(0.5)), '2020-06').unscorable, 'no_variation');
});

// ── 9. 월 미상 ───────────────────────────────────────────────

test('9. 월을 모르면 6월로 만들지 않고 연 단위로만 잰다', () => {
  const series = mk([...Array(12).fill(0.2), ...Array(12).fill(0.8)]);
  const y = scoreEventYearly(series, 2021);
  assert.equal(y.unscorable, null);
  assert.equal(y.eventPercentile, 100);
  // 연 단위 채점에는 월 지표가 없다
  assert.equal(y.top3Within3, undefined);
  assert.equal(y.peakErrorMonths, undefined);
});

// ── 10~12. 창 크기 ───────────────────────────────────────────

test('10~12. 창에 정확히 그 달 수만 담긴다', () => {
  const keys = Array.from({ length: 60 }, (_, i) => `k${i}`);
  for (const [name, months] of Object.entries({ month: 1, quarter: 3, halfyear: 6, year: 12 })) {
    const w = windowSlice(keys, 30, months);
    assert.equal(w.count, months, `${name} 창이 ${w.count}개`);
    assert.equal(w.full, true);
  }
  // 짝수 창은 왼쪽을 하나 적게 — 규칙이 정해져 있다
  const six = windowSlice(keys, 30, 6);
  assert.equal(30 - six.from, 2, '왼쪽 2');
  assert.equal(six.to - 30, 3, '오른쪽 3');
  // 경계에서는 담긴 개수와 다 찼는지를 남긴다
  const edge = windowSlice(keys, 0, 12);
  assert.ok(edge.count < 12);
  assert.equal(edge.full, false);
});

test('10b. 분야 해상도가 실제 창 크기로 이어진다', () => {
  const r = run();
  const k = Object.keys(r.timeline)[10];
  for (const d of Object.keys(r.timeline[k].domains)) {
    const v = r.timeline[k].domains[d];
    if (v.unavailable) continue;
    assert.equal(v.window, WINDOW_MONTHS[RESOLUTION[d]], `${d} 창 크기`);
    assert.ok(v.windowCount <= v.window, `${d} 담긴 달이 창을 넘지 않는다`);
  }
});

// ── 13~14. 방향과 세기 ───────────────────────────────────────

test('13. 약한 흔들림과 강한 흔들림의 magnitude 가 다르다', () => {
  const r = run();
  const mags = Object.values(r.timeline)
    .map((t) => t.featureShift.career?.magnitude).filter((x) => x != null);
  assert.ok(mags.length);
  assert.ok(Math.max(...mags) > Math.min(...mags), 'magnitude 가 달마다 달라야 한다');
  // raw 가 작으면 magnitude 도 작다
  for (const t of Object.values(r.timeline)) {
    const s = t.featureShift.career;
    if (!s) continue;
    const peak = Math.max(0, ...Object.values(s.raw).map(Math.abs));
    assert.ok(Math.abs(s.magnitude - Math.min(1, peak / 0.5)) < 0.01);
  }
});

test('14. 사건 점수가 magnitude 를 반영한다', () => {
  const dir = { independence: 1, change: 0.8, organization: -0.5 };
  const strong = scoreEvents('career', 0.9, dir, null, 1, null, 1.0);
  const weak = scoreEvents('career', 0.9, dir, null, 1, null, 0.06);
  const pick = (xs) => xs.find((x) => x.type === 'freelance');
  assert.ok(pick(strong).score > pick(weak).score * 5,
    '방향이 같아도 세기가 약하면 점수가 크게 낮아야 한다');
  assert.equal(pick(strong).parts.shiftMagnitude, 1);
  assert.ok(pick(weak).parts.shiftMagnitude < 0.2);
});

// ── 15~16. 기준선과 사람 가중 ────────────────────────────────

test('15. 순열 기준선이 씨앗 고정으로 재현된다', () => {
  const series = mk([0.1, 0.4, 0.9, 0.2, 0.7, 0.3, 0.8, 0.5]);
  const a = permutationBaseline(series, 2000, 123);
  const b = permutationBaseline(series, 2000, 123);
  assert.deepEqual(a, b, '같은 씨앗이면 같은 값');
  const c = permutationBaseline(series, 2000, 999);
  assert.notEqual(a.mean === c.mean && a.lo === c.lo && a.hi === c.hi, true, '씨앗이 다르면 달라진다');
  // 무작위로 뽑으면 평균 백분위는 50 근처다
  assert.ok(Math.abs(a.mean - 50) < 8, `null 평균 ${a.mean}`);
  // 구분 못 하는 시계열은 기준선도 못 만든다
  assert.equal(permutationBaseline(mk(Array(12).fill(0.5))).unscorable, 'no_variation');

  const rnd = seededRandom(7);
  const first = [rnd(), rnd(), rnd()];
  const rnd2 = seededRandom(7);
  assert.deepEqual([rnd2(), rnd2(), rnd2()], first);
});

test('16. 사람 가중 평균이 사건 수에 지배되지 않는다', () => {
  const rows = [
    { person: 'A', v: 100 }, { person: 'A', v: 100 }, { person: 'A', v: 100 },
    { person: 'B', v: 0 },
  ];
  const pw = personWeighted(rows, (r) => r.v);
  assert.equal(pw.people, 2);
  assert.equal(pw.mean, 50, '사건 셋을 낸 A 가 전체를 지배하지 않는다');
  const ew = rows.reduce((a, r) => a + r.v, 0) / rows.length;
  assert.equal(ew, 75, '사건 가중이면 75 — 둘은 달라야 한다');
  const boot = personBootstrap(rows, (r) => r.v, 500);
  assert.ok(boot.note, '사람이 적으면 탐색용이라고 적는다');
});

// ── 18. Top-K 동점 ───────────────────────────────────────────

test('18. Top-K 경계 동점을 배열 순서로 자르지 않는다', () => {
  const entries = mk([0.9, 0.5, 0.5, 0.5, 0.5, 0.1]);
  const t = topK(entries, 3);
  assert.equal(t.candidateCount, 5, '3위 자리 동점 넷을 모두 넣는다');
  assert.equal(t.topKRequested, 3);
  assert.equal(t.cutoff, 0.5);
  // 순서를 뒤집어도 같은 집합
  const rev = topK(mk([0.1, 0.5, 0.5, 0.5, 0.5, 0.9]), 3);
  assert.equal(rev.candidateCount, 5);
  // 사건 채점에도 실제 개수가 실린다
  const s = scoreEvent(entries, '2020-02');
  assert.equal(s.top3, true);
  assert.equal(s.top3Count, 5);
});

// ── 이름과 계산 일치 ─────────────────────────────────────────

test('지표 이름이 계산과 일치한다', () => {
  // 사건이 1위가 아니고 Top3 안에도 없지만, Top3 중 하나가 ±1달 안
  const series = mk([0.9, 0.85, 0.8, 0.2, 0.1, 0.05]);
  const s = scoreEvent(series, '2020-04');
  assert.equal(s.top3, false, '사건월 자체는 Top3 가 아니다');
  assert.equal(s.top3Within1, true, 'Top3 중 하나(2020-03)가 ±1달 안');
  assert.ok(s.bestPercentileWithin1 > s.eventPercentile,
    '±1창 최고값의 백분위는 사건월 자신의 백분위보다 높다');
  assert.equal(s.peakErrorMonths, 3, '전체 최고점(2020-01)은 3달 떨어져 있다');
});

test('열두 분야 모두 unavailable 을 조용히 0 으로 바꾸지 않는다', () => {
  const r = run();
  for (const t of Object.values(r.timeline)) {
    for (const [d, v] of Object.entries(t.domains)) {
      if (v.unavailable) {
        assert.equal(v.activation, null, `${d} unavailable 인데 값이 있다`);
        assert.equal(v.percentile, null);
        assert.ok(v.why);
      } else {
        assert.ok(Number.isFinite(v.rawActivation), `${d} 원값이 숫자여야 한다`);
      }
    }
  }
  void DOMAINS;
});

// ── 19~24. 합산 통계의 null 분포 · 사람별 눈금 ────────────────

test('19. 합산 null 은 개별 사건 null 구간의 평균이 아니다', () => {
  // 사건 여섯 건 — 각자 다른 시계열
  const rows = [0, 1, 2, 3, 4, 5].map((i) => ({
    person: `P${i}`,
    series: mk(Array.from({ length: 36 }, (_, j) => ((j * 7 + i * 13) % 36) / 36)),
  }));
  const agg = aggregateNull(rows, { rounds: 2000, seed: 1 });
  const each = rows.map((r) => permutationBaseline(r.series, 2000, 1));

  const avgLo = each.reduce((a, b) => a + b.lo, 0) / each.length;
  const avgHi = each.reduce((a, b) => a + b.hi, 0) / each.length;
  const A = agg.metrics.eventPercentile.event;

  // 평균은 √n 만큼 좁아진다 — 개별 구간을 평균한 폭보다 확실히 좁아야 한다
  assert.ok(A.hi - A.lo < (avgHi - avgLo) / 1.8,
    `합산 폭 ${A.hi - A.lo} 가 개별 평균 폭 ${avgHi - avgLo} 만큼 넓다`);
  assert.ok(A.lo > avgLo + 10, '합산 null 하한이 개별 하한과 같으면 안 된다');
  assert.ok(A.hi < avgHi - 10, '합산 null 상한이 개별 상한과 같으면 안 된다');
  // 중심은 비슷해야 한다 (좁아진 것이지 옮겨간 것이 아니다)
  assert.ok(Math.abs(A.mean - 50) < 6, `합산 null 평균 ${A.mean}`);
});

test('20. 같은 씨앗이면 합산 null 이 똑같이 재현된다', () => {
  const rows = [0, 1, 2].map((i) => ({
    person: `P${i}`,
    series: mk(Array.from({ length: 24 }, (_, j) => ((j * 5 + i * 3) % 24) / 24)),
  }));
  const a = aggregateNull(rows, { rounds: 500, seed: 777 });
  const b = aggregateNull(rows, { rounds: 500, seed: 777 });
  const c = aggregateNull(rows, { rounds: 500, seed: 778 });
  for (const m of NULL_METRICS) {
    assert.deepEqual(a.metrics[m].event.samples, b.metrics[m].event.samples, `${m} 재현 실패`);
  }
  assert.notDeepEqual(a.metrics.eventPercentile.event.samples,
    c.metrics.eventPercentile.event.samples, '씨앗이 다르면 달라야 한다');
});

test('21. 사건 가중 null 과 사람 가중 null 을 따로 만든다', () => {
  // 한 사람이 사건 다섯, 다른 두 사람이 하나씩 — 두 가중이 갈려야 한다
  const heavy = mk(Array.from({ length: 36 }, (_, j) => (j < 6 ? 0.9 : 0.1)));
  const light = mk(Array.from({ length: 36 }, (_, j) => j / 36));
  const rows = [
    ...Array.from({ length: 5 }, () => ({ person: 'A', series: heavy })),
    { person: 'B', series: light },
    { person: 'C', series: light },
  ];
  const agg = aggregateNull(rows, { rounds: 2000, seed: 42 });
  assert.equal(agg.events, 7);
  assert.equal(agg.people, 3);
  const e = agg.metrics.eventPercentile.event;
  const p = agg.metrics.eventPercentile.person;
  assert.notDeepEqual(e.samples, p.samples, '두 분포가 같으면 따로 계산하지 않은 것이다');
  // 사람 가중은 A 한 사람이 5/7 을 차지하지 않으므로 폭이 더 넓다
  assert.ok(p.hi - p.lo > e.hi - e.lo, '사람 가중이 사건 가중보다 좁을 수 없다');
});

test('22. 창 지표에도 null 기준선이 만들어진다', () => {
  const rows = [0, 1, 2, 3].map((i) => ({
    person: `P${i}`,
    series: mk(Array.from({ length: 36 }, (_, j) => ((j * 11 + i) % 36) / 36)),
  }));
  const agg = aggregateNull(rows, { rounds: 1000, seed: 9 });
  for (const t of [1, 3, 6]) {
    const w = agg.metrics[`top3Within${t}`].event;
    const b = agg.metrics[`bestPercentileWithin${t}`].event;
    assert.ok(w.mean >= 0 && w.mean <= 100, `Top3Within±${t} null ${w.mean}`);
    assert.ok(b.mean >= 0 && b.mean <= 100, `BestPercentileWithin±${t} null ${b.mean}`);
  }
  // 창이 넓을수록 우연히 걸릴 확률이 높다 — 기준선도 같이 올라야 한다
  assert.ok(agg.metrics.top3Within6.event.mean > agg.metrics.top3Within1.event.mean,
    '±6 기준선이 ±1 보다 낮으면 계산이 잘못됐다');
  assert.ok(agg.metrics.bestPercentileWithin6.event.mean
    > agg.metrics.bestPercentileWithin1.event.mean);
  // 관측값의 위치를 0~100 으로 낸다
  const pos = nullPosition(agg.metrics.top3Within3.event.mean, agg.metrics.top3Within3.event);
  assert.ok(pos >= 0 && pos <= 100);
  // 사전계산한 뽑기표가 scoreEvent 와 같은 값을 준다
  const d = prepareNullDraws(rows[0].series).draws.find((x) => x.key === '2020-05');
  const s = scoreEvent(rows[0].series, '2020-05');
  assert.equal(d.eventPercentile, s.eventPercentile);
  assert.equal(d.top3Within3, s.top3Within3 ? 100 : 0);
  assert.equal(d.bestPercentileWithin3, s.bestPercentileWithin3);
});

test('23. 같은 체계라도 사람마다 눈금이 다르면 각자의 눈금으로 잰다', () => {
  // 같은 체계, 같은 사건 달. 한 사람은 달이 갈리고(month) 한 사람은 해만 갈린다(year)
  const monthly = mk(Array.from({ length: 36 }, (_, j) => (j % 12) / 12));
  const yearly = mk(Array.from({ length: 36 }, (_, j) => Math.floor(j / 12) / 3));
  const row = { precision: 'month', year: 2021, key: '2021-03' };

  const a = scoreAtResolution(monthly, { ...row, resolution: 'month' });
  const b = scoreAtResolution(yearly, { ...row, resolution: 'year' });
  assert.equal(a.scale, 'month');
  assert.equal(b.scale, 'year');
  assert.equal(b.score.n, 3, '해 단위는 36달이 아니라 3해로 잰다');
  assert.equal(a.score.n, 36);

  // 첫 사람 눈금을 씌우면 값이 달라진다 — 그래서 행마다 받아야 한다
  const wrong = scoreAtResolution(yearly, { ...row, resolution: 'month' });
  assert.equal(wrong.scale, 'month');
  assert.notEqual(wrong.score.n, b.score.n);
  // 사건 날짜가 해까지만 알려졌으면 달 단위 체계라도 해로 접는다
  const coarse = scoreAtResolution(monthly, { ...row, precision: 'year', resolution: 'month' });
  assert.equal(coarse.scale, 'year');
});

test('24. 눈금이 없는 체계는 채점에서 빼고, 구분못함·무자료와 구별해 센다', () => {
  const row = { precision: 'month', year: 2021, key: '2021-03' };
  const flat = mk(Array.from({ length: 36 }, () => 0.4));
  const empty = mk(Array.from({ length: 36 }, () => null));
  const live = mk(Array.from({ length: 36 }, (_, j) => (j % 7) / 7));

  // none 은 0점이 아니라 평가 제외다
  const none = scoreAtResolution(live, { ...row, resolution: 'none' });
  assert.equal(none.skipped, 'no_resolution');
  assert.equal(none.score, null, '눈금이 없으면 점수를 만들지 않는다');

  assert.equal(scoreAtResolution(flat, { ...row, resolution: 'month' }).skipped, 'no_variation');
  assert.equal(scoreAtResolution(empty, { ...row, resolution: 'month' }).skipped, 'unavailable');
  assert.equal(scoreAtResolution(live, { ...row, resolution: 'month' }).skipped, null);

  // 넷이 서로 다른 칸으로 세어진다 — 한 칸에 뭉치면 "못 가림"이 "틀림"이 된다
  const tally = [none, scoreAtResolution(flat, { ...row, resolution: 'month' }),
    scoreAtResolution(empty, { ...row, resolution: 'month' }),
    scoreAtResolution(live, { ...row, resolution: 'month' })].map((x) => x.skipped);
  assert.deepEqual(tally, ['no_resolution', 'no_variation', 'unavailable', null]);
});

// ── 25. 가장자리 보정 ─────────────────────────────────────────

test('25. 창 지표의 null 후보에서 가장자리 달을 뺀다', () => {
  const series = mk(Array.from({ length: 36 }, (_, j) => ((j * 7) % 36) / 36));
  const p = prepareNullDraws(series);
  const keyOf = (pool) => pool.map((d) => d.key);

  // ±6 은 앞뒤 여섯 달을 확보한 달만 후보다
  const six = keyOf(poolFor(p.draws, 'bestPercentileWithin6'));
  assert.ok(!six.includes('2020-01'), '첫 달이 ±6 후보에 있으면 안 된다');
  assert.ok(!six.includes('2022-12'), '마지막 달이 ±6 후보에 있으면 안 된다');
  assert.ok(!six.includes('2020-06'), '여섯째 달은 앞쪽 여유가 5달뿐이다');
  assert.ok(six.includes('2020-07'), '일곱째 달부터 ±6 이 온전하다');
  assert.ok(six.includes('2021-06'), '한가운데 달은 후보다');
  assert.equal(six.length, 36 - 12);

  // 창이 좁을수록 후보가 넓다
  assert.ok(poolFor(p.draws, 'top3Within1').length > poolFor(p.draws, 'top3Within6').length);
  assert.equal(poolFor(p.draws, 'top3Within1').length, 36 - 2);
  // EventPercentile 은 창을 쓰지 않으므로 전부 후보다
  assert.equal(poolFor(p.draws, 'eventPercentile').length, 36);

  // 스무딩 창이 덜 찬 달은 한가운데라도 창 지표에서 뺀다
  const withHole = series.map((e, i) => (i === 18 ? { ...e, full: false } : e));
  const h = prepareNullDraws(withHole);
  assert.ok(!keyOf(poolFor(h.draws, 'top3Within1')).includes(series[18].k));
  assert.ok(keyOf(poolFor(h.draws, 'eventPercentile')).includes(series[18].k),
    'EventPercentile 후보에서까지 빼지는 않는다');
});

test('25b. 가장자리 보정 뒤에도 합산 null 구조와 재현성이 그대로다', () => {
  const rows = [0, 1, 2, 3].map((i) => ({
    person: `P${i}`,
    series: mk(Array.from({ length: 36 }, (_, j) => ((j * 11 + i * 5) % 36) / 36)),
  }));
  const a = aggregateNull(rows, { rounds: 600, seed: 31 });
  const b = aggregateNull(rows, { rounds: 600, seed: 31 });
  for (const m of NULL_METRICS) {
    assert.ok(a.metrics[m].event && a.metrics[m].person, `${m} 두 가중이 모두 있다`);
    assert.deepEqual(a.metrics[m].event.samples, b.metrics[m].event.samples, `${m} 재현 실패`);
    // 후보가 몇 달이었는지 적어 둔다 — 조용히 좁히지 않는다
    assert.ok(a.metrics[m].pool.candidates > 0);
    assert.ok(a.metrics[m].pool.candidates <= a.metrics[m].pool.total);
  }
  assert.equal(a.metrics.eventPercentile.pool.candidates, a.metrics.eventPercentile.pool.total);
  assert.ok(a.metrics.bestPercentileWithin6.pool.candidates
    < a.metrics.bestPercentileWithin1.pool.candidates, '±6 후보가 ±1 보다 좁다');
});
