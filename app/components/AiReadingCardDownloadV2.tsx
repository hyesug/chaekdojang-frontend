"use client";

import { useState } from "react";
import type { AiReadingCardData } from "../lib/aiReadingCard";

const SIZE = 1080;
const PAD = 88;

export default function AiReadingCardDownloadV2({ card }: { card: AiReadingCardData }) {
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const canvas = drawCard(card);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("no blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "chaekdojang-ai-reading-card.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      alert("이미지 저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <button type="button" onClick={save} disabled={saving} className="rounded-full bg-brown-700 px-3 py-1.5 text-xs text-white hover:bg-brown-800 disabled:opacity-50 sm:w-full">
      {saving ? "저장 중" : "이미지로 저장"}
    </button>
  );
}

function drawCard(card: AiReadingCardData) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no ctx");

  // 배경 그라디언트
  const grad = ctx.createLinearGradient(0, 0, SIZE * 0.8, SIZE);
  grad.addColorStop(0, "#fdf6f0");
  grad.addColorStop(0.6, "#f5e8d4");
  grad.addColorStop(1, "#ede0cc");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 장식용 따옴표
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#c47f56";
  ctx.font = "bold 580px Georgia, serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText('"', -15, -55);
  ctx.restore();

  // 헤더
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = "#c47f56";
  ctx.font = "700 20px Arial, sans-serif";
  ctx.fillText("AI READING CARD", PAD, PAD);

  ctx.fillStyle = "#b8956d";
  ctx.font = "400 20px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("chaekdojang", SIZE - PAD, PAD);
  ctx.textAlign = "left";

  // 책 제목
  let y = PAD + 54;
  ctx.fillStyle = "#1a0f07";
  ctx.font = "700 50px Georgia, serif";
  y = wrappedText(ctx, card.bookTitle || "책 제목", PAD, y, SIZE - PAD * 2 - 60, 62, 2);

  // 포인트 구분선
  y += 30;
  ctx.strokeStyle = "rgba(196, 127, 86, 0.6)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(PAD + 80, y);
  ctx.stroke();

  // 한줄 리뷰 — 히어로
  y += 44;
  ctx.fillStyle = "#1a0f07";
  const textLen = (card.oneLineReview || "").length;
  const fontSize = textLen > 64 ? 52 : textLen > 42 ? 58 : 64;
  ctx.font = `700 ${fontSize}px Georgia, serif`;
  y = wrappedText(ctx, card.oneLineReview || "이 책을 읽고 생각이 조금 달라졌다.", PAD, y, SIZE - PAD * 2, fontSize * 1.28, 5);

  // 감정 키워드
  y += 44;
  y = keywordChips(ctx, card.emotionKeywords?.slice(0, 5) ?? [], PAD, y);

  // 섹션 구분선
  y += 52;
  ctx.strokeStyle = "#e2cdb5";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(SIZE - PAD, y);
  ctx.stroke();

  // 추천 대상 / 인상적인 구절
  y += 36;
  ctx.fillStyle = "#c47f56";
  ctx.font = "700 18px Arial, sans-serif";
  ctx.fillText("추천 대상", PAD, y);
  ctx.fillText("인상적인 구절", SIZE / 2 + 20, y);

  y += 38;
  ctx.fillStyle = "#5c3d28";
  ctx.font = "400 28px Arial, sans-serif";
  wrappedText(ctx, card.recommendedFor || "", PAD, y, SIZE / 2 - PAD - 20, 40, 3);
  wrappedText(ctx, card.impressivePoint || "", SIZE / 2 + 20, y, SIZE / 2 - PAD - 20, 40, 4);

  // 푸터
  const name = (card.authorName || card.authorNickname || "책도장 독자").trim() || "책도장 독자";
  ctx.fillStyle = "#b8956d";
  ctx.font = "400 22px Arial, sans-serif";
  ctx.textBaseline = "bottom";
  ctx.textAlign = "left";
  ctx.fillText(`by ${name}`, PAD, SIZE - PAD);

  ctx.fillStyle = "#7a5a42";
  ctx.font = "700 26px Georgia, serif";
  ctx.textAlign = "right";
  ctx.fillText("책도장 · chaekdojang.com", SIZE - PAD, SIZE - PAD);
  ctx.textAlign = "left";

  return canvas;
}

function keywordChips(ctx: CanvasRenderingContext2D, keywords: string[], x: number, y: number) {
  ctx.font = "400 24px Arial, sans-serif";
  let cx = x;
  let cy = y;
  for (const raw of keywords) {
    const label = raw.trim();
    if (!label) continue;
    const w = ctx.measureText(label).width + 44;
    if (cx + w > SIZE - PAD) { cx = x; cy += 52; }
    roundedRect(ctx, cx, cy - 31, w, 44, 22);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fill();
    ctx.strokeStyle = "#d4a87c";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#7a5a42";
    ctx.font = "500 24px Arial, sans-serif";
    ctx.fillText(label, cx + 22, cy);
    cx += w + 14;
  }
  return cy + 13;
}

function wrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  maxLines: number
) {
  const chars = Array.from(text);
  const lines: string[] = [];
  let line = "";
  for (const ch of chars) {
    const next = line + ch;
    if (ctx.measureText(next).width <= maxW || !line) { line = next; continue; }
    lines.push(line);
    line = ch;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && chars.join("").length > lines.join("").length) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
  return y + lines.length * lineH;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
