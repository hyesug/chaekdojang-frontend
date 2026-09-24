import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "책도장의 개인정보 처리 기준을 안내합니다.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-brown-700">
      <h1 className="font-serif text-3xl font-bold text-brown-800 mb-4">개인정보처리방침</h1>
      <p className="text-sm text-brown-400 mb-8">시행일: 2026년 9월 24일</p>

      <div className="space-y-7 leading-7">
        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">1. 서비스와 운영자</h2>
          <p>
            책도장은 독후감 작성, 독서 기록, 책 취향 공유를 제공하는 독서 SNS입니다. 개인정보 보호 관련 문의,
            열람, 정정, 삭제, 탈퇴 요청은 <Link href="/cs" className="underline hover:text-brown-900">고객센터</Link>를
            통해 접수할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">2. 수집하는 개인정보</h2>
          <p>
            책도장은 회원가입과 로그인을 위해 OAuth 로그인 제공자로부터 아래 정보를 제공받을 수 있습니다.
            제공 항목은 사용자가 각 제공자의 동의 화면에서 승인한 범위에 따릅니다.
          </p>
          <ul className="mt-3 list-disc pl-5 space-y-1">
            <li>카카오: 회원 식별값, 닉네임, 프로필 이미지</li>
            <li>네이버: 회원 식별값, 이름, 이메일, 프로필 이미지</li>
            <li>구글: 회원 식별값, 이름 또는 표시 이름, 이메일, 프로필 이미지</li>
          </ul>
          <p className="mt-3">
            서비스 이용 과정에서 사용자가 직접 입력한 닉네임, 프로필 소개, 독후감, 댓글, 서재 기록,
            팔로우, 좋아요, 북마크, 알림 설정, 문의 내용이 처리될 수 있습니다. 접속 IP, 접속·활동 시각,
            세션 ID, User-Agent, 브라우저와 운영체제, 기기 유형, 책도장 도메인에서 임의로 생성한 UUID 형식의
            기기 식별자, 오류 로그도 서비스 운영 과정에서 생성될 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">3. 작가/출판사 신청 정보</h2>
          <p>
            작가, 출판사, 서점, 운영자 등 공개 프로필 신청 기능을 제공하는 경우 신청 유형, 표시 이름,
            소개글, 공식 링크, 연락 이메일, 증빙 링크, 신청 처리 상태와 관리자 검토 기록을 수집할 수 있습니다.
            이 정보는 신청자 확인, 프로필 승인 여부 판단, 부정 신청 방지, 문의 응대 목적으로 사용합니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">4. 종합 운세</h2>
          <p>
            종합 운세 화면의 명반 계산은 이용자의 브라우저 안에서 이루어지며, 입력한 이름, 성별, 생년월일,
            태어난 시각, 태어난 곳, 사는 곳은 계산만으로는 서버로 전송되지 않습니다. 다만 아래 두 경우에는
            책도장 서버가 해당 정보를 처리합니다.
          </p>
          <ul className="mt-3 list-disc pl-5 space-y-1">
            <li>
              AI에게 묻기: 질문 내용과 함께 위 입력 정보, 이를 바탕으로 계산한 명반 결과가 책도장 서버를 거쳐
              AI 서비스(Anthropic)로 전송됩니다. 책도장은 월 이용 한도 확인을 위해 로그인한 이용자의 이용
              시각을 기록할 수 있으며, 질문과 답변 본문은 책도장 서버에 저장하지 않습니다.
            </li>
            <li>
              프로필 저장: 로그인한 이용자가 저장을 선택한 경우에만 이름, 성별, 생년월일(양력), 태어난 시각,
              태어난 곳, 사는 곳, 서머타임 여부를 저장합니다. 다음 방문 때 입력란을 채우는 목적으로만 쓰며,
              운세 화면에서 언제든 삭제할 수 있고 회원 탈퇴 시 함께 삭제됩니다.
            </li>
          </ul>
          <p className="mt-3">
            궁합에 입력한 상대방 정보는 브라우저 안에서만 계산하며 서버로 보내거나 저장하지 않습니다.
            타인의 정보를 입력할 때는 당사자의 동의를 받아 주세요.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">5. 이용 목적</h2>
          <p>
            개인정보는 회원 식별과 로그인, 독후감 작성/조회/공유, 프로필과 서재 기능 제공, 작가/출판사
            프로필 신청 검토, 종합 운세 AI 풀이와 프로필 저장, 서비스 운영과 보안, 오류 분석, 부정 이용 방지, 고객 문의 응대를 위해 사용합니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">6. 보관과 삭제</h2>
          <p>
            회원 탈퇴 또는 삭제 요청 시 이메일, 닉네임, 프로필 이미지, 자기소개 등 계정 식별 정보는
            삭제하거나 탈퇴 계정 값으로 변경합니다. 서재, 팔로우, 알림, 북마크, 좋아요, 소셜 로그인 연결처럼
            사용자 개인에게 종속된 활동 데이터는 삭제합니다.
          </p>
          <p className="mt-2">
            공개 독후감과 댓글은 서비스의 공개 게시물 맥락을 유지하기 위해 본문은 보존하되 작성자 정보는
            &quot;탈퇴한 사용자&quot;로 익명화할 수 있습니다. 사용자는 탈퇴 전에 본인이 작성한 독후감과 댓글을 직접
            삭제할 수 있고, 탈퇴 후 별도 삭제 요청도 할 수 있습니다.
          </p>
          <p className="mt-2">
            작가/출판사 신청 정보는 신청 처리, 분쟁 대응, 부정 신청 방지를 위해 필요한 기간 동안 보관할 수
            있으며, 목적 달성 후에는 지체 없이 삭제하거나 식별할 수 없는 형태로 처리합니다. 관계 법령에 따라
            보관이 필요한 정보는 해당 법령에서 정한 기간 동안 분리 보관한 뒤 파기합니다.
          </p>
          <p className="mt-2">
            접속 IP, 임의 기기 식별자, User-Agent와 세부 활동 기록은 서비스 운영·보안 확인 목적으로 원칙적으로
            생성일로부터 90일간 보관한 뒤 자동 삭제합니다. 관계 법령 준수 또는 사고 조사에 별도 보관이 필요한
            경우에는 해당 목적에 필요한 범위와 기간에 한해 보관할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">7. 제3자 제공과 외부 서비스</h2>
          <p>
            책도장은 이용자의 개인정보를 임의로 제3자에게 판매하거나 제공하지 않습니다. 다만 서비스 제공에
            필요한 범위에서 카카오, 네이버, 구글의 로그인 기능, 카카오 책 API와 Google Books API의 도서 정보,
            Vercel의 프론트엔드 배포, AWS EC2/RDS의 서버와 데이터베이스 인프라를 사용할 수 있습니다.
          </p>
          <p className="mt-2">
            일부 외부 서비스는 국외 사업자가 제공할 수 있으며, 이 경우 서비스 제공과 보안, 장애 대응에 필요한
            범위에서 데이터가 처리될 수 있습니다.
          </p>
          <p className="mt-2">
            종합 운세의 AI 풀이는 다음과 같이 개인정보를 국외로 이전합니다. AI에게 묻기를 쓰지 않으면
            이전되지 않습니다.
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>이전받는 자: Anthropic, PBC (미국)</li>
            <li>이전 항목: 질문 내용, 이름, 성별, 생년월일, 태어난 시각, 태어난 곳, 사는 곳, 명반 계산 결과</li>
            <li>이전 시기와 방법: AI에게 물을 때마다 암호화된 네트워크로 전송</li>
            <li>이용 목적: AI 운세 풀이 답변 생성</li>
            <li>보유 기간: Anthropic의 API 데이터 보관 정책에 따른 기간</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">8. 쿠키와 접속 기록</h2>
          <p>
            책도장은 로그인 상태 유지, 보안, 오류 분석, 서비스 이용 통계 확인을 위해 쿠키 또는 유사 기술과
            접속 기록을 사용할 수 있습니다. 사용자는 브라우저 설정을 통해 쿠키 저장을 제한할 수 있으나,
            이 경우 일부 기능 이용이 제한될 수 있습니다. 기기 식별자는 책도장 도메인에서 생성한 임의 UUID를
            사용하며, 브라우저 하드웨어 지문은 수집하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">9. 이용자의 권리</h2>
          <p>
            이용자는 개인정보의 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다. 로그인한 사용자는 프로필
            페이지에서 계정을 삭제할 수 있으며, 추가 조치가 필요한 경우 고객센터를 통해 요청할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">10. 아동의 개인정보</h2>
          <p>
            책도장은 만 14세 이상 이용자를 대상으로 서비스를 제공합니다. 만 14세 미만 아동은 책도장에 가입하거나
            서비스를 이용할 수 없습니다. 만 14세 미만 이용자의 가입 또는 개인정보 처리가 확인되는 경우 관련 정보를
            삭제하거나 이용을 제한할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-brown-800 mb-2">11. 변경 고지</h2>
          <p>
            개인정보처리방침이 변경되는 경우 시행일과 변경 내용을 서비스 화면에 게시합니다. 중요한 변경이 있는
            경우 합리적인 방법으로 별도 안내할 수 있습니다.
          </p>
        </section>
      </div>
    </div>
  );
}
