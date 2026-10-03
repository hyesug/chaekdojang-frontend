"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
    <div ref={modalRootRef} className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" tabIndex={-1} aria-hidden="true" className="absolute inset-0 cursor-default bg-black/45" onClick={onClose} />
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onKeyDown={trapFocus} className={`relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden bg-cream-50 sm:max-w-xl ${className}`}>
        {children}
      </section>
    </div>,
    document.body,
  );
}
