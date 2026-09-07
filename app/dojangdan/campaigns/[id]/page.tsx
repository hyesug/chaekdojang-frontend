import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BackButton from "../../../components/BackButton";
import { fetchApiData, fetchAuthenticatedApiData, SITE_URL } from "../../../lib/serverApi";
import { STATUS_LABEL, formatDate, type CampaignDetail } from "../../types";
import CampaignApplyPanel from "./CampaignApplyPanel";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const detail = await fetchApiData<CampaignDetail>(`/api/dojangdan/campaigns/${id}`, {
    cache: "no-store",
  });
  if (!detail) return { title: "책도장단 - 책도장" };

  const title = `${detail.campaign.title} - 책도장단`;
  const description = `${detail.campaign.bookTitle} 서평단을 ${detail.campaign.recruitCount}명 모집합니다.`;
  return {
    title,
    description,
    alternates: { canonical: `/dojangdan/campaigns/${id}` },
    openGraph: { title, description, url: `${SITE_URL}/dojangdan/campaigns/${id}`, siteName: "책도장" },
  };
}

export default async function CampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const detail = await fetchAuthenticatedApiData<CampaignDetail>(
    `/api/dojangdan/campaigns/${id}`
  );
  if (!detail) notFound();

  const { campaign } = detail;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <BackButton fallbackHref="/dojangdan/campaigns" />

      <section className="mt-4 rounded-3xl border border-cream-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-cream-100 px-2.5 py-0.5 text-xs font-semibold text-brown-600">
            {STATUS_LABEL[campaign.status]}
          </span>
          <Link
            href={`/profiles/${campaign.profileSlug}`}
            className="text-xs text-brown-400 hover:text-brown-600"
          >
            {campaign.profileName}
          </Link>
        </div>
        <h1 className="mt-3 font-serif text-2xl font-bold leading-snug text-brown-900">
          {campaign.title}
        </h1>

        <div className="mt-5 flex gap-4 rounded-2xl bg-cream-50 p-4">
          {campaign.bookThumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={campaign.bookThumbnail}
              alt={campaign.bookTitle}
              className="h-28 w-20 flex-shrink-0 rounded object-cover"
            />
          ) : (
            <div className="h-28 w-20 flex-shrink-0 rounded bg-cream-100" />
          )}
          <div className="min-w-0">
            <p className="font-serif text-lg font-bold text-brown-900">{campaign.bookTitle}</p>
            <p className="text-sm text-brown-500">{campaign.bookAuthor}</p>
            <Link
              href={`/books/${campaign.bookId}`}
              className="mt-2 inline-flex text-xs font-semibold text-brown-600 underline"
            >
              책 정보 보기
            </Link>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="모집 인원" value={`${campaign.recruitCount}명`} />
          <Stat label="신청" value={`${campaign.applicantCount}명`} />
          <Stat label="모집 마감" value={formatDate(campaign.recruitEndAt)} />
          <Stat label="독후감 마감" value={formatDate(campaign.reviewDueAt)} />
        </dl>
      </section>

      {detail.description && (
        <section className="mt-6 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-900">모집 안내</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-brown-600">
            {detail.description}
          </p>
        </section>
      )}

      <CampaignApplyPanel
        campaignId={campaign.id}
        profileName={campaign.profileName}
        acceptingApplications={detail.acceptingApplications}
        priorityWindow={detail.priorityWindow}
        canApplyNow={detail.canApplyNow}
        initialStatus={detail.myApplicationStatus}
      />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-cream-50 px-3 py-2">
      <dt className="text-xs text-brown-400">{label}</dt>
      <dd className="mt-0.5 font-semibold text-brown-800">{value}</dd>
    </div>
  );
}
