import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "책·웹소설 검색",
  description: "책 제목·저자·ISBN이나 웹소설 제목으로 작품을 찾아 독후감을 쓰고 서재에 담아보세요. 닉네임으로 다른 독자도 찾을 수 있어요.",
  alternates: { canonical: "/search" },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
