"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";

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

  if (loading) return <div className="h-24 animate-pulse rounded-[10px] bg-background" />;
  if (!data) return null;

  return <div className="space-y-5">
    <KpiStrip columns={4}>
      <Link href="/dashboard/dispatch" className="contents"><KpiCell label="Pending dispatch" value={data.pendingDispatch} detail="Ready to dispatch" className="cursor-pointer hover:bg-brand-soft/45" /></Link>
      <KpiCell label="Dispatched today" value={data.dispatchedToday} detail="Orders moved" tone="success" />
      <KpiCell label="Received today" value={data.receivedToday} detail="Units received" />
      <Link href="/dashboard/inventory" className="contents"><KpiCell label="Stock alerts" value={data.lowStockCount} detail="Low or out of stock" tone={data.lowStockCount ? "warning" : "neutral"} className="cursor-pointer hover:bg-brand-soft/45" /></Link>
    </KpiStrip>

    {data.lowStockItems.length > 0 && <section className="crm-surface">
      <div className="flex items-center gap-3 border-b px-5 py-4"><span className="grid size-9 place-items-center rounded-lg bg-warning-soft text-warning"><AlertTriangle size={17} /></span><div><h3 className="text-sm font-semibold text-foreground">Needs attention</h3><p className="mt-0.5 text-xs text-muted">Lowest stock first</p></div></div>
      <div className="divide-y">{data.lowStockItems.map((item) => <div key={item.id} className="flex items-center justify-between px-5 py-3">
        <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{item.name}</p><p className="text-xs text-muted">{item.unit}</p></div>
        <span className={`shrink-0 text-sm font-semibold ${item.stockOnHand <= 0 ? "text-danger" : "text-warning"}`}>{item.stockOnHand} {item.unit}</span>
      </div>)}</div>
    </section>}
  </div>;
}
