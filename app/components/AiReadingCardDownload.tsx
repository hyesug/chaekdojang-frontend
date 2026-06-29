"use client";

import { useRef, useState } from "react";
import AiReadingCard from "./AiReadingCard";
import type { AiReadingCardData } from "../lib/aiReadingCard";

export default function AiReadingCardDownload({ card }: { card: AiReadingCardData }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  async function downloadImage() {
    if (!cardRef.current || saving) return;
    setSaving(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#fffaf0",
        scale: 2,
        useCORS: true,
        width: 1080,
        height: 1080,
        windowWidth: 1080,
        windowHeight: 1080,
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "chaekdojang-ai-reading-card.png";
        link.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={downloadImage}
        disabled={saving}
        className="rounded-full bg-brown-700 px-3 py-1.5 text-xs text-white hover:bg-brown-800 disabled:opacity-50"
      >
        {saving ? "저장 중" : "이미지로 저장"}
      </button>

      <div className="fixed -left-[9999px] top-0 h-[1080px] w-[1080px]" aria-hidden>
        <div ref={cardRef} className="h-[1080px] w-[1080px]">
          <AiReadingCard card={card} exportSize />
        </div>
      </div>
    </div>
  );
}
