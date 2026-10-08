"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OAUTH_BASE } from "../../lib/api";
import { markLoggedIn } from "../../lib/auth";

const BACKEND = OAUTH_BASE;
const LOGIN_RETURN_TO_KEY = "chaekdojang:login-return-to";

function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasError = searchParams.get("error") === "oauth_failed";
  const isSignup = searchParams.get("mode") === "signup";
  const [isLocal, setIsLocal] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const needsAgeConfirmation = isSignup;
  const socialButtonClass =
    !needsAgeConfirmation || ageConfirmed
      ? ""
      : "opacity-50 cursor-not-allowed pointer-events-none";

  useEffect(() => {
    setIsLocal(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const returnTo = safeReturnTo(searchParams.get("returnTo"));
    if (returnTo) sessionStorage.setItem(LOGIN_RETURN_TO_KEY, returnTo);
  }, [searchParams]);

  async function handleDevLogin() {
    const res = await fetch("/api/dev/login", { method: "POST" });
    if (!res.ok) return;
    await res.json().catch(() => null);
    markLoggedIn();
    window.dispatchEvent(new Event("auth-change"));
    const returnTo = safeReturnTo(sessionStorage.getItem(LOGIN_RETURN_TO_KEY));
    sessionStorage.removeItem(LOGIN_RETURN_TO_KEY);
    router.push(returnTo ?? "/");
    router.refresh();
  }

  return (
    <div className="cdj-page flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="stamp-mark mx-auto h-11 w-11 text-base" aria-hidden="true">冊</span>
          <h1 className="cdj-title mt-5 text-[1.75rem]">
            {isSignup ? "책도장 시작하기" : "다시 오신 걸 환영해요"}
          </h1>
          <p className="cdj-lead mt-2">
            {isSignup
              ? "소셜 계정으로 책도장을 시작합니다."
              : "책도장에 다시 온 것을 환영합니다."}
          </p>
        </div>

        {hasError && (
          <p className="cdj-alert cdj-alert--error mb-4 text-center" role="alert">
            로그인에 실패했습니다. 다시 시도해주세요.
          </p>
        )}

        <div className="cdj-card flex flex-col gap-2.5 p-6">
          {needsAgeConfirmation && (
            <label className="mb-1 flex cursor-pointer items-start gap-2.5 rounded-lg border border-cream-300 bg-cream-100 px-3.5 py-3 text-left">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-cream-300 accent-brown-600"
              />
              <span className="text-[13px] leading-5 text-brown-900">
                만 14세 이상입니다. 만 14세 미만은 책도장에 가입하거나 서비스를 이용할 수 없습니다.
              </span>
            </label>
          )}

          <a
            href={`${BACKEND}/oauth2/authorization/kakao`}
            aria-disabled={needsAgeConfirmation && !ageConfirmed}
            className={`relative flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] px-4 text-[15px] font-semibold text-black/85 transition hover:brightness-[0.97] ${socialButtonClass}`}
          >
            <span className="absolute left-4"><KakaoIcon /></span>
            카카오로 {isSignup ? "시작하기" : "로그인"}
          </a>

          <a
            href={`${BACKEND}/oauth2/authorization/naver`}
            aria-disabled={needsAgeConfirmation && !ageConfirmed}
            className={`relative flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#03C75A] px-4 text-[15px] font-semibold text-white transition hover:brightness-[0.97] ${socialButtonClass}`}
          >
            <span className="absolute left-4"><NaverIcon /></span>
            네이버로 {isSignup ? "시작하기" : "로그인"}
          </a>

          <a
            href={`${BACKEND}/oauth2/authorization/google`}
            aria-disabled={needsAgeConfirmation && !ageConfirmed}
            className={`relative flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[#DADCE0] bg-white px-4 text-[15px] font-semibold text-[#1F1F1F] transition hover:bg-[#F8F9FA] ${socialButtonClass}`}
          >
            <span className="absolute left-4"><GoogleIcon /></span>
            구글로 {isSignup ? "시작하기" : "로그인"}
          </a>

          {isSignup && (
            <p className="mt-1 text-center text-xs leading-5 text-sage-600">
              이미 해당 소셜 계정으로 로그인된 적이 있으면 추가 입력 없이 이어집니다.
            </p>
          )}

          {isLocal && (
            <button
              type="button"
              onClick={handleDevLogin}
              className="cdj-button cdj-button--ghost mt-2 w-full"
            >
              로컬 개발자 로그인
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
          <p className="text-sm text-sage-600">불러오는 중...</p>
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
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 1C4.582 1 1 3.91 1 7.5c0 2.254 1.458 4.234 3.658 5.385L3.75 16.5l4.032-2.67A9.6 9.6 0 009 14c4.418 0 8-2.91 8-6.5S13.418 1 9 1z"
        fill="#3C1E1E"
      />
    </svg>
  );
}

function NaverIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M10.35 9.27L7.5 5H5v8h2.65V9.73L10.5 13H13V5h-2.65v4.27z" fill="white" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
      <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}
