import type { LucideIcon } from "lucide-react";

export function KpiCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return <div className="flex min-h-24 items-center gap-3.5 rounded-xl border bg-white p-4 shadow-[0_4px_14px_rgba(23,32,51,0.055)] sm:p-5">
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon size={19} strokeWidth={1.8} /></span>
    <div><p className="text-xs text-muted">{label}</p><p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-foreground">{value}</p></div>
  </div>;
}
