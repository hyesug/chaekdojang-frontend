import type { AiReadingCardData } from "../lib/aiReadingCard";
import { renderAiReadingCardSvg } from "../lib/aiReadingCardSvg";

export default function AiReadingCard({
  card,
  compact = false,
}: {
  card: AiReadingCardData;
  compact?: boolean;
  exportSize?: boolean;
}) {
  return (
    <div
      data-ai-reading-card
      className={`relative h-auto min-h-0 overflow-hidden rounded-lg border border-cream-300 bg-cream-50 text-[#102A2C] ${
        compact ? "w-full max-w-[360px]" : "w-full max-w-[520px]"
      }`}
    >
      {/* SVG 에 박힌 900×640 은 이미지 저장용 크기라, 화면에서는 틀 너비에 맞춰 줄인다. */}
      <div className="w-full [&>svg]:block [&>svg]:h-auto [&>svg]:w-full" role="img" aria-label={`${card.bookTitle} AI 독서카드`} dangerouslySetInnerHTML={{ __html: renderAiReadingCardSvg(card) }} />
    </div>
  );
}
