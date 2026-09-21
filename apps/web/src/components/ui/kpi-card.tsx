import type { LucideIcon } from "lucide-react";

type KpiTone = "brand" | "success" | "warning" | "danger" | "neutral";
const toneClasses: Record<KpiTone, string> = {
  brand: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-red-50 text-danger",
  neutral: "bg-background text-muted",
};

export function KpiCard({ icon: Icon, label, value, detail, tone = "brand" }: { icon: LucideIcon; label: string; value: string | number; detail?: string; tone?: KpiTone }) {
  return <div className="flex min-h-24 items-center gap-4 rounded-xl border bg-white p-4 shadow-[0_3px_12px_rgba(15,23,42,0.045)] sm:p-5">
    <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${toneClasses[tone]}`}><Icon size={18} strokeWidth={1.9} /></span>
    <div className="min-w-0"><p className="text-[11px] font-medium text-muted">{label}</p><p className="mt-1 truncate text-xl font-semibold tracking-[-0.025em] text-foreground">{value}</p>{detail && <p className="mt-0.5 truncate text-[11px] text-muted">{detail}</p>}</div>
  </div>;
}
