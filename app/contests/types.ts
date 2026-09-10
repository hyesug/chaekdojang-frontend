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
  acceptingEntries: boolean;
  submitClosed: boolean;
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

/**
 * 독자에게 보여줄 상태 이름.
 * 주최자가 마감 처리를 하지 않아도 접수 기간이 지났으면 '접수 마감'으로 보여준다.
 * 시각 비교는 서버(한국 시간)가 이미 해서 내려주므로 여기서 다시 계산하지 않는다.
 */
export function contestStatusLabel(contest: ContestSummary) {
  if (contest.status !== "OPEN") return CONTEST_STATUS_LABEL[contest.status];
  if (contest.acceptingEntries) return "접수 중";
  return contest.submitClosed ? "접수 마감" : "접수 예정";
}

/** 책도장이 직접 주최하면 이름과 유형 이름이 같아 중복으로 보이므로 유형을 뺀다. */
export function hostLabel(name: string, type: HostProfileType) {
  const label = HOST_TYPE_LABEL[type];
  return label === name ? name : `${name} · ${label}`;
}

/** 지정 도서가 없으면 자유주제 공모전이다. */
export function topicLabel(contest: ContestSummary) {
  if (contest.books.length === 0) return "자유주제";
  if (contest.books.length === 1) return contest.books[0].title;
  return `${contest.books[0].title} 외 ${contest.books.length - 1}권`;
}
