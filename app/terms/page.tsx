import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관",
  description: "책도장 이용약관을 안내합니다.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-brown-700">
      <h1 className="font-serif text-3xl font-bold text-brown-800 mb-4">이용약관</h1>
      <p className="text-sm text-brown-400 mb-8">시행일: 2026년 6월 16일</p>
      <div className="space-y-6 leading-7">
        <p>책도장은 독후감과 독서 기록을 작성하고 공유하는 무료 서비스입니다.</p>
        <p>사용자는 본인이 작성한 콘텐츠에 대한 책임을 가집니다.</p>
        <p>타인의 저작권, 명예, 개인정보를 침해하는 콘텐츠를 게시해서는 안 됩니다.</p>
        <p>운영자는 부적절한 콘텐츠를 숨김, 삭제하거나 이용을 제한할 수 있습니다.</p>
        <p>책도장은 개인 개발 프로젝트로 시작했으며 기능과 운영 방식은 변경될 수 있습니다.</p>
        <p>현재는 무료 서비스이며, 향후 유료 기능이 도입될 경우 별도로 안내합니다.</p>
      </div>
    </div>
  );
}
