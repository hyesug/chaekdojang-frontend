/**
 * 시기 층 — 구조를 고정한다.
 *
 * 여기서 막는 것은 **세 층이 다시 섞이는 것**이다.
 *   activation   그 분야가 움직이는가 (좋고 나쁨이 아니다)
 *   featureShift 어느 방향으로
 *   event        현실에서 무슨 일로
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { predictTimeline, peakWindows } from '../../public/unse-8f3k2m/src/semantic/timing/timeline.js';
import {
  DOMAINS, DOMAIN_LABEL, RESOLUTION, WINDOW_MONTHS, signal, unavailable, monthNo,
} from '../../public/unse-8f3k2m/src/semantic/timing/schema.js';
import { EVENT_CANDIDATES, scoreEvents, candidatesOf } from '../../public/unse-8f3k2m/src/semantic/timing/events.js';
import { SYSTEM_IDS } from '../../public/unse-8f3k2m/src/semantic/extract.js';
import { AXES } from '../../public/unse-8f3k2m/src/semantic/axes.js';

const BIRTH = {
  name: 'x', gender: 'female', year: 1992, month: 1, day: 30,
  hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전',
};
const RANGE = { from: '2028-01', to: '2029-12' };

let cached = null;
const run = () => (cached ??= predictTimeline({ birth: BIRTH, ...RANGE }));

test('열두 분야 해상도가 정의돼 있고 창 크기로 이어진다', () => {
  for (const d of DOMAINS) {
    assert.ok(RESOLUTION[d], `${d} 해상도 없음`);
    assert.ok(WINDOW_MONTHS[RESOLUTION[d]] >= 1, `${d} 창 크기 없음`);
  }
  // 결혼을 관계와 같은 눈금으로 보지 않는다
  assert.ok(WINDOW_MONTHS[RESOLUTION.marriage] > WINDOW_MONTHS[RESOLUTION.relationship]);
  assert.equal(RESOLUTION.personality, 'year');
});

test('열다섯이 모두 같은 모양으로 시기 신호를 낸다', () => {
  const r = run();
  assert.equal(Object.keys(r.systemResults).length, SYSTEM_IDS.length);
  for (const id of SYSTEM_IDS) {
    const months = Object.values(r.systemResults[id].months).filter(Boolean);
    assert.ok(months.length, `${id} 결과 없음`);
    for (const m of months.slice(0, 3)) {
      assert.ok(['month', 'year', 'none'].includes(m.resolution), `${id} 해상도 ${m.resolution}`);
      if (!m.available) { assert.ok(m.why, `${id} 는 왜 못 쓰는지 적는다`); continue; }
      for (const [d, v] of Object.entries(m.activations)) {
        assert.ok(DOMAINS.includes(d), `${id} 에 없는 분야 ${d}`);
        assert.ok(v >= 0 && v <= 1, `${id}.${d} activation ${v}`);
      }
    }
  }
});

test('시기를 가르지 못하는 체계는 그렇다고 적는다', () => {
  const r = run();
  const coarse = SYSTEM_IDS.filter((id) => {
    const m = Object.values(r.systemResults[id].months).find(Boolean);
    return m && m.resolution !== 'month';
  });
  // 태을신수는 한 궁에 세 해를 머문다 — 달을 가를 수 없다
  assert.ok(coarse.includes('taeeul'), '태을신수가 달 단위라고 나오면 안 된다');
  for (const id of coarse) {
    const m = Object.values(r.systemResults[id].months).find(Boolean);
    assert.ok(m.why, `${id} 는 왜 눈금이 굵은지 적는다`);
  }
});

test('activation 과 featureShift 와 event 가 섞이지 않는다', () => {
  const r = run();
  const t = r.timeline[Object.keys(r.timeline)[6]];
  assert.ok(t.domains.career, 'activation 이 따로 있다');
  assert.ok(t.featureShift.career, '방향이 따로 있다');
  assert.ok(Array.isArray(t.events), '사건 후보가 따로 있다');
  assert.match(r.meta.note, /좋은 일이 생긴다는 뜻이 아니다/);
  assert.match(r.meta.confidenceNote, /다른 말이다/);
});

test('activation 을 그 사람 안에서의 순위로도 낸다', () => {
  const r = run();
  for (const t of Object.values(r.timeline)) {
    for (const [d, v] of Object.entries(t.domains)) {
      assert.ok(v.percentile >= 0 && v.percentile <= 100, `${d} 백분위 ${v.percentile}`);
      assert.equal(v.resolution, RESOLUTION[d]);
    }
  }
});

test('방향이 그 분야의 축으로만 나온다', () => {
  const r = run();
  for (const t of Object.values(r.timeline)) {
    for (const [d, shift] of Object.entries(t.featureShift)) {
      for (const [ax, v] of Object.entries(shift)) {
        assert.ok(AXES[d].includes(ax), `${d} 에 없는 축 ${ax}`);
        assert.ok(v >= -1 && v <= 1, `${d}.${ax} = ${v}`);
      }
    }
  }
});

test('사건 후보가 다섯 몫의 곱으로 매겨진다', () => {
  const r = run();
  const withEvents = Object.values(r.timeline).find((t) => t.events.length);
  assert.ok(withEvents, '사건 후보가 하나도 안 나오면 안 된다');
  for (const e of withEvents.events) {
    assert.ok(e.type && e.label && e.domain);
    for (const k of ['activation', 'natalSusceptibility', 'directionMatch',
      'contextCompatibility', 'systemConsensus']) {
      assert.ok(k in e.parts, `${e.type} 에 ${k} 가 없다`);
    }
  }
});

test('방향이 안 맞으면 활성화가 높아도 그 사건이 아니다', () => {
  const toOrg = scoreEvents('career', 0.9,
    { organization: 0.9, stability: 0.6, change: 0.1, independence: -0.5 }, null, 1);
  const toIndep = scoreEvents('career', 0.9,
    { independence: 0.9, change: 0.8, organization: -0.5 }, null, 1);
  const pick = (xs, t) => xs.find((x) => x.type === t).score;
  assert.ok(pick(toIndep, 'freelance') > pick(toOrg, 'freelance'), '독립 방향이면 프리랜서가 높다');
  assert.ok(pick(toOrg, 'promotion') > pick(toIndep, 'promotion'), '조직 방향이면 승진이 높다');
});

test('현재 상태가 있으면 성립하지 않는 후보를 거른다', () => {
  const shift = { marriageOrientation: 0.9, spouseStable: 0.6 };
  const single = scoreEvents('marriage', 0.9, shift, null, 1, { maritalStatus: 'single' });
  const married = scoreEvents('marriage', 0.9, shift, null, 1, { maritalStatus: 'married' });
  assert.ok(single.find((x) => x.type === 'marriage').score > 0);
  assert.equal(married.find((x) => x.type === 'marriage').score, 0, '기혼이면 결혼 후보가 아니다');
});

test('현재 상태가 없으면 명반으로 상태를 추측하지 않는다', () => {
  const none = scoreEvents('marriage', 0.9, { marriageOrientation: 0.9 }, null, 1, null);
  assert.ok(none.every((x) => x.parts.contextCompatibility === 1), '거르지 않는다');
  assert.ok(none[0].contextNote, '거르지 않았다는 사실을 적는다');
});

test('건강은 질환명·수술을 후보로 만들지 않는다', () => {
  const keys = candidatesOf('health').map((c) => c.key).sort();
  assert.deepEqual(keys, ['health_attention_period', 'physical_load', 'recovery_need']);
});

test('자녀·학업은 확정적으로 단정하지 않는다고 적는다', () => {
  assert.ok(candidatesOf('children').some((c) => /관련|구간|전환/.test(c.label)));
  const exam = candidatesOf('education').find((c) => c.key === 'exam_success_window');
  assert.match(exam.note, /합격을 단정하지 않는다/);
});

test('아홉 분야에 사건 후보가 모두 있다', () => {
  for (const d of ['career', 'relationship', 'marriage', 'children', 'education',
    'wealth', 'residence', 'movement', 'health', 'majorChange']) {
    assert.ok((EVENT_CANDIDATES[d] ?? []).length >= 3,
      `${DOMAIN_LABEL[d]} 후보가 ${EVENT_CANDIDATES[d]?.length}개뿐`);
  }
  assert.ok(EVENT_CANDIDATES.career.length >= 8, '직업을 하나로 압축하지 않는다');
});

test('여러 분야가 함께 켜지는 구간을 따로 표시한다', () => {
  const r = run();
  assert.ok(Array.isArray(r.transitions));
  for (const t of r.transitions) assert.ok(t.domains.length >= 3);
});

test('강한 구간을 순위로 뽑는다', () => {
  const w = peakWindows(run(), 'career', 2);
  assert.ok(w.length >= 1);
  for (const x of w) assert.ok(monthNo(x.to) >= monthNo(x.from));
});

test('시각을 모르면 자미·점성만 빠지고 나머지는 시기를 계속 낸다', () => {
  const r = predictTimeline({ birth: { ...BIRTH, hour: undefined, minute: undefined }, ...RANGE });
  const first = Object.keys(r.systemResults.jamidusu.months)[0];
  assert.equal(r.systemResults.jamidusu.months[first].available, false);
  assert.match(r.systemResults.jamidusu.months[first].why, /시각/);
  assert.equal(r.systemResults.saju.months[first].available, true);
  assert.ok(Object.values(r.timeline).some((t) => t.domains.career.activation > 0));
});

test('같은 입력이면 시간축이 똑같다', () => {
  const a = predictTimeline({ birth: BIRTH, ...RANGE });
  const b = predictTimeline({ birth: BIRTH, ...RANGE });
  const k = Object.keys(a.timeline)[3];
  assert.deepEqual(a.timeline[k].domains, b.timeline[k].domains);
  assert.deepEqual(a.timeline[k].featureShift, b.timeline[k].featureShift);
});

test('체계별 결과를 버리지 않는다 — 나중에 누가 잘 잡는지 재야 한다', () => {
  const r = run();
  for (const id of SYSTEM_IDS) {
    const v = r.systemResults[id];
    assert.ok(v.name && v.lineage, `${id} 이름·계보`);
    assert.ok(Object.keys(v.months).length, `${id} 달별 결과`);
  }
});

test('신호 스키마가 빈 값을 조용히 만들지 않는다', () => {
  const s = signal('saju', '2028-01', {});
  assert.equal(s.available, true);
  const u = unavailable('jamidusu', '2028-01', '시각 미상');
  assert.equal(u.available, false);
  assert.equal(u.resolution, 'none');
  assert.ok(u.why);
});
