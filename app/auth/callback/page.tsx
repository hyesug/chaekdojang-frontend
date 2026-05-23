"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * 소셜 로그인 후 백엔드가 이 페이지로 리다이렉트한다.
 * URL 파라미터에서 JWT 토큰을 꺼내 localStorage에 저장하고 메인 페이지로 이동.
 */
export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (token) {
      localStorage.setItem("token", token);
      window.dispatchEvent(new Event("auth-change"));
      router.replace("/");
    } else if (error) {
      router.replace("/auth/login?error=oauth_failed");
    } else {
      router.replace("/auth/login");
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
      <p className="text-sm text-brown-400">로그인 처리 중...</p>
    </div>
  );
}
