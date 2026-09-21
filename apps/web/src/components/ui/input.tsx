import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border bg-white px-3 text-sm text-foreground outline-none transition duration-150 placeholder:text-subtle focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:bg-background disabled:text-subtle sm:h-10",
        className,
      )}
      {...props}
    />
  );
}
