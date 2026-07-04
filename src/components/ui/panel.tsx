import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "app-surface rounded-lg shadow-sm shadow-slate-950/5 dark:shadow-black/20",
        className,
      )}
      {...props}
    />
  );
}
