import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "책도장단 모집",
  description: "신간과 독립출판 서평단을 책도장에서 모집하고 독후감을 모아드립니다.",
};

const targets = [
  "신간을 알리고 싶은 작가",
  "독립출판물을 소개하고 싶은 창작자",
  "서평단 리뷰를 한곳에 모으고 싶은 출판사",
  "독자 반응을 정리해 홍보 자료로 쓰고 싶은 운영자",
];

const features = [
  "책별 독후감 모아보기",
  "서평단 모집 안내",
  "독후감 작성 링크",
  "공유 가능한 리뷰 모음 페이지",
];

const steps = ["문의", "모집", "독서/작성", "리뷰 모음", "공유"];

export default function DojangdanPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <section className="mb-10">
        <p className="text-sm text-brown-400 mb-2">책도장단</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-brown-800 leading-tight">
          신간과 독립출판 서평단을 책도장에서 모집하고 독후감을 모아드립니다.
        </h1>
        <p className="mt-4 text-brown-500 leading-7">
          책도장단은 작가와 출판사가 독자를 만나고, 흩어진 독후감을 책 단위로 모아
          공유할 수 있도록 준비 중인 서평단 운영 기능입니다.
        </p>
      </section>

      <section className="grid sm:grid-cols-2 gap-3 mb-10">
        {targets.map((item) => (
          <div key={item} className="rounded-lg border border-cream-200 bg-white p-4 text-brown-700">
            {item}
          </div>
        ))}
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-bold text-brown-800 mb-4">책도장단으로 할 수 있는 일</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {features.map((item) => (
            <div key={item} className="rounded-lg bg-cream-50 border border-cream-200 p-4 text-sm text-brown-600">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-brown-100 bg-white p-5">
        <h2 className="font-serif text-xl font-bold text-brown-800 mb-3">진행 흐름</h2>
        <ol className="grid sm:grid-cols-5 gap-2 text-sm text-brown-600">
          {steps.map((step) => (
            <li key={step} className="rounded-lg bg-cream-50 px-3 py-3 text-center">
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-brown-400">
          현재는 초기 베타 기능으로 운영 가능 여부를 확인하고 있습니다.
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
