import type { Metadata } from "next";
import ManageContestsClient from "./ManageContestsClient";

export const metadata: Metadata = {
  title: "공모전 운영실 - 책도장",
  description: "도서관·출판사와 책도장 운영진이 공모전을 열고 심사하는 공간입니다.",
  robots: { index: false },
};

export default function ContestManagePage() {
  return <ManageContestsClient />;
}
