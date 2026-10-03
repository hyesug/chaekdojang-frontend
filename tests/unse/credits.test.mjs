import assert from 'node:assert/strict';
import test from 'node:test';
import { loadCreditStatus } from '../../public/unse/src/credits.js';

const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

test('질문권 API는 로그인·소진·잔액·일시 오류를 구분한다', async () => {
  assert.deepEqual(await loadCreditStatus(async () => response(401)), { kind: 'logged-out' });
  assert.deepEqual(await loadCreditStatus(async () => response(200, { data: { balance: { totalBalance: 0 } } })), { kind: 'exhausted', totalBalance: 0 });
  assert.deepEqual(await loadCreditStatus(async () => response(200, { data: { balance: { totalBalance: 4 } } })), { kind: 'available', totalBalance: 4 });
  assert.deepEqual(await loadCreditStatus(async () => { throw new Error('offline'); }), { kind: 'unavailable' });
});
