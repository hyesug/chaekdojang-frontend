"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type NavLink = { href: string; label: string };

export default function MobileMenu({ links }: { links: NavLink[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!localStorage.getItem("token"));
  }, []);

  function logout() {
    localStorage.removeItem("token");
    setLoggedIn(false);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="md:hidden relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 text-brown-600 text-xl leading-none"
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-52 bg-white rounded-2xl shadow-lg border border-cream-200 p-4 flex flex-col gap-2">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="text-sm text-brown-700 font-medium hover:text-brown-500 py-1.5 px-2 rounded-lg hover:bg-cream-50 transition-colors"
            >
              {label}
            </Link>
          ))}
          <hr className="border-cream-200 my-1" />
          {loggedIn ? (
            <button
              onClick={logout}
              className="text-sm text-brown-500 font-medium py-1.5 px-2 text-left"
            >
              로그아웃
            </button>
          ) : (
            <>
              <Link
                href="/auth/login"
                onClick={() => setOpen(false)}
                className="text-sm text-brown-600 font-medium py-1.5 px-2"
              >
                로그인
              </Link>
              <Link
                href="/auth/register"
                onClick={() => setOpen(false)}
                className="px-4 py-2 bg-brown-600 text-white rounded-full text-sm text-center hover:bg-brown-700 transition-colors"
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
