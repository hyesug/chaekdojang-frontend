import test from 'node:test';
import assert from 'node:assert/strict';

import { groupTimingEvents } from '../../public/unse/src/validation/timingCaseWindows.js';

const DOMAIN_OF = { 직업: 'career', 관계: 'relationship' };
const birth = { gender: 'female', year: 1993, month: 3, day: 17, hour: 15, minute: 42, birthPlace: '여주' };
const career = [
  { domain: '직업', year: 2021, month: 10 },
  { domain: '직업', year: 2024, month: 11 },
];

test('다른 분야의 오래된 사건은 직업 검증 창을 넓히지 않는다', () => {
  const base = groupTimingEvents([{ id: 'P01', birth, events: career }], DOMAIN_OF, { paddingYears: 3 });
  const withOldRelationship = groupTimingEvents([{
    id: 'P01', birth,
    events: [...career, { domain: '관계', year: 2010, month: 4 }],
  }], DOMAIN_OF, { paddingYears: 3 });

  const careerBase = base.find((x) => x.domain === 'career');
  const careerWithOldRelationship = withOldRelationship.find((x) => x.domain === 'career');
  assert.deepEqual(
    { from: careerWithOldRelationship.from, to: careerWithOldRelationship.to },
    { from: careerBase.from, to: careerBase.to },
  );
  assert.equal(careerBase.from, '2018-01');
  assert.equal(careerBase.to, '2027-12');
});
