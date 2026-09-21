/**
 * 속성별 담당 체계 — 이 파일이 지키는 것은 **침묵의 규칙**이다.
 *
 * 담당표의 요점은 "무엇을 말하는가"가 아니라 "언제 입을 다무는가"다.
 * 빈칸을 다른 체계로 메우면 정확도가 내려간다는 것을 실제로 쟀고,
 * 그 결과로 두 속성(거주형태·혼인안정)은 아예 비웠다. 누군가 나중에
 * "답이 너무 없다"며 채우면 조용히 나빠지므로 여기서 못박는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFortune } from '../../public/unse-8f3k2m/src/engine.js';
import { routeQuestion } from '../../public/unse-8f3k2m/src/hires/router.js';
import { buildHiRes } from '../../public/unse-8f3k2m/src/hires/context.js';
import * as IN from '../../public/unse-8f3k2m/src/hires/interpret.js';
import * as ZW from '../../public/unse-8f3k2m/src/hires/ziwei.js';

const person = (over = {}) => readFortune({
  name: '테스트', gender: 'female', year: 1992, month: 1, day: 30,
  hour: 16, minute: 28, birthPlace: '여주', homePlace: '대전', ...over,
});

const readsOf = (r) => {
  const stack = r.input.timeKnown ? ZW.stackAt(r.input, 2026, null) : null;
  return [...IN.readAll(r.input, r.chart, stack), ...IN.auxReads(r.results ?? [])];
};

test('영점보다 나빴던 속성은 담당이 비어 있다', () => {
  const pol = IN.axisPolicy();
  for (const axis of ['거주형태', '혼인안정']) {
    assert.equal(pol[axis].owners.length, 0, `${axis} 는 담당을 두지 않는다`);
    assert.equal(pol[axis].grade, '비움');
  }
});

test('비운 속성은 어떤 체계가 말해도 답으로 나가지 않는다', () => {
  const r = person();
  const best = IN.bestRead(readsOf(r));
  // 자미 전택궁 읽기 자체는 살아 있다 — 비운 것은 '담당'이지 '계산'이 아니다
  const ziwei = readsOf(r).find((x) => x.system === '자미두수');
  assert.ok(ziwei.거주형태, '전택궁 읽기는 계속 계산된다');
  // 그런데 담당표를 거치면 나가지 않는다
  assert.equal(best.거주형태.said, null, '비운 속성은 답이 비어야 한다');
  assert.equal(best.혼인안정.said, null);
});

test('담당이 침묵하면 다른 체계로 메우지 않는다', () => {
  // 수입형태의 담당은 자미 하나다. 사주도 수입형태를 말하지만 쓰지 않는다
  const pol = IN.axisPolicy();
  assert.deepEqual(pol.수입형태.owners, ['자미두수']);

  const fake = [
    { system: '자미두수', 수입형태: null },
    { system: '사주', 수입형태: { value: '자기 판 쪽', basis: '비겁' } },
  ];
  assert.equal(IN.bestRead(fake).수입형태.said, null,
    '담당이 침묵하면 사주가 말해도 비어야 한다');
});

test('직업은 넷을 나란히 낸다 — 하나로 좁히지 않는다', () => {
  const best = IN.bestRead(readsOf(person()));
  assert.equal(best.직업.grade, '나란히');
  assert.ok(best.직업.said.length >= 2, '한 체계로 줄이지 않는다');
  const systems = best.직업.said.map((x) => x.system);
  assert.equal(new Set(systems).size, systems.length, '체계가 겹치지 않는다');
});

test('근거 없는 값은 내지 않는다', () => {
  for (const box of Object.values(IN.bestRead(readsOf(person())))) {
    for (const said of box.said ?? []) {
      assert.ok(said.value && said.basis, `${said.system} 은 값과 근거를 함께 낸다`);
    }
  }
});

test('시각을 모르면 시각이 필요한 담당은 침묵한다', () => {
  const r = person({ hour: undefined, minute: undefined });
  const best = IN.bestRead(readsOf(r));
  assert.equal(best.수입형태.said, null, '자미는 시각 없이 판을 세우지 않는다');
  assert.equal(best.결혼경험.said, null, '하우스는 시각 없이 세우지 않는다');
  // 시각이 없어도 사주는 말할 수 있다
  assert.ok(best.자녀자리.said, '사주 천간은 시각 없이도 읽는다');
});

test('문맥 글에 담당 구획과 성향/시기의 선이 실린다', () => {
  const r = person();
  const plan = { ...routeQuestion('내 직업이랑 성향이 어때?', 2026), fromYear: 2026, years: 1 };
  const { text } = buildHiRes(r, null, plan);

  assert.match(text, /속성마다 담당 체계/);
  assert.match(text, /거주형태:\s*\*\*말하지 말 것\*\*/);
  assert.match(text, /혼인안정:\s*\*\*말하지 말 것\*\*/);
  // 성향은 미래로 늘여도 되지만 날짜는 안 된다 — 이 선이 글에서 사라지면 안 된다
  assert.match(text, /언제 무슨 일이 일어난다고는 말하지 말 것/);
  assert.match(text, /p=0\.886/);
});

test('담당이 아닌 체계는 참고 목록에만 들어간다', () => {
  const r = person();
  const plan = { ...routeQuestion('내 직업이랑 성향이 어때?', 2026), fromYear: 2026, years: 1 };
  const { json } = buildHiRes(r, null, plan);
  const owners = IN.axisPolicy().직업.owners;
  for (const x of json.interpreted?.reads ?? []) {
    assert.ok(!owners.includes(x.system), `${x.system} 은 담당이므로 참고 목록에 없어야 한다`);
  }
});
