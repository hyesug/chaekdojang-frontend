import test from "node:test";
import assert from "node:assert/strict";
import { customEmotionKeywords } from "../app/write/emotionKeywords.js";

test("keeps user-added emotions separate from preset emotions for display", () => {
  assert.deepEqual(
    customEmotionKeywords(["성장", "나만의 단어", "또 다른 단어"]),
    ["나만의 단어", "또 다른 단어"],
  );
});
