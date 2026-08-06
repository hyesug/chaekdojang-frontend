"use client";

import { useState } from "react";

export default function SpoilerContent({ content }: { content: string }) {
  const [revealed, setRevealed] = useState(false);
  if (!revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="mt-6 w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center"
      >
        <span className="block text-sm font-semibold text-amber-800">스포일러가 포함된 독후감입니다</span>
        <span className="mt-1 block text-xs text-amber-600">내용을 보려면 누르세요</span>
      </button>
    );
  }
  return <p className="mt-6 whitespace-pre-wrap text-base leading-8 text-brown-800">{content}</p>;
}
