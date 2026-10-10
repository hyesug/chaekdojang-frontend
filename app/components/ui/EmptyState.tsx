import type { ReactNode } from "react";

export function EmptyState({ title, children, icon, action }: { title: string; children?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col items-center rounded-xl border border-dashed border-cream-300 px-6 py-14 text-center">
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cream-200 text-sage-600">{icon}</div>}
      <h2 className="text-base font-bold text-brown-800">{title}</h2>
      {children && <div className="mt-1.5 max-w-sm text-sm leading-6 text-sage-600">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}
