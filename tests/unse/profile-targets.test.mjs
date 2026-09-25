import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveProfileTargets } from '../../public/unse/src/interpretation/targets.js';

test('관계·자녀·직업의 구체 후보는 근거와 반증 조건을 함께 낸다', () => {
  const r = deriveProfileTargets([
    { id: 'saju', name: '사주', facts: [{ label: '십신', value: '식상 3 · 관성 2' }], signals: { domains: { 관계: 70, 직업: 70 }, tags: ['책임', '학습'] } },
    { id: 'jamidusu', name: '자미', facts: [{ label: '부처궁', value: '卯 — 태음' }, { label: '자녀궁', value: '子 — 천동' }, { label: '관록궁', value: '酉 — 천기' }], signals: { domains: { 관계: 70, 직업: 70 }, tags: ['책임', '학습'] } },
  ]);
  assert.equal(r.relationship[0].key, 'formal-partnership');
  assert.equal(r.children[0].key, 'caregiving-axis');
  assert.ok(r.career[0].falsifiers.length);
});
