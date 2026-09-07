export type CampaignStatus = "DRAFT" | "RECRUITING" | "CLOSED" | "SELECTED" | "COMPLETED";

export type CampaignDeliveryType = "PHYSICAL" | "PDF" | "EPUB";

export type CampaignApplicationStatus =
  | "APPLIED"
  | "SELECTED"
  | "REJECTED"
  | "SUBMITTED"
  | "DROPPED";

export type CampaignSummary = {
  id: number;
  title: string;
  status: CampaignStatus;
  recruitCount: number;
  applicantCount: number;
  bookId: number;
  bookTitle: string;
  bookAuthor: string;
  bookThumbnail: string | null;
  profileId: number;
  profileName: string;
  profileSlug: string;
  recruitStartAt: string;
  recruitEndAt: string;
  reviewDueAt: string;
  priorityInviteHours: number;
  priorityInviteUntil: string | null;
  deliveryType: CampaignDeliveryType;
  ebookAccessExtraDays: number;
};

export type CampaignDetail = {
  campaign: CampaignSummary;
  description: string | null;
  acceptingApplications: boolean;
  priorityWindow: boolean;
  canApplyNow: boolean;
  myApplicationStatus: CampaignApplicationStatus | null;
  myApplicationId: number | null;
};

export type MyCampaignApplication = {
  id: number;
  campaignId: number;
  campaignTitle: string;
  bookId: number;
  bookTitle: string;
  bookThumbnail: string | null;
  profileId: number;
  profileName: string;
  status: CampaignApplicationStatus;
  appliedAt: string;
  selectedAt: string | null;
  submittedAt: string | null;
  reviewDueAt: string;
  reviewId: number | null;
};

export type ReaderTrackRecord = {
  appliedCount: number;
  selectedCount: number;
  submittedCount: number;
  completionRate: number | null;
  averageReviewLength: number | null;
  averageDaysToSubmit: number | null;
  onTimeRate: number | null;
};

export type SubmittableReview = {
  id: number;
  excerpt: string;
  length: number;
  rating: number;
  createdAt: string;
};

export type CampaignApplicant = {
  applicationId: number;
  userId: number;
  nickname: string;
  profileImage: string | null;
  message: string | null;
  status: CampaignApplicationStatus;
  appliedAt: string;
  selectedAt: string | null;
  submittedAt: string | null;
  reviewId: number | null;
  reviewLength: number | null;
  trackRecord: ReaderTrackRecord;
  ebookOpenCount: number | null;
  ebookFirstOpenedAt: string | null;
  ebookExpiresAt: string | null;
};

export type ManagedProfile = {
  id: number;
  displayName: string;
  slug: string;
  type: "AUTHOR" | "PUBLISHER" | "BOOKSTORE";
  verified: boolean;
};

export type ManageCampaignDetail = {
  campaign: CampaignSummary;
  description: string | null;
  appliedCount: number;
  selectedCount: number;
  submittedCount: number;
  rejectedCount: number;
  consentedReviewCount: number;
  completionRate: number | null;
};

export type ConsentDisplayNameType = "REAL_NICKNAME" | "ANONYMOUS";

export type ReviewUsageConsent = {
  id: number;
  applicationId: number;
  consentPromotional: boolean;
  consentExcerpt: boolean;
  displayNameType: ConsentDisplayNameType;
  termsVersion: string;
  consentedAt: string;
  revokedAt: string | null;
};

export type MyFollowIntent = {
  profileId: number;
  profileName: string;
  profileSlug: string;
  createdAt: string;
};

export type ProfileAudience = {
  profileId: number;
  profileName: string;
  interestedReaderCount: number;
  campaignExperiencedCount: number;
  topCategories: Array<{ category: string; count: number }>;
};

export type CampaignReviewSummary = {
  applicationId: number;
  reviewId: number;
  displayName: string;
  consentPromotional: boolean;
  consentExcerpt: boolean;
  reviewLength: number;
  submittedAt: string;
  reviewUrl: string;
  content: string | null;
};

export type EbookFile = {
  id: number;
  originalFilename: string;
  byteSize: number;
  pageCount: number | null;
  uploadedAt: string;
};

export type MyEbookAccess = {
  grantId: number;
  grantedAt: string;
  expiresAt: string;
  readable: boolean;
  expired: boolean;
  revoked: boolean;
  openCount: number;
  firstOpenedAt: string | null;
  originalFilename: string | null;
  pageCount: number | null;
  byteSize: number | null;
};

export const DELIVERY_TYPE_LABEL: Record<CampaignDeliveryType, string> = {
  PHYSICAL: "실물 도서",
  PDF: "PDF",
  EPUB: "EPUB",
};

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: "작성 중",
  RECRUITING: "모집 중",
  CLOSED: "모집 마감",
  SELECTED: "독후감 작성 기간",
  COMPLETED: "종료",
};

export const APPLICATION_STATUS_LABEL: Record<CampaignApplicationStatus, string> = {
  APPLIED: "신청 완료",
  SELECTED: "선정",
  REJECTED: "미선정",
  SUBMITTED: "독후감 제출",
  DROPPED: "중도 포기",
};

export function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate()
  ).padStart(2, "0")}`;
}
