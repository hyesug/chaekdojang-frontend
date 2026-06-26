"use client";

import Link from "next/link";
import { usePwaInstallPrompt } from "../hooks/usePwaInstallPrompt";

export default function IosInstallBanner() {
  const { platform, canPromptInstall, shouldShowGuide, dismiss, promptInstall } = usePwaInstallPrompt();

  if (!shouldShowGuide && !canPromptInstall) return null;

  const instruction = platform === "ios"
    ? "iPhone에서는 Safari 공유 버튼을 누른 뒤 “홈 화면에 추가”를 선택해 주세요."
    : "Chrome에서 앱 설치 버튼을 누르거나 오른쪽 위 메뉴에서 홈 화면에 추가할 수 있어요.";

  return (
    <section className="mx-auto mb-6 w-full max-w-2xl px-4">
      <div className="rounded-lg border border-cream-300 bg-white px-4 py-3 text-sm text-brown-600 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-brown-800">책도장을 앱처럼 사용해보세요</p>
            <p className="mt-1 text-xs leading-5 text-brown-500">{instruction}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {canPromptInstall && (
                <button
                  type="button"
                  onClick={promptInstall}
                  className="rounded-full bg-brown-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brown-700"
                >
                  앱 설치하기
                </button>
              )}
              <Link href="/install" className="text-xs font-medium text-brown-700 underline underline-offset-2">
                설치 방법 보기
              </Link>
            </div>
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
