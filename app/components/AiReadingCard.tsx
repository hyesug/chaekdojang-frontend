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
  const bookAuthor = card.bookAuthor?.trim() || "저자 미상";

  return (
    <div
      data-ai-reading-card
      className={`relative aspect-square w-full overflow-hidden rounded-md border border-[#e6d8c7] bg-[#fffaf4] text-[#2b1a10] ${
        compact ? "max-w-[360px] p-6" : "max-w-[520px] p-8 sm:p-10"
      }`}
    >
      <div className="absolute right-7 top-7 flex h-12 w-12 items-center justify-center rounded-full border border-[#b58f73] font-serif text-base font-bold text-[#8b6349]">
        冊
      </div>

      <div className="flex h-full flex-col">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#9f7b63] sm:text-[10px]">
            CHAEKDOJANG
          </p>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-[#b99c86] sm:text-[10px]">
            AI READING CARD
          </p>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <p className="line-clamp-4 pr-8 font-serif text-[2rem] font-bold leading-snug text-[#2b1a10] sm:text-[2.55rem]">
            {sentence}
          </p>
          <span className="mt-4 h-px w-12 bg-[#8b6349]" />
        </div>

        <div className="grid grid-cols-[70px_1fr] gap-4 sm:grid-cols-[82px_1fr] sm:gap-5">
          {card.bookThumbnail ? (
            <img
              src={card.bookThumbnail}
              alt={card.bookTitle}
              className="h-[98px] w-[70px] rounded object-cover shadow-sm sm:h-[116px] sm:w-[82px]"
            />
          ) : (
            <div className="flex h-[98px] w-[70px] items-end justify-center rounded bg-[#d8bea3] pb-2 font-serif text-lg font-bold text-white shadow-sm sm:h-[116px] sm:w-[82px]">
              책
            </div>
          )}

          <div className="min-w-0 self-center">
            <h3 className="line-clamp-2 font-serif text-base font-bold leading-snug text-[#2b1a10] sm:text-lg">
              {card.bookTitle}
            </h3>
            <p className="mt-1 truncate text-xs text-[#8c6047] sm:text-sm">{bookAuthor}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full bg-[#eadfce] px-2.5 py-1 text-[10px] text-[#6f5949] sm:text-[11px]"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 text-[11px] uppercase tracking-[0.08em] text-[#7f6048] sm:text-xs">
          <span className="block max-w-[70%] truncate">BY {name}</span>
        </div>
      </div>
    </div>
  );
}
