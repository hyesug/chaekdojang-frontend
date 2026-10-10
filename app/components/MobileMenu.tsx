"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Menu, X } from "lucide-react";
import AdminNavLink from "./AdminNavLink";
import { isActivePath, type NavItem } from "./HeaderNav";
import { isAuthenticated, logout as logoutSession } from "../lib/auth";

export default function MobileMenu({ links }: { links: NavItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    async function syncAuth() {
      setLoggedIn(await isAuthenticated());
    }

    syncAuth();
    window.addEventListener("auth-change", syncAuth);
    return () => window.removeEventListener("auth-change", syncAuth);
  }, []);

  // 메뉴가 열려 있는 동안 Esc 로 닫는다
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function logout() {
    setLoggedIn(false);
    await logoutSession();
    window.dispatchEvent(new Event("auth-change"));
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const itemCls = (active: boolean) =>
    `flex min-h-12 items-center justify-between rounded-md px-3 text-[15px] transition-colors ${
      active ? "bg-brown-100 font-semibold text-brown-800" : "text-brown-900 hover:bg-cream-200"
    }`;

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="cdj-icon-button"
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={open}
      >
        {open ? <X size={22} strokeWidth={1.75} /> : <Menu size={22} strokeWidth={1.75} />}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-x-0 bottom-0 top-16 bg-brown-800/20 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-0 top-16 flex max-h-[calc(100dvh-64px)] flex-col overflow-y-auto border-b border-cream-300 bg-cream-50 px-4 pb-5 pt-3 shadow-[var(--shadow-floating)]">
            <nav className="flex flex-col gap-0.5" aria-label="모바일 메뉴">
              {links.map(({ href, label, external }) => {
                const active = isActivePath(pathname, href);
                // 운세는 Next 라우트가 아니라 정적 사이트라 일반 링크로 나간다
                return external ? (
                  <a key={href} href={href} onClick={() => setOpen(false)} className={itemCls(false)}>
                    {label}
                  </a>
                ) : (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={itemCls(active)}
                    aria-current={active ? "page" : undefined}
                  >
                    {label}
                    <ChevronRight size={16} className="text-sage-500" aria-hidden="true" />
                  </Link>
                );
              })}
              <Link href="/install" onClick={() => setOpen(false)} className={itemCls(false)}>
                앱처럼 사용하기
                <ChevronRight size={16} className="text-sage-500" aria-hidden="true" />
              </Link>
              <div className="px-3 py-2">
                <AdminNavLink onClick={() => setOpen(false)} />
              </div>
            </nav>
            <div className="mt-2 border-t border-cream-300 pt-4">
              {loggedIn ? (
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/profile" onClick={() => setOpen(false)} className="cdj-button cdj-button--secondary">
                    내 프로필
                  </Link>
                  <button onClick={logout} className="cdj-button cdj-button--ghost">
                    로그아웃
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/auth/login" onClick={() => setOpen(false)} className="cdj-button cdj-button--secondary">
                    로그인
                  </Link>
                  <Link href="/auth/register" onClick={() => setOpen(false)} className="cdj-button cdj-button--primary">
                    회원가입
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
