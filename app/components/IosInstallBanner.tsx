"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISSED_KEY = "chaekdojang:pwa-install-banner-dismissed-at";
const DISMISS_DAYS = 7;
const DISMISS_MS = DISMISS_DAYS * 24 * 60 * 60 * 1000;

type InstallPlatform = "ios" | "android";

function detectPlatform(userAgent: string): InstallPlatform | null {
  if (/iPhone|iPod|iPad/.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return null;
}

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isRecentlyDismissed() {
  const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
  return dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_MS;
}

export default function IosInstallBanner() {
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);

  useEffect(() => {
    if (isRecentlyDismissed()) return;
    if (isStandaloneMode()) return;

    const detected = detectPlatform(window.navigator.userAgent);
    if (!detected) return;

    setPlatform(detected);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setPlatform(null);
  }

  if (!platform) return null;

  const instruction = platform === "ios"
    ? "Safari 공유 버튼을 누른 뒤 홈 화면에 추가를 선택하면 앱처럼 바로 열 수 있어요."
    : "Chrome 오른쪽 위 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택하면 앱처럼 바로 열 수 있어요.";

  return (
    <section className="mx-auto mb-6 w-full max-w-2xl px-4">
      <div className="rounded-lg border border-cream-300 bg-white px-4 py-3 text-sm text-brown-600 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-brown-800">책도장을 앱처럼 사용해보세요</p>
            <p className="mt-1 text-xs leading-5 text-brown-500">{instruction}</p>
            <Link href="/install" className="mt-2 inline-block text-xs font-medium text-brown-700 underline underline-offset-2">
              설치 방법 자세히 보기
            </Link>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-brown-400 transition-colors hover:bg-cream-100 hover:text-brown-700"
            aria-label="홈 화면 추가 안내 닫기"
          >
            7일간 닫기
          </button>
        </div>
      </div>
    </section>
  );
}
