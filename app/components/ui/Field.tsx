import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

type BaseProps = { label: string; hint?: ReactNode; error?: ReactNode; children: (props: { id: string; "aria-describedby"?: string; "aria-invalid": boolean }) => ReactNode };

export function Field({ label, hint, error, children }: BaseProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return <div className="space-y-1.5"><label className="block text-sm font-medium text-brown-700" htmlFor={id}>{label}</label>{children({ id, "aria-describedby": describedBy, "aria-invalid": Boolean(error) })}{hint && <p id={hintId} className="text-xs text-brown-500">{hint}</p>}{error && <p id={errorId} className="text-xs text-wine-700" role="alert">{error}</p>}</div>;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`cdj-field ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`cdj-field resize-y ${className}`} {...props} />;
}
