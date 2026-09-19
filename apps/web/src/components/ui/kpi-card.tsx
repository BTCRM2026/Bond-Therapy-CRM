import type { LucideIcon } from "lucide-react";

export function KpiCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return <div className="flex min-h-24 items-center gap-4 rounded-xl border bg-white p-4 shadow-[0_3px_12px_rgba(23,35,31,0.045)] sm:p-5">
    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Icon size={18} strokeWidth={1.9} /></span>
    <div><p className="text-[11px] font-medium text-muted">{label}</p><p className="mt-1 text-xl font-semibold tracking-[-0.025em] text-foreground">{value}</p></div>
  </div>;
}
