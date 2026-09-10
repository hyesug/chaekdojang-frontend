export type ContestStatus = "DRAFT" | "OPEN" | "CLOSED" | "ANNOUNCED";

export type ContestEntryType = "REVIEW" | "TEXT";

export type ContestEntryStatus = "SUBMITTED" | "WITHDRAWN" | "AWARDED" | "NOT_AWARDED";

export type HostProfileType = "AUTHOR" | "PUBLISHER" | "BOOKSTORE" | "LIBRARY" | "PLATFORM";

export type ContestBook = {
  bookId: number;
  title: string;
  author: string;
  thumbnail: string | null;
};

export type ContestSummary = {
  id: number;
  title: string;
  status: ContestStatus;
  entryType: ContestEntryType;
  hostProfileId: number;
  hostName: string;
  hostSlug: string;
  hostType: HostProfileType;
  platformHosted: boolean;
  submitStartAt: string;
  submitEndAt: string;
  announceAt: string;
  entryCount: number;
  books: ContestBook[];
};

export type MyContestEntry = {
  id: number;
  contestId: number;
  contestTitle: string;
  hostName: string;
  contestStatus: ContestStatus;
  entryType: ContestEntryType;
  status: ContestEntryStatus;
  entryTitle: string | null;
  bookId: number | null;
  bookTitle: string | null;
  reviewId: number | null;
  awardRank: number | null;
  awardName: string | null;
  submittedAt: string;
  submitEndAt: string;
  announceAt: string;
};

export type ContestAward = {
  entryId: number;
  awardRank: number | null;
  awardName: string | null;
  nickname: string;
  entryTitle: string | null;
  bookTitle: string | null;
  reviewId: number | null;
  content: string | null;
};

export type ContestDetail = {
  contest: ContestSummary;
  description: string | null;
  prizeDescription: string | null;
  acceptingEntries: boolean;
  myEntry: MyContestEntry | null;
  awards: ContestAward[];
};

export type ContestSubmittableReview = {
  reviewId: number;
  bookId: number | null;
  bookTitle: string | null;
  excerpt: string;
  length: number;
  rating: number;
  createdAt: string;
};

export type ContestEntry = {
  entryId: number;
  userId: number;
  nickname: string;
  profileImage: string | null;
  status: ContestEntryStatus;
  submittedAt: string;
  bookId: number | null;
  bookTitle: string | null;
  entryTitle: string | null;
  content: string | null;
  contentLength: number;
  reviewId: number | null;
  reviewDeleted: boolean;
  awardRank: number | null;
  awardName: string | null;
};

export type HostProfile = {
  id: number;
  displayName: string;
  slug: string;
  type: HostProfileType;
  verified: boolean;
  platform: boolean;
};

export type ManageContestDetail = {
  contest: ContestSummary;
  description: string | null;
  prizeDescription: string | null;
  entryCount: number;
  awardedCount: number;
  notAwardedCount: number;
  withdrawnCount: number;
};

export const CONTEST_STATUS_LABEL: Record<ContestStatus, string> = {
  DRAFT: "작성 중",
  OPEN: "접수 중",
  CLOSED: "심사 중",
  ANNOUNCED: "발표 완료",
};

export const ENTRY_TYPE_LABEL: Record<ContestEntryType, string> = {
  REVIEW: "독후감 연결",
  TEXT: "전용 글 작성",
};

export const ENTRY_STATUS_LABEL: Record<ContestEntryStatus, string> = {
  SUBMITTED: "응모 완료",
  WITHDRAWN: "응모 취소",
  AWARDED: "수상",
  NOT_AWARDED: "미수상",
};

export const HOST_TYPE_LABEL: Record<HostProfileType, string> = {
  AUTHOR: "작가",
  PUBLISHER: "출판사",
  BOOKSTORE: "서점",
  LIBRARY: "도서관",
  PLATFORM: "책도장",
};

export function formatDateTime(value: string | null) {
  if (!value) return "-";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}.${match[2]}.${match[3]} ${match[4]}:${match[5]}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

/** 지정 도서가 없으면 자유주제 공모전이다. */
export function topicLabel(contest: ContestSummary) {
  if (contest.books.length === 0) return "자유주제";
  if (contest.books.length === 1) return contest.books[0].title;
  return `${contest.books[0].title} 외 ${contest.books.length - 1}권`;
}
