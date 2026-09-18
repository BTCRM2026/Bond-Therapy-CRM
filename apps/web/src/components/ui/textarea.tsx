import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-foreground outline-none transition duration-150 placeholder:text-subtle focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:bg-background disabled:text-subtle",
        className,
      )}
      {...props}
    />
  );
}
