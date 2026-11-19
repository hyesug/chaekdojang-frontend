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
    <nav className="hidden flex-1 items-center gap-0.5 xl:flex" aria-label="주요 메뉴">
      {links.map(({ href, label, external }) => {
        const active = isActivePath(pathname, href);
        const cls = `whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[14.5px] transition-colors ${
          active
            ? "bg-brand-soft font-semibold text-brand"
            : "font-medium text-sage-600 hover:bg-cream-200 hover:text-brown-800"
        }`;
        return external ? (
          <a key={href} href={href} className={cls}>
            {label}
          </a>
        ) : (
          <Link key={href} href={href} className={cls} aria-current={active ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
