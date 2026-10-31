import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "독후감 둘러보기",
  description: "책도장 독자들이 남긴 공개 독후감을 최신순·별점순·인기순으로 둘러보고, 취향이 맞는 독자를 찾아보세요.",
  alternates: { canonical: "/explore" },
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
