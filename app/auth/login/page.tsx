"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { OAUTH_BASE } from "../../lib/api";

const BACKEND = OAUTH_BASE;

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasError = searchParams.get("error") === "oauth_failed";
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => {
    setIsLocal(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  }, []);

  async function handleDevLogin() {
    const res = await fetch("/api/dev/login", { method: "POST" });
    if (!res.ok) return;
    const json = await res.json();
    const token = json.data?.token ?? json.token;
    if (!token) return;
    localStorage.setItem("token", token);
    window.dispatchEvent(new Event("auth-change"));
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold text-brown-800 mb-2">로그인</h1>
          <p className="text-sm text-brown-400">책도장에 오신 것을 환영합니다</p>
        </div>

        {hasError && (
          <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl text-center mb-4">
            로그인에 실패했습니다. 다시 시도해주세요.
          </p>
        )}

        <div className="bg-white rounded-2xl border border-cream-200 p-6 shadow-sm flex flex-col gap-3">
          <a
            href={`${BACKEND}/oauth2/authorization/kakao`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium bg-[#FEE500] text-[#3C1E1E] hover:brightness-95 transition"
          >
            <KakaoIcon />
            카카오로 로그인
          </a>
          <a
            href={`${BACKEND}/oauth2/authorization/naver`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium bg-[#03C75A] text-white hover:brightness-95 transition"
          >
            <NaverIcon />
            네이버로 로그인
          </a>
          <a
            href={`${BACKEND}/oauth2/authorization/google`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium bg-white text-brown-800 border border-cream-300 hover:bg-cream-50 transition"
          >
            <GoogleIcon />
            구글로 로그인
          </a>
          {isLocal && (
            <button
              type="button"
              onClick={handleDevLogin}
              className="w-full py-3 rounded-xl text-sm font-medium bg-cream-100 text-brown-700 hover:bg-cream-200 transition"
            >
              로컬 개발용 로그인
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
          <p className="text-sm text-brown-400">불러오는 중...</p>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path fillRule="evenodd" clipRule="evenodd"
        d="M9 1C4.582 1 1 3.91 1 7.5c0 2.254 1.458 4.234 3.658 5.385L3.75 16.5l4.032-2.67A9.6 9.6 0 009 14c4.418 0 8-2.91 8-6.5S13.418 1 9 1z"
        fill="#3C1E1E"/>
    </svg>
  );
}

function NaverIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M10.35 9.27L7.5 5H5v8h2.65V9.73L10.5 13H13V5h-2.65v4.27z" fill="white"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
