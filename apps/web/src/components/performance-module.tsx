"use client";

import { useEffect, useState } from "react";

type Metric = { metric: string; achieved: number; target: number | null };
type ProductMixRow = { productId: string; name: string; quantity: number; revenue: number };
type Performance = { period: { month: number; year: number }; metrics: Metric[]; productMix: ProductMixRow[] };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const METRIC_LABELS: Record<string, string> = { REVENUE: "Revenue", COLLECTION: "Collection", NEW_ACTIVE_SALONS: "New Active Salons", VISITS: "Visits", PRODUCTIVE_VISITS: "Productive Visits", CALLS: "Calls", FOLLOW_UPS: "Follow-ups" };
const CURRENCY_METRICS = new Set(["REVENUE", "COLLECTION"]);
const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const format = (metric: string, value: number) => CURRENCY_METRICS.has(metric) ? money(value) : value.toLocaleString("en-IN");

export function PerformanceModule() {
  const [data, setData] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/targets/performance/me", { cache: "no-store" });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error("Unable to load your performance.");
        setData(json as Performance);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load your performance."); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="space-y-3"><div className="h-24 animate-pulse rounded-xl bg-background" /><div className="h-64 animate-pulse rounded-xl bg-background" /></div>;
  if (error || !data) return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error || "Unable to load your performance."}</div>;

  return <div className="space-y-5">
    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{MONTHS[data.period.month - 1]} {data.period.year}</p>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
      {data.metrics.map((metric) => <MetricCard key={metric.metric} metric={metric} />)}
    </div>
    {data.productMix.length > 0 && <section className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
      <div className="border-b px-4 py-3 sm:px-5"><p className="text-sm font-semibold text-foreground">Product mix</p><p className="mt-0.5 text-xs text-muted">Top sellers this period</p></div>
      <div className="divide-y">{data.productMix.map((row) => <div key={row.productId} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{row.name}</p><p className="mt-0.5 text-xs text-muted">{row.quantity} unit{row.quantity === 1 ? "" : "s"}</p></div>
        <p className="shrink-0 text-sm font-semibold text-foreground">{money(row.revenue)}</p>
      </div>)}</div>
    </section>}
  </div>;
}

function MetricCard({ metric }: { metric: Metric }) {
  const label = METRIC_LABELS[metric.metric] ?? metric.metric;
  const percent = metric.target && metric.target > 0 ? Math.min(100, Math.round((metric.achieved / metric.target) * 100)) : null;
  return <div className="crm-surface p-3 sm:p-5">
    <p className="text-[10px] font-semibold uppercase leading-4 tracking-[0.08em] text-muted sm:text-[11px] sm:tracking-[0.1em]">{label}</p>
    <div className="mt-2 flex items-baseline gap-1.5">
      <p className="min-w-0 truncate text-xl font-bold tracking-[-0.02em] text-foreground sm:text-2xl">{format(metric.metric, metric.achieved)}</p>
      {metric.target != null && <p className="hidden text-sm text-muted sm:block">/ {format(metric.metric, metric.target)}</p>}
    </div>
    {percent != null ? <>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${percent}%` }} /></div>
      <p className="mt-1.5 text-xs font-medium text-muted">{percent}% of target</p>
    </> : <p className="mt-3 text-xs text-subtle">No target set for this period</p>}
  </div>;
}
