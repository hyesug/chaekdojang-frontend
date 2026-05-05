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
    // 컴포넌트가 브라우저에 마운트된 이후에만 localStorage를 읽는다.
    // 서버 렌더링 시점에는 이 블록이 실행되지 않으므로 hydration 오류가 생기지 않는다.
    setMounted(true);
    setLoggedIn(!!localStorage.getItem("token"));
  }, []);

  function logout() {
    localStorage.removeItem("token");
    setLoggedIn(false);
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
