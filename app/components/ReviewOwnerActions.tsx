"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch } from "../lib/auth";

type Me = { id: number };

export default function ReviewOwnerActions({
  reviewId,
  authorId,
}: {
  reviewId: number;
  authorId: number | null;
}) {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (authorId == null) return;
    authFetch("/api/users/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const me = (json?.data ?? json) as Me | null;
        setIsOwner(me?.id === authorId);
      })
      .catch(() => {});
  }, [authorId]);

  if (!isOwner) return null;

  return (
    <div className="mb-4 flex justify-end">
      <Link
        href={`/reviews/${reviewId}/edit`}
        className="rounded-full border border-brown-200 bg-white px-4 py-1.5 text-xs text-brown-500 hover:border-brown-400 hover:text-brown-800"
      >
        독후감 수정
      </Link>
    </div>
  );
}
