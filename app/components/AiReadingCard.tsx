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
      className={`relative aspect-square w-full overflow-hidden rounded-lg border border-[#eadbc7] bg-[#fffaf0] text-[#2f170b] ${
        compact ? "max-w-[360px] p-5" : "max-w-[520px] p-8 sm:p-10"
      }`}
    >
      <div className="absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-full border border-[#f3a5ad] font-serif text-lg font-bold text-[#e85f70]">
        冊
      </div>

      <div className="flex h-full flex-col">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a87455] sm:text-xs">
            CHAEKDOJANG
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b99074] sm:text-xs">
            AI READING CARD
          </p>
        </div>

        <div className="flex flex-1 items-center">
          <p className="line-clamp-4 pr-4 font-serif text-3xl font-bold leading-snug text-[#2f170b] sm:text-4xl">
            {sentence}
          </p>
        </div>

        <div className="grid grid-cols-[72px_1fr] gap-4 border-t border-[#eadbc7] pt-4 sm:grid-cols-[92px_1fr] sm:gap-5 sm:pt-5">
          {card.bookThumbnail ? (
            <img
              src={card.bookThumbnail}
              alt={card.bookTitle}
              className="h-24 w-[72px] rounded object-cover shadow-sm sm:h-32 sm:w-[92px]"
            />
          ) : (
            <div className="flex h-24 w-[72px] items-end justify-center rounded bg-[#d8bea3] pb-2 font-serif text-lg font-bold text-white shadow-sm sm:h-32 sm:w-[92px]">
              책
            </div>
          )}

          <div className="min-w-0">
            <h3 className="line-clamp-2 font-serif text-base font-bold leading-snug text-[#2f170b] sm:text-xl">
              {card.bookTitle}
            </h3>
            <p className="mt-1 truncate text-xs text-[#8c6047] sm:text-sm">{bookAuthor}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full border border-[#d9b999] bg-white/70 px-2.5 py-1 text-[11px] text-[#6b3b24] sm:text-xs"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3 text-[11px] text-[#9b6b4d] sm:text-xs">
          <span className="max-w-[45%] truncate">by {name}</span>
          <span className="font-serif font-bold text-[#2f170b]">책도장 · chaekdojang.com</span>
        </div>
      </div>
    </div>
  );
}
