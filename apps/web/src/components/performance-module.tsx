"use client";

import { CheckCircle2, PhoneCall, Target, TrendingUp, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { KpiCard } from "@/components/ui/kpi-card";

type Performance = {
  period: { month: number; year: number };
  target: number | null;
  revenue: number;
  orderCount: number;
  newActiveClients: number;
  productiveVisits: number;
  callsAndVisits: number;
  leadsCreated: number;
  leadsConverted: number;
  conversionRatePercent: number | null;
  productMix: Array<{ productId: string; name: string; quantity: number; revenue: number }>;
};

const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function PerformanceModule() {
  const [data, setData] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/sales/performance", { cache: "no-store" });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error("Unable to load performance data.");
        setData(json as Performance);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load performance data."); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="h-24 animate-pulse rounded-xl bg-background" /><div className="h-24 animate-pulse rounded-xl bg-background" /><div className="h-24 animate-pulse rounded-xl bg-background" /><div className="h-24 animate-pulse rounded-xl bg-background" /></div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>;
  if (!data) return null;

  const progress = data.target ? Math.min(100, Math.round((data.revenue / data.target) * 100)) : null;

  return <div className="space-y-4">
    <section className="rounded-xl border bg-white p-5 shadow-[0_3px_12px_rgba(15,23,42,0.04)] sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{MONTHS[data.period.month - 1]} {data.period.year}</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
        <p className="text-2xl font-semibold tracking-[-0.02em] text-foreground">{money(data.revenue)}</p>
        {data.target != null && <p className="text-sm text-muted">Target {money(data.target)}</p>}
      </div>
      {progress != null && <div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-1.5 text-xs text-muted">{progress}% of target · {data.orderCount} orders</p></div>}
    </section>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard icon={UserCheck} label="New active salons" value={data.newActiveClients} tone="success" />
      <KpiCard icon={CheckCircle2} label="Productive visits" value={data.productiveVisits} tone="brand" />
      <KpiCard icon={PhoneCall} label="Calls & visits logged" value={data.callsAndVisits} tone="neutral" />
      <KpiCard icon={Target} label="Lead conversion" value={data.conversionRatePercent != null ? `${data.conversionRatePercent}%` : "—"} detail={`${data.leadsConverted} of ${data.leadsCreated} leads`} tone="warning" />
    </div>

    <section className="rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3 border-b px-5 py-4"><span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand"><TrendingUp size={17} /></span><div><h3 className="text-sm font-semibold text-foreground">Product mix this month</h3><p className="mt-0.5 text-xs text-muted">Top sellers from your orders</p></div></div>
      {data.productMix.length ? <div className="divide-y">{data.productMix.map((item) => <div key={item.productId} className="flex items-center justify-between px-5 py-3">
        <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{item.name}</p><p className="text-xs text-muted">{item.quantity} units</p></div>
        <p className="shrink-0 text-sm font-semibold text-foreground">{money(item.revenue)}</p>
      </div>)}</div> : <div className="px-5 py-8 text-center text-xs text-muted">No orders booked this month yet.</div>}
    </section>
  </div>;
}
