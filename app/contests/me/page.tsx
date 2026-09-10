import type { Metadata } from "next";
import MyContestsClient from "./MyContestsClient";

export const metadata: Metadata = {
  title: "내 공모전 응모 현황 - 책도장",
  description: "내가 응모한 공모전과 심사·수상 결과를 확인합니다.",
  robots: { index: false },
};

export default function MyContestsPage() {
  return <MyContestsClient />;
}
