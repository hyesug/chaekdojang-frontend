"use client";

import { useEffect } from "react";
import { bookReturnStorageKey } from "../lib/returnMemory";

function isSafeInternalHref(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

export default function ReviewReturnMemory({
  bookId,
  reviewId,
  returnTo,
}: {
  bookId?: number | string | null;
  reviewId: number | string;
  returnTo: string | null;
}) {
  useEffect(() => {
    if (!returnTo || !isSafeInternalHref(returnTo)) return;
    try {
      sessionStorage.setItem(`chaekdojang:return-to:${reviewId}`, returnTo);
      if (bookId != null) {
        sessionStorage.setItem(bookReturnStorageKey(bookId), returnTo);
      }
    } catch {
      /* storage may be unavailable */
    }
  }, [bookId, reviewId, returnTo]);

  return null;
}
