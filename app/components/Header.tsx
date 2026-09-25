import Link from "next/link";
import MobileMenu from "./MobileMenu";
import AuthButtons from "./AuthButtons";
import NotificationBell from "./NotificationBell";
import AdminNavLink from "./AdminNavLink";

const navLinks = [
  { href: "/", label: "피드" },
  { href: "/search?tab=books", label: "검색" },
  { href: "/library", label: "서재" },
  { href: "/write", label: "독후감 쓰기" },
  { href: "/dojangdan", label: "도장단" },
  { href: "/contests", label: "공모전" },
  { href: "/groups", label: "독서모임" },
  { href: "/stats", label: "독서 인생지도" },
  // 운세는 Next 라우트가 아니라 public/unse 의 정적 사이트다.
  // next/link 로 걸면 클라이언트 라우팅이 잡아채 404 가 나므로 일반 링크로 나간다.
  { href: "/unse", label: "운세", external: true },
  { href: "/cs", label: "고객센터" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-cream-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
        <Link
          href="/"
          aria-label="책도장 홈으로 이동"
          className="relative z-10 -ml-2 flex-none inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-serif text-2xl font-bold tracking-tight text-brown-700"
        >
          <span className="stamp-mark pointer-events-none text-[11px] leading-none">冊</span>
          책도장
        </Link>

        <nav className="hidden md:flex flex-1 items-center justify-center gap-4">
          {navLinks.map(({ href, label, external }) => {
            const cls =
              "text-sm text-brown-500 hover:text-brown-800 transition-colors font-medium whitespace-nowrap";
            return external ? (
              <a key={href} href={href} className={cls}>
                {label}
              </a>
            ) : (
              <Link key={href} href={href} className={cls}>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-3 flex-none ml-auto">
          <AdminNavLink />
          <NotificationBell />
          <AuthButtons />
        </div>

        <div className="flex md:hidden items-center gap-2 flex-none ml-auto">
          <NotificationBell />
          <MobileMenu links={navLinks} />
        </div>
      </div>
    </header>
  );
}
