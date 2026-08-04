import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "독서모임 초대 - 책도장",
  robots: { index: false, follow: false },
};

export default async function GroupInvitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/groups/${encodeURIComponent(slug)}`);
}
