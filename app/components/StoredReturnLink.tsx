"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function StoredReturnLink({
  href,
  storageKey,
  children,
  className,
}: {
  href: string;
  storageKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [resolvedHref, setResolvedHref] = useState(href);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored && stored.startsWith("/") && !stored.startsWith("//")) {
        setResolvedHref(stored);
      }
    } catch {
      setResolvedHref(href);
    }
  }, [href, storageKey]);

  return (
    <Link href={resolvedHref} className={className}>
      {children}
    </Link>
  );
}
