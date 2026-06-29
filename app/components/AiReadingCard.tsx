import type { AiReadingCardData } from "../lib/aiReadingCard";

export default function AiReadingCard({
  card,
  compact = false,
  exportSize = false,
}: {
  card: AiReadingCardData;
  compact?: boolean;
  exportSize?: boolean;
}) {
  return (
    <div
      data-ai-reading-card
      className={`relative overflow-hidden rounded-lg border border-cream-200 bg-[#fffaf0] text-brown-900 shadow-sm ${
        exportSize ? "h-[1080px] w-[1080px] p-20" : compact ? "p-4" : "aspect-square w-full max-w-[520px] p-8"
      }`}
    >
      <div className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-full border-2 border-red-300 text-sm font-bold text-red-500 opacity-80">
        冊
      </div>

      <div className="flex h-full flex-col">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brown-300">
          Chaekdojang AI Reading Card
        </p>
        <h3 className={`mt-3 font-serif font-bold leading-tight ${exportSize ? "text-7xl" : compact ? "text-xl" : "text-4xl"}`}>
          {card.bookTitle}
        </h3>

        <p className={`mt-6 font-serif font-bold leading-snug text-brown-800 ${exportSize ? "text-6xl" : compact ? "text-lg" : "text-3xl"}`}>
          “{card.oneLineReview}”
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {card.emotionKeywords.slice(0, 5).map((keyword) => (
            <span
              key={keyword}
              className={`rounded-full border border-brown-200 bg-white/75 text-brown-600 ${exportSize ? "px-5 py-2 text-2xl" : "px-3 py-1 text-sm"}`}
            >
              {keyword}
            </span>
          ))}
        </div>

        <div className={`mt-6 grid gap-4 ${compact ? "" : "sm:grid-cols-2"}`}>
          <div>
            <p className="text-xs font-semibold text-brown-300">추천 대상</p>
            <p className={`mt-1 font-medium text-brown-700 ${exportSize ? "text-3xl" : "text-sm"}`}>{card.recommendedFor}</p>
          </div>
          {card.impressivePoint && (
            <div>
              <p className="text-xs font-semibold text-brown-300">인상 깊은 지점</p>
              <p className={`mt-1 text-brown-600 ${exportSize ? "text-2xl leading-9" : "text-sm leading-5"}`}>{card.impressivePoint}</p>
            </div>
          )}
        </div>

        <div className={`mt-auto flex items-end justify-between pt-6 text-brown-400 ${exportSize ? "text-2xl" : "text-xs"}`}>
          <span>by {card.authorNickname}</span>
          <span className={`font-serif font-bold text-brown-700 ${exportSize ? "text-3xl" : "text-base"}`}>책도장 · chaekdojang.com</span>
        </div>
      </div>
    </div>
  );
}
