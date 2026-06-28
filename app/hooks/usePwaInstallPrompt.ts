"use client";

import { useCallback, useEffect, useState } from "react";

export const PWA_DISMISSED_KEY = "chaekdojang:pwa-install-banner-dismissed-at";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type PwaPlatform = "ios" | "android" | "desktop" | "unknown";

function detectPlatform(userAgent: string): PwaPlatform {
  if (/iPhone|iPod|iPad/.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  if (/Chrome|Chromium|Edg/i.test(userAgent)) return "desktop";
  return "unknown";
}

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isRecentlyDismissed() {
  const dismissedAt = Number(localStorage.getItem(PWA_DISMISSED_KEY) ?? 0);
  return dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_MS;
}

export function usePwaInstallPrompt() {
  const [platform, setPlatform] = useState<PwaPlatform>("unknown");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setPlatform(detectPlatform(window.navigator.userAgent));
    setStandalone(isStandaloneMode());
    setDismissed(isRecentlyDismissed());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setDismissed(isRecentlyDismissed());
    }

    function handleInstalled() {
      setDeferredPrompt(null);
      setStandalone(true);
      setDismissed(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(PWA_DISMISSED_KEY, String(Date.now()));
    setDismissed(true);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => null);
    setDeferredPrompt(null);
    dismiss();
    return true;
  }, [deferredPrompt, dismiss]);

  const canPromptInstall = platform === "android" && Boolean(deferredPrompt) && !standalone && !dismissed;
  const shouldShowGuide = !standalone && !dismissed && (platform === "ios" || platform === "android");

  return {
    platform,
    standalone,
    canPromptInstall,
    shouldShowGuide,
    dismiss,
    promptInstall,
  };
}
