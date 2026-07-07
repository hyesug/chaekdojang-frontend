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
    <button
      type="button"
      onClick={save}
      disabled={saving}
      className="rounded-full bg-brown-700 px-3 py-1.5 text-xs text-white hover:bg-brown-800 disabled:opacity-50 sm:w-full"
    >
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

  // ─── 배경 그라디언트 ───
  const grad = ctx.createLinearGradient(0, 0, SIZE * 0.75, SIZE);
  grad.addColorStop(0, "#fef8f0");
  grad.addColorStop(0.5, "#f3e6cc");
  grad.addColorStop(1, "#e5cca8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ─── 장식용 따옴표 ───
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#c47f56";
  ctx.font = "bold 700px Georgia, serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("“", -25, -70);
  ctx.restore();

  // ─── 헤더 ───
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = "#c47f56";
  ctx.font = "700 21px Arial, sans-serif";
  ctx.fillText("AI READING CARD", PAD, PAD);

  ctx.fillStyle = "#b8957a";
  ctx.font = "400 21px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("chaekdojang", SIZE - PAD, PAD);
  ctx.textAlign = "left";

  const HEADER_SEP_Y = PAD + 40;
  ctx.strokeStyle = "rgba(196,127,86,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, HEADER_SEP_Y);
  ctx.lineTo(SIZE - PAD, HEADER_SEP_Y);
  ctx.stroke();

  // ─── 푸터 ───
  const FOOTER_SEP_Y = SIZE - PAD - 44;
  const FOOTER_TEXT_Y = SIZE - PAD - 10;

  ctx.strokeStyle = "rgba(196,127,86,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, FOOTER_SEP_Y);
  ctx.lineTo(SIZE - PAD, FOOTER_SEP_Y);
  ctx.stroke();

  const name = (card.authorName || card.authorNickname || "").trim() || "책도장 독자";
  ctx.textBaseline = "bottom";
  ctx.textAlign = "left";
  ctx.fillStyle = "#b8957a";
  ctx.font = "400 22px Arial, sans-serif";
  ctx.fillText(`by ${name}`, PAD, FOOTER_TEXT_Y);

  ctx.fillStyle = "#7a5a42";
  ctx.font = "700 26px Georgia, serif";
  ctx.textAlign = "right";
  ctx.fillText("책도장 · chaekdojang.com", SIZE - PAD, FOOTER_TEXT_Y);
  ctx.textAlign = "left";

  // ─── 콘텐츠 영역 계산 ───
  const ZONE_TOP = HEADER_SEP_Y + 24;
  const ZONE_BOTTOM = FOOTER_SEP_Y - 24;

  ctx.textBaseline = "top";

  // 책 제목 높이 측정
  const BOOK_FS = 54;
  const BOOK_LH = Math.round(BOOK_FS * 1.24);
  ctx.font = `700 ${BOOK_FS}px Georgia, serif`;
  const bookLines = measureWrappedLines(ctx, card.bookTitle || "제목 없음", SIZE - PAD * 2, 2);
  const bookH = bookLines.length * BOOK_LH;

  // 한줄 감상 높이 측정 (글자 수에 따라 폰트 크기 조정)
  const oneLiner = card.oneLineReview || "이 책을 읽고 생각이 달라졌다.";
  const len = oneLiner.length;
  const ONE_FS = len > 60 ? 52 : len > 36 ? 62 : len > 18 ? 72 : len > 10 ? 82 : 92;
  const ONE_LH = Math.round(ONE_FS * 1.32);
  ctx.font = `700 ${ONE_FS}px Georgia, serif`;
  const oneLines = measureWrappedLines(ctx, oneLiner, SIZE - PAD * 2, 5);
  const oneH = oneLines.length * ONE_LH;

  // 키워드 칩 높이 측정
  const keywords = (card.emotionKeywords ?? []).filter(Boolean).slice(0, 5);
  const CHIP_FS = 26;
  const CHIP_ROW_H = 54;
  let chipRows = 0;
  if (keywords.length > 0) {
    ctx.font = `500 ${CHIP_FS}px Arial, sans-serif`;
    let cx = PAD;
    chipRows = 1;
    for (const kw of keywords) {
      const w = ctx.measureText(kw.trim()).width + 52;
      if (cx + w > SIZE - PAD) { cx = PAD; chipRows++; }
      cx += w + 14;
    }
  }
  const chipH = chipRows * CHIP_ROW_H;

  // 전체 높이 계산
  const GAP_BOOK_ACCENT = 36;
  const ACCENT_BLOCK = 3 + 44;
  const GAP_ONE_CHIP = keywords.length > 0 ? 44 : 0;
  const totalH = bookH + GAP_BOOK_ACCENT + ACCENT_BLOCK + oneH + GAP_ONE_CHIP + chipH;

  // 수직 중앙 정렬
  let y = ZONE_TOP + Math.round(Math.max(0, (ZONE_BOTTOM - ZONE_TOP - totalH) / 2));

  // ─── 책 제목 ───
  ctx.fillStyle = "#1a0f07";
  ctx.font = `700 ${BOOK_FS}px Georgia, serif`;
  bookLines.forEach((line, i) => ctx.fillText(line, PAD, y + i * BOOK_LH));
  y += bookH + GAP_BOOK_ACCENT;

  // ─── 포인트 구분선 ───
  ctx.strokeStyle = "rgba(196,127,86,0.65)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(PAD + 74, y);
  ctx.stroke();
  y += ACCENT_BLOCK;

  // ─── 한줄 감상 (히어로) ───
  ctx.fillStyle = "#1a0f07";
  ctx.font = `700 ${ONE_FS}px Georgia, serif`;
  oneLines.forEach((line, i) => ctx.fillText(line, PAD, y + i * ONE_LH));
  y += oneH + GAP_ONE_CHIP;

  // ─── 키워드 칩 ───
  if (keywords.length > 0) {
    ctx.font = `500 ${CHIP_FS}px Arial, sans-serif`;
    let cx = PAD;
    let cy = y;
    for (const kw of keywords) {
      const label = kw.trim();
      if (!label) continue;
      const w = ctx.measureText(label).width + 52;
      if (cx + w > SIZE - PAD) { cx = PAD; cy += CHIP_ROW_H; }
      roundedRect(ctx, cx, cy - 28, w, 46, 23);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fill();
      ctx.strokeStyle = "rgba(196,127,86,0.38)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#7a5a42";
      ctx.fillText(label, cx + 26, cy);
      cx += w + 14;
    }
  }

  return canvas;
}

/** 텍스트를 최대 너비로 줄바꿈하고 최대 줄 수로 자른 배열 반환 */
function measureWrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number
): string[] {
  const chars = Array.from(text);
  const lines: string[] = [];
  let line = "";
  for (const ch of chars) {
    const next = line + ch;
    if (ctx.measureText(next).width <= maxW || !line) {
      line = next;
    } else {
      lines.push(line);
      line = ch;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  // 잘린 경우 말줄임표
  const drawnLen = lines.join("").length;
  if (drawnLen < chars.length && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
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
