"use client";

import { useState } from "react";
import type { AiReadingCardData } from "../lib/aiReadingCard";

const SIZE = 1080;
const PADDING = 86;

export default function AiReadingCardDownload({ card }: { card: AiReadingCardData }) {
  const [saving, setSaving] = useState(false);

  async function downloadImage() {
    if (saving) return;
    setSaving(true);
    try {
      const canvas = renderCard(card);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("PNG 파일을 만들지 못했습니다.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "chaekdojang-ai-reading-card.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      alert("이미지 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={downloadImage}
      disabled={saving}
      className="rounded-full bg-brown-700 px-3 py-1.5 text-xs text-white hover:bg-brown-800 disabled:opacity-50"
    >
      {saving ? "저장 중" : "이미지로 저장"}
    </button>
  );
}

function renderCard(card: AiReadingCardData) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context is not available.");

  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.strokeStyle = "#eadbc7";
  ctx.lineWidth = 3;
  roundRect(ctx, 46, 46, SIZE - 92, SIZE - 92, 28);
  ctx.stroke();

  drawStamp(ctx);

  ctx.fillStyle = "#b78262";
  ctx.font = "700 22px Georgia, serif";
  ctx.letterSpacing = "6px";
  ctx.fillText("CHAEKDOJANG AI READING CARD", PADDING, 150);
  ctx.letterSpacing = "0px";

  let y = 210;
  ctx.fillStyle = "#2f170b";
  ctx.font = "700 58px Georgia, 'Times New Roman', serif";
  y = drawWrappedText(ctx, card.bookTitle, PADDING, y, 720, 68, 2);

  y += 54;
  ctx.fillStyle = "#2f170b";
  ctx.font = "700 48px Georgia, 'Times New Roman', serif";
  y = drawWrappedText(ctx, `“${card.oneLineReview}”`, PADDING, y, 850, 72, 4);

  y += 34;
  y = drawKeywords(ctx, card.emotionKeywords.slice(0, 5), PADDING, y);

  y += 54;
  ctx.fillStyle = "#b26d43";
  ctx.font = "700 24px Arial, sans-serif";
  ctx.fillText("추천 대상", PADDING, y);
  ctx.fillText("인상 깊은 지점", 560, y);

  y += 40;
  ctx.fillStyle = "#5b321d";
  ctx.font = "400 30px Arial, sans-serif";
  drawWrappedText(ctx, card.recommendedFor, PADDING, y, 390, 42, 3);
  drawWrappedText(ctx, card.impressivePoint ?? "", 560, y, 390, 42, 4);

  ctx.fillStyle = "#9b6b4d";
  ctx.font = "400 24px Arial, sans-serif";
  ctx.fillText(`by ${card.authorNickname}`, PADDING, 1000);

  ctx.fillStyle = "#2f170b";
  ctx.font = "700 30px Georgia, serif";
  ctx.textAlign = "right";
  ctx.fillText("책도장 · chaekdojang.com", SIZE - PADDING, 1000);
  ctx.textAlign = "left";

  return canvas;
}

function drawStamp(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = "#ff9aa4";
  ctx.fillStyle = "#ff5f6f";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(920, 150, 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = "700 32px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("冊", 920, 150);
  ctx.restore();
}

function drawKeywords(ctx: CanvasRenderingContext2D, keywords: string[], x: number, y: number) {
  ctx.font = "400 24px Arial, sans-serif";
  let cursorX = x;
  let cursorY = y;
  for (const keyword of keywords) {
    const width = ctx.measureText(keyword).width + 42;
    if (cursorX + width > SIZE - PADDING) {
      cursorX = x;
      cursorY += 52;
    }
    roundRect(ctx, cursorX, cursorY - 30, width, 42, 21);
    ctx.fillStyle = "#fffdf8";
    ctx.fill();
    ctx.strokeStyle = "#cfa783";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#6b3b24";
    ctx.fillText(keyword, cursorX + 21, cursorY);
    cursorX += width + 14;
  }
  return cursorY + 12;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const lines = wrapText(ctx, text, maxWidth, maxLines);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const chars = Array.from(text);
  const lines: string[] = [];
  let current = "";

  for (const char of chars) {
    const next = current + char;
    if (ctx.measureText(next).width <= maxWidth || current.length === 0) {
      current = next;
      continue;
    }
    lines.push(current);
    current = char;
    if (lines.length === maxLines) break;
  }

  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines && chars.join("").length > lines.join("").length) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
