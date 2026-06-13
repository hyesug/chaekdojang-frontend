import Link from "next/link";
import MobileMenu from "./MobileMenu";
import AuthButtons from "./AuthButtons";
import NotificationBell from "./NotificationBell";
import AdminNavLink from "./AdminNavLink";

const navLinks = [
  { href: "/", label: "피드" },
  { href: "/explore", label: "탐색" },
  { href: "/search", label: "검색" },
  { href: "/library", label: "서재" },
  { href: "/write", label: "독후감 쓰기" },
  { href: "/cs", label: "고객센터" },
  // { href: "/subscription", label: "프리미엄" }, // 추후 오픈 예정
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-cream-200">
      <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
        {/* 로고 */}
        <Link
          href="/"
          className="font-serif text-2xl font-bold text-brown-700 tracking-tight flex-none"
        >
          책인감
        </Link>

        {/* 데스크탑 내비게이션 — flex-1로 남은 공간 차지, 내부에서 가운데 정렬 */}
        <nav className="hidden md:flex flex-1 items-center justify-center gap-6">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-brown-500 hover:text-brown-800 transition-colors font-medium whitespace-nowrap"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* 우측: 관리자 + 알림 + 로그인 버튼 */}
        <div className="hidden md:flex items-center gap-3 flex-none ml-auto">
          <AdminNavLink />
          <NotificationBell />
          <AuthButtons />
        </div>

        {/* 모바일: 알림 + 햄버거 */}
        <div className="flex md:hidden items-center gap-2 flex-none ml-auto">
          <NotificationBell />
          <MobileMenu links={navLinks} />
        </div>
      </div>
    </header>
  );
}
