"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminNavLink from "./AdminNavLink";
import { isAuthenticated, logout as logoutSession } from "../lib/auth";

type NavLink = { href: string; label: string; external?: boolean };

export default function MobileMenu({ links }: { links: NavLink[] }) {
  const router = useRouter();
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

  async function logout() {
    setLoggedIn(false);
    await logoutSession();
    window.dispatchEvent(new Event("auth-change"));
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative lg:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 min-w-11 items-center justify-center p-2 text-xl leading-none text-brown-700"
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <div className="absolute right-0 top-12 flex max-h-[calc(100dvh-68px)] w-64 flex-col gap-1 overflow-y-auto border border-cream-300 bg-cream-50 p-3 shadow-[var(--shadow-floating)]">
          {links.map(({ href, label, external }) => {
            const cls =
              "min-h-11 border-b border-cream-200 px-2 py-3 text-sm text-brown-700 transition-colors hover:bg-cream-100";
            // 운세는 Next 라우트가 아니라 정적 사이트라 일반 링크로 나간다
            return external ? (
              <a key={href} href={href} onClick={() => setOpen(false)} className={cls}>
                {label}
              </a>
            ) : (
              <Link key={href} href={href} onClick={() => setOpen(false)} className={cls}>
                {label}
              </Link>
            );
          })}
          <Link
            href="/install"
            onClick={() => setOpen(false)}
            className="min-h-11 border-b border-cream-200 px-2 py-3 text-sm text-brown-700 transition-colors hover:bg-cream-100"
          >
            앱처럼 사용하기
          </Link>
          <AdminNavLink onClick={() => setOpen(false)} />
          <hr className="border-cream-200 my-1" />
          {loggedIn ? (
            <>
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="min-h-11 px-2 py-3 text-sm text-brown-700 transition-colors hover:bg-cream-100"
              >
                내 프로필
              </Link>
              <button
                onClick={logout}
                className="min-h-11 px-2 py-3 text-left text-sm text-brown-500"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                onClick={() => setOpen(false)}
                className="min-h-11 px-2 py-3 text-sm text-brown-600"
              >
                로그인
              </Link>
              <Link
                href="/auth/register"
                onClick={() => setOpen(false)}
                className="cdj-button cdj-button--primary mt-2 text-center"
              >
                회원가입
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
