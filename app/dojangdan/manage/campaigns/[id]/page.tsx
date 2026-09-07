import type { Metadata } from "next";
import ManageCampaignClient from "./ManageCampaignClient";

export const metadata: Metadata = {
  title: "캠페인 관리 - 책도장단",
  robots: { index: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function ManageCampaignPage({ params }: Props) {
  const { id } = await params;
  return <ManageCampaignClient campaignId={Number(id)} />;
}
