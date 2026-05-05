import Link from "next/link";
import MobileMenu from "./MobileMenu";

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

        {/* 로그인 / 회원가입 버튼 */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/auth/login"
            className="px-4 py-1.5 text-sm text-brown-600 hover:text-brown-800 transition-colors"
          >
            로그인
          </Link>
          <Link
            href="/auth/register"
            className="px-4 py-1.5 text-sm bg-brown-600 text-white rounded-full hover:bg-brown-700 transition-colors"
          >
            회원가입
          </Link>
        </div>

        {/* 모바일: 햄버거 메뉴 (클라이언트 컴포넌트) */}
        <MobileMenu links={navLinks} />
      </div>
    </header>
  );
}
