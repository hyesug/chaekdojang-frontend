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
  ctx.fillStyle = "#f2ece4";
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.save();
  ctx.shadowColor = "rgba(45, 31, 20, 0.18)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  rounded(ctx, 28, 28, SIZE - 56, SIZE - 56, 10);
  ctx.fillStyle = "#fffaf3";
  ctx.fill();
  ctx.restore();

  const paper = ctx.createLinearGradient(28, 28, SIZE, SIZE);
  paper.addColorStop(0, "rgba(255,255,255,0.88)");
  paper.addColorStop(0.5, "rgba(255,250,243,0.92)");
  paper.addColorStop(1, "rgba(243,231,214,0.96)");
  rounded(ctx, 28, 28, SIZE - 56, SIZE - 56, 10);
  ctx.fillStyle = paper;
  ctx.fill();

  ctx.save();
  rounded(ctx, 28, 28, SIZE - 56, SIZE - 56, 10);
  ctx.clip();

  const grad = ctx.createRadialGradient(920, 775, 40, 890, 800, 370);
  grad.addColorStop(0, "rgba(226,214,194,0.42)");
  grad.addColorStop(1, "rgba(226,214,194,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.fillStyle = "rgba(231,219,200,0.32)";
  ctx.beginPath();
  ctx.ellipse(855, 830, 230, 300, -0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(965, 785, 155, 230, -0.2, 0, Math.PI * 2);
  ctx.fill();

  leaf(ctx);
  ctx.restore();

  ctx.strokeStyle = "#d7c7b6";
  ctx.lineWidth = 2;
  rounded(ctx, 28, 28, SIZE - 56, SIZE - 56, 10);
  ctx.stroke();
}

function header(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#8f6d55";
  ctx.font = "700 18px Arial, sans-serif";
  ctx.fillText("CHAEKDOJANG", PAD, 118);
  ctx.fillStyle = "#b58f73";
  ctx.font = "700 17px Arial, sans-serif";
  ctx.fillText("AI READING CARD", PAD, 146);
}

function stamp(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = "#b58f73";
  ctx.fillStyle = "#8b6349";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(928, 126, 49, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = "700 29px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("冊", 928, 119);
  ctx.font = "400 13px Arial, sans-serif";
  ctx.fillText("책도장", 928, 151);
  ctx.restore();
}

function mainText(ctx: CanvasRenderingContext2D, text: string) {
  const size = text.length > 64 ? 50 : text.length > 42 ? 58 : 68;
  ctx.fillStyle = "#2b1a10";
  ctx.font = `600 ${size}px Georgia, 'Times New Roman', serif`;
  const bottom = wrap(ctx, text, PAD, 270, 760, size * 1.28, 4);

  ctx.strokeStyle = "#8f6d55";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD, bottom + 58);
  ctx.lineTo(PAD + 78, bottom + 58);
  ctx.stroke();
}

async function bookInfo(ctx: CanvasRenderingContext2D, card: AiReadingCardData) {
  const top = 650;
  const coverW = 128;
  const coverH = 184;
  if (card.bookThumbnail) {
    const img = await loadBookCover(card.bookThumbnail);
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

  const x = PAD + coverW + 42;
  ctx.fillStyle = "#2b1a10";
  ctx.font = "700 31px Georgia, 'Times New Roman', serif";
  wrap(ctx, card.bookTitle || "책 제목", x, top + 56, 610, 40, 2);
  ctx.fillStyle = "#8c6047";
  ctx.font = "400 21px Arial, sans-serif";
  ctx.fillText(`| ${card.bookAuthor || "저자 미상"}`, x, top + 132);
  chips(ctx, card.emotionKeywords?.slice(0, 5) ?? ["성찰", "감상", "기록"], x, top + 182);
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
  ctx.font = "400 18px Arial, sans-serif";
  let cursor = x;
  for (const raw of values) {
    const label = raw.trim();
    if (!label) continue;
    const w = Math.min(ctx.measureText(label).width + 32, 168);
    rounded(ctx, cursor, y - 27, w, 36, 18);
    ctx.fillStyle = "#eadfce";
    ctx.fill();
    ctx.fillStyle = "#6f5949";
    ctx.fillText(label, cursor + 16, y);
    cursor += w + 11;
  }
}

function footer(ctx: CanvasRenderingContext2D, name: string) {
  ctx.fillStyle = "#7f6048";
  ctx.font = "400 22px Arial, sans-serif";
  ellipsis(ctx, `책도장 · chaekdojang.com`, PAD, 960, 470);
  ctx.fillStyle = "#2b1a10";
  ctx.font = "400 19px Arial, sans-serif";
  const byline = ellipsisText(ctx, name, 280);
  ctx.textAlign = "right";
  ctx.fillText(byline, SIZE - PAD, 960);
  ctx.textAlign = "left";
}

function leaf(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.translate(826, 780);
  ctx.rotate(-0.65);
  ctx.strokeStyle = "rgba(126, 99, 70, 0.5)";
  ctx.fillStyle = "rgba(126, 99, 70, 0.11)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, 160);
  ctx.bezierCurveTo(22, 92, 56, 40, 100, -18);
  ctx.stroke();
  const leaves = [
    [22, 115, -32],
    [42, 82, 34],
    [58, 50, -34],
    [78, 18, 34],
    [92, -8, -28],
  ];
  for (const [x, y, angle] of leaves) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(30, -32, 68, -20, 78, 0);
    ctx.bezierCurveTo(50, 16, 18, 18, 0, 0);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
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
  ctx.fillText(ellipsisText(ctx, text, maxW), x, y);
}

function ellipsisText(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  let value = text;
  while (value.length > 1 && ctx.measureText(value).width > maxW) value = `${value.slice(0, -2)}…`;
  return value;
}

async function loadBookCover(src: string) {
  const candidates = [bookCoverProxy(src), nextImageProxy(src), normalizeImageUrl(src)].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const img = await loadImageBlob(candidate).catch(() => null);
    if (img) return img;
  }
  return null;
}

function bookCoverProxy(src: string) {
  const normalized = normalizeImageUrl(src);
  return normalized ? `/image-proxy?url=${encodeURIComponent(normalized)}` : null;
}

function nextImageProxy(src: string) {
  const normalized = normalizeImageUrl(src);
  if (!normalized) return null;
  return `/_next/image?url=${encodeURIComponent(normalized)}&w=256&q=90`;
}

function normalizeImageUrl(src: string) {
  try {
    return new URL(src.startsWith("//") ? `https:${src}` : src).toString();
  } catch {
    return null;
  }
}

async function loadImageBlob(src: string) {
  const res = await fetch(src, { cache: "force-cache" });
  if (!res.ok) throw new Error("image fetch failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
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
