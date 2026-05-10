"use client";

/*
 * 헤더의 로그인/회원가입 버튼 영역.
 * localStorage는 브라우저에서만 읽을 수 있어서 Server Component인 Header에서 직접 쓸 수 없다.
 * 그래서 이 부분만 'use client' Client Component로 분리한다.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AuthButtons() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    function syncAuth() {
      const token = localStorage.getItem("token");
      if (!token || token === "undefined" || token === "null") {
        localStorage.removeItem("token");
        setLoggedIn(false);
      } else {
        setLoggedIn(true);
      }
    }

    setMounted(true);
    syncAuth();

    // 로그인/로그아웃 시 같은 탭에서도 즉시 반영
    window.addEventListener("auth-change", syncAuth);
    return () => window.removeEventListener("auth-change", syncAuth);
  }, []);

  function logout() {
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("auth-change"));
    router.push("/");
    router.refresh(); // 서버 컴포넌트(피드 등)도 새로 불러오도록
  }

  // 마운트 전: 서버·클라이언트 HTML이 일치하도록 빈 공간 유지
  if (!mounted) {
    return <div className="hidden md:block w-40 h-8" />;
  }

  if (loggedIn) {
    return (
      <div className="hidden md:flex items-center gap-2">
        <Link
          href="/profile"
          className="px-4 py-1.5 text-sm text-brown-600 hover:text-brown-800 transition-colors"
        >
          내 프로필
        </Link>
        <Link
          href="/library"
          className="px-4 py-1.5 text-sm text-brown-600 hover:text-brown-800 transition-colors"
        >
          내 서재
        </Link>
        <button
          onClick={logout}
          className="px-4 py-1.5 text-sm border border-brown-300 text-brown-500 rounded-full hover:bg-cream-200 transition-colors"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
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
  );
}
