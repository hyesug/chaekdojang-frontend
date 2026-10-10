/**
 * rename-unse-path.mjs — 운세 사이트 주소를 바꾼다
 *
 *   npm run unse:url -- <새주소>
 *   예) npm run unse:url -- unse-2k9x4p
 *
 * 왜 스크립트인가.
 *   이 주소는 메뉴에 걸지 않고 아는 사람만 들어오게 하는 자리다. 그런데
 *   정적 사이트는 public/<폴더> 가 곧 주소라서, 주소만 바꾸고 폴더를 두면
 *   옛 주소가 그대로 열린다 — 바꾼 의미가 없어진다. 그래서 폴더 이름을
 *   실제로 바꾸고, 그 이름을 적어 둔 곳을 전부 같이 고친다.
 *
 * 고치는 곳: public/<폴더> 와 **저장소 안에서 옛 이름을 적어 둔 모든 글 파일.**
 *
 * 처음에는 고칠 파일을 손으로 적어 두었는데(설정 넷 + tests/unse + 문서),
 * 실제로 돌려 보니 **55곳이 남았다** — scripts/ · lib/ · validation/ ·
 * docs/plans/ 가 목록에 없었다. 목록으로 관리하면 새 파일이 생길 때마다
 * 조용히 빠진다. 그래서 훑는다.
 *
 * 바꾼 뒤에는 `npm run test:unse` 와 `npm run build` 가 그대로 통과해야 한다.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 지금 쓰고 있는 폴더 이름을 public/ 에서 찾아낸다 — 하드코딩하면 한 번 쓰고 못 쓴다 */
function currentSlug() {
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

/** 이 주소는 URL 한 조각이 된다. 띄어쓰기나 슬래시가 들어가면 조용히 깨진다 */
function validate(slug) {
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(slug)) {
    throw new Error(
      `'${slug}' 는 주소로 쓸 수 없습니다. 영문 소문자·숫자·하이픈만, 3~64자로 지어 주세요 (예: unse-2k9x4p).`
    );
  }
  if (existsSync(join(ROOT, 'public', slug))) {
    throw new Error(`public/${slug} 가 이미 있습니다.`);
  }
}

/** 들어가지 않을 곳 — 만들어지는 것과 남의 것 */
const SKIP_DIR = new Set([
  'node_modules', '.git', '.next', '.vercel', '.turbo',
  'dist', 'build', 'coverage', 'out',
]);

/** 글로 된 것만 연다. 이미지·폰트를 utf8 로 읽으면 깨진 채로 다시 쓰게 된다 */
const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.yml', '.yaml', '.html', '.css', '.txt', '.log',
]);

/** 저장소를 훑어 고칠 만한 파일을 모은다 */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) { walk(full, out); continue; }
    const dot = name.lastIndexOf('.');
    if (dot < 0 || !TEXT_EXT.has(name.slice(dot))) continue;
    // 아주 큰 로그까지 열지는 않는다
    if (st.size > 8 * 1024 * 1024) continue;
    out.push(full);
  }
  return out;
}

/** 텍스트에서 옛 이름을 새 이름으로 바꾼다. 바뀐 개수를 돌려준다 */
function swap(file, from, to) {
  if (!existsSync(file)) return 0;
  // 목록에 디렉터리가 섞여 들어오면 readFileSync 가 EISDIR 로 죽는다 —
  // tests/unse/fixtures/ 에서 실제로 그렇게 멈췄다.
  if (statSync(file).isDirectory()) return 0;
  const before = readFileSync(file, 'utf8');
  const after = before.split(from).join(to);
  if (before === after) return 0;
  writeFileSync(file, after);
  return before.split(from).length - 1;
}

const arg = process.argv[2];
if (!arg) {
  console.error('쓰는 법: npm run unse:url -- <새주소>\n예)      npm run unse:url -- unse-2k9x4p');
  process.exit(1);
}

const from = currentSlug();
const to = arg.trim();
validate(to);

if (from === to) {
  console.log(`이미 ${from} 입니다. 바꿀 것이 없습니다.`);
  process.exit(0);
}

// 폴더부터 옮긴다. git mv 를 쓰면 이력이 이어지고, 저장소 밖이면 그냥 rename 한다.
const oldDir = join('public', from);
const newDir = join('public', to);
try {
  execFileSync('git', ['mv', oldDir, newDir], { cwd: ROOT, stdio: 'pipe' });
} catch {
  const { renameSync } = await import('node:fs');
  renameSync(join(ROOT, oldDir), join(ROOT, newDir));
}

// 목록을 손으로 적지 않고 훑는다 — 적어 두면 새 파일이 생길 때 빠진다
const targets = walk(ROOT);

let total = 0;
for (const file of targets) {
  const n = swap(file, from, to);
  if (n) {
    total += n;
    console.log(`  ${relative(ROOT, file)} — ${n}곳`);
  }
}

console.log(`\npublic/${from} → public/${to} (참조 ${total}곳 수정)`);
console.log(`새 주소: /${to}`);
console.log('\n확인: npm run test:unse  그리고  npm run build');
console.log('배포 뒤 옛 주소는 열리지 않습니다. 북마크가 있으면 새 주소로 바꿔 두세요.');
