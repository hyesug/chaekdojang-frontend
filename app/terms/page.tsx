import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "이용약관",
  description: "책도장 이용약관을 안내합니다.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-brown-700">
      <h1 className="font-serif text-3xl font-bold text-brown-800 mb-4">이용약관</h1>
      <p className="text-sm text-brown-400 mb-8">시행일: 2026년 6월 19일</p>

      <div className="space-y-7 leading-7">
        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">1. 서비스</h2>
          <p>
            책도장은 독후감과 독서 기록을 작성하고 공유하는 독서 SNS입니다. 사용자는 카카오, 네이버, 구글 등
            소셜 로그인으로 가입하고 서비스를 이용할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">2. 약관과 개인정보처리방침 동의</h2>
          <p>
            사용자가 책도장에 가입하거나 서비스를 계속 이용하는 경우 본 약관과
            {" "}<Link href="/privacy" className="underline hover:text-brown-900">개인정보처리방침</Link>에
            동의한 것으로 봅니다. 동의하지 않는 경우 서비스 이용을 중단하고 계정 삭제를 요청할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">3. 계정 관리</h2>
          <p className="mb-2">
            책도장은 만 14세 이상 이용자를 대상으로 합니다. 만 14세 미만 아동은 책도장에 가입하거나 서비스를
            이용할 수 없으며, 만 14세 미만 이용자의 가입이 확인되는 경우 운영자는 계정 이용을 제한하거나 삭제할 수 있습니다.
          </p>
          <p>
            사용자는 본인 계정을 안전하게 관리해야 하며, 다른 사람의 계정을 사용하거나 자신의 계정을 부정하게
            양도해서는 안 됩니다. 운영자는 보안, 부정 이용 방지, 서비스 보호를 위해 필요한 경우 이용을 제한할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">4. 사용자 콘텐츠</h2>
          <p>
            사용자는 본인이 작성한 독후감, 댓글, 프로필 정보 등 콘텐츠에 대한 책임을 가집니다. 콘텐츠의 저작권은
            원칙적으로 작성자에게 있으며, 사용자는 책도장이 해당 콘텐츠를 서비스 화면에 표시하고 공유 기능을
            제공하는 데 필요한 범위에서 사용할 수 있도록 허락합니다.
          </p>
          <p className="mt-2">
            타인의 저작권, 명예, 개인정보, 초상권을 침해하거나 불법 자료, 혐오 표현, 스팸, 광고성 게시물,
            서비스 운영을 방해하는 콘텐츠를 게시해서는 안 됩니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">5. 작가/출판사 프로필 신청</h2>
          <p>
            책도장은 작가, 출판사, 서점, 운영자 등 공개 프로필 신청 기능을 제공할 수 있습니다. 신청자는 정확한
            정보와 본인 또는 단체를 확인할 수 있는 공식 링크나 증빙 자료를 제출해야 합니다.
          </p>
          <p className="mt-2">
            운영자는 신청 내용을 검토해 승인, 반려, 보류할 수 있으며, 허위 정보, 사칭, 권리 침해, 서비스 목적에
            맞지 않는 신청이 확인되면 프로필 공개를 제한하거나 취소할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">6. 운영 조치</h2>
          <p>
            운영자는 약관 위반, 권리 침해 신고, 법령 위반 우려, 서비스 안정성 침해가 있는 경우 게시물 숨김,
            삭제, 계정 이용 제한, 프로필 승인 취소 등 필요한 조치를 할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">7. 계정 삭제와 게시물 처리</h2>
          <p>
            사용자는 프로필 페이지에서 계정을 삭제할 수 있습니다. 계정 삭제 시 계정 식별 정보와 개인 활동 데이터는
            삭제 또는 익명화되며, 공개 독후감과 댓글은 작성자가 &quot;탈퇴한 사용자&quot;로 표시된 상태로 유지될 수 있습니다.
          </p>
          <p className="mt-2">
            공개 독후감과 댓글의 본문 삭제를 원하는 사용자는 탈퇴 전에 직접 삭제하거나, 탈퇴 후
            {" "}<Link href="/cs" className="underline hover:text-brown-900">고객센터</Link>를 통해 별도 삭제를 요청할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">8. 외부 서비스와 링크</h2>
          <p>
            책도장은 도서 정보, 소셜 로그인, 배포와 인프라 운영을 위해 외부 서비스를 사용할 수 있습니다.
            서비스 안의 외부 구매 링크나 제3자 웹사이트 이용에는 해당 외부 서비스의 약관과 정책이 적용될 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">9. 유료 기능</h2>
          <p>
            현재 책도장은 무료 서비스를 기본으로 제공합니다. 향후 유료 기능이나 프리미엄 노출 기능이 도입되는 경우
            가격, 결제, 환불, 해지 조건을 별도로 안내합니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">10. 약관 변경</h2>
          <p>
            책도장은 필요한 경우 약관을 변경할 수 있으며, 변경 내용과 시행일을 서비스 화면에 게시합니다.
            사용자는 변경 약관에 동의하지 않을 경우 서비스 이용을 중단하고 계정 삭제를 요청할 수 있습니다.
          </p>
        </section>
      </div>
    </div>
  );
}
