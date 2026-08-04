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
      className={`relative overflow-hidden rounded-2xl text-[#1a0f07] shadow-md ${
        compact ? "max-w-[360px]" : "aspect-square w-full max-w-[520px]"
      }`}
      style={{ background: "linear-gradient(145deg, #fdf6f0 0%, #f5e8d4 60%, #ede0cc 100%)" }}
    >
      <span
        className="pointer-events-none absolute left-2 top-0 select-none font-serif font-bold leading-none text-[#c47f56]"
        style={{ fontSize: compact ? "100px" : "200px", opacity: 0.08 }}
        aria-hidden
      >
        &ldquo;
      </span>

      <div className={`relative flex h-full flex-col ${compact ? "p-5" : "p-7 sm:p-8"}`}>
        <div className="flex items-start justify-between">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#c47f56]">AI Reading Card</p>
          <p className="text-[9px] text-[#b8956d]">chaekdojang</p>
        </div>

        <p className={`mt-1 font-serif font-bold leading-tight text-[#1a0f07] ${compact ? "text-sm" : "text-base"}`}>
          {card.bookTitle}
        </p>

        <div className={`bg-[#c47f56] opacity-60 ${compact ? "my-2 h-0.5 w-6" : "my-3 h-0.5 w-8"}`} />

        <div className="flex-1">
          <p className={`font-serif font-bold leading-snug text-[#1a0f07] ${compact ? "text-xl" : "text-[2rem] sm:text-[2.4rem]"}`}>
            {sentence}
          </p>
        </div>

        <div className={`flex flex-wrap gap-1.5 ${compact ? "mt-2" : "mt-3"}`}>
          {keywords.map((keyword) => (
            <span
              key={keyword}
              className="rounded-full border border-[#d4a87c] bg-white/60 px-2.5 py-0.5 text-[10px] font-medium text-[#7a5a42]"
            >
              {keyword}
            </span>
          ))}
        </div>

        <div className={`border-t border-[#e2cdb5] ${compact ? "mt-2 pt-2" : "mt-3 pt-3"}`}>
          {!compact && (
            <div className="mb-2 grid grid-cols-2 gap-3">
              {card.recommendedFor && (
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-widest text-[#c47f56]">추천 대상</p>
                  <p className="mt-0.5 text-[10px] text-[#5c3d28]">{card.recommendedFor}</p>
                </div>
              )}
              {card.impressivePoint && (
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-widest text-[#c47f56]">인상적인 구절</p>
                  <p className="mt-0.5 text-[10px] text-[#5c3d28]">{card.impressivePoint}</p>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-[0.08em] text-[#b8956d]">BY {name}</span>
            <span className="font-serif text-[9px] font-bold text-[#7a5a42]">책도장 · chaekdojang.com</span>
          </div>
        </div>
      </div>
    </div>
  );
}
