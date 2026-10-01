import type { ReactNode } from "react";

export function StatusBadge({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "danger"; children: ReactNode }) {
  const tones = { neutral: "border-cream-300 text-brown-600", success: "border-brown-500 text-brown-700", warning: "border-yellow-700 text-yellow-800", danger: "border-wine-500 text-wine-700" };
  return <span className={`inline-flex items-center border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
