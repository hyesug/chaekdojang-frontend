import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ManageCampaignClient from "./ManageCampaignClient";

export const metadata: Metadata = {
  title: "캠페인 관리 - 책도장단",
  robots: { index: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function ManageCampaignPage({ params }: Props) {
  const { id } = await params;
  // 숫자가 아니면 Number(id)가 NaN이 되어 /api/.../NaN 을 호출하게 된다.
  if (!/^\d+$/.test(id)) notFound();

  return <ManageCampaignClient campaignId={Number(id)} />;
}
