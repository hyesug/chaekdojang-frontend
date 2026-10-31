import type { Metadata } from "next";
import FeedClient, { type FeedPageData } from "./FeedClient";
import { DEFAULT_OG_IMAGE, fetchApiData, SERVICE_DESCRIPTION } from "./lib/serverApi";

const title = "책도장 - 독후감 쓰고 읽은 책을 기록하는 독서 SNS";

export const metadata: Metadata = {
  title: { absolute: title },
  description: SERVICE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: "책도장",
    title,
    description: SERVICE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default async function FeedPage() {
  const initialPage = await fetchApiData<FeedPageData>(
    "/api/reviews?page=0&size=10&sort=recent",
    { cache: "no-store" },
  );

  return <FeedClient initialPage={initialPage} />;
}
