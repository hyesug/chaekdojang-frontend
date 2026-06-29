"use client";

import { useState } from "react";
import type { AiReadingCardData } from "../lib/aiReadingCard";

const SIZE = 1080;
const PAD = 82;

export default function AiReadingCardDownloadV2({ card }: { card: AiReadingCardData }) {
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const canvas = await drawCard(card);
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
    <button type="button" onClick={save} disabled={saving} className="rounded-full bg-brown-700 px-3 py-1.5 text-xs text-white hover:bg-brown-800 disabled:opacity-50">
      {saving ? "저장 중" : "이미지로 저장"}
    </button>
  );
}

async function drawCard(card: AiReadingCardData) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no ctx");

  background(ctx);
  stamp(ctx);
  header(ctx);
  mainText(ctx, card.oneLineReview || "이 책을 읽고 생각이 조금 달라졌다.");
  await bookInfo(ctx, card);
  footer(ctx, card.authorName || card.authorNickname || "책도장 독자");
  return canvas;
}

function background(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#fffaf3";
  ctx.fillRect(0, 0, SIZE, SIZE);
  const grad = ctx.createRadialGradient(850, 790, 80, 850, 790, 360);
  grad.addColorStop(0, "rgba(228,210,188,0.45)");
  grad.addColorStop(1, "rgba(228,210,188,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = "#e3d4c1";
  ctx.lineWidth = 3;
  rounded(ctx, 34, 34, 1012, 1012, 14);
  ctx.stroke();
}

function header(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#8f6d55";
  ctx.font = "700 19px Arial, sans-serif";
  ctx.fillText("CHAEKDOJANG", PAD, 118);
  ctx.fillStyle = "#b58f73";
  ctx.font = "700 18px Arial, sans-serif";
  ctx.fillText("AI READING CARD", PAD, 146);
}

function stamp(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = "#b58f73";
  ctx.fillStyle = "#8b6349";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(922, 128, 49, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = "700 29px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("冊", 922, 121);
  ctx.font = "400 13px Arial, sans-serif";
  ctx.fillText("책도장", 922, 151);
  ctx.restore();
}

function mainText(ctx: CanvasRenderingContext2D, text: string) {
  const size = text.length > 64 ? 58 : text.length > 42 ? 66 : 76;
  ctx.fillStyle = "#2b1a10";
  ctx.font = `700 ${size}px Georgia, 'Times New Roman', serif`;
  const bottom = wrap(ctx, text, PAD, 300, 850, size * 1.3, 4);
  ctx.strokeStyle = "#8b6349";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, bottom + 36);
  ctx.lineTo(PAD + 72, bottom + 36);
  ctx.stroke();
}

async function bookInfo(ctx: CanvasRenderingContext2D, card: AiReadingCardData) {
  const top = 642;
  const coverW = 128;
  const coverH = 184;
  if (card.bookThumbnail) {
    const img = await loadImage(card.bookThumbnail).catch(() => null);
    if (img) {
      ctx.save();
      rounded(ctx, PAD, top, coverW, coverH, 8);
      ctx.clip();
      const scale = Math.max(coverW / img.naturalWidth, coverH / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, PAD + (coverW - w) / 2, top + (coverH - h) / 2, w, h);
      ctx.restore();
    } else cover(ctx, top, coverW, coverH);
  } else cover(ctx, top, coverW, coverH);

  const x = PAD + coverW + 38;
  ctx.fillStyle = "#2b1a10";
  ctx.font = "700 35px Georgia, 'Times New Roman', serif";
  wrap(ctx, card.bookTitle || "책 제목", x, top + 55, 650, 45, 2);
  ctx.fillStyle = "#8c6047";
  ctx.font = "400 24px Arial, sans-serif";
  ctx.fillText(card.bookAuthor || "저자 미상", x, top + 145);
  chips(ctx, card.emotionKeywords?.slice(0, 5) ?? ["성찰", "감상", "기록"], x, top + 196);
}

function cover(ctx: CanvasRenderingContext2D, y: number, w: number, h: number) {
  rounded(ctx, PAD, y, w, h, 8);
  ctx.fillStyle = "#d8bea3";
  ctx.fill();
  ctx.fillStyle = "#fffaf0";
  ctx.font = "700 34px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("책", PAD + w / 2, y + h - 28);
  ctx.textAlign = "left";
}

function chips(ctx: CanvasRenderingContext2D, values: string[], x: number, y: number) {
  ctx.font = "400 21px Arial, sans-serif";
  let cursor = x;
  for (const raw of values) {
    const label = raw.trim();
    if (!label) continue;
    const w = Math.min(ctx.measureText(label).width + 36, 180);
    rounded(ctx, cursor, y - 30, w, 40, 20);
    ctx.fillStyle = "#eadfce";
    ctx.fill();
    ctx.fillStyle = "#6f5949";
    ctx.fillText(label, cursor + 18, y);
    cursor += w + 13;
  }
}

function footer(ctx: CanvasRenderingContext2D, name: string) {
  ctx.fillStyle = "#7f6048";
  ctx.font = "700 22px Arial, sans-serif";
  ellipsis(ctx, `by ${name}`, PAD, 1000, 470);
  ctx.textAlign = "right";
  ctx.fillStyle = "#2b1a10";
  ctx.font = "700 24px Georgia, 'Times New Roman', serif";
  ctx.fillText("책도장 · chaekdojang.com", SIZE - PAD, 1000);
  ctx.textAlign = "left";
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number) {
  const chars = Array.from(text);
  const lines: string[] = [];
  let line = "";
  for (const ch of chars) {
    const next = line + ch;
    if (ctx.measureText(next).width <= maxW || !line) line = next;
    else {
      lines.push(line);
      line = ch;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  lines.forEach((value, i) => ctx.fillText(value, x, y + i * lineH));
  return y + Math.max(lines.length - 1, 0) * lineH;
}

function ellipsis(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number) {
  let value = text;
  while (value.length > 1 && ctx.measureText(value).width > maxW) value = `${value.slice(0, -2)}…`;
  ctx.fillText(value, x, y);
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
