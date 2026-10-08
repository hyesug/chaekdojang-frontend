"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ModalShell({ title, onClose, children, className = "" }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const [mounted, setMounted] = useState(false);
  const modalRootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!mounted || !modalRootRef.current || !dialogRef.current) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const background = (Array.from(document.body.children) as HTMLElement[])
      .filter((element) => element !== modalRootRef.current)
      .map((element) => ({ element, inert: element.inert }));
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
      .filter((element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0);

    background.forEach(({ element }) => { element.inert = true; });
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => (focusable()[0] ?? dialogRef.current)?.focus());
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", closeOnEscape);
      background.forEach(({ element, inert }) => { element.inert = inert; });
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [mounted]);

  function trapFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
      .filter((element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0);
    if (items.length === 0) { event.preventDefault(); dialogRef.current?.focus(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  if (!mounted) return null;

  return createPortal(
    <div ref={modalRootRef} className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" tabIndex={-1} aria-hidden="true" className="cdj-backdrop absolute inset-0 cursor-default bg-brown-800/40" onClick={onClose} />
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onKeyDown={trapFocus} className={`cdj-dialog relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl border border-cream-300 bg-cream-50 shadow-[var(--shadow-floating)] sm:max-w-xl sm:rounded-xl ${className}`}>
        {children}
      </section>
    </div>,
    document.body,
  );
}

// 모달 머리: 제목과 닫기 버튼을 모든 모달에서 같은 모양으로 맞춘다.
export function ModalHeader({ title, onClose }: { title: ReactNode; onClose: () => void }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-cream-300 py-3 pl-5 pr-3">
      <h2 className="text-base font-bold text-brown-800">{title}</h2>
      <button type="button" onClick={onClose} className="cdj-icon-button" aria-label="닫기">
        <X size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </header>
  );
}
