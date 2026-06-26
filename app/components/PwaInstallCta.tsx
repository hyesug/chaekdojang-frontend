"use client";

import Link from "next/link";
import { usePwaInstallPrompt } from "../hooks/usePwaInstallPrompt";

type Props = {
  variant?: "inline" | "card";
};

export default function PwaInstallCta({ variant = "card" }: Props) {
  const { platform, standalone, canPromptInstall, shouldShowGuide, dismiss, promptInstall } = usePwaInstallPrompt();

  if (standalone || (!shouldShowGuide && !canPromptInstall)) return null;

  const href = "/install";
  const buttonText = canPromptInstall ? "앱 설치하기" : "앱처럼 사용하기";
  const guideText = platform === "ios"
    ? "iPhone에서는 Safari 공유 버튼에서 홈 화면에 추가할 수 있어요."
    : "홈 화면에 추가하면 더 빠르게 열 수 있어요.";

  const action = canPromptInstall ? (
    <button
      type="button"
      onClick={promptInstall}
      className="rounded-full bg-brown-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brown-700"
    >
      {buttonText}
    </button>
  ) : (
    <Link
      href={href}
      className="rounded-full bg-brown-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brown-700"
    >
      {buttonText}
    </Link>
  );

  if (variant === "inline") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-brown-500">
        <span>{guideText}</span>
        {action}
        <button type="button" onClick={dismiss} className="text-brown-400 underline underline-offset-2 hover:text-brown-600">
          7일간 닫기
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cream-200 bg-white px-4 py-3">
      <p className="text-sm font-semibold text-brown-800">책도장을 앱처럼 사용해보세요</p>
      <p className="mt-1 text-xs text-brown-500">{guideText}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {action}
        <button type="button" onClick={dismiss} className="text-xs text-brown-400 underline underline-offset-2 hover:text-brown-600">
          7일간 닫기
        </button>
      </div>
    </div>
  );
}
