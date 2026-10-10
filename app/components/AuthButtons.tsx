"use client";

/*
 * 헤더의 로그인/회원가입 버튼 영역.
 * 쿠키 기반 로그인 상태는 브라우저에서 세션 API로 확인한다.
 * 그래서 이 부분만 'use client' Client Component로 분리한다.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleUserRound } from "lucide-react";
import { isAuthenticated, logout as logoutSession } from "../lib/auth";

export default function AuthButtons() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    async function syncAuth() {
      setLoggedIn(await isAuthenticated());
    }

    setMounted(true);
    syncAuth();

    // 로그인/로그아웃 시 같은 탭에서도 즉시 반영
    window.addEventListener("auth-change", syncAuth);
    return () => window.removeEventListener("auth-change", syncAuth);
  }, []);

  async function logout() {
    setLoggedIn(false);
    await logoutSession();
    window.dispatchEvent(new Event("auth-change"));
    router.push("/");
    router.refresh(); // 서버 컴포넌트(피드 등)도 새로 불러오도록
  }

  // 마운트 전: 서버·클라이언트 HTML이 일치하도록 빈 공간 유지
  if (!mounted) {
    return <div className="hidden h-9 w-36 lg:block" />;
  }

  if (loggedIn) {
    return (
      <div className="hidden items-center gap-0.5 lg:flex">
        <Link href="/profile" className="cdj-icon-button" aria-label="내 프로필" title="내 프로필">
          <CircleUserRound size={20} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <button onClick={logout} className="cdj-button cdj-button--ghost cdj-button--sm">
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="hidden items-center gap-1 lg:flex">
      <Link href="/auth/login" className="cdj-button cdj-button--ghost cdj-button--sm">
        로그인
      </Link>
      <Link href="/auth/register" className="cdj-button cdj-button--secondary cdj-button--sm">
        회원가입
      </Link>
    </div>
  );
}
