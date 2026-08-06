import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function LegacyBookReviewsPage({ params }: Props) {
  const { id } = await params;
  redirect(`/books/${encodeURIComponent(id)}`);
}
