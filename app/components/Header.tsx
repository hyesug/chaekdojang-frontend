import Link from "next/link";
import { PenLine } from "lucide-react";
import MobileMenu from "./MobileMenu";
import AuthButtons from "./AuthButtons";
import NotificationBell from "./NotificationBell";
import AdminNavLink from "./AdminNavLink";
import HeaderNav, { type NavItem } from "./HeaderNav";

// external: Next 라우트가 아닌 정적 페이지(운세)는 일반 링크로 이동한다.
// "독후감 쓰기"는 메뉴가 아니라 오른쪽 주요 버튼으로, "고객센터"는 푸터와 모바일 메뉴로 옮겼다.
// **메뉴를 고칠 때는 public/unse/index.html 의 헤더도 함께** 고쳐야 한다.
const navLinks: NavItem[] = [
  { href: "/", label: "피드" },
  { href: "/search?tab=books", label: "검색" },
  { href: "/library", label: "서재" },
  { href: "/groups", label: "독서모임" },
  { href: "/dojangdan", label: "도장단" },
  { href: "/contests", label: "공모전" },
  { href: "/stats", label: "독서 인생지도" },
  { href: "/unse", label: "운세", external: true },
];

const mobileLinks: NavItem[] = [
  ...navLinks,
  { href: "/write", label: "독후감 쓰기" },
  { href: "/cs", label: "고객센터" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-cream-300 bg-cream-50">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link
          href="/"
          aria-label="책도장 홈으로 이동"
          className="relative z-10 -ml-1 inline-flex min-h-11 flex-none items-center gap-2.5 px-1 font-serif text-[1.3rem] font-bold text-brown-800"
        >
          <span className="stamp-mark pointer-events-none" aria-hidden="true">冊</span>
          책도장
        </Link>

        <HeaderNav links={navLinks} />

        <div className="ml-auto hidden flex-none items-center gap-1.5 lg:flex">
          <AdminNavLink />
          <NotificationBell />
          <AuthButtons />
          <Link href="/write" className="cdj-button cdj-button--primary cdj-button--sm ml-1.5">
            <PenLine size={15} strokeWidth={2} aria-hidden="true" />
            독후감 쓰기
          </Link>
        </div>

        <div className="ml-auto flex flex-none items-center gap-1 lg:hidden">
          <NotificationBell />
          <MobileMenu links={mobileLinks} />
        </div>
      </div>
    </header>
  );
}
