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
import {
  evidenceOr, SIHWA_ACT, SIHWA_DIR, VEDIC_VARGA,
} from '../../public/unse-8f3k2m/src/semantic/timing/adapters.js';
import { SYSTEM_IDS } from '../../public/unse-8f3k2m/src/semantic/extract.js';
import { AXES } from '../../public/unse-8f3k2m/src/semantic/axes.js';

const BIRTH = {
  name: 'x', gender: 'female', year: 1992, month: 1, day: 30,
  hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전',
};
const RANGE = { from: '2028-01', to: '2029-12' };

let cached = null;
const run = () => (cached ??= predictTimeline({ birth: BIRTH, ...RANGE }));

// 보강한 재료를 보려면 창이 넉넉해야 한다 (대운 전환·다샤 전환이 들어오도록)
let cached20 = null;
const run20 = () => (cached20 ??= predictTimeline({ birth: BIRTH, from: '2019-01', to: '2022-12' }));
const ziweiSihwaAct = (k) => SIHWA_ACT[k];
const ziweiSihwaDir = (k) => SIHWA_DIR[k];

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

test('방향과 세기를 따로 낸다 — 약한 흔들림이 강한 방향으로 둔갑하지 않는다', () => {
  const r = run();
  for (const t of Object.values(r.timeline)) {
    for (const [d, shift] of Object.entries(t.featureShift)) {
      assert.ok('raw' in shift && 'direction' in shift && 'magnitude' in shift,
        `${d} 는 raw·direction·magnitude 를 따로 낸다`);
      assert.ok(shift.magnitude >= 0 && shift.magnitude <= 1);
      for (const kind of ['raw', 'direction']) {
        for (const [ax, v] of Object.entries(shift[kind])) {
          assert.ok(AXES[d].includes(ax), `${d}.${kind} 에 없는 축 ${ax}`);
          assert.ok(v >= -1 && v <= 1, `${d}.${kind}.${ax} = ${v}`);
        }
      }
      // raw 가 작으면 magnitude 도 작아야 한다
      const peak = Math.max(0, ...Object.values(shift.raw).map(Math.abs));
      if (peak < 0.05) assert.ok(shift.magnitude < 0.2, `${d} raw ${peak} 인데 magnitude ${shift.magnitude}`);
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

// ── 보강한 재료가 실제로 쓰이는가 ─────────────────────────────

test('같은 원천은 두 번 세지 않는다 — 묶음 안은 포화, 묶음끼리만 누적', () => {
  // 한 묶음에 같은 크기 셋을 넣어도 +30% 를 넘지 않는다
  const one = evidenceOr({ a: [0.4] });
  const three = evidenceOr({ a: [0.4, 0.4, 0.4] });
  assert.ok(three > one);
  assert.ok(three <= 0.4 * 1.3 + 1e-9, `한 묶음이 ${three} 까지 부풀었다`);
  // 서로 다른 묶음이면 겹쳐 오른다 (noisy-OR)
  const two = evidenceOr({ a: [0.4], b: [0.4] });
  assert.ok(two > three, '다른 원천이 겹치는 쪽이 더 높아야 한다');
  assert.ok(two < 0.8, '그래도 단순 덧셈보다는 낮다');
  assert.equal(evidenceOr({}), 0);
  assert.equal(evidenceOr({ a: [], b: [null] }), 0);
});

test('사주 — 근묘화실 기둥 충돌과 대운 전환이 evidence 에 남는다', () => {
  const r = run20();
  const kinds = new Set();
  for (const m of Object.values(r.systemResults.saju.months)) {
    for (const e of m?.evidence ?? []) kinds.add(e.what.replace(/\s.*$/, ''));
  }
  // 월운 십성은 늘 있고, 원국 기둥과의 관계도 실려야 한다
  assert.ok([...kinds].some((k) => k === '월운 십성' || k.startsWith('월운')), '월운 십성');
  assert.ok(['년주', '월주', '일주', '시주', '세운', '대운'].some((p) => kinds.has(p)),
    `원국·세운 기둥과의 관계가 하나도 안 실렸다: ${[...kinds].join(', ')}`);
  // 십성이 배정되지 않은 분야는 0 이 아니라 null 이다
  const any = Object.values(r.systemResults.saju.months).find(Boolean);
  assert.equal(any.rawActivations.personality, null);
});

test('자미 — 사화 넷이 방향에서 서로 다르게 쓰인다', () => {
  // 화록과 화기는 같은 별이라도 방향이 갈려야 한다
  const rec = ziweiSihwaDir('화록');
  const gi = ziweiSihwaDir('화기');
  assert.ok(rec > 0 && gi < 0, `화록 ${rec} · 화기 ${gi} — 부호가 갈려야 한다`);
  assert.ok(ziweiSihwaDir('화권') > ziweiSihwaDir('화과'), '화권이 화과보다 세다');
  // activation 에서는 넷 다 시끄럽다 — 화기도 0 이 아니다
  for (const k of ['화록', '화권', '화과', '화기']) assert.ok(ziweiSihwaAct(k) > 0.15, k);
});

test('자미 — 직업 넷 말고 다른 분야의 궁도 실제로 켜진다', () => {
  const r = run20();
  // 부처궁·자녀궁·전택궁·질액궁은 '직업' 궁 목록에 없다. 재료가 닿지 않으면
  // 이 분야들의 시계열이 통째로 같은 값이 된다
  for (const d of ['marriage', 'children', 'residence', 'health']) {
    const xs = Object.values(r.systemResults.jamidusu.months)
      .map((m) => m?.rawActivations?.[d]).filter(Number.isFinite);
    assert.ok(xs.length, `${d} 값이 없다`);
    assert.ok(new Set(xs).size > 1, `자미 ${d} 가 달마다 같은 값이다 — 궁 재료가 안 닿았다`);
  }
});

test('서양 — 느린 배경과 빠른 방아쇠를 합쳐도 값이 터지지 않는다', () => {
  const r = run20();
  const xs = [];
  for (const m of Object.values(r.systemResults.astrology.months)) {
    for (const [d, v] of Object.entries(m?.rawActivations ?? {})) {
      if (Number.isFinite(v)) { assert.ok(v >= 0 && v <= 1, `${d} activation ${v}`); xs.push(v); }
    }
  }
  assert.ok(xs.length);
  // 배경이 몇 해씩 이어지므로 늘 1.0 에 붙어 있으면 시기를 못 가른다
  const pinned = xs.filter((v) => v > 0.98).length / xs.length;
  assert.ok(pinned < 0.5, `${Math.round(pinned * 100)}% 가 1.0 에 붙었다 — 중복 누적이다`);
  assert.ok(new Set(xs.map((v) => Math.round(v * 100))).size > 5, '값이 달마다 갈려야 한다');
});

test('베딕 — 분야마다 그 분야의 분할도를 쓴다', () => {
  const r = run20();
  const ev = Object.values(r.systemResults.vedic.months).flatMap((m) => m?.evidence ?? []);
  const codes = new Set(ev.map((e) => e.what.match(/\b(D\d+)\b/)?.[1]).filter(Boolean));
  assert.ok(codes.size >= 2, `분할도가 ${[...codes].join(',') || '하나도'} 안 쓰였다`);
  // 다샤 주인을 문자열로 읽는다 — 예전에는 노드 객체를 비교해 늘 0 이었다
  const xs = Object.values(r.systemResults.vedic.months)
    .map((m) => m?.rawActivations?.career).filter(Number.isFinite);
  assert.ok(xs.length && new Set(xs).size > 1, '베딕 직업 activation 이 상수다');
  // 직업은 D10, 결혼은 D9 로 본다 (표에 박아 둔 배당)
  assert.equal(VEDIC_VARGA.career, 'D10');
  assert.equal(VEDIC_VARGA.marriage, 'D9');
  assert.equal(VEDIC_VARGA.children, 'D7');
  assert.equal(VEDIC_VARGA.residence, 'D4');
  assert.equal(VEDIC_VARGA.wealth, 'D2');
  // 학업은 D24 가 없으므로 D1 로 둔다 — 자녀의 D7 을 빌려 쓰지 않는다
  assert.equal(VEDIC_VARGA.education, 'D1');
});

test('보강 뒤에도 시각 미상이면 자미·점성만 빠지고 결정적이다', () => {
  const noTime = { ...BIRTH, hour: undefined, minute: undefined };
  const a = predictTimeline({ birth: noTime, from: '2020-01', to: '2021-12' });
  const k = Object.keys(a.systemResults.jamidusu.months)[0];
  assert.equal(a.systemResults.jamidusu.months[k].available, false);
  assert.equal(a.systemResults.astrology.months[k].available, false);
  assert.equal(a.systemResults.saju.months[k].available, true);
  assert.equal(a.systemResults.vedic.months[k].available, true, '베딕은 다샤로 계속 말한다');
  // 같은 입력이면 같은 값 (보강한 재료도 결정적이어야 한다)
  const b = predictTimeline({ birth: noTime, from: '2020-01', to: '2021-12' });
  assert.deepEqual(a.systemResults.vedic.months[k].rawActivations,
    b.systemResults.vedic.months[k].rawActivations);
  assert.deepEqual(a.timeline[Object.keys(a.timeline)[5]].domains,
    b.timeline[Object.keys(b.timeline)[5]].domains);
});
