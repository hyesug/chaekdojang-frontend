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

test("공통 404·오류·로딩 화면을 제공한다", () => {
  for (const file of ["app/not-found.tsx", "app/error.tsx", "app/loading.tsx"]) {
    assert.equal(existsSync(path.join(root, file)), true, `${file}가 필요합니다`);
  }
});

test.todo("운세 화면은 장식용 gradient를 사용하지 않는다");
