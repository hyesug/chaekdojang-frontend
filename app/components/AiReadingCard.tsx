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
      className={`relative h-auto min-h-0 overflow-hidden rounded-lg text-[#102A2C] shadow-md ${
        compact ? "max-w-[360px]" : "w-full max-w-[520px]"
      }`}
      style={{ background: "#E3ECE7" }}
    >
      <div className="w-full" role="img" aria-label={`${card.bookTitle} AI 독서카드`} dangerouslySetInnerHTML={{ __html: renderAiReadingCardSvg(card) }} />
    </div>
  );
}
