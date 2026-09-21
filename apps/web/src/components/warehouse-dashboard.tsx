"use client";

import { AlertTriangle, PackageCheck, PackagePlus, Truck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type DashboardData = {
  pendingDispatch: number;
  lowStockCount: number;
  receivedToday: number;
  dispatchedToday: number;
  lowStockItems: Array<{ id: string; name: string; stockOnHand: number; unit: string }>;
};

export function WarehouseDashboardWidgets() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/warehouse/dashboard", { cache: "no-store" });
        if (response.ok && !cancelled) setData(await response.json());
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="h-24 animate-pulse rounded-xl bg-background" /><div className="h-24 animate-pulse rounded-xl bg-background" /><div className="h-24 animate-pulse rounded-xl bg-background" /><div className="h-24 animate-pulse rounded-xl bg-background" /></div>;
  if (!data) return null;

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Link href="/dashboard/dispatch" className="rounded-xl border bg-white p-4 shadow-[0_3px_12px_rgba(15,23,42,0.04)] hover:border-brand/25">
        <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand"><Truck size={18} /></span>
        <p className="mt-3 text-2xl font-semibold text-foreground">{data.pendingDispatch}</p>
        <p className="text-xs text-muted">Ready to dispatch</p>
      </Link>
      <div className="rounded-xl border bg-white p-4 shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
        <span className="grid size-10 place-items-center rounded-lg bg-success-soft text-success"><PackageCheck size={18} /></span>
        <p className="mt-3 text-2xl font-semibold text-foreground">{data.dispatchedToday}</p>
        <p className="text-xs text-muted">Moved today</p>
      </div>
      <div className="rounded-xl border bg-white p-4 shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
        <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand"><PackagePlus size={18} /></span>
        <p className="mt-3 text-2xl font-semibold text-foreground">{data.receivedToday}</p>
        <p className="text-xs text-muted">Units received today</p>
      </div>
      <Link href="/dashboard/inventory" className="rounded-xl border bg-white p-4 shadow-[0_3px_12px_rgba(15,23,42,0.04)] hover:border-brand/25">
        <span className="grid size-10 place-items-center rounded-lg bg-warning-soft text-warning"><AlertTriangle size={18} /></span>
        <p className={`mt-3 text-2xl font-semibold ${data.lowStockCount > 0 ? "text-danger" : "text-foreground"}`}>{data.lowStockCount}</p>
        <p className="text-xs text-muted">Low or out of stock</p>
      </Link>
    </div>

    {data.lowStockItems.length > 0 && <section className="rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3 border-b px-5 py-4"><span className="grid size-9 place-items-center rounded-lg bg-warning-soft text-warning"><AlertTriangle size={17} /></span><div><h3 className="text-sm font-semibold text-foreground">Needs attention</h3><p className="mt-0.5 text-xs text-muted">Lowest stock first</p></div></div>
      <div className="divide-y">{data.lowStockItems.map((item) => <div key={item.id} className="flex items-center justify-between px-5 py-3">
        <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{item.name}</p><p className="text-xs text-muted">{item.unit}</p></div>
        <span className={`shrink-0 text-sm font-semibold ${item.stockOnHand <= 0 ? "text-danger" : "text-warning"}`}>{item.stockOnHand} {item.unit}</span>
      </div>)}</div>
    </section>}
  </div>;
}
