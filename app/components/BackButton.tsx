"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

type BackButtonProps = {
  fallbackHref: string;
  fallbackStorageKey?: string;
  label?: string;
  preferFallback?: boolean;
  storageKey?: string;
};

function safeHref(value: string | null) {
  return value != null && value.startsWith("/") && !value.startsWith("//");
}

export default function BackButton({
  fallbackHref,
  fallbackStorageKey,
  label = "뒤로",
  preferFallback = false,
  storageKey,
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

  function handleBack() {
    if (preferFallback) {
      router.replace(fallbackHref);
      return;
    }
    const storedHref = getStoredHref(fallbackStorageKey) ?? getStoredHref(storageKey);
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
      className="-ml-2 inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm font-medium text-sage-600 transition-colors hover:bg-cream-200 hover:text-brown-800"
    >
      <ChevronLeft size={17} aria-hidden="true" />
      {label.replace(/^[←<]\s*/, "")}
    </button>
  );
}
