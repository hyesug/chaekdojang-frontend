import Link from "next/link";
import MobileMenu from "./MobileMenu";
import AuthButtons from "./AuthButtons";
import NotificationBell from "./NotificationBell";
import AdminNavLink from "./AdminNavLink";

// external 은 지금 쓰는 항목이 없지만(운세를 메뉴에서 뺐다) 타입에는 남겨 둔다.
// 빼면 되살릴 때 타입 오류부터 나고, MobileMenu 도 이 모양을 받는다.
const navLinks: { href: string; label: string; external?: boolean }[] = [
  { href: "/", label: "피드" },
  { href: "/search?tab=books", label: "검색" },
  { href: "/library", label: "서재" },
  { href: "/write", label: "독후감 쓰기" },
  { href: "/dojangdan", label: "도장단" },
  { href: "/contests", label: "공모전" },
  { href: "/groups", label: "독서모임" },
  { href: "/stats", label: "독서 인생지도" },
  // 운세는 메뉴에서 뺐다. 페이지(/unse)는 그대로 살아 있고 주소로 들어가면
  // 열린다 — AI 질문 한 번에 수백 원이 들어 아직 일반 공개할 단계가 아니다.
  // 되살릴 때는 아래 한 줄의 주석만 풀면 되고, public/unse/index.html 의
  // 헤더에서도 같이 빼 두었으니 그쪽도 함께 풀 것.
  // { href: "/unse", label: "운세", external: true },
  { href: "/cs", label: "고객센터" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-cream-300 bg-cream-50/95 backdrop-blur-sm">
      <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center gap-4 px-4">
        <Link
          href="/"
          aria-label="책도장 홈으로 이동"
          className="relative z-10 -ml-2 inline-flex min-h-11 flex-none items-center gap-2 px-2 font-serif text-xl font-semibold tracking-tight text-brown-800"
        >
          <span className="stamp-mark pointer-events-none text-[11px] leading-none">冊</span>
          책도장
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-5 lg:flex" aria-label="주요 메뉴">
          {navLinks.map(({ href, label, external }) => {
            const cls =
              "border-b-2 border-transparent py-1 text-sm text-brown-500 transition-colors hover:border-brown-500 hover:text-brown-800 whitespace-nowrap";
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

        <div className="ml-auto hidden flex-none items-center gap-3 lg:flex">
          <AdminNavLink />
          <NotificationBell />
          <AuthButtons />
        </div>

        <div className="ml-auto flex flex-none items-center gap-2 lg:hidden">
          <NotificationBell />
          <MobileMenu links={navLinks} />
        </div>
      </div>
    </header>
  );
}
