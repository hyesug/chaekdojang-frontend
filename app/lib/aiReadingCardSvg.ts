import type { AiReadingCardData } from "./aiReadingCard";

// 화면 카드와 저장 이미지가 같은 SVG 를 쓴다. 색은 app/globals.css 청록 잉크 아카이브 토큰과 같은 값이다.
const COLOR = {
  paper: "#FCFBF7",
  primary: "#174A46",
  primarySoft: "#E3ECE7",
  ink: "#102A2C",
  text: "#182321",
  muted: "#56706A",
  subtle: "#6F817C",
  border: "#DCDDD3",
  borderStrong: "#B9C2B9",
  accent: "#8B3040",
  star: "#B07A1E",
};
const WIDTH = 900;
const PAD = 72;
const CONTENT = WIDTH - PAD * 2;
const SANS = "'Pretendard Variable', Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
const SERIF = "'Noto Serif KR', 'Nanum Myeongjo', AppleMyungjo, serif";

// 한 줄 감상은 길이에 따라 글자를 줄여 가며 다 들어가는 크기를 고른다.
const HERO_SIZES = [
  { size: 42, lineHeight: 58, maxLines: 3 },
  { size: 36, lineHeight: 50, maxLines: 4 },
  { size: 30, lineHeight: 42, maxLines: 5 },
];

function xml(value: string | number | null | undefined) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

// 한글·한자는 글자 크기(1em)만큼, 공백·영문·숫자는 그보다 좁게 잡아 줄 폭을 어림한다.
function charWidth(character: string) {
  if (character === " ") return 0.3;
  return /[ᄀ-ᇿ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(character) ? 1 : 0.6;
}

function textWidth(value: string) {
  return Array.from(value).reduce((sum, character) => sum + charWidth(character), 0);
}

// maxWidth 는 글자 크기 기준 폭(em). 띄어쓰기에서 먼저 줄을 바꾸고, 한 단어가 너무 길 때만 글자 단위로 자른다.
function lines(value: string, maxWidth: number, maxLines: number) {
  const result: string[] = [];
  let line = "";
  let width = 0;
  for (const word of value.trim().split(/\s+/).filter(Boolean)) {
    const wordWidth = textWidth(word);
    if (line && width + charWidth(" ") + wordWidth <= maxWidth) {
      line += ` ${word}`;
      width += charWidth(" ") + wordWidth;
      continue;
    }
    if (line) result.push(line);
    line = "";
    width = 0;
    for (const character of Array.from(word)) {
      if (line && width + charWidth(character) > maxWidth) {
        result.push(line);
        line = "";
        width = 0;
      }
      line += character;
      width += charWidth(character);
    }
  }
  if (line) result.push(line);
  if (result.length <= maxLines) return result;
  const kept = result.slice(0, maxLines);
  let last = Array.from(kept[maxLines - 1]);
  while (last.length > 0 && textWidth(`${last.join("")}…`) > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.join("").trimEnd()}…`;
  return kept;
}

function textLines(values: string[], x: number, y: number, lineHeight: number, attributes: string) {
  return values
    .map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" ${attributes}>${xml(line)}</text>`)
    .join("");
}

// 한 화면에 카드가 여러 장 있어도 표지 clipPath id 가 겹치지 않게 내용으로 id 를 만든다.
function hashId(value: string) {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return (hash >>> 0).toString(36);
}

function buildAiReadingCardSvg(card: AiReadingCardData, coverSrc: string) {
  const parts: string[] = [];

  // 머리: 작성자 서명 + 책도장 로고(app/icon.svg 의 동그라미 冊 도장)
  const headerY = 92;
  const name = (card.authorName || card.authorNickname || "책도장 독자").trim() || "책도장 독자";
  parts.push(`<text x="${PAD}" y="${headerY}" font-family="${SANS}" font-size="11" font-weight="700" letter-spacing="2" fill="${COLOR.subtle}">BY</text>`);
  parts.push(textLines(lines(name, (CONTENT - 260) / 16, 1), PAD + 26, headerY, 0, `font-family="${SERIF}" font-size="16" font-weight="700" letter-spacing="-0.2" fill="${COLOR.ink}"`));
  const markSize = 34;
  const markX = WIDTH - PAD - markSize;
  parts.push(`<text x="${markX - 12}" y="${headerY}" text-anchor="end" font-family="${SANS}" font-size="14" letter-spacing="1" fill="${COLOR.subtle}">chaekdojang.com</text>`);
  parts.push(`<g transform="translate(${markX} ${headerY - 5 - markSize / 2}) scale(${markSize / 512})"><g transform="rotate(-9 256 256)"><circle cx="256" cy="256" r="184" fill="none" stroke="#8B1E1E" stroke-width="34"/><text x="256" y="319" text-anchor="middle" font-family="Noto Serif KR, Nanum Myeongjo, Batang, serif" font-size="198" font-weight="800" fill="#8B1E1E">冊</text></g></g>`);

  // 책 정보: 표지 + 제목·저자·별점
  const cover = { x: PAD, y: 132, width: 112, height: 162 };
  const clipId = `cdj-cover-${hashId(`${card.bookTitle}|${card.authorNickname}|${card.oneLineReview}`)}`;
  const coverRect = `x="${cover.x}" y="${cover.y}" width="${cover.width}" height="${cover.height}" rx="4"`;
  parts.push(`<rect ${coverRect} fill="${COLOR.primarySoft}"/>`);
  parts.push(coverSrc
    ? `<image href="${xml(coverSrc)}" x="${cover.x}" y="${cover.y}" width="${cover.width}" height="${cover.height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
    : `<text x="${cover.x + cover.width / 2}" y="${cover.y + cover.height / 2 + 6}" text-anchor="middle" font-family="${SERIF}" font-size="17" fill="${COLOR.muted}">표지</text>`);
  parts.push(`<rect ${coverRect} fill="none" stroke="${COLOR.border}" stroke-width="1.5"/>`);

  const infoX = cover.x + cover.width + 36;
  const infoWidth = WIDTH - PAD - infoX;
  const titleLines = lines(card.bookTitle || "제목 없음", infoWidth / 34, 2);
  parts.push(textLines(titleLines, infoX, 160, 44, `font-family="${SERIF}" font-size="34" font-weight="700" letter-spacing="-0.8" fill="${COLOR.ink}"`));
  let infoY = 160 + (titleLines.length - 1) * 44;
  if (card.bookAuthor?.trim()) {
    infoY += 42;
    parts.push(textLines(lines(card.bookAuthor, infoWidth / 20, 1), infoX, infoY, 0, `font-family="${SANS}" font-size="20" fill="${COLOR.muted}"`));
  }
  if (card.rating != null) {
    const filled = Math.min(5, Math.max(0, Math.round(card.rating)));
    infoY += 40;
    parts.push(`<text x="${infoX}" y="${infoY}" font-family="${SANS}" font-size="20"><tspan letter-spacing="2" fill="${COLOR.star}">${"★".repeat(filled)}${"☆".repeat(5 - filled)}</tspan><tspan dx="10" fill="${COLOR.muted}">${card.rating.toFixed(1)}</tspan></text>`);
  }
  const ruleY = Math.max(cover.y + cover.height, infoY + 10) + 40;
  parts.push(`<line x1="${PAD}" y1="${ruleY}" x2="${WIDTH - PAD}" y2="${ruleY}" stroke="${COLOR.borderStrong}" stroke-width="1.5"/>`);

  // 한 줄 감상: 사이트 인용문(.cdj-quote)처럼 와인색 세로줄 + 명조
  const heroText = card.oneLineReview?.trim() || "이 책을 읽고 생각이 조금 달라졌다.";
  const heroX = PAD + 28;
  const hero = HERO_SIZES.find(({ size, maxLines }) => lines(heroText, (CONTENT - 28) / size, maxLines + 1).length <= maxLines) ?? HERO_SIZES[HERO_SIZES.length - 1];
  const heroLines = lines(heroText, (CONTENT - 28) / hero.size, hero.maxLines);
  const heroTop = ruleY + 44;
  const heroBaseline = heroTop + Math.round(hero.size * 0.8);
  const heroBottom = heroBaseline + (heroLines.length - 1) * hero.lineHeight + Math.round(hero.size * 0.28);
  parts.push(`<rect x="${PAD}" y="${heroTop - 2}" width="4" height="${heroBottom - heroTop + 2}" fill="${COLOR.accent}"/>`);
  parts.push(textLines(heroLines, heroX, heroBaseline, hero.lineHeight, `font-family="${SERIF}" font-size="${hero.size}" font-weight="700" letter-spacing="${(-hero.size * 0.025).toFixed(2)}" fill="${COLOR.ink}"`));
  let cursor = heroBottom;

  // 감정 키워드: 작은 태그만 알약 모양
  const keywords = (card.emotionKeywords ?? []).map((keyword) => keyword.trim()).filter(Boolean).slice(0, 5);
  if (keywords.length > 0) {
    let chipX = PAD;
    let chipY = cursor + 36;
    for (const keyword of keywords) {
      const width = Math.ceil(textWidth(keyword) * 18) + 40;
      if (chipX > PAD && chipX + width > WIDTH - PAD) {
        chipX = PAD;
        chipY += 50;
      }
      parts.push(`<rect x="${chipX}" y="${chipY}" width="${width}" height="40" rx="20" fill="${COLOR.primarySoft}"/><text x="${chipX + width / 2}" y="${chipY + 26}" text-anchor="middle" font-family="${SANS}" font-size="18" font-weight="600" fill="${COLOR.primary}">${xml(keyword)}</text>`);
      chipX += width + 10;
    }
    cursor = chipY + 40;
  }

  // 추천 대상 · 고른 구절: 둘 다 있으면 두 칸, 하나면 한 칸 전체
  const details: { label: string; value: string; font: string; maxLines: number }[] = [];
  if (card.recommendedFor?.trim()) details.push({ label: "추천 대상", value: card.recommendedFor.trim(), font: SANS, maxLines: 3 });
  if (card.impressivePoint?.trim()) details.push({ label: "내 독후감에서 고른 구절", value: `“${card.impressivePoint.trim()}”`, font: SERIF, maxLines: 4 });
  if (details.length > 0) {
    const top = cursor + 52;
    const gap = 48;
    const columnWidth = details.length === 2 ? (CONTENT - gap) / 2 : CONTENT;
    let bottom = top;
    details.forEach((detail, index) => {
      const x = PAD + index * (columnWidth + gap);
      const bodyLines = lines(detail.value, columnWidth / 21, detail.maxLines);
      parts.push(`<text x="${x}" y="${top + 16}" font-family="${SANS}" font-size="16" font-weight="700" letter-spacing="1" fill="${COLOR.muted}">${detail.label}</text>`);
      parts.push(textLines(bodyLines, x, top + 54, 33, `font-family="${detail.font}" font-size="21" fill="${COLOR.text}"`));
      bottom = Math.max(bottom, top + 54 + (bodyLines.length - 1) * 33 + 8);
    });
    cursor = bottom;
  }

  const height = cursor + 72;
  // body 의 자간·글꼴 기능이 화면 카드에만 상속되지 않도록 svg 에서 초기화한다.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" style="letter-spacing:0;font-feature-settings:normal;font-weight:400">
    <defs><clipPath id="${clipId}"><rect ${coverRect}/></clipPath></defs>
    <rect width="${WIDTH}" height="${height}" fill="${COLOR.paper}"/>
    <rect x="24" y="24" width="${WIDTH - 48}" height="${height - 48}" rx="6" fill="none" stroke="${COLOR.border}" stroke-width="1.5"/>
    ${parts.join("\n    ")}
  </svg>`;
  return { svg, height };
}

export function renderAiReadingCardSvg(card: AiReadingCardData, coverSrc = card.bookThumbnail ?? "") {
  return buildAiReadingCardSvg(card, coverSrc).svg;
}

export async function aiReadingCardPng(card: AiReadingCardData) {
  let coverDataUrl = "";
  if (card.bookThumbnail) {
    try {
      const response = await fetch(`/image-proxy?url=${encodeURIComponent(card.bookThumbnail)}`, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const blob = await response.blob();
        coverDataUrl = await blobToDataUrl(blob);
      }
    } catch {
      coverDataUrl = "";
    }
  }

  const { svg, height } = buildAiReadingCardSvg(card, coverDataUrl);
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
    canvas.height = height * 2;
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
