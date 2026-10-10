import type { ReactNode } from "react";

export function Alert({ tone = "info", children }: { tone?: "info" | "warning" | "error"; children: ReactNode }) {
  return <div role="alert" className={`cdj-alert ${tone === "error" ? "cdj-alert--error" : tone === "warning" ? "cdj-alert--warning" : ""}`}>{children}</div>;
}
