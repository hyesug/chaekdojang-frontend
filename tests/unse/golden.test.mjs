import test from 'node:test';
import assert from 'node:assert/strict';

import { readFortune } from '../../public/unse/src/engine.js';

const NOW = new Date('2026-09-15T00:00:00Z');

const fact = (r, systemId, label) => {
  const sys = r.results.find((x) => x.id === systemId);
  assert.ok(sys, '체계가 없음: ' + systemId);
  const f = sys.facts.find((x) => x.label === label);
  assert.ok(f, systemId + '에 근거가 없음: ' + label);
  return f;
};

const pillarText = (r) => [
  r.chart.pillars.year.hanja,
  r.chart.pillars.month.hanja,
  r.chart.pillars.day.hanja,
  r.chart.pillars.hour.hanja,
].join(' ');

const CASES = [
  {
    form: {
      name: '골든 A',
      year: 1992, month: 1, day: 30, hour: 16, minute: 28,
      birthPlace: '여주', homePlace: '대전', gender: 'female',
    },
    pillars: '辛未 辛丑 乙巳 甲申',
    // 표기를 한글 우선으로 바꿨다(한자는 처음 한 번만 병기). 떨어지는
    // 지지는 그대로 巳 라 **계산은 변하지 않았다** — 라벨만 바뀐 것이다
    ziweiMing: '사궁(巳)',
    asc: '게자리 23.9°',
    mc: '양자리 9.2°',
    vedicLagna: '카르카 (게)',
    vedicLagnaDegree: '0.1°',
    nak: 'Jye',
    daeun: '현재 乙巳',
    dasha: '태양 다샤',
  },
  {
    form: {
      name: '골든 B',
      year: 1999, month: 4, day: 28, hour: 10, minute: 15,
      birthPlace: '대전', homePlace: '대전', gender: 'male',
    },
    pillars: '己卯 戊辰 庚戌 辛巳',
    ziweiMing: '해궁(亥)',
    asc: '게자리 17.8°',
    mc: '양자리 1.9°',
    vedicLagna: '미투나 (쌍둥이)',
    vedicLagnaDegree: '23.9°',
    nak: 'Hasta',
    daeun: '현재 丙寅',
    dasha: '라후 다샤',
  },
];

for (const [i, c] of CASES.entries()) {
  test('검증된 핵심 명반 골든 케이스 ' + (i + 1), () => {
    const r = readFortune(c.form, { now: NOW });
    assert.deepEqual(r.errors, []);
    assert.equal(pillarText(r), c.pillars);

    assert.equal(fact(r, 'jamidusu', '명궁').value, c.ziweiMing);
    assert.equal(fact(r, 'astrology', '상승점').value, c.asc);
    assert.equal(fact(r, 'astrology', '중천').value, c.mc);

    const lagna = fact(r, 'vedic', '라그나');
    assert.equal(lagna.value, c.vedicLagna);
    assert.match(lagna.note, new RegExp(c.vedicLagnaDegree.replace('.', '\\.')));

    assert.match(fact(r, 'vedic', '나크샤트라').value, new RegExp(c.nak));
    assert.match(fact(r, 'saju', '대운').note, new RegExp(c.daeun));
    assert.equal(fact(r, 'vedic', '현재 다샤').value, c.dasha);
  });
}

test('서로 다른 40개 명반에서 핵심 계산이 빠지거나 오류가 나지 않는다', () => {
  const cities = ['서울', '대전', '부산', '대구', '광주광역시', '수원', '제주', '전주'];

  for (let i = 0; i < 40; i++) {
    const form = {
      name: '회귀-' + i,
      year: 1980 + i,
      month: (i % 12) + 1,
      day: ((i * 7) % 27) + 1,
      hour: (i * 5) % 24,
      minute: (i * 11) % 60,
      birthPlace: cities[i % cities.length],
      homePlace: cities[(i + 3) % cities.length],
      gender: i % 2 ? 'male' : 'female',
    };

    const r = readFortune(form, { now: NOW });
    assert.deepEqual(r.errors, [], '회귀 케이스 ' + i + '에서 체계 오류 발생');
    assert.ok(r.chart.pillars.year && r.chart.pillars.month && r.chart.pillars.day && r.chart.pillars.hour);

    for (const id of ['saju', 'jamidusu', 'astrology', 'vedic']) {
      assert.ok(r.results.some((x) => x.id === id), '회귀 케이스 ' + i + '에서 ' + id + ' 누락');
    }
  }
});
