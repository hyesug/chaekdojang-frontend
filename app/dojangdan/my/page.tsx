import type { Metadata } from "next";
import MyDojangdanClient from "./MyDojangdanClient";

export const metadata: Metadata = {
  title: "내 서평단 현황 - 책도장",
  description: "신청한 책도장단과 독후감 제출 현황, 완주 이력을 확인하세요.",
  robots: { index: false },
};

export default function MyDojangdanPage() {
  return <MyDojangdanClient />;
}
