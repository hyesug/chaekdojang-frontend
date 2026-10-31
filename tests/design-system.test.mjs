import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");

test("청록 잉크 아카이브 토큰과 키보드 포커스가 전역 스타일에 제공된다", () => {
  const css = read("app/globals.css");

  for (const [name, value] of Object.entries({
    "--color-bg": "#F3F2EB",
    "--color-surface": "#FCFBF7",
    "--color-primary": "#174A46",
    "--color-ink": "#102A2C",
    "--color-text": "#182321",
    "--color-sage": "#78988F",
    "--color-accent": "#8B3040",
  })) {
    assert.match(css, new RegExp(`${name}\\s*:\\s*${value}`, "i"));
  }

  assert.match(css, /--radius-sm\s*:/);
  assert.match(css, /--radius-md\s*:/);
  assert.match(css, /--radius-lg\s*:/);
  assert.match(css, /:focus-visible\s*\{/);
});

test("기존 화면의 surface와 capsule 버튼도 아카이브 형태 언어를 상속한다", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.bg-white\s*\{/);
  assert.match(css, /button\.rounded-full/);
});

test("기존 보조 텍스트 별칭도 종이와 상아 배경에서 AA 대비를 유지한다", () => {
  const css = read("app/globals.css");
  assert.match(css, /--color-brown-300:\s*#566F69/i);
  assert.match(css, /--color-brown-400:\s*#496A63/i);
});

test("공통 404·오류 화면과 페이지 이동 표시를 제공한다", () => {
  for (const file of ["app/not-found.tsx", "app/error.tsx", "app/components/NavigationProgress.tsx"]) {
    assert.equal(existsSync(path.join(root, file)), true, `${file}가 필요합니다`);
  }
  assert.match(read("app/layout.tsx"), /<NavigationProgress \/>/);
});

test("루트 loading.tsx 를 두지 않아 공개 페이지 본문이 첫 HTML 에 바로 실린다", () => {
  // 루트 Suspense 경계가 있으면 긴 본문이 <div hidden> 블록으로 밀려나 JS 없는 수집기가 읽지 못한다.
  assert.equal(existsSync(path.join(root, "app/loading.tsx")), false, "app/loading.tsx 대신 NavigationProgress 를 쓴다");
});

test("공통 field와 modal은 보조기술에 상태와 역할을 제공한다", () => {
  const fieldPath = path.join(root, "app/components/ui/Field.tsx");
  const modalPath = path.join(root, "app/components/ui/ModalShell.tsx");
  assert.equal(existsSync(fieldPath), true, "Field primitive가 필요합니다");
  assert.equal(existsSync(modalPath), true, "ModalShell primitive가 필요합니다");
  assert.match(readFileSync(fieldPath, "utf8"), /aria-describedby/);
  assert.match(readFileSync(fieldPath, "utf8"), /aria-invalid/);
  assert.match(readFileSync(modalPath, "utf8"), /role="dialog"/);
  assert.match(readFileSync(modalPath, "utf8"), /aria-modal="true"/);
});

test("모달은 키보드 포커스를 내부에 유지하고 호출 지점으로 되돌린다", () => {
  const modal = read("app/components/ui/ModalShell.tsx");
  assert.match(modal, /previousFocus/);
  assert.match(modal, /focusable/);
  assert.match(modal, /event\.key !== "Tab"/);
});

test("작은 화면의 메뉴와 기존 제어 요소는 잘리지 않고 각자 활자 규칙을 유지한다", () => {
  const menu = read("app/components/MobileMenu.tsx");
  const css = read("app/globals.css");
  assert.match(menu, /max-h-\[calc\(100dvh-\d+px\)\]/);
  assert.match(menu, /overflow-y-auto/);
  assert.match(css, /@layer base\s*\{\s*button, input, select, textarea\s*\{\s*font:\s*inherit;/);
});

test("고객 문의는 레이블과 오류 설명을 각 입력에 연결한다", () => {
  const page = read("app/cs/page.tsx");
  assert.match(page, /<Field label="제목" error=\{/);
  assert.match(page, /<Field label="문의 내용"[\s\S]*?error=\{/);
  assert.match(page, /\{\.\.\.aria\}/);
});

test("책도장단 진입은 문서형 표면과 비캡슐 CTA를 사용한다", () => {
  const page = read("app/dojangdan/page.tsx");
  assert.match(page, /cdj-surface/);
  assert.match(page, /cdj-button--primary/);
  assert.doesNotMatch(page, /rounded-full/);
});

test("운세 화면은 장식용 gradient를 사용하지 않는다", () => {
  assert.doesNotMatch(read("public/unse/assets/style.css"), /linear-gradient/i);
});
