"use client";

import { useEffect } from "react";
import { bookReturnStorageKey } from "../lib/returnMemory";

function isSafeInternalHref(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

export default function BookReturnMemory({
  bookId,
  href,
}: {
  bookId: number | string;
  href: string;
}) {
  useEffect(() => {
    if (!isSafeInternalHref(href)) return;
    try {
      sessionStorage.setItem(bookReturnStorageKey(bookId), href);
    } catch {
      /* storage may be unavailable */
    }
  }, [bookId, href]);

  return null;
}
