import test from 'node:test';
import assert from 'node:assert/strict';

import { isRegisteredEventKind, normalizeTimingEvent } from '../../public/unse/src/validation/eventTargets.js';

test('결혼식과 출산은 구체 사건 목표로 정규화한다', () => {
  const wedding = normalizeTimingEvent({ eventKind: 'wedding_ceremony', year: 2021, month: 5 }, 'marriage');
  const birth = normalizeTimingEvent({ eventKind: 'birth', year: 2023, month: 11 }, 'children');

  assert.deepEqual(wedding, {
    eventKind: 'wedding_ceremony', candidateKind: 'marriage', datePrecision: 'month',
    observedThrough: null, observationEnded: null, eligible: true, reason: null,
  });
  assert.equal(birth.eventKind, 'birth');
  assert.equal(birth.candidateKind, 'birth');
  assert.equal(birth.eligible, true);
  assert.equal(isRegisteredEventKind('marriage', 'wedding_ceremony'), true);
});

test('구체 사건 종류가 없는 기존 결혼·자녀 행은 검증 목표에서 제외한다', () => {
  const event = normalizeTimingEvent({ year: 2021, month: 5 }, 'marriage');

  assert.equal(event.eligible, false);
  assert.match(event.reason, /eventKind/);
});

test('등록되지 않은 사건과 관찰 종료 뒤의 사실을 추정하지 않는다', () => {
  const invalid = normalizeTimingEvent({ eventKind: 'birth', year: 2021 }, 'marriage');
  const censored = normalizeTimingEvent({
    eventKind: 'birth', year: 2021, observedThrough: '2024-06', observationEnded: 'lost_contact',
  }, 'children');

  assert.equal(invalid.eligible, false);
  assert.match(invalid.reason, /등록/);
  assert.equal(censored.datePrecision, 'year');
  assert.equal(censored.observedThrough, '2024-06');
  assert.equal(censored.observationEnded, 'lost_contact');
});
