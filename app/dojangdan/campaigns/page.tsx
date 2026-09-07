import Link from "next/link";
import { fetchApiData, SITE_URL } from "../../lib/serverApi";
import { STATUS_LABEL, formatDate, type CampaignSummary } from "../types";

export const metadata = {
  title: "책도장단 모집 - 책도장",
  description: "출판사·작가가 모집하는 서평단에 신청하고 독후감을 남겨보세요.",
  alternates: { canonical: "/dojangdan/campaigns" },
  openGraph: {
    title: "책도장단 모집 - 책도장",
    description: "출판사·작가가 모집하는 서평단에 신청하고 독후감을 남겨보세요.",
    url: `${SITE_URL}/dojangdan/campaigns`,
    siteName: "책도장",
  },
};

export const dynamic = "force-dynamic";

export default async function CampaignListPage() {
  const campaigns =
    (await fetchApiData<CampaignSummary[]>("/api/dojangdan/campaigns", {
      cache: "no-store",
    })) ?? [];

  const recruiting = campaigns.filter((campaign) => campaign.status === "RECRUITING");
  const others = campaigns.filter((campaign) => campaign.status !== "RECRUITING");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <section className="rounded-3xl border border-cream-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-brown-400">책도장단</p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-brown-900">
          지금 모집 중인 서평단
        </h1>
        <p className="mt-3 text-sm leading-6 text-brown-500">
          신청하고 선정되면 책을 받아 읽고, 독후감을 남깁니다. 남긴 독후감은 내 서재와 책 페이지에 그대로 쌓입니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/dojangdan/my"
            className="rounded-full border border-cream-200 px-4 py-2 text-sm font-semibold text-brown-700 hover:bg-cream-50"
          >
            내 서평단 현황
          </Link>
          <Link
            href="/dojangdan/manage"
            className="rounded-full border border-cream-200 px-4 py-2 text-sm font-semibold text-brown-700 hover:bg-cream-50"
          >
            출판사·작가 운영실
          </Link>
        </div>
      </section>

      {campaigns.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-cream-200 bg-white p-6 text-center text-sm text-brown-500">
          아직 공개된 서평단이 없습니다.
        </p>
      ) : (
        <>
          <CampaignSection title="모집 중" campaigns={recruiting} />
          <CampaignSection title="지난 서평단" campaigns={others} />
        </>
      )}
    </main>
  );
}

function CampaignSection({ title, campaigns }: { title: string; campaigns: CampaignSummary[] }) {
  if (campaigns.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-serif text-xl font-bold text-brown-900">{title}</h2>
      <div className="mt-4 space-y-3">
        {campaigns.map((campaign) => (
          <Link
            key={campaign.id}
            href={`/dojangdan/campaigns/${campaign.id}`}
            className="flex gap-4 rounded-2xl border border-cream-200 bg-white p-4 shadow-sm hover:border-brown-200"
          >
            {campaign.bookThumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={campaign.bookThumbnail}
                alt={campaign.bookTitle}
                className="h-24 w-16 flex-shrink-0 rounded object-cover"
              />
            ) : (
              <div className="h-24 w-16 flex-shrink-0 rounded bg-cream-100" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-semibold text-brown-600">
                  {STATUS_LABEL[campaign.status]}
                </span>
                <span className="truncate text-xs text-brown-400">{campaign.profileName}</span>
              </div>
              <p className="mt-1 truncate font-serif text-lg font-bold text-brown-900">
                {campaign.title}
              </p>
              <p className="truncate text-sm text-brown-500">
                {campaign.bookTitle} · {campaign.bookAuthor}
              </p>
              <p className="mt-1 text-xs text-brown-400">
                {campaign.applicantCount}명 신청 / {campaign.recruitCount}명 모집 · 마감{" "}
                {formatDate(campaign.recruitEndAt)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
