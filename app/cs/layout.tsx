import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "고객센터",
  description: "책도장 이용 중 궁금한 점이나 건의사항을 문의하세요. 모든 문의는 비밀글로 처리됩니다.",
  alternates: { canonical: "/cs" },
};

export default function CustomerSupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
