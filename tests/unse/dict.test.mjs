/**
 * 17체계 해석 사전 — 빠진 칸 없이, 명반에서 고른 열쇠가 모두 사전에 있는가
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFortune } from '../../public/unse/src/engine.js';
import { loadDicts, dictKeys, dictEntries, dictField } from '../../public/unse/src/semantic/dict.js';
import { DICT_SHARE } from '../../public/unse/src/semantic/data/rarity.js';

const dict = await loadDicts();

test('모든 항목이 칸을 채운다 — 성향 사전은 다섯 칸, 10년 운 사전은 세 칸', () => {
  for (const [group, entries] of Object.entries(dict)) {
    const fields = group === 'flow' ? ['h', '총운', '애정운', '금전운', '직장운', '건강운'] : group === 'event' ? ['t', 'w', 'p'] : group.startsWith('daeun') || group.startsWith('pair-') || (group.startsWith('ziwei-') && group !== 'ziwei-ming') ? ['h', 'g', 'c'] : ['p', 'w', 'm', 'r', 'c'];
    for (const [key, e] of Object.entries(entries)) {
      for (const f of fields) assert.ok(e[f]?.length > 5, `${group}|${key} 의 ${f} 칸이 비었다`);
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

test('사주는 일간×태어난 달 120·일주 60, 10년 운은 일간×천간 100·일간×지지 120을 다 갖춘다', () => {
  assert.equal(Object.keys(dict['saju-stem-month']).length, 120);
  assert.equal(Object.keys(dict['saju-ilju']).length, 60);
  assert.equal(Object.keys(dict['daeun-stem']).length, 100);
  assert.equal(Object.keys(dict['daeun-branch']).length, 120);
  for (const p of ['ming', 'career', 'money', 'spouse', 'children']) assert.equal(Object.keys(dict[`ziwei-${p}`]).length, 39, `자미 ${p}`);
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

test('AI 상담 문맥에도 리포트와 같은 사전 문장이 실린다', async () => {
  const { buildContext } = await import('../../public/unse/src/aiContext.js');
  const form = { gender: 'female', year: 1992, month: 1, day: 30, hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전' };
  const r = readFortune(form);
  const ctx = buildContext(form, r);
  assert.match(ctx, /## 이 사람의 해석/);
  const first = dictField(dictEntries(r), 'p', 1)[0].text;
  assert.ok(ctx.includes(first), '리포트 성격 첫 문장이 AI 문맥에 없다');
});

test('AI 문맥은 리포트와 같은 "앞으로 마주할 중요한 일" 목록을 싣고, 결혼 시기를 점치지 않는다', async () => {
  const { buildContext, buildCompatContext } = await import('../../public/unse/src/aiContext.js');
  const { lifeEventItems, pairEventItems } = await import('../../public/unse/src/report.js');
  const { compareFortune } = await import('../../public/unse/src/compat.js');
  const a = { name: '가', gender: 'female', year: 1993, month: 5, day: 17, hour: 14, minute: 20, birthPlace: '서울', homePlace: '서울' };
  const b = { name: '나', gender: 'male', year: 1990, month: 11, day: 3, hour: 7, minute: 0, birthPlace: '서울', homePlace: '서울' };
  const ra = readFortune(a), rb = readFortune(b);
  const ctx = buildContext(a, ra);
  for (const it of lifeEventItems(ra)) assert.ok(ctx.includes(it.title), `개인 AI 문맥에 사건이 없다: ${it.title}`);
  const pctx = buildCompatContext(a, b, compareFortune(a, b));
  for (const it of pairEventItems(ra, rb, '가', '나')) assert.ok(pctx.includes(it.title), `궁합 AI 문맥에 사건이 없다: ${it.title}`);
  assert.match(pctx, /연애 궁합인가, 결혼 궁합인가/);
  assert.doesNotMatch(pctx, /결혼 시기를 물을 때 반드시/);
});

test('오늘·이달의 운세는 점수 구간의 정해진 한 줄이 아니라 그날 기운이 이 사람에게 무엇인지로 쓴다', async () => {
  const { periodFlow } = await import('../../public/unse/src/report.js');
  const { readForecast } = await import('../../public/unse/src/forecast.js');
  const form = { gender: 'female', year: 1992, month: 1, day: 30, hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전' };
  const r = readFortune(form), f = readForecast(form);
  for (const kind of ['day', 'month']) {
    const fl = periodFlow(r, f[kind], kind);
    assert.ok(fl.theme.length > 10, `${kind} 결 문장이 없다`);
    assert.equal(fl.areas.length, 5);
    for (const [, t] of fl.areas) assert.doesNotMatch(t, /특별히 좋지도 나쁘지도|평소대로 흘러가는/);
  }
});

test('평생 성향 사전(자미 명궁·관록궁)은 "이직·업종 변경이 잦다"고 단정하지 않는다', async () => {
  // 사례 검증: 파군이 명궁·관록궁에 있는 4명 모두 이직 기록이 없었다(미용실 운영·헬스트레이너·대리점 운영 등)
  const { readFile } = await import('node:fs/promises');
  for (const f of ['ziwei-ming.json', 'ziwei-career.json']) {
    const d = JSON.parse(await readFile(new URL(`../../public/unse/dict/${f}`, import.meta.url), 'utf8'));
    for (const [k, e] of Object.entries(d)) {
      for (const t of Object.values(e)) {
        assert.doesNotMatch(String(t), /이직이나 업종 변경|업종 변경을 .*자주|직업.{0,8}여러 번 바꾸|판을 자주 바꿉/, `${f} ${k}`);
      }
    }
  }
});

test('인성(받는 기운) 문장은 "배우는 것을 좋아한다"는 취향으로 단정하지 않는다', async () => {
  // 피드백: 이 문장을 받은 사람이 "배우는 걸 싫어한다". 인성의 본뜻은 받음·도움·문서·자격이지 공부 취향이 아니다
  const { readFile, readdir } = await import('node:fs/promises');
  const dir = new URL('../../public/unse/dict/', import.meta.url);
  for (const f of (await readdir(dir)).filter((x) => /^saju-/.test(x))) {
    const t = await readFile(new URL(f, dir), 'utf8');
    assert.doesNotMatch(t, /배우는 것을 좋아|배우기를 좋아|공부를 좋아/, f);
  }
});

test('피드백 문장에서 사전 출처를 거꾸로 찾는다(관리자 운세 피드백)', async () => {
  const { buildSentenceIndex, traceSources, keyLabel } = await import('../../public/unse/src/semantic/sourceTrace.js');
  const { DICT_FILES } = await import('../../public/unse/src/semantic/dictFiles.js');
  const { readFile } = await import('node:fs/promises');
  const dicts = {};
  for (const f of DICT_FILES) dicts[f] = JSON.parse(await readFile(new URL(`../../public/unse/dict/${f}.json`, import.meta.url), 'utf8'));
  const index = buildSentenceIndex(dicts);
  const line = dicts['saju-stem-month-3']['신-진'].p;
  // 화면처럼 칸 제목과 다른 문장이 앞뒤에 붙어 있어도 찾는다
  const found = traceSources(`가장 강하게 나타나는 성향 ${line} 다른 사람에게서 잘 보이지 않는 특징 …`, index);
  assert.ok(found.some((x) => x.file === 'saju-stem-month-3' && x.key === '신-진' && x.field === 'p'), JSON.stringify(found.slice(0, 3)));
  assert.match(found.find((x) => x.key === '신-진').label, /사주 일간×월 · 辛\(신\) 일간 × 辰\(진\)월 · 성격/);
  assert.equal(keyLabel('saju-ilju-1', '경진'), '庚辰(경진) 일주');
  assert.deepEqual(traceSources('', index), []);
});

test('주간 자동 수정: 같은 출처에 👎 3개·60% 이상일 때만 고칠 후보로 올린다', async () => {
  const { summarize, MIN_DOWN, MIN_DOWN_RATE } = await import('../../scripts/fortune-feedback-report.mjs');
  const { buildSentenceIndex } = await import('../../public/unse/src/semantic/sourceTrace.js');
  const index = buildSentenceIndex({ 'ziwei-ming': { 파군: { p: '정해진 방식이 마음에 안 들면 그냥 넘어가지 못합니다.' } } });
  const line = '정해진 방식이 마음에 안 들면 그냥 넘어가지 못합니다.';
  const fb = (verdict, n) => Array.from({ length: n }, () => ({ verdict, snippet: `핵심 요약 ${line}`, comment: verdict === 'down' ? '아니에요' : null }));
  assert.equal(MIN_DOWN, 3); assert.equal(MIN_DOWN_RATE, 0.6);
  assert.equal(summarize(fb('down', 2), index).candidates.length, 0);                 // 👎 2개 — 아직
  assert.equal(summarize([...fb('down', 3), ...fb('up', 3)], index).candidates.length, 0); // 50% — 아직
  const ok = summarize([...fb('down', 3), ...fb('up', 1)], index);
  assert.equal(ok.candidates.length, 1);
  assert.equal(ok.candidates[0].key, '파군');
});

test('주간 자동 수정: 고친(사전에서 사라진) 문장의 피드백만 처리 완료 대상으로 고른다', async () => {
  const { fixedIds } = await import('../../scripts/fortune-feedback-report.mjs');
  const { buildSentenceIndex } = await import('../../public/unse/src/semantic/sourceTrace.js');
  const before = { candidates: [
    { text: '예전에 단정하던 문장이 여기 들어 있습니다', ids: [1, 2] },
    { text: '아직 사전에 남아 있는 문장이 여기 있습니다', ids: [3] },
  ] };
  const index = buildSentenceIndex({ x: { k: { p: '아직 사전에 남아 있는 문장이 여기 있습니다.' } } });
  assert.deepEqual(fixedIds(before, index).sort(), [1, 2]);
  assert.deepEqual(fixedIds({}, index), []);
});

test('자미두수: 명궁이 子·丑궁이어도 오호둔 궁간이 맞다 (子궁 천간은 인궁에서 10칸 뒤)', async () => {
  const { palaceStems } = await import('../../public/unse/src/hires/ziwei.js');
  // 辛년(7): 丙辛→庚寅. 寅庚 卯辛 … 亥己 子庚 丑辛
  const st = palaceStems(7);
  assert.equal(st[2], 6);   // 寅 庚
  assert.equal(st[0], 6);   // 子 庚 (예전: 戊)
  assert.equal(st[1], 7);   // 丑 辛 (예전: 己)
  // 실제 사례(다른 만세력과 대조): 1991-08-23 15:49 여 — 명궁 庚子, 토5국, 자미 卯, 명궁 주성 태양
  const { readFortune } = await import('../../public/unse/src/engine.js');
  const r = readFortune({ name: 'x', year: 1991, month: 8, day: 23, hour: 15, minute: 49, birthPlace: '서울', homePlace: '서울', gender: 'female' });
  const f = (k) => r.results.find((x) => x.id === 'jamidusu').facts.find((x) => x.label === k);
  assert.match(f('오행국').note, /庚子/);
  assert.match(f('자미성').value, /卯/);
  assert.match(`${f('명궁').value} ${f('명궁').note ?? ''}`, /태양/);
});

/* ── 전수조사에서 고친 계산 (2026-10) ─────────────────────────── */

test('천덕귀인: 正丁 二申 三壬 四辛 五亥 六甲 七癸 八寅 九丙 十乙 子巳 丑庚', async () => {
  const { sinsalOf } = await import('../../public/unse/src/core/sinsal.js');
  const me = (monthBranch) => ({ dayStem: 0, dayBranch: 0, monthBranch, yearBranch: 0 });
  const has = (mb, day) => sinsalOf(me(mb), day).includes('천덕');
  // 천간으로 보는 달: 寅丁 辰壬 巳辛 未甲 申癸 戌丙 亥乙 丑庚
  for (const [mb, stem] of [[2, 3], [4, 8], [5, 7], [7, 0], [8, 9], [10, 2], [11, 1], [1, 6]]) {
    assert.ok(has(mb, { stem, branch: 99 }), `월지 ${mb} 천덕 천간 ${stem}`);
  }
  // 지지로 보는 달: 卯申 午亥 酉寅 子巳
  for (const [mb, branch] of [[3, 8], [6, 11], [9, 2], [0, 5]]) {
    assert.ok(has(mb, { stem: 99, branch }), `월지 ${mb} 천덕 지지 ${branch}`);
  }
  // 예전 틀린 값은 아니다: 寅월 辛, 巳월 乙, 申월 丁, 亥월 己
  for (const [mb, stem] of [[2, 7], [5, 1], [8, 3], [11, 5]]) assert.ok(!has(mb, { stem, branch: 99 }));
});

test('육임 삼전: 하적상(賊)이 있으면 상극하(剋)보다 먼저 초전으로 쓴다', async () => {
  const { readFortune } = await import('../../public/unse/src/engine.js');
  // 1991-08-23 15:49 — 1과 寅/辰(상극하), 3과 亥/丑(하적상) → 초전 亥 · 중전 酉 · 말전 未
  const r = readFortune({ name: 'x', year: 1991, month: 8, day: 23, hour: 15, minute: 49, birthPlace: '서울', homePlace: '서울', gender: 'female' });
  const f = (k) => r.results.find((x) => x.id === 'yukim').facts.find((x) => x.label === k)?.value ?? '';
  assert.match(f('과체'), /賊/);
  assert.match(f('초전'), /^亥/);
  assert.match(f('중전'), /^酉/);
  assert.match(f('말전'), /^未/);
});

test('토정비결: 세는나이는 음력 해, 중괘 월대소·하괘 일진은 올해 달력으로', async () => {
  const { readFortune } = await import('../../public/unse/src/engine.js');
  const r = readFortune({ name: 'x', year: 1991, month: 8, day: 23, hour: 15, minute: 49, birthPlace: '서울', homePlace: '서울', gender: 'female' },
    { now: new Date('2026-10-10T03:00:00Z') });
  const note = (k) => r.results.find((x) => x.id === 'tojeong').facts.find((x) => x.label === k)?.note ?? '';
  assert.match(note('상괘'), /세는나이 36 \+ 태세수 16/);
  assert.match(note('중괘'), /월건 丙申 수 14 \+ 올해 월대소/);
  assert.match(note('하괘'), /올해 생일 일진수/);
  // 1월생(설날 전)은 음력 해로 센다 — 1992-01-20 은 음력 1991년 12월
  const jan = readFortune({ name: 'x', year: 1992, month: 1, day: 20, hour: 9, minute: 0, birthPlace: '서울', homePlace: '서울', gender: 'male' },
    { now: new Date('2026-10-10T03:00:00Z') });
  const n2 = jan.results.find((x) => x.id === 'tojeong').facts.find((x) => x.label === '상괘')?.note ?? '';
  assert.match(n2, /세는나이 36 /);
});

test('매화역수(주역): 연수는 사주 연지(입춘)가 아니라 음력 해(설날)의 지지로 센다', async () => {
  const { hexOf } = await import('../../public/unse/src/systems/juyeok.js');
  // 1985-02-15 생: 입춘(2/4) 뒤라 사주 연지는 丑, 설날(2/20) 전이라 음력 해는 1984 甲子
  const x = { ziweiYear: 1984, yearBranch: 1, lunar: { year: 1984, month: 12, day: 26 }, timeKnown: false, hourBranch: 0 };
  const byLunar = hexOf(x), byIpchun = hexOf({ ...x, ziweiYear: undefined, lunar: { month: 12, day: 26 } });
  // 子=1 로 세면 1+12+26=39 → 상괘 7, 丑=2 로 세면 40 → 상괘 8
  assert.equal(byLunar.upper, 6);
  assert.equal(byIpchun.upper, 7);
});
