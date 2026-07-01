"use client";

import StoredReturnLink from "./StoredReturnLink";
import { bookReturnStorageKey } from "../lib/returnMemory";

export default function BookReturnLink({
  bookId,
  href,
  preferHref = false,
  children,
  className,
}: {
  bookId: number | string;
  href: string;
  preferHref?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <StoredReturnLink
      href={href}
      storageKey={bookReturnStorageKey(bookId)}
      preferHref={preferHref}
      className={className}
    >
      {children}
    </StoredReturnLink>
  );
}
