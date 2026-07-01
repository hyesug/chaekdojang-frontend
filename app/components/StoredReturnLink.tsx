"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function StoredReturnLink({
  href,
  storageKey,
  preferHref = false,
  children,
  className,
}: {
  href: string;
  storageKey: string;
  preferHref?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [resolvedHref, setResolvedHref] = useState(href);

  useEffect(() => {
    if (preferHref) {
      setResolvedHref(href);
      return;
    }
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored && stored.startsWith("/") && !stored.startsWith("//")) {
        setResolvedHref(stored);
        return;
      }
    } catch {
      /* keep fallback */
    }
    setResolvedHref(href);
  }, [href, preferHref, storageKey]);

  return (
    <Link href={resolvedHref} className={className}>
      {children}
    </Link>
  );
}
