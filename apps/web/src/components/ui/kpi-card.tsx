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
  return <div className={cn("crm-surface flex min-h-[108px] items-center justify-between gap-4 p-5 transition duration-150", className)}>
    <div className="min-w-0"><p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p><p className="mt-1.5 truncate text-xl font-semibold tracking-[-0.025em] text-foreground">{value}</p>{detail && <p className="mt-1 truncate text-xs text-muted">{detail}</p>}</div>
    <span className={`grid size-10 shrink-0 place-items-center rounded-xl border border-current/15 ${toneClasses[tone]}`}><Icon size={18} strokeWidth={1.9} /></span>
  </div>;
}
