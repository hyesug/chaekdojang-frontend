import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "text";
};

export function Button({ variant = "primary", className = "", type = "button", ...props }: Props) {
  return <button type={type} className={`cdj-button cdj-button--${variant} ${className}`} {...props} />;
}
