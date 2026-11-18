import test from 'node:test';
import assert from 'node:assert/strict';

import { readFortune } from '../../public/unse/src/engine.js';
import { readForecast } from '../../public/unse/src/forecast.js';
import { renderSajuReport, nextMonths } from '../../public/unse/src/sajuReport.js';
import { loadDicts } from '../../public/unse/src/semantic/dict.js';

await loadDicts();

const A = { name: '풀이 개인', year: 1990, month: 6, day: 15, hour: 12, minute: 0, birthPlace: '서울', homePlace: '서울', gender: 'male' };
const B = { name: '풀이 상대', year: 1992, month: 8, day: 20, hour: null, minute: null, birthPlace: '부산', homePlace: '부산', gender: 'female' };
const FORMS = [A, { ...A, gender: 'female' }, B, { ...A, year: 1975, month: 2, day: 3 }];
const render = (form) => { const r = readFortune(form); const f = readForecast(form); return { r, f, html: renderSajuReport(r, f) }; };
/** 근거 칸을 뺀 본문 글 */
const bodyText = (html) => html.replace(/<div class="sz-basis">[\s\S]*?<\/span><\/div>/g, ' ').replace(/<[^>]+>/g, ' ');
const JARGON = /[一-鿿]|(?:명|부처|자녀|재백|관록|천이|복덕)궁|하우스|대운|사화|다샤|일간|관성|재성|식상|라그나|삼형|육합|\*\*|p=|°/;

test('명반 풀이는 번호 붙은 질문 → 한 줄 답 → 근거 형식이고, 번호가 1부터 이어진다', () => {
  for (const form of FORMS) {
    const { html } = render(form);
    const nums = [...html.matchAll(/<span class="sz-n">(\d+)<\/span>/g)].map((m) => Number(m[1]));
    assert.ok(nums.length >= 6, `카드가 너무 적다: ${nums.length}`);
    assert.deepEqual(nums, nums.map((_, i) => i + 1));
    assert.equal((html.match(/class="sz-a"/g) ?? []).length, nums.length);
    assert.match(html, /class="sz-basis"/);
    assert.doesNotMatch(html, /undefined|NaN|null/);
  }
});

test('본문에는 한자·전문용어가 없고, 계산 용어는 근거 칸에만 둔다', () => {
  for (const form of FORMS) {
    const text = bodyText(render(form).html);
    const hit = text.match(JARGON);
    assert.equal(hit, null, `남은 용어: ${hit?.[0]} — ${hit ? text.slice(Math.max(0, hit.index - 30), hit.index + 30) : ''}`);
  }
});

test('결혼·출산 연도나 가능성 단정은 싣지 않는다', () => {
  for (const form of FORMS) {
    const text = bodyText(render(form).html);
    assert.doesNotMatch(text, /가능성이 매우 높|\d+%|결혼하게 됩니다|낳게 됩니다/);
  }
});

test('열두 달은 이번 달부터 이어지고, 움직일 달과 숨 고를 달이 겹치지 않는다', () => {
  const { r, f, html } = render(A);
  const ms = nextMonths(r, f.today);
  assert.equal(ms.length, 12);
  const k = (x) => x.y * 12 + x.m;
  for (let i = 1; i < ms.length; i++) assert.ok(k(ms[i]) > k(ms[i - 1]));
  const sec = html.slice(html.indexOf('>움직일 달</h4>'), html.indexOf('달의 기운은'));
  const good = sec.slice(0, sec.indexOf('숨 고를 달')).match(/\d{4}년 \d+월/g) ?? [];
  const bad = sec.slice(sec.indexOf('숨 고를 달')).match(/\d{4}년 \d+월/g) ?? [];
  assert.equal(good.length, 3);
  assert.deepEqual(good.filter((x) => bad.includes(x)), []);
});

test('같은 형식도 출생 정보가 바뀌면 내용이 달라진다', () => {
  assert.notEqual(render(A).html, render({ ...A, month: 1, day: 3, hour: 4 }).html);
});
