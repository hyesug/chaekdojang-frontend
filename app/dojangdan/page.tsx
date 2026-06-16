import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "책도장단 모집",
  description: "신간과 독립출판 서평단을 책도장에서 모집하고 독후감을 모아드립니다.",
};

export default function DojangdanPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <section className="mb-10">
        <p className="text-sm text-brown-400 mb-2">책도장단</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-brown-800 leading-tight">
          신간과 독립출판 서평단을 책도장에서 모집하고 독후감을 모아드립니다.
        </h1>
        <p className="mt-4 text-brown-500 leading-7">
          출판사, 독립출판 작가, 브런치 작가, 신간 홍보가 필요한 분이 독자를 모으고
          리뷰 결과를 한곳에서 공유할 수 있도록 준비 중인 초기 베타 기능입니다.
        </p>
      </section>

      <section className="grid sm:grid-cols-2 gap-3 mb-10">
        {[
          "신간을 알리고 싶은 작가",
          "독립출판물을 홍보하고 싶은 창작자",
          "서평단 리뷰를 한곳에 모으고 싶은 출판사",
          "독자 반응을 정리하고 싶은 운영자",
        ].map((item) => (
          <div key={item} className="rounded-lg border border-cream-200 bg-white p-4 text-brown-700">
            {item}
          </div>
        ))}
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-bold text-brown-800 mb-4">제공 예정</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            "서평단 모집 페이지",
            "신청자 안내",
            "독후감 작성 링크",
            "리뷰 모음 페이지",
            "공유 가능한 결과 링크",
          ].map((item) => (
            <div key={item} className="rounded-lg bg-cream-50 border border-cream-200 p-4 text-sm text-brown-600">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-brown-100 bg-white p-5">
        <h2 className="font-serif text-xl font-bold text-brown-800 mb-3">진행 흐름</h2>
        <ol className="grid sm:grid-cols-5 gap-2 text-sm text-brown-600">
          {["문의", "모집", "독서/작성", "리뷰 모음", "공유"].map((step) => (
            <li key={step} className="rounded-lg bg-cream-50 px-3 py-3 text-center">{step}</li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-brown-400">
          현재는 초기 베타로 운영 가능 여부를 확인하고 있습니다.
        </p>
        <Link
          href="/cs"
          className="mt-5 inline-flex rounded-full bg-brown-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brown-700"
        >
          책도장단 문의하기
        </Link>
      </section>
    </div>
  );
}
