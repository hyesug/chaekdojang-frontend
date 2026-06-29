export type AiReadingCardData = {
  bookTitle: string;
  bookAuthor?: string | null;
  bookThumbnail?: string | null;
  authorName?: string | null;
  authorNickname: string;
  oneLineReview: string;
  emotionKeywords: string[];
  recommendedFor: string;
  impressivePoint?: string | null;
};

export const sampleAiReadingCard: AiReadingCardData = {
  bookTitle: "데미안",
  bookAuthor: "헤르만 헤세",
  bookThumbnail: null,
  authorName: "책도장 독자",
  authorNickname: "책도장 독자",
  oneLineReview: "나를 깨뜨리고 나아가는 성장의 기록",
  emotionKeywords: ["성장", "불안", "해방", "자기발견"],
  recommendedFor: "자기만의 길을 찾고 싶은 사람",
  impressivePoint: "익숙한 세계를 벗어나는 일이 왜 두렵고도 필요한지 보여준다.",
};
