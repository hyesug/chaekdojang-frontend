"use client";

import { useRouter } from "next/navigation";

type BackButtonProps = {
  fallbackHref: string;
  label?: string;
  preferFallback?: boolean;
};

export default function BackButton({
  fallbackHref,
  label = "← 뒤로",
  preferFallback = false,
}: BackButtonProps) {
  const router = useRouter();

  function handleBack() {
    if (preferFallback) {
      router.push(fallbackHref);
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
