import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary: "border border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] hover:opacity-85",
    secondary: "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-strong)]",
    ghost: "bg-transparent text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]",
    danger: "border border-[var(--danger)] bg-[var(--danger)] text-white hover:opacity-85",
    success: "border border-[var(--success)] bg-[var(--success)] text-white hover:opacity-85",
  };
  return (
    <button
      className={cn(
        "focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition duration-150 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
