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
  return <div className={cn("crm-surface flex min-h-[132px] items-center justify-between gap-4 p-6 transition duration-150", className)}>
    <div className="min-w-0">
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-2.5 truncate text-[28px] font-bold leading-none tracking-[-0.02em] text-foreground">{value}</p>
      {detail && <p className="mt-2.5 truncate text-xs text-muted">{detail}</p>}
    </div>
    <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${toneClasses[tone]}`}><Icon size={20} strokeWidth={1.9} /></span>
  </div>;
}
