/**
 * 17체계 해석 사전 — 빠진 칸 없이, 명반에서 고른 열쇠가 모두 사전에 있는가
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFortune } from '../../public/unse/src/engine.js';
import { loadDicts, dictKeys, dictEntries, dictField } from '../../public/unse/src/semantic/dict.js';
import { DICT_SHARE } from '../../public/unse/src/semantic/data/rarity.js';

const dict = await loadDicts();

test('모든 항목이 성격·일·돈·관계·조심 다섯 칸을 채운다', () => {
  for (const [group, entries] of Object.entries(dict)) {
    for (const [key, e] of Object.entries(entries)) {
      for (const f of ['p', 'w', 'm', 'r', 'c']) assert.ok(e[f]?.length > 5, `${group}|${key} 의 ${f} 칸이 비었다`);
    }
  }
});

test('무작위 2천 명에서 나온 열쇠가 모두 사전에 있다', () => {
  const miss = Object.keys(DICT_SHARE).filter((k) => {
    const i = k.indexOf('|');
    return !dict[k.slice(0, i)]?.[k.slice(i + 1)];
  });
  assert.deepEqual(miss, []);
});

test('사주는 일간×태어난 달 120개와 일주 60개를 다 갖춘다', () => {
  assert.equal(Object.keys(dict['saju-stem-month']).length, 120);
  assert.equal(Object.keys(dict['saju-ilju']).length, 60);
});

test('출생 시각을 알면 열 갈래 넘게, 사람마다 다른 조합을 받는다', () => {
  const a = readFortune({ gender: 'female', year: 1992, month: 1, day: 30, hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전' });
  const b = readFortune({ gender: 'male', year: 1988, month: 7, day: 2, hour: 5, minute: 30, birthPlace: '대전', homePlace: '대전' });
  assert.ok(dictKeys(a).length >= 15);
  const ka = dictKeys(a).map((x) => x.join('|')).sort().join(',');
  const kb = dictKeys(b).map((x) => x.join('|')).sort().join(',');
  assert.notEqual(ka, kb);
  const p = dictField(dictEntries(a), 'p', 4);
  assert.equal(new Set(p.map((x) => x.text)).size, p.length, '같은 문장이 두 번 나오면 안 된다');
});
