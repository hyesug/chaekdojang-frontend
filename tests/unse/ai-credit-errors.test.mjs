import assert from 'node:assert/strict';
import test from 'node:test';
import { isCreditExhausted } from '../../public/unse/src/ai.js';

test('서버가 확정한 질문권 부족만 구매 흐름으로 분류한다', () => {
  assert.equal(isCreditExhausted({ status: 402 }), true);
  assert.equal(isCreditExhausted({ status: 401 }), false);
  assert.equal(isCreditExhausted({ status: 429 }), false);
  assert.equal(isCreditExhausted({ status: 503 }), false);
  assert.equal(isCreditExhausted(new Error('AI 질문권이 없습니다.')), false);
});
