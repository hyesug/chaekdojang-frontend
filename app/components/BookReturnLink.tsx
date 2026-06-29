"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { bookReturnStorageKey } from "./BookReturnMemory";

type Props = {
  bookId: number | string;
  fallbackHref: string;
  children: React.ReactNode;
  className?: string;
};

function safe(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

export default function BookReturnLink({ bookId, fallbackHref, children, className }: Props) {
  const [href, setHref] = useState(fallbackHref);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(bookReturnStorageKey(bookId));
      if (stored && safe(stored)) setHref(stored);
    } catch {
      setHref(fallbackHref);
    }
  }, [bookId, fallbackHref]);

  return <Link href={href} className={className}>{children}</Link>;
}
