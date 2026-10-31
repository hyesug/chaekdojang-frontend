import type { Metadata } from "next";

// /users/[id] 는 같은 사람의 공개 프로필(/u/[nickname])을 화면에서만 다시 그리는 주소다.
// 검색 결과에는 서버에서 내용을 그리는 /u/[nickname] 하나만 남긴다.
export const metadata: Metadata = {
  title: "독자 프로필",
  robots: { index: false, follow: true },
};

export default function UsersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
