import type { AiReadingCardData } from "./aiReadingCard";

const WIDTH = 900;
const HEIGHT = 640;
const SANS = "Pretendard, 'Malgun Gothic', Arial, sans-serif";
const SERIF = "'Noto Serif KR', 'Nanum Myeongjo', serif";

function xml(value: string | number | null | undefined) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

function lines(value: string, maxChars: number, maxLines: number) {
  const result: string[] = [];
  let line = "";
  for (const character of Array.from(value.trim())) {
    if (line.length >= maxChars) {
      result.push(line);
      line = "";
      if (result.length === maxLines) break;
    }
    line += character;
  }
  if (result.length < maxLines && line) result.push(line);
  if (result.length === maxLines && result.join("").length < value.trim().length) {
    result[maxLines - 1] = `${result[maxLines - 1].slice(0, -1)}…`;
  }
  return result;
}

function textBlock(value: string, x: number, y: number, maxChars: number, maxLines: number, size: number, lineHeight: number, options = "") {
  return lines(value, maxChars, maxLines)
    .map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" font-family="${SERIF}" font-size="${size}" ${options}>${xml(line)}</text>`)
    .join("");
}

export function renderAiReadingCardSvg(card: AiReadingCardData, coverSrc = card.bookThumbnail ?? "") {
  const titleLines = lines(card.bookTitle || "제목 없음", 18, 2);
  const heroLines = lines(card.oneLineReview || "이 책을 읽고 생각이 조금 달라졌다.", 31, 3);
  const keywords = (card.emotionKeywords ?? []).filter(Boolean).slice(0, 5);
  const heroY = 258;
  const chipsY = heroY + heroLines.length * 40 + 26;
  const detailY = chipsY + 58;
  const stars = card.rating == null ? "" : `${"★".repeat(Math.round(card.rating))}${"☆".repeat(5 - Math.round(card.rating))} ${card.rating.toFixed(1)}`;
  const name = (card.authorName || card.authorNickname || "책도장 독자").trim() || "책도장 독자";
  const cover = coverSrc
    ? `<image href="${xml(coverSrc)}" x="80" y="92" width="92" height="132" preserveAspectRatio="xMidYMid slice" clip-path="url(#coverClip)"/>`
    : `<rect x="80" y="92" width="92" height="132" rx="4" fill="#C0D2C9"/><text x="126" y="160" text-anchor="middle" font-family="${SERIF}" font-size="13" fill="#174A46">표지</text>`;

  let chipX = 80;
  const chipSvg = keywords.map((keyword) => {
    const width = Math.max(62, keyword.length * 14 + 24);
    const result = `<rect x="${chipX}" y="${chipsY}" width="${width}" height="28" rx="4" fill="#FCFBF7" stroke="#B9C2B9"/><text x="${chipX + width / 2}" y="${chipsY + 19}" text-anchor="middle" font-family="${SANS}" font-size="13" fill="#315F5A">${xml(keyword)}</text>`;
    chipX += width + 10;
    return result;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FCFBF7"/><stop offset="1" stop-color="#E3ECE7"/></linearGradient>
      <clipPath id="coverClip"><rect x="80" y="92" width="92" height="132" rx="4"/></clipPath>
    </defs>
    <rect width="900" height="640" rx="12" fill="url(#paper)"/>
    <text x="80" y="62" font-family="${SANS}" font-size="14" font-weight="700" letter-spacing="2" fill="#174A46">AI READING CARD</text>
    <text x="820" y="62" text-anchor="end" font-family="${SANS}" font-size="13" fill="#6F817C">chaekdojang</text>
    <text x="62" y="82" font-family="${SERIF}" font-size="110" fill="#174A46" opacity=".07">“</text>
    ${cover}
    ${textBlock(card.bookTitle || "제목 없음", 200, 122, 18, 2, 24, 30, 'font-weight="700" fill="#102A2C"')}
    ${card.bookAuthor ? `<text x="200" y="180" font-family="${SANS}" font-size="14" fill="#56706A">${xml(card.bookAuthor)}</text>` : ""}
    ${stars ? `<text x="200" y="207" font-family="${SANS}" font-size="16" letter-spacing="1" fill="#B07A1E">${xml(stars)}</text>` : ""}
    <line x1="80" y1="240" x2="820" y2="240" stroke="#8B3040" stroke-width="1" opacity=".7"/>
    ${textBlock(card.oneLineReview || "이 책을 읽고 생각이 조금 달라졌다.", 80, heroY, 31, 3, 31, 40, 'font-weight="700" fill="#102A2C"')}
    ${chipSvg}
    <line x1="80" y1="${detailY + 20}" x2="820" y2="${detailY + 20}" stroke="#B9C2B9"/>
    ${card.recommendedFor ? `<text x="80" y="${detailY + 48}" font-family="${SANS}" font-size="11" font-weight="700" fill="#56706A">추천 대상</text>${textBlock(card.recommendedFor, 80, detailY + 72, 27, 2, 13, 19, 'fill="#315F5A"')}` : ""}
    ${card.impressivePoint ? `<text x="470" y="${detailY + 48}" font-family="${SANS}" font-size="11" font-weight="700" fill="#56706A">내 독후감에서 고른 구절</text>${textBlock(`“${card.impressivePoint}”`, 470, detailY + 72, 29, 3, 13, 19, 'fill="#315F5A"')}` : ""}
    <line x1="80" y1="590" x2="820" y2="590" stroke="#B9C2B9"/>
    <text x="80" y="616" font-family="${SANS}" font-size="12" letter-spacing="1" fill="#6F817C">BY ${xml(name.toUpperCase())}</text>
    <text x="820" y="616" text-anchor="end" font-family="${SERIF}" font-size="13" font-weight="700" fill="#174A46">책도장 · chaekdojang.com</text>
  </svg>`;
}

export async function aiReadingCardPng(card: AiReadingCardData) {
  let coverDataUrl = "";
  if (card.bookThumbnail) {
    try {
      const response = await fetch(`/image-proxy?url=${encodeURIComponent(card.bookThumbnail)}`);
      if (response.ok) {
        const blob = await response.blob();
        coverDataUrl = await blobToDataUrl(blob);
      }
    } catch {
      coverDataUrl = "";
    }
  }

  const svg = renderAiReadingCardSvg(card, coverDataUrl);
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("card image render failed"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH * 2;
    canvas.height = HEIGHT * 2;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("cover read failed"));
    reader.readAsDataURL(blob);
  });
}
