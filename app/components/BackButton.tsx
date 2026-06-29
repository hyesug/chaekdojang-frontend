"use client";

import { useRouter } from "next/navigation";

type BackButtonProps = {
  fallbackHref: string;
  label?: string;
  preferFallback?: boolean;
  storageKey?: string;
};

export default function BackButton({
  fallbackHref,
  label = "← 뒤로",
  preferFallback = false,
  storageKey,
}: BackButtonProps) {
  const router = useRouter();

  function getStoredHref() {
    if (!storageKey) return null;
    try {
      const value = sessionStorage.getItem(storageKey);
      if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
      return value;
    } catch {
      return null;
    }
  }

  function handleBack() {
    if (preferFallback) {
      router.push(fallbackHref);
      return;
    }
    const storedHref = getStoredHref();
    if (storedHref) {
      router.push(storedHref);
      return;
    }
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
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
