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
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.strokeStyle = "#eadbc7";
  ctx.lineWidth = 3;
  roundRect(ctx, 44, 44, SIZE - 88, SIZE - 88, 24);
  ctx.stroke();
}

function drawHeader(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#9d6a4d";
  ctx.font = "700 24px Arial, sans-serif";
  ctx.fillText("CHAEKDOJANG", PADDING, 136);
  ctx.fillStyle = "#b99074";
  ctx.font = "700 22px Arial, sans-serif";
  ctx.fillText("AI READING CARD", PADDING, 170);
}

function drawStamp(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = "#f3a5ad";
  ctx.fillStyle = "#e85f70";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(914, 140, 46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = "700 32px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("冊", 914, 140);
  ctx.restore();
}

function drawMainSentence(ctx: CanvasRenderingContext2D, sentence: string) {
  const fontSize = sentence.length > 72 ? 48 : sentence.length > 44 ? 56 : 64;
  ctx.fillStyle = "#2f170b";
  ctx.font = `700 ${fontSize}px Georgia, 'Times New Roman', serif`;
  ctx.textBaseline = "alphabetic";
  drawWrappedText(ctx, sentence, PADDING, 360, CARD_INNER, fontSize * 1.34, 4);
}

async function drawBookArea(ctx: CanvasRenderingContext2D, card: AiReadingCardData, includeCover: boolean) {
  const top = 700;
  const coverX = PADDING;
  const coverY = top;
  const coverW = 136;
  const coverH = 190;

  ctx.strokeStyle = "#eadbc7";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PADDING, top - 36);
  ctx.lineTo(SIZE - PADDING, top - 36);
  ctx.stroke();

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
  ctx.fillStyle = "#2f170b";
  ctx.font = "700 36px Georgia, 'Times New Roman', serif";
  drawWrappedText(ctx, card.bookTitle || "책 제목", textX, top + 42, 700, 46, 2);

  ctx.fillStyle = "#8c6047";
  ctx.font = "400 25px Arial, sans-serif";
  ctx.fillText(card.bookAuthor?.trim() || "저자 미상", textX, top + 142);

  drawKeywords(ctx, tags(card), textX, top + 188, 690);
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
  ctx.fillStyle = "#9b6b4d";
  ctx.font = "400 24px Arial, sans-serif";
  drawEllipsizedText(ctx, `by ${name}`, PADDING, 1000, 410);

  ctx.fillStyle = "#2f170b";
  ctx.font = "700 29px Georgia, serif";
  ctx.textAlign = "right";
  ctx.fillText("책도장 · chaekdojang.com", SIZE - PADDING, 1000);
  ctx.textAlign = "left";
}

function drawKeywords(ctx: CanvasRenderingContext2D, keywords: string[], x: number, y: number, maxWidth: number) {
  ctx.font = "400 23px Arial, sans-serif";
  let cursorX = x;
  let cursorY = y;
  for (const keyword of keywords.slice(0, 5)) {
    const label = keyword.trim();
    if (!label) continue;
    const width = Math.min(ctx.measureText(label).width + 40, 190);
    if (cursorX + width > x + maxWidth) {
      cursorX = x;
      cursorY += 50;
    }
    roundRect(ctx, cursorX, cursorY - 31, width, 42, 21);
    ctx.fillStyle = "#fffdf8";
    ctx.fill();
    ctx.strokeStyle = "#d9b999";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#6b3b24";
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
  wrapText(ctx, text, maxWidth, maxLines).forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
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
