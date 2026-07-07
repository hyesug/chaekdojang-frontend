import ReviewEditForm from "../../../components/ReviewEditForm";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ReviewEditPage({ params }: Props) {
  const { id } = await params;
  return <ReviewEditForm reviewId={Number(id)} />;
}
