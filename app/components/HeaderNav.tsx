"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; external?: boolean };

// "/search?tab=books" 같은 링크도 경로 부분만 비교해 현재 메뉴를 표시한다.
export function isActivePath(pathname: string, href: string) {
  const path = href.split("?")[0];
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}

export default function HeaderNav({ links }: { links: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="hidden flex-1 items-center gap-0.5 lg:flex" aria-label="주요 메뉴">
      {links.map(({ href, label, external }) => {
        const active = isActivePath(pathname, href);
        const cls = `relative whitespace-nowrap rounded-md px-3 py-2 text-[15px] transition-colors ${
          active
            ? "font-semibold text-brown-800"
            : "font-medium text-sage-600 hover:bg-cream-200/70 hover:text-brown-800"
        }`;
        return external ? (
          <a key={href} href={href} className={cls}>
            {label}
          </a>
        ) : (
          <Link key={href} href={href} className={cls} aria-current={active ? "page" : undefined}>
            {label}
            {active && (
              <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-brown-700" aria-hidden="true" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
