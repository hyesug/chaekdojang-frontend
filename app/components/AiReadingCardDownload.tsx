"use client";

import { useState } from "react";
import type { AiReadingCardData } from "../lib/aiReadingCard";

const SIZE = 1080;
const PADDING = 86;
const CARD_INNER = SIZE - PADDING * 2;

export default function AiReadingCardDownload({ card }: { card: AiReadingCardData }) {
  const [saving, setSaving] = useState(false);

  async function downloadImage() {
    if (saving) return;
    setSaving(true);
    try {
      const canvas = await renderCard(card, true);
      let blob = await toPngBlob(canvas);
      if (!blob) {
        const fallbackCanvas = await renderCard(card, false);
        blob = await toPngBlob(fallbackCanvas);
      }
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

function authorName(card: AiReadingCardData) {
  return (card.authorName || card.authorNickname || "책도장 독자").trim() || "책도장 독자";
}

function mainSentence(card: AiReadingCardData) {
  return card.oneLineReview?.trim() || "이 책을 읽고 생각이 조금 달라졌다.";
}

function tags(card: AiReadingCardData) {
  const values = card.emotionKeywords?.filter(Boolean).slice(0, 5) ?? [];
  return values.length > 0 ? values : ["성찰", "감상", "기록"];
}

async function renderCard(card: AiReadingCardData, includeCover: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context is not available.");

  drawBackground(ctx);
  drawStamp(ctx);
  drawHeader(ctx);
  drawMainSentence(ctx, mainSentence(card));
  await drawBookArea(ctx, card, includeCover);
  drawFooter(ctx, authorName(card));

  return canvas;
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#fffaf4";
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.strokeStyle = "#e6d8c7";
  ctx.lineWidth = 2;
  roundRect(ctx, 10, 10, SIZE - 20, SIZE - 20, 8);
  ctx.stroke();
}

function drawHeader(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#9f7b63";
  ctx.font = "700 19px Arial, sans-serif";
  ctx.fillText("CHAEKDOJANG", PADDING, 116);
  ctx.fillStyle = "#b99c86";
  ctx.font = "700 18px Arial, sans-serif";
  ctx.fillText("AI READING CARD", PADDING, 144);
}

function drawStamp(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = "#b58f73";
  ctx.fillStyle = "#8b6349";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(920, 126, 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = "700 28px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("冊", 920, 120);
  ctx.font = "400 13px Arial, sans-serif";
  ctx.fillText("책도장", 920, 149);
  ctx.restore();
}

function drawMainSentence(ctx: CanvasRenderingContext2D, sentence: string) {
  const fontSize = sentence.length > 72 ? 58 : sentence.length > 44 ? 66 : 76;
  ctx.fillStyle = "#2b1a10";
  ctx.font = `700 ${fontSize}px Georgia, 'Times New Roman', serif`;
  ctx.textBaseline = "alphabetic";
  const bottom = drawWrappedText(ctx, sentence, PADDING, 300, CARD_INNER - 70, fontSize * 1.28, 4);

  ctx.strokeStyle = "#8b6349";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PADDING, bottom + 34);
  ctx.lineTo(PADDING + 74, bottom + 34);
  ctx.stroke();
}

async function drawBookArea(ctx: CanvasRenderingContext2D, card: AiReadingCardData, includeCover: boolean) {
  const top = 650;
  const coverX = PADDING;
  const coverY = top;
  const coverW = 132;
  const coverH = 188;

  if (includeCover && card.bookThumbnail) {
    const img = await loadImage(card.bookThumbnail).catch(() => null);
    if (img) {
      drawCoverImage(ctx, img, coverX, coverY, coverW, coverH);
    } else {
      drawCoverPlaceholder(ctx, coverX, coverY, coverW, coverH);
    }
  } else {
    drawCoverPlaceholder(ctx, coverX, coverY, coverW, coverH);
  }

  const textX = coverX + coverW + 36;
  ctx.fillStyle = "#2b1a10";
  ctx.font = "700 35px Georgia, 'Times New Roman', serif";
  drawWrappedText(ctx, card.bookTitle || "책 제목", textX, top + 56, 650, 45, 2);

  ctx.fillStyle = "#8c6047";
  ctx.font = "400 24px Arial, sans-serif";
  ctx.fillText(card.bookAuthor?.trim() || "저자 미상", textX, top + 144);

  drawKeywords(ctx, tags(card), textX, top + 190, 650);
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  ctx.save();
  roundRect(ctx, x, y, width, height, 8);
  ctx.clip();
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  ctx.drawImage(img, x + (width - drawW) / 2, y + (height - drawH) / 2, drawW, drawH);
  ctx.restore();
  ctx.strokeStyle = "#d6bd9f";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, width, height, 8);
  ctx.stroke();
}

function drawCoverPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  roundRect(ctx, x, y, width, height, 8);
  ctx.fillStyle = "#d8bea3";
  ctx.fill();
  ctx.fillStyle = "#fffaf0";
  ctx.font = "700 34px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("책", x + width / 2, y + height - 28);
  ctx.textAlign = "left";
}

function drawFooter(ctx: CanvasRenderingContext2D, name: string) {
  ctx.fillStyle = "#7f6048";
  ctx.font = "700 22px Arial, sans-serif";
  drawEllipsizedText(ctx, `BY ${name}`, PADDING, 1000, 540);
}

function drawKeywords(ctx: CanvasRenderingContext2D, keywords: string[], x: number, y: number, maxWidth: number) {
  ctx.font = "400 21px Arial, sans-serif";
  let cursorX = x;
  let cursorY = y;
  for (const keyword of keywords.slice(0, 5)) {
    const label = keyword.trim();
    if (!label) continue;
    const width = Math.min(ctx.measureText(label).width + 36, 180);
    if (cursorX + width > x + maxWidth) {
      cursorX = x;
      cursorY += 50;
    }
    roundRect(ctx, cursorX, cursorY - 30, width, 40, 20);
    ctx.fillStyle = "#eadfce";
    ctx.fill();
    ctx.fillStyle = "#6f5949";
    drawEllipsizedText(ctx, label, cursorX + 20, cursorY, width - 38);
    cursorX += width + 13;
  }
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
  return y + Math.max(lines.length - 1, 0) * lineHeight;
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

function drawEllipsizedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
) {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  let value = text;
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  ctx.fillText(`${value}…`, x, y);
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

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function toPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob(resolve, "image/png");
    } catch {
      resolve(null);
    }
  });
}
