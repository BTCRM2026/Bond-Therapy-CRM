import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-background text-muted border-border",
  success: "bg-[#ECFDF3] text-[#067647] border-[#ABEFC6]",
  warning: "bg-[#FFFAEB] text-[#B54708] border-[#FEDF89]",
  danger: "bg-[#FEF3F2] text-danger border-[#FECDCA]",
  info: "bg-[#EFF8FF] text-[#175CD3] border-[#B2DDFF]",
  brand: "bg-brand-soft text-brand-dark border-transparent",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
