import Link from "next/link";
import MobileMenu from "./MobileMenu";
import AuthButtons from "./AuthButtons";

const navLinks = [
  { href: "/", label: "피드" },
  { href: "/search", label: "책 검색" },
  { href: "/library", label: "서재" },
  { href: "/write", label: "독후감 쓰기" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-cream-200">
      <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* 로고 — font-serif로 책 감성 강조 */}
        <Link
          href="/"
          className="font-serif text-2xl font-bold text-brown-700 tracking-tight"
        >
          책인감
        </Link>

        {/* 데스크탑 내비게이션 */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-brown-500 hover:text-brown-800 transition-colors font-medium"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* 로그인 상태에 따라 버튼이 바뀌는 Client Component */}
        <AuthButtons />

        {/* 모바일: 햄버거 메뉴 (클라이언트 컴포넌트) */}
        <MobileMenu links={navLinks} />
      </div>
    </header>
  );
}
