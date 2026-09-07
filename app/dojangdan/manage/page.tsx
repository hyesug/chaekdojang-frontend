import type { Metadata } from "next";
import ManageClient from "./ManageClient";

export const metadata: Metadata = {
  title: "책도장단 운영실 - 책도장",
  description: "출판사·작가가 서평단을 모집하고 신청자를 선정하는 공간입니다.",
  robots: { index: false },
};

export default function ManagePage() {
  return <ManageClient />;
}
