import type { Metadata } from "next";
import AssistantClient from "./AssistantClient";

export const metadata: Metadata = {
  title: "AI 독서 도우미",
  description: "책도장 독자들의 공개 독후감이나 내 독후감에 질문하면 관련 글을 찾아 근거와 함께 답해 드려요.",
  alternates: { canonical: "/assistant" },
  robots: { index: false, follow: false },
};

export default function AssistantPage() {
  return <AssistantClient />;
}
