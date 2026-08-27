import type { Metadata } from "next";
import FeedClient, { type FeedPageData } from "./FeedClient";
import { fetchApiData } from "./lib/serverApi";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function FeedPage() {
  const initialPage = await fetchApiData<FeedPageData>(
    "/api/reviews?page=0&size=10&sort=recent",
    { cache: "no-store" },
  );

  return <FeedClient initialPage={initialPage} />;
}
