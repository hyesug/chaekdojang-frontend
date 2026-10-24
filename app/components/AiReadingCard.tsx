import type { AiReadingCardData } from "../lib/aiReadingCard";

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

export default function AiReadingCard({
  card,
  compact = false,
}: {
  card: AiReadingCardData;
  compact?: boolean;
  exportSize?: boolean;
}) {
  const name = authorName(card);
  const sentence = mainSentence(card);
  const keywords = tags(card);

  return (
    <div
      data-ai-reading-card
      className={`relative overflow-hidden rounded-lg text-[#102A2C] shadow-md ${
        compact ? "max-w-[360px]" : "aspect-square w-full max-w-[520px]"
      }`}
      style={{ background: "linear-gradient(145deg, #FCFBF7 0%, #E3ECE7 100%)" }}
    >
      <span
        className="pointer-events-none absolute left-2 top-0 select-none font-serif font-bold leading-none text-[#174A46]"
        style={{ fontSize: compact ? "80px" : "140px", opacity: 0.07 }}
        aria-hidden
      >
        &ldquo;
      </span>

      <div className={`relative flex h-full flex-col ${compact ? "p-5" : "p-7 sm:p-8"}`}>
        <div className="flex items-start justify-between">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#174A46]">AI Reading Card</p>
          <p className="text-[9px] text-[#6F817C]">chaekdojang</p>
        </div>

        <div className="mt-2 flex gap-3">
          {card.bookThumbnail && (
            <img src={card.bookThumbnail} alt="" className={`${compact ? "h-16 w-11" : "h-24 w-16"} shrink-0 rounded-sm object-cover shadow-sm`} />
          )}
          <div className="min-w-0">
            <p className={`font-serif font-bold leading-tight text-[#102A2C] ${compact ? "text-sm" : "text-base"}`}>{card.bookTitle}</p>
            {card.bookAuthor && <p className="mt-1 text-[10px] text-[#56706A]">{card.bookAuthor}</p>}
            {card.rating != null && <p className="mt-2 text-xs tracking-wide text-[#B07A1E]" aria-label={`별점 ${card.rating}점`}>{"★".repeat(Math.round(card.rating))}{"☆".repeat(5 - Math.round(card.rating))} <span className="text-[#56706A]">{card.rating.toFixed(1)}</span></p>}
          </div>
        </div>

        <div className={`bg-[#8B3040] opacity-70 ${compact ? "my-2 h-px w-6" : "my-3 h-px w-8"}`} />

        <div>
          <p className={`font-serif font-bold leading-snug text-[#102A2C] ${compact ? "text-base" : "text-xl sm:text-2xl"}`}>
            {sentence}
          </p>
        </div>

        <div className={`flex flex-wrap gap-1.5 ${compact ? "mt-2" : "mt-3"}`}>
          {keywords.map((keyword) => (
            <span
              key={keyword}
              className="rounded-sm border border-[#B9C2B9] bg-white/70 px-2 py-0.5 text-[10px] font-medium text-[#315F5A]"
            >
              {keyword}
            </span>
          ))}
        </div>

        <div className={`border-t border-[#B9C2B9] ${compact ? "mt-2 pt-2" : "mt-3 pt-3"}`}>
          {!compact && (
            <div className="mb-2 grid grid-cols-2 gap-3">
              {card.recommendedFor && (
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-widest text-[#56706A]">추천 대상</p>
                  <p className="mt-0.5 text-[10px] text-[#315F5A]">{card.recommendedFor}</p>
                </div>
              )}
              {card.impressivePoint && (
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-widest text-[#56706A]">내 독후감에서 고른 구절</p>
                  <p className="mt-0.5 text-[10px] text-[#315F5A]">“{card.impressivePoint}”</p>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-[0.08em] text-[#6F817C]">BY {name}</span>
            <span className="font-serif text-[9px] font-bold text-[#174A46]">책도장 · chaekdojang.com</span>
          </div>
        </div>
      </div>
    </div>
  );
}
