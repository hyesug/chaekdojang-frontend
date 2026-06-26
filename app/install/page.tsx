import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "앱처럼 사용하기 - 책도장",
  description: "책도장을 iPhone과 Android 홈 화면에 추가해서 앱처럼 사용하는 방법입니다.",
  robots: { index: false, follow: true },
};

export default function InstallPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <section className="rounded-2xl border border-cream-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-brown-400">PWA 설치 안내</p>
        <h1 className="mt-2 font-serif text-2xl font-bold text-brown-900">
          책도장을 앱처럼 사용해보세요
        </h1>
        <p className="mt-3 text-sm leading-6 text-brown-500">
          앱스토어에서 설치하는 앱은 아니지만, 홈 화면에 책도장 아이콘을 추가하면 앱처럼 바로 열 수 있습니다.
        </p>
      </section>

      <section className="mt-6 grid gap-4">
        <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-800">iPhone / iPad</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-brown-600">
            <li>Safari에서 책도장에 접속합니다.</li>
            <li>하단 또는 상단의 공유 버튼을 누릅니다.</li>
            <li>홈 화면에 추가를 선택합니다.</li>
            <li>추가를 누르면 홈 화면에 책도장 아이콘이 생깁니다.</li>
          </ol>
          <p className="mt-3 rounded-xl bg-cream-50 px-3 py-2 text-xs leading-5 text-brown-400">
            iPhone에서는 Chrome보다 Safari에서 홈 화면 추가를 사용하는 것이 가장 안정적입니다.
          </p>
        </div>

        <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-800">Android / Chrome</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-brown-600">
            <li>Chrome에서 책도장에 접속합니다.</li>
            <li>화면에 앱 설치하기 버튼이 보이면 버튼을 누릅니다.</li>
            <li>버튼이 보이지 않으면 오른쪽 위 점 3개 메뉴를 누릅니다.</li>
            <li>앱 설치 또는 홈 화면에 추가를 선택합니다.</li>
            <li>설치 또는 추가를 누르면 홈 화면에 책도장 아이콘이 생깁니다.</li>
          </ol>
        </div>

        <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-800">PC Chrome</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-brown-600">
            <li>Chrome에서 책도장에 접속합니다.</li>
            <li>주소창 오른쪽의 설치 아이콘을 누릅니다.</li>
            <li>아이콘이 보이지 않으면 Chrome 메뉴에서 페이지를 앱으로 설치를 선택합니다.</li>
          </ol>
        </div>

        <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-brown-800">설치 후 확인할 것</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-brown-600">
            <li>홈 화면의 책도장 아이콘으로 실행되는지 확인합니다.</li>
            <li>주소창 없이 앱처럼 열리는지 확인합니다.</li>
            <li>로그인 상태가 유지되는지 확인합니다.</li>
            <li>책 검색, 독후감 작성, 프로필 수정이 정상인지 확인합니다.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
