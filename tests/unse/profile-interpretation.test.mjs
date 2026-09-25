import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretProfile } from '../../public/unse/src/interpretation/profile.js';

test('서로 다른 체계의 근거가 있어야 직업 후보를 낸다', () => {
  const r = interpretProfile([{ id: 'saju', name: '사주', signals: { domains: { 직업: 80 }, tags: ['독립', '학습'] } }, { id: 'jamidusu', name: '자미', signals: { domains: { 직업: 75 }, tags: ['독립', '실행'] } }]);
  assert.equal(r.areas.직업.candidates[0].key, 'independent-professional');
  assert.equal(r.areas.직업.candidates[0].systems.length, 2);
});

test('점수 근거가 없는 체계는 영역 합의에 넣지 않는다', () => {
  const r = interpretProfile([{ id: 'a', name: 'A', signals: { domains: { 건강: null }, tags: ['돌봄'] } }]);
  assert.equal(r.domainEvidence.건강.supporting.length, 0);
});

test('상반된 직업 후보는 단정 대신 갈림으로 표시한다', () => {
  const rs = [
    { id: 'saju', name: '사주', signals: { domains: { 직업: 80 }, tags: ['독립', '학습'] } },
    { id: 'jamidusu', name: '자미', signals: { domains: { 직업: 75 }, tags: ['독립', '학습'] } },
    { id: 'astrology', name: '점성술', signals: { domains: { 직업: 82 }, tags: ['책임', '학습'] } },
    { id: 'vedic', name: '베딕', signals: { domains: { 직업: 76 }, tags: ['책임', '학습'] } },
  ];
  assert.equal(interpretProfile(rs).areas.직업.conflicted, true);
});

test('직업 전용 장치가 없는 체계는 직업 후보 근거에서 제외한다', () => {
  const rs = [
    { id: 'tarot', name: '타로', signals: { domains: { 직업: 90 }, tags: ['독립', '학습'] } },
    { id: 'saju', name: '사주', signals: { domains: { 직업: 80 }, tags: ['독립', '학습'] } },
    { id: 'jamidusu', name: '자미', signals: { domains: { 직업: 80 }, tags: ['독립', '학습'] } },
  ];
  assert.deepEqual(interpretProfile(rs).areas.직업.candidates[0].systems.map((x) => x.id), ['saju', 'jamidusu']);
});

test('전용 체계의 원국 사실은 후보가 없어도 해석 근거로 보존한다', () => {
  const r = interpretProfile([{ id: 'jamidusu', name: '자미', facts: [{ label: '관록궁', value: '酉 — 천동' }], signals: { domains: { 직업: 50 }, tags: [] } }]);
  assert.equal(r.domainEvidence.직업.anchors[0].fact.label, '관록궁');
});
