import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ReviewEditPage({ params }: Props) {
  const { id } = await params;
  redirect(`/write?reviewId=${id}`);
}
