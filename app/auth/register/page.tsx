"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 소셜 로그인만 지원하므로 회원가입과 로그인이 같다.
// /auth/register 로 접근하면 /auth/login 으로 보낸다.
export default function RegisterPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/auth/login");
  }, [router]);
  return null;
}
