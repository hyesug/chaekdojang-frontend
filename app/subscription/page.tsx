import Link from "next/link";

export default function SubscriptionPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <p className="text-sm text-brown-400 mb-2">v1.0 준비 중</p>
      <h1 className="font-serif text-3xl font-bold text-brown-800 mb-4">
        프리미엄 구독은 아직 열리지 않았어요
      </h1>
      <p className="text-sm text-brown-500 leading-relaxed mb-8">
        MVP 출시 단계에서는 독후감 피드, 팔로우, 책 검색, 내 서재에 집중합니다.
        구독 혜택과 결제는 v1.0에서 다시 설계한 뒤 오픈할 예정입니다.
      </p>
      <Link
        href="/"
        className="inline-flex px-5 py-2.5 rounded-full bg-brown-600 text-white text-sm font-medium hover:bg-brown-700 transition-colors"
      >
        피드로 돌아가기
      </Link>
    </div>
  );
}
