"use client";

import { useState } from "react";

type Props = {
  bio?: string | null;
  compact?: boolean;
  className?: string;
};

export const MAX_BIO_LENGTH = 150;

export default function ExpandableBio({ bio, compact = false, className = "" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const text = bio?.trim();
  if (!text) return null;

  if (compact) {
    return <p className={`text-xs text-brown-400 truncate ${className}`}>{text}</p>;
  }

  return (
    <div className={className}>
      <p className={`text-sm text-brown-500 whitespace-pre-wrap break-words ${expanded ? "" : "line-clamp-2"}`}>
        {text}
      </p>
      {text.length > 55 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-xs text-brown-400 hover:text-brown-600"
        >
          {expanded ? "접기" : "더보기"}
        </button>
      )}
    </div>
  );
}
