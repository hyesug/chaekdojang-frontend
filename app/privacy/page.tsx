import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "책도장의 개인정보 처리 기준을 안내합니다.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-brown-700">
      <h1 className="font-serif text-3xl font-bold text-brown-800 mb-4">개인정보처리방침</h1>
      <p className="text-sm text-brown-400 mb-8">시행일: 2026년 6월 16일</p>
      <div className="space-y-7 leading-7">
        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">서비스</h2>
          <p>책도장은 독후감 작성, 독서 기록, 책 취향 공유를 제공하는 무료 독서 SNS입니다.</p>
        </section>
        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">수집하는 정보</h2>
          <p>
            OAuth 로그인 제공자로부터 받는 식별 정보, 닉네임, 프로필 이미지, 이메일이 제공되는 경우의 이메일,
            사용자가 직접 작성한 독후감, 댓글, 프로필 소개, 서재 기록을 처리합니다. 서비스 운영 과정에서 접속기록,
            IP 일부, 브라우저와 기기 정보, 쿠키 또는 유사 식별자가 생성될 수 있습니다.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">이용 목적</h2>
          <p>
            회원 식별과 로그인, 독후감 작성/조회/공유, 프로필과 서재 기능 제공, 서비스 운영과 보안,
            오류 분석, 부정 이용 방지를 위해 사용합니다.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">보관과 삭제</h2>
          <p>
            회원 탈퇴 또는 삭제 요청 시 이메일, 닉네임, 프로필 이미지, 자기소개 등 계정 식별 정보는
            삭제하거나 탈퇴 계정 값으로 변경합니다. 서재, 팔로우, 알림, 북마크, 좋아요, 소셜 로그인 연결처럼
            사용자 개인에게 종속된 활동 데이터는 삭제합니다.
          </p>
          <p className="mt-2">
            공개 독후감과 댓글은 서비스의 공개 게시물 맥락을 유지하기 위해 본문은 보존하되 작성자 정보는
            “탈퇴한 사용자”로 익명화합니다. 사용자는 탈퇴 전에 본인이 작성한 독후감과 댓글을 직접 삭제할 수 있고,
            탈퇴 후 별도 삭제 요청도 할 수 있습니다.
          </p>
          <p className="mt-2">
            관계 법령에 따라 보관이 필요한 정보가 있는 경우에는 해당 법령에서 정한 기간 동안 분리 보관한 뒤,
            목적 달성 또는 보관 기간 종료 시 복구되거나 재생되지 않도록 파기합니다.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">제3자 제공과 외부 서비스</h2>
          <p>
            개인정보를 임의로 제3자에게 제공하지 않습니다. 로그인, 도서 검색, 배포와 인프라 운영을 위해
            카카오, 네이버, 구글, 도서 정보 API, Vercel, AWS EC2/RDS 등 외부 서비스를 사용할 수 있습니다.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">이용자의 권리와 문의</h2>
          <p>
            이용자는 개인정보 조회, 수정, 삭제, 탈퇴를 요청할 수 있습니다. 로그인한 사용자는 프로필 페이지에서
            계정을 직접 삭제할 수 있으며, 추가 문의가 필요한 경우 고객센터를 통해 요청할 수 있습니다.
          </p>
        </section>
      </div>
    </div>
  );
}
