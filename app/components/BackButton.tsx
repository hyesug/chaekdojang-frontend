"use client";

import { useRouter } from "next/navigation";

type BackButtonProps = {
  fallbackHref: string;
  label?: string;
  preferFallback?: boolean;
  storageKey?: string;
  fallbackStorageKey?: string;
};

function safeHref(value: string | null) {
  return value != null && value.startsWith("/") && !value.startsWith("//");
}

export default function BackButton({
  fallbackHref,
  label = "← 뒤로",
  preferFallback = false,
  storageKey,
  fallbackStorageKey,
}: BackButtonProps) {
  const router = useRouter();

  function getStoredHref(key?: string) {
    if (!key) return null;
    try {
      const value = sessionStorage.getItem(key);
      return safeHref(value) ? value : null;
    } catch {
      return null;
    }
  }

  function getTargetHref() {
    return getStoredHref(storageKey) ?? getStoredHref(fallbackStorageKey) ?? fallbackHref;
  }

  function handleBack() {
    const target = getTargetHref();
    const hasStoredTarget = Boolean(getStoredHref(storageKey) ?? getStoredHref(fallbackStorageKey));
    if (preferFallback || hasStoredTarget) {
      router.push(target);
      return;
    }
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push(target);
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="text-sm text-brown-500 hover:text-brown-700"
    >
      {label}
    </button>
  );
}
