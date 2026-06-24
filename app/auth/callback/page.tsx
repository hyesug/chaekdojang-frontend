"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trackMetric } from "../../components/AnalyticsTracker";

// useSearchParams()는 Next.js에서 반드시 Suspense 안에 있어야 빌드가 통과됨
function OAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");
    const setup = searchParams.get("setup");

    if (token) {
      window.dispatchEvent(new Event("auth-change"));
      trackMetric("login_success", "/auth/callback");
      router.replace(setup === "true" ? "/setup-nickname" : "/");
    } else if (error) {
      router.replace("/auth/login?error=oauth_failed");
    } else {
      window.dispatchEvent(new Event("auth-change"));
      trackMetric("login_success", "/auth/callback");
      router.replace(setup === "true" ? "/setup-nickname" : "/");
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
      <p className="text-sm text-brown-400">로그인 처리 중...</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
          <p className="text-sm text-brown-400">로그인 처리 중...</p>
        </div>
      }
    >
      <OAuthCallback />
    </Suspense>
  );
}
