"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "chaekdojang:ios-install-banner-dismissed";

function isIosDevice(userAgent: string) {
  return /iPhone|iPod/.test(userAgent);
}

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function IosInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) === "true") return;
    if (!isIosDevice(window.navigator.userAgent)) return;
    if (isStandaloneMode()) return;

    setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section className="mx-auto mb-6 w-full max-w-2xl px-4">
      <div className="rounded-lg border border-cream-300 bg-white px-4 py-3 text-sm text-brown-600 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-brown-800">책도장을 홈 화면에 추가해보세요</p>
            <p className="mt-1 text-xs leading-5 text-brown-500">
              Safari 공유 버튼을 누른 뒤 홈 화면에 추가를 선택하면 앱처럼 바로 열 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-brown-400 transition-colors hover:bg-cream-100 hover:text-brown-700"
            aria-label="홈 화면 추가 안내 닫기"
          >
            닫기
          </button>
        </div>
      </div>
    </section>
  );
}
