"use client";

import { AlertTriangle, PackageCheck, PackagePlus, Truck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { KpiCard } from "@/components/ui/kpi-card";

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

  if (loading) return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><div className="h-24 animate-pulse rounded-xl bg-background" /><div className="h-24 animate-pulse rounded-xl bg-background" /><div className="h-24 animate-pulse rounded-xl bg-background" /><div className="h-24 animate-pulse rounded-xl bg-background" /></div>;
  if (!data) return null;

  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Link href="/dashboard/dispatch" className="group"><KpiCard icon={Truck} label="Pending dispatch" value={data.pendingDispatch} detail="Ready to dispatch" className="h-full group-hover:-translate-y-0.5 group-hover:border-brand/30" /></Link>
      <KpiCard icon={PackageCheck} label="Dispatched today" value={data.dispatchedToday} detail="Orders moved" tone="success" />
      <KpiCard icon={PackagePlus} label="Received today" value={data.receivedToday} detail="Units received" />
      <Link href="/dashboard/inventory" className="group"><KpiCard icon={AlertTriangle} label="Stock alerts" value={data.lowStockCount} detail="Low or out of stock" tone={data.lowStockCount ? "warning" : "neutral"} className="h-full group-hover:-translate-y-0.5 group-hover:border-brand/30" /></Link>
    </div>

    {data.lowStockItems.length > 0 && <section className="crm-surface">
      <div className="flex items-center gap-3 border-b px-5 py-4"><span className="grid size-9 place-items-center rounded-lg bg-warning-soft text-warning"><AlertTriangle size={17} /></span><div><h3 className="text-sm font-semibold text-foreground">Needs attention</h3><p className="mt-0.5 text-xs text-muted">Lowest stock first</p></div></div>
      <div className="divide-y">{data.lowStockItems.map((item) => <div key={item.id} className="flex items-center justify-between px-5 py-3">
        <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{item.name}</p><p className="text-xs text-muted">{item.unit}</p></div>
        <span className={`shrink-0 text-sm font-semibold ${item.stockOnHand <= 0 ? "text-danger" : "text-warning"}`}>{item.stockOnHand} {item.unit}</span>
      </div>)}</div>
    </section>}
  </div>;
}
