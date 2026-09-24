import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type KpiTone = "brand" | "success" | "warning" | "danger" | "neutral";
const toneClasses: Record<KpiTone, string> = {
  brand: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-red-50 text-danger",
  neutral: "bg-background text-muted",
};

export function KpiCard({ icon: Icon, label, value, detail, tone = "brand", className }: { icon: LucideIcon; label: string; value: string | number; detail?: string; tone?: KpiTone; className?: string }) {
  return <div className={cn("crm-surface flex min-h-[112px] items-center justify-between gap-2 p-3 transition duration-150 sm:min-h-[132px] sm:gap-4 sm:p-5", className)}>
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase leading-4 tracking-[0.08em] text-muted sm:text-[11px] sm:tracking-[0.1em]">{label}</p>
      <p className="mt-2 truncate text-xl font-bold leading-none tracking-[-0.02em] text-foreground sm:mt-2.5 sm:text-[28px]">{value}</p>
      {detail && <p className="mt-2 text-[11px] leading-4 text-muted sm:mt-2.5 sm:text-xs">{detail}</p>}
    </div>
    <span className={`grid size-9 shrink-0 place-items-center rounded-lg sm:size-12 sm:rounded-xl ${toneClasses[tone]}`}><Icon className="size-[17px] sm:size-5" strokeWidth={1.9} /></span>
  </div>;
}
