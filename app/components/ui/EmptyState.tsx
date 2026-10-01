import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <section className="border-y border-cream-300 py-12 text-center"><h2 className="font-serif text-xl font-semibold text-brown-800">{title}</h2>{children && <div className="mt-3 text-sm text-brown-500">{children}</div>}</section>;
}
