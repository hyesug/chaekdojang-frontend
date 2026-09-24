/**
 * bundle-unse.mjs — 운세 사이트의 ES 모듈을 한 파일로 묶는다
 *
 *   npm run unse:bundle          한 번 묶는다
 *   npm run unse:watch           고치는 대로 다시 묶는다 (엔진 작업할 때)
 *
 * 왜 묶는가.
 *   이 사이트는 public/ 에서 그대로 서빙되는 정적 사이트다. 브라우저가
 *   `src/ui.js` 를 열면 거기서 import 가 줄줄이 이어져 모듈 마흔아홉 개를
 *   따로따로 받아온다. 용량도 용량이지만 요청 횟수가 그대로 첫 화면이
 *   뜨는 시간이 된다 — 느린 회선에서 특히 그렇다.
 *
 *   주석을 지우는 것도 목적이다. 이 저장소는 "왜 이렇게 했는지"를 한글
 *   주석으로 길게 적어 두는 쪽을 택했고 그건 유지보수에 필요하다. 다만
 *   그 주석이 브라우저까지 갈 이유는 없다. 원본은 그대로 두고 나가는
 *   것만 턴다.
 *
 * 왜 쪼개는가.
 *   묶기만 하면 생년월일을 적는 동안에도 계산 엔진과 해석문을 전부 받아놓고
 *   기다리게 된다. 폼 화면에 필요한 것은 도시 목록과 판 번호뿐이다.
 *   그래서 진입점을 boot.js 로 두고, 무거운 쪽은 boot.js 안의
 *   `import('./ui.js')` 한 줄로 떼어 낸다. esbuild 의 splitting 이 그 지점을
 *   보고 알아서 덩이를 가른다.
 *
 *   나오는 파일은 app.js(첫 화면)와 chunk-*.js(엔진)이다. 둘 다 만들어지는
 *   물건이라 손으로 고치지 않는다.
 *
 * 무엇을 건드리지 않는가.
 *   src/ 아래 원본은 손대지 않는다. 테스트도 원본을 그대로 import 한다.
 *   번들은 만들어지는 물건이고, 원본이 언제나 진짜다.
 *
 * 소스맵을 만들지 않는 이유.
 *   소스맵을 함께 올리면 주석까지 포함한 원본이 그대로 다시 공개된다.
 *   묶는 이유 하나가 사라지고 용량도 배로 든다. 오류를 좇아야 하면
 *   `--sourcemap` 을 붙여 한 번 만들어 보고, 올리지는 않는다.
 */

import { build, context } from 'esbuild';
import { readdirSync, statSync, existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 운세 폴더를 public/ 에서 찾아낸다.
 *
 * 주소(=폴더 이름)는 `npm run unse:url` 로 바뀐다. 여기에 이름을 박아두면
 * 주소를 바꾼 다음 날 이 스크립트가 조용히 깨진다. rename-unse-path.mjs 와
 * 같은 방법으로 찾는다 — src/engine.js 가 있는 폴더가 그곳이다.
 */
function findSite() {
  const pub = join(ROOT, 'public');
  const hit = readdirSync(pub).filter(
    (d) => statSync(join(pub, d)).isDirectory() && existsSync(join(pub, d, 'src', 'engine.js'))
  );
  if (hit.length !== 1) {
    throw new Error(
      hit.length === 0
        ? 'public/ 아래에서 운세 폴더(src/engine.js 가 있는 곳)를 찾지 못했습니다.'
        : `운세 폴더로 보이는 것이 여럿입니다: ${hit.join(', ')}`
    );
  }
  return hit[0];
}

const slug = findSite();
const siteDir = join(ROOT, 'public', slug);
const entry = join(siteDir, 'src', 'boot.js');
const watch = process.argv.includes('--watch');
const sourcemap = process.argv.includes('--sourcemap');

/**
 * 지난번에 나온 덩이를 먼저 지운다.
 * 덩이 이름은 무엇이 어디로 갈렸느냐에 따라 달라진다. 지우지 않으면 아무도
 * 읽지 않는 옛 파일이 폴더에 쌓이고, 그게 저장소에 그대로 올라간다.
 */
function sweep() {
  for (const name of readdirSync(siteDir)) {
    if (/^app-.*\.js(\.map)?$/.test(name)) unlinkSync(join(siteDir, name));
  }
}

/** 원본 몇 개를 얼마나 줄였는지 — 묶은 보람을 눈으로 확인하려고 적는다 */
function report() {
  const srcFiles = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.js')) srcFiles.push(p);
    }
  };
  walk(join(siteDir, 'src'));
  const srcBytes = srcFiles.reduce((t, p) => t + statSync(p).size, 0);

  const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
  const outs = readdirSync(siteDir)
    .filter((n) => n === 'app.js' || /^app-.*\.js$/.test(n))
    .map((n) => ({ name: n, buf: readFileSync(join(siteDir, n)) }))
    .sort((a, b) => b.buf.length - a.buf.length);

  // 첫 화면이 실제로 받는 것은 app.js 와 **거기서 정적으로 이어지는 덩이**뿐이다.
  // 이름으로 찍지 말고 app.js 의 import 를 따라가서 센다 — 덩이 이름에 해시가
  // 붙은 뒤로 이름 비교는 더 이상 맞지 않는다.
  const byName = new Map(outs.map((o) => [o.name, o]));
  const staticImports = (name) => {
    const txt = byName.get(name)?.buf?.toString('utf8') ?? '';
    return [...txt.matchAll(/from *"\.\/(app-[^"]+\.js)"/g)].map((m) => m[1]);
  };
  const eager = new Set();
  const walkEager = (name) => {
    if (!name || eager.has(name)) return;
    eager.add(name);
    for (const next of staticImports(name)) walkEager(next);
  };
  walkEager('app.js');
  const lazy = (n) => !eager.has(n);
  const first = outs.filter((o) => eager.has(o.name));
  const kbSum = (arr, f = (b) => b.length) =>
    kb(arr.reduce((t, o) => t + f(o.buf), 0));

  console.log(`public/${slug} — 원본 ${srcFiles.length}개 ${kb(srcBytes)} → ${outs.length}개`);
  for (const o of outs) {
    console.log(
      `  ${o.name.padEnd(16)} ${kb(o.buf.length).padStart(6)} ` +
      `(gzip ${kb(gzipSync(o.buf).length).padStart(6)})  ` +
      `${lazy(o.name) ? '눌렀을 때' : '첫 화면'}`
    );
  }
  console.log(
    `  첫 화면 합계 ${kbSum(first)} (gzip ${kbSum(first, (b) => gzipSync(b).length)})`
  );
}

/**
 * target 을 es2022 로 잡은 이유.
 *   이 코드는 `??`, `?.`, 클래스 필드 없이 최신 문법을 조금 쓴다. 더 낮게
 *   잡으면 esbuild 가 헬퍼를 끼워 넣어 오히려 커진다. 2022 면 요즘 쓰는
 *   브라우저는 전부 그대로 읽는다.
 */
const options = {
  entryPoints: [entry],
  outdir: siteDir,
  // 진입점 파일 이름은 boot 가 아니라 app 으로 둔다. index.html 이 읽는 이름이라
  // 여기서 바꾸면 index.html 도 같이 고쳐야 한다.
  entryNames: 'app',
  // 떼어 낸 진입점이 둘 이상이 되면서 esbuild 가 공용 덩이를 여럿 만든다.
  // 그것들이 전부 'chunk' 라는 같은 이름을 원해서 부딪쳤다 — 해시를 붙여
  // 가른다. 쌓이지는 않는다. `sweep()` 이 묶기 전에 `app-*.js` 를 모두 지운다.
  // (진입점 `app.js` 는 여전히 고정 이름이라 index.html 은 그대로다)
  chunkNames: 'app-[name]-[hash]',
  bundle: true,
  splitting: true,        // import('./ui.js') 를 보고 덩이를 가른다
  format: 'esm',          // index.html 이 <script type="module"> 로 읽는다
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  sourcemap,
  charset: 'utf8',        // 한글 문자열을 \uXXXX 로 부풀리지 않는다
  logLevel: 'warning',
  banner: {
    js: '/* 종합 운세 — public/' + slug + '/src 를 묶은 것입니다. 원본이 진짜이고 이 파일은 만들어진 것입니다. */',
  },
};

if (watch) {
  sweep();
  const ctx = await context({ ...options, logLevel: 'info' });
  await ctx.watch();
  console.log(`지켜보는 중 — public/${slug}/src 를 고치면 다시 묶습니다. 멈추려면 Ctrl+C`);
} else {
  sweep();
  await build(options);
  report();
}
