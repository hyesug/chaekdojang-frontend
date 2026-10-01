import type { ReactNode } from "react";

export function SectionHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return <header className="mb-6"><>{eyebrow && <p className="cdj-kicker">{eyebrow}</p>}</><h2 className="cdj-heading mt-2">{title}</h2>{children && <div className="mt-2 text-sm text-brown-500">{children}</div>}</header>;
}
