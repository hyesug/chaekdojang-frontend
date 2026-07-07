"use client";

import { useState } from "react";
import type { AiReadingCardData } from "../lib/aiReadingCard";

// B안 — 클린 에디토리얼 / 900×900
const SIZE = 900;
const PAD = 72;

// 한국어가 잘 렌더링되는 폰트 스택
const SANS = "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', Arial, sans-serif";

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

  // textBaseline = "top" 고정 — 한국어 포함 모든 텍스트에 일관 적용
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  // ─── 배경 ───
  ctx.fillStyle = "#fafaf6";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ─── 상단 다크 바 ───
  ctx.fillStyle = "#2c2018";
  ctx.fillRect(0, 0, SIZE, 8);

  // ─── 헤더 ───
  const HEADER_FS = 18;
  const HEADER_Y = PAD;
  ctx.fillStyle = "#2c2018";
  ctx.font = `700 ${HEADER_FS}px ${SANS}`;
  ctx.fillText("AI READING CARD", PAD, HEADER_Y);

  ctx.fillStyle = "#a09080";
  ctx.font = `400 ${HEADER_FS}px ${SANS}`;
  ctx.textAlign = "right";
  ctx.fillText("chaekdojang", SIZE - PAD, HEADER_Y);
  ctx.textAlign = "left";

  // 헤더 구분선
  const HEADER_SEP_Y = HEADER_Y + HEADER_FS * 1.6;
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#2c2018";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, HEADER_SEP_Y);
  ctx.lineTo(SIZE - PAD, HEADER_SEP_Y);
  ctx.stroke();
  ctx.restore();

  // ─── 푸터 ───
  const FOOTER_FS = 19;
  const FOOTER_TEXT_Y = SIZE - PAD - FOOTER_FS;
  const FOOTER_SEP_Y = FOOTER_TEXT_Y - 16;

  ctx.save();
  ctx.strokeStyle = "#e0d8d0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, FOOTER_SEP_Y);
  ctx.lineTo(SIZE - PAD, FOOTER_SEP_Y);
  ctx.stroke();
  ctx.restore();

  const name = (card.authorName || card.authorNickname || "").trim() || "책도장 독자";
  ctx.fillStyle = "#9a8878";
  ctx.font = `400 ${FOOTER_FS}px ${SANS}`;
  ctx.fillText(`by ${name}`, PAD, FOOTER_TEXT_Y);

  ctx.fillStyle = "#4a3828";
  ctx.font = `700 ${FOOTER_FS}px ${SANS}`;
  ctx.textAlign = "right";
  ctx.fillText("책도장", SIZE - PAD, FOOTER_TEXT_Y);
  ctx.textAlign = "left";

  // ─── 콘텐츠 영역 ───
  const ZONE_TOP = HEADER_SEP_Y + 20;
  const ZONE_BOTTOM = FOOTER_SEP_Y - 20;

  // 책 제목 높이 측정
  const BOOK_FS = 42;
  const BOOK_LH = Math.round(BOOK_FS * 1.30);
  ctx.font = `700 ${BOOK_FS}px ${SANS}`;
  const bookLines = measureLines(ctx, card.bookTitle || "제목 없음", SIZE - PAD * 2, 2);
  const bookH = bookLines.length * BOOK_LH;

  // 책 저자
  const AUTHOR_FS = 18;
  const AUTHOR_LH = Math.round(AUTHOR_FS * 1.40);
  const hasAuthor = !!(card.bookAuthor?.trim());
  const authorH = hasAuthor ? AUTHOR_LH + 6 : 0;

  // 전체 너비 구분선 블록
  const DIVIDER_GAP = 20; // 위
  const DIVIDER_GAP2 = 22; // 아래

  // 한줄 감상 — 폰트 크기 적응
  const oneLiner = card.oneLineReview || "이 책을 읽고 생각이 달라졌다.";
  const len = oneLiner.length;
  const ONE_FS = len > 60 ? 42 : len > 36 ? 50 : len > 18 ? 58 : len > 10 ? 66 : 74;
  const ONE_LH = Math.round(ONE_FS * 1.35);
  ctx.font = `700 ${ONE_FS}px ${SANS}`;
  const oneLines = measureLines(ctx, oneLiner, SIZE - PAD * 2, 5);
  const oneH = oneLines.length * ONE_LH;

  // 키워드 칩
  const keywords = (card.emotionKeywords ?? []).filter(Boolean).slice(0, 5);
  const CHIP_FS = 20;
  const CHIP_H = 36;
  const CHIP_GAP_V = 8;
  let chipRows = 0;
  if (keywords.length > 0) {
    ctx.font = `500 ${CHIP_FS}px ${SANS}`;
    let cx = PAD;
    chipRows = 1;
    for (const kw of keywords) {
      const w = ctx.measureText(kw.trim()).width + 40;
      if (cx + w > SIZE - PAD) { cx = PAD; chipRows++; }
      cx += w + 10;
    }
  }
  const chipH = chipRows > 0 ? chipRows * CHIP_H + (chipRows - 1) * CHIP_GAP_V : 0;
  const chipGap = keywords.length > 0 ? 34 : 0;

  // 전체 콘텐츠 높이
  const totalH =
    bookH + authorH +
    DIVIDER_GAP + 1 + DIVIDER_GAP2 +
    oneH + chipGap + chipH;

  // 수직 중앙 정렬
  let y = ZONE_TOP + Math.round(Math.max(0, (ZONE_BOTTOM - ZONE_TOP - totalH) / 2));

  // 책 제목 그리기
  ctx.fillStyle = "#1a110a";
  ctx.font = `700 ${BOOK_FS}px ${SANS}`;
  bookLines.forEach((line, i) => ctx.fillText(line, PAD, y + i * BOOK_LH));
  y += bookH;

  // 저자 그리기
  if (hasAuthor && card.bookAuthor) {
    y += 6;
    ctx.fillStyle = "#6b5a4a";
    ctx.font = `400 ${AUTHOR_FS}px ${SANS}`;
    ctx.fillText(card.bookAuthor, PAD, y);
    y += AUTHOR_LH;
  }

  // 전체 너비 구분선
  y += DIVIDER_GAP;
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = "#2c2018";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(SIZE - PAD, y);
  ctx.stroke();
  ctx.restore();
  y += 1 + DIVIDER_GAP2;

  // 한줄 감상 HERO
  ctx.fillStyle = "#1a110a";
  ctx.font = `700 ${ONE_FS}px ${SANS}`;
  oneLines.forEach((line, i) => ctx.fillText(line, PAD, y + i * ONE_LH));
  y += oneH;

  // 키워드 칩 그리기
  if (keywords.length > 0) {
    y += chipGap;
    ctx.font = `500 ${CHIP_FS}px ${SANS}`;
    let cx = PAD;
    let cy = y;
    for (const kw of keywords) {
      const label = kw.trim();
      if (!label) continue;
      const w = ctx.measureText(label).width + 40;
      if (cx + w > SIZE - PAD) { cx = PAD; cy += CHIP_H + CHIP_GAP_V; }

      // 칩 배경 (베이지)
      roundedRect(ctx, cx, cy, w, CHIP_H, 5);
      ctx.fillStyle = "#f0ebe4";
      ctx.fill();

      // 칩 텍스트 — textBaseline="top" 기준으로 수직 중앙
      const textTopY = cy + Math.round((CHIP_H - CHIP_FS) / 2);
      ctx.fillStyle = "#6b5a4a";
      ctx.fillText(label, cx + 20, textTopY);

      cx += w + 10;
    }
  }

  return canvas;
}

/** textBaseline="top" 기준 줄바꿈 */
function measureLines(
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
  if (lines.join("").length < chars.length && lines.length > 0) {
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
