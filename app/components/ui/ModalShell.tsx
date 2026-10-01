"use client";

import { useEffect, type ReactNode } from "react";

export function ModalShell({ title, onClose, children, className = "" }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", closeOnEscape); return () => window.removeEventListener("keydown", closeOnEscape); }, [onClose]);
  return <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"><button aria-label="닫기" className="absolute inset-0 cursor-default bg-black/45" onClick={onClose} /><section role="dialog" aria-modal="true" aria-label={title} className={`relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden bg-cream-50 sm:max-w-xl ${className}`}>{children}</section></div>;
}
