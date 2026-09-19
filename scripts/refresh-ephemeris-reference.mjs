/**
 * refresh-ephemeris-reference.mjs — 천체 위치 기준값을 다시 뜬다
 *
 * 쓰는 법 (평소에는 쓸 일이 없다):
 *
 *   npm i -D celestine
 *   node scripts/refresh-ephemeris-reference.mjs
 *   npm un celestine
 *
 * 왜 라이브러리를 저장소에 남기지 않는가.
 *   celestine 은 우리 계산을 **대조하기 위한 두 번째 의견**이다. 값을 한 번
 *   재고 나면 라이브러리 자체는 더 할 일이 없는데, 남겨 두면 판올림·취약점
 *   경고·유지보수가 따라온다. 그래서 값만 떠서 fixtures 에 넣고 라이브러리는
 *   지운다. 기준값 파일은 깨지지도 사라지지도 않는다.
 *
 *   런타임에 쓰지 않는 이유는 따로 있다. 이미 운영 중인 명반 계산을 바꾸면
 *   같은 생년월일에 다른 결과가 나온다. 두 구현이 벌어지는 자리에서 어느
 *   쪽이 맞는지 가릴 기준이 우리에게 없으므로, 바꿀 근거도 없다.
 *
 * 언제 다시 뜨는가.
 *   · core/planets.js 나 core/astro.js 의 계산을 의도적으로 고쳤을 때
 *   · 표본을 늘리고 싶을 때
 *   기준값을 새로 뜬 뒤에는 tests/unse/ephemeris-accuracy.test.mjs 가
 *   여전히 통과하는지 반드시 확인할 것. 통과하지 않으면 둘 중 하나가
 *   달라진 것이고, 어느 쪽인지 밝히기 전에는 커밋하지 않는다.
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toJD } from '../public/unse-8f3k2m/src/core/astro.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'unse', 'fixtures', 'ephemeris-reference.json');

let C;
try {
  C = await import('celestine');
} catch {
  console.error(
    '기준값을 뜨려면 celestine 이 필요합니다.\n' +
    '  npm i -D celestine\n' +
    '  node scripts/refresh-ephemeris-reference.mjs\n' +
    '  npm un celestine'
  );
  process.exit(1);
}

const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
                'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

/** 명반이 실제로 몰리는 구간을 촘촘히, 나머지는 넓게 */
const YEARS = [1900, 1920, 1940, 1950, 1960, 1970, 1975, 1980, 1985, 1990, 1992,
               1995, 1999, 2000, 2005, 2010, 2015, 2020, 2025, 2026, 2030, 2035,
               2040, 2045, 2050];

const dates = [];
for (const y of YEARS) dates.push([y, 1, 15, 3, 0], [y, 7, 7, 15, 30]);
// 테스트가 쓰는 실제 명반 셋도 넣어 둔다
dates.push([1992, 1, 30, 7, 28], [1999, 4, 28, 1, 15], [1985, 11, 2, 18, 40]);

const p2 = (n) => String(n).padStart(2, '0');
const samples = dates.map(([y, m, d, h, mi]) => {
  const jd = toJD(y, m, d, h, mi);
  const pos = C.ephemeris.getAllPositionsObject(jd);
  const lon = {};
  for (const b of BODIES) lon[b] = Math.round(pos[b].longitude * 1e4) / 1e4;
  return { utc: `${y}-${p2(m)}-${p2(d)}T${p2(h)}:${p2(mi)}Z`, jd: Math.round(jd * 1e6) / 1e6, lon };
});

const pkg = JSON.parse(
  (await import('node:fs')).readFileSync(join(ROOT, 'node_modules', 'celestine', 'package.json'), 'utf8')
);

const out = {
  note: '독립 구현이 계산한 지심 황경(도, 회귀좌표). 우리 엔진을 대조하기 위한 기준값이다.',
  source: `celestine@${pkg.version} (${pkg.license}, https://github.com/Anonyfox/celestine) — ephemeris.getAllPositionsObject(jd)`,
  generated: new Date().toISOString().slice(0, 10),
  caveat: '이 값도 근사식이다. 우리 엔진과 벌어진다고 해서 어느 쪽이 틀렸다는 뜻이 아니라, 그만큼 믿지 말라는 뜻이다.',
  bodies: BODIES,
  samples,
};

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`${samples.length} 표본 → tests/unse/fixtures/ephemeris-reference.json (celestine@${pkg.version})`);
console.log('이제 npm run test:unse 로 상한을 다시 확인하고, npm un celestine 으로 지우세요.');
