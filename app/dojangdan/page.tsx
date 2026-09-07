import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "책도장단 베타 문의",
  description: "신간·독립출판·작가의 책을 위한 서평단 모집과 독후감 모음 서비스를 문의하세요.",
  alternates: { canonical: "/dojangdan" },
};

const targets = [
  "신간을 홍보하고 싶은 출판사",
  "독립출판물을 알리고 싶은 작가",
  "서평단 모집 페이지가 필요한 운영자",
  "독후감을 한곳에 모아 보여주고 싶은 분",
];

const features = [
  "서평단 모집 페이지 생성",
  "신청자 관리",
  "독후감 작성 유도",
  "책별 독후감 모아보기",
  "공유 가능한 리뷰 모음 링크 제공",
];

const steps = [
  "책도장단 모집 페이지 생성",
  "독자 신청",
  "선정 및 책 제공",
  "독후감 작성",
  "책별 리뷰 모음 페이지 생성",
  "외부 공유 및 홍보 활용",
];

export default function DojangdanPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <section className="rounded-2xl border border-cream-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-brown-400">책도장단</p>
        <h1 className="mt-2 font-serif text-3xl font-bold leading-tight text-brown-900">
          서평단 모집부터 독후감 모음까지 책 단위로 정리합니다.
        </h1>
        <p className="mt-4 text-sm leading-7 text-brown-600">
          책도장단은 신간·독립출판·작가의 책을 독자에게 소개하고, 독후감을 한곳에 모아 보여주는 서평단 모집 서비스입니다.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/dojangdan/campaigns"
            className="inline-flex rounded-full bg-brown-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brown-800"
          >
            모집 중인 서평단 보기
          </Link>
          <Link
            href="/cs"
            className="inline-flex rounded-full border border-cream-200 px-5 py-3 text-sm font-semibold text-brown-700 hover:bg-cream-50"
          >
            책도장단 베타 문의하기
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-bold text-brown-900">이런 분께 적합합니다</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {targets.map((item) => (
            <div key={item} className="rounded-2xl border border-cream-200 bg-white p-4 text-sm text-brown-700 shadow-sm">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-bold text-brown-900">제공 기능</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {features.map((item) => (
            <div key={item} className="rounded-2xl border border-cream-200 bg-cream-50 p-4 text-sm text-brown-700">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl font-bold text-brown-900">운영 방식</h2>
        <ol className="mt-4 space-y-3">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3 rounded-xl bg-cream-50 px-4 py-3 text-sm text-brown-700">
              <span className="font-semibold text-brown-400">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8 rounded-2xl border border-brown-100 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl font-bold text-brown-900">베타 운영 안내</h2>
        <p className="mt-3 text-sm leading-7 text-brown-600">
          현재 책도장단은 베타 운영 중입니다. 초기 제휴는 무료 또는 소액으로 테스트 가능하며, 운영 방식은 책의 성격과 모집 규모에 따라 조정됩니다.
        </p>
        <p className="mt-3 text-sm leading-7 text-brown-500">
          문의 시 담당자명, 소속명, 이메일, 연락처, 책 제목, 출판사/작가 여부, 모집 희망 인원, 문의 내용을 함께 남겨주세요.
        </p>
        <Link
          href="/cs"
          className="mt-5 inline-flex rounded-full bg-brown-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brown-800"
        >
          베타 운영 문의하기
        </Link>
      </section>
    </main>
  );
}
