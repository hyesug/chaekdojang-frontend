"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 소셜 인증 흐름은 같지만, 사용자가 회원가입으로 들어온 맥락은 유지한다.
export default function RegisterPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/auth/login?mode=signup");
  }, [router]);
  return null;
}
