import type { Metadata } from "next";
import Link from "next/link";
import AccountDeletionActions from "./AccountDeletionActions";

export const metadata: Metadata = {
  title: "계정 삭제 안내",
  description: "책도장 계정 삭제와 개인정보 삭제 방법을 안내합니다.",
};

export default function AccountDeletionPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-brown-700">
      <h1 className="font-serif text-3xl font-bold text-brown-800 mb-4">계정 삭제 안내</h1>
      <p className="text-brown-500 leading-7 mb-8">
        사용자는 언제든지 계정 탈퇴 또는 개인정보 삭제를 요청할 수 있습니다. 로그인한 사용자는
        이 페이지에서 직접 계정을 삭제할 수 있습니다.
      </p>

      <div className="space-y-7 leading-7">
        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">삭제되는 정보</h2>
          <p>계정 식별 정보, 프로필 정보, 서재 기록 등 계정 기반 정보는 삭제 대상입니다.</p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">별도 확인이 필요한 정보</h2>
          <p>
            공개 독후감과 댓글은 다른 사용자의 화면에 노출될 수 있으므로 삭제 또는 비공개 처리 방식이
            별도로 적용될 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">삭제 방법</h2>
          <p>
            로그인한 상태에서 아래 확인 문구를 입력하면 계정 삭제를 직접 진행할 수 있습니다. 삭제 후에는
            현재 로그인 정보가 지워지고 홈으로 이동합니다.
          </p>
        </section>

        <AccountDeletionActions />

        <section className="text-sm text-brown-400">
          <Link href="/privacy" className="underline">개인정보처리방침</Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="underline">이용약관</Link>
        </section>
      </div>
    </div>
  );
}
