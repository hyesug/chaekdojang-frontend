import type { ReactNode } from "react";

export function TableShell({ label, children }: { label: string; children: ReactNode }) {
  return <div className="cdj-table-wrap" role="region" aria-label={label} tabIndex={0}>{children}</div>;
}
