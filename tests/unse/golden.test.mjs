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
      year: 1993, month: 3, day: 17, hour: 15, minute: 42,
      birthPlace: '여주', homePlace: '대전', gender: 'female',
    },
    // 가상 인물이다(실제 사례 출생 정보는 저장소에 두지 않는다). 사주 기둥은 손으로 검산했다:
    // 경칩~청명 사이라 卯월, 일진 (JDN+49)%60=33 丁酉, 진태양시 15:04 申시
    pillars: '癸酉 乙卯 丁酉 戊申',
    ziweiMing: '미궁(未)',
    asc: '사자자리 21.8°',
    mc: '황소자리 15.5°',
    vedicLagna: '카르카 (게)',
    vedicLagnaDegree: '28.0°',
    nak: 'Uttara Ashadha',
    daeun: '현재 戊午',
    dasha: '라후 다샤',
  },
  {
    form: {
      name: '골든 B',
      year: 1998, month: 8, day: 21, hour: 9, minute: 35,
      birthPlace: '대전', homePlace: '대전', gender: 'male',
    },
    // 가상 인물. 입추~백로 사이라 庚申월, 일진 36 庚子, 진태양시 09:01 巳시
    pillars: '戊寅 庚申 庚子 辛巳',
    ziweiMing: '인궁(寅)',
    asc: '천칭자리 12.6°',
    mc: '게자리 14.1°',
    vedicLagna: '칸야 (처녀)',
    vedicLagnaDegree: '18.8°',
    nak: 'Ashlesha',
    daeun: '현재 癸亥',
    dasha: '금성 다샤',
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
