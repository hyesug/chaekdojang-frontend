import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "작가와 출판사를 위한 책도장",
  description: "내 책의 독자 리뷰를 한 페이지에 모으고 홍보 자산으로 활용하세요.",
};

export default function ForAuthorsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <section className="mb-10">
        <p className="text-sm text-brown-400 mb-2">For authors</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-brown-800 leading-tight">
          내 책의 독자 리뷰를 한 페이지에 모으세요.
        </h1>
        <p className="mt-4 text-brown-500 leading-7">
          책도장은 독후감이 흩어지지 않도록 책별 리뷰를 모으고, 신간과 독립출판물의
          독자 반응을 공유 가능한 링크로 정리하는 독서 SNS입니다.
        </p>
      </section>

      <section className="grid sm:grid-cols-3 gap-3 mb-10">
        {[
          "인스타그램, 블로그, 개인 SNS에 흩어진 리뷰를 다시 찾기 어렵습니다.",
          "좋은 리뷰를 신간 홍보 자료로 정리하기 번거롭습니다.",
          "독자 반응을 꾸준히 모을 공간이 필요합니다.",
        ].map((item) => (
          <div key={item} className="rounded-lg bg-white border border-cream-200 p-4 text-sm text-brown-600 leading-6">
            {item}
          </div>
        ))}
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-bold text-brown-800 mb-4">책도장의 해결 방식</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            "책별 독후감 모아보기",
            "서평단 리뷰 아카이브",
            "공유 가능한 리뷰 링크",
            "독자 반응 정리",
          ].map((item) => (
            <div key={item} className="rounded-lg bg-cream-50 border border-cream-200 p-4 text-brown-700">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-brown-100 bg-white p-5">
        <h2 className="font-serif text-xl font-bold text-brown-800 mb-3">활용 예시</h2>
        <p className="text-sm text-brown-500 leading-7">
          신간 홍보, 독립출판물 홍보, 브런치 작가의 책 소개, 북토크와 독서모임 후기 정리에 활용할 수 있습니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/dojangdan" className="rounded-full bg-brown-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brown-700">
            책도장단 보기
          </Link>
          <Link href="/cs" className="rounded-full border border-brown-300 px-5 py-2.5 text-sm font-medium text-brown-600 hover:bg-cream-100">
            문의하기
          </Link>
        </div>
      </section>
    </div>
  );
}
