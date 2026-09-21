"use client";

import { PackageCheck, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { OrderStatus, type Order, type OrderListResponse } from "@/components/orders-module";
import { Button } from "@/components/ui/button";

const money = (value: string | number) => `₹${Number(value).toLocaleString("en-IN")}`;
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback;

const TABS = [
  ["CONFIRMED", "Ready to dispatch"],
  ["DISPATCHED", "On the way"],
] as const;

export function DispatchModule({ initial }: { initial: OrderListResponse | null }) {
  const [status, setStatus] = useState<"CONFIRMED" | "DISPATCHED">("CONFIRMED");
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initial ? "" : "Unable to load the dispatch queue. Please try again.");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/orders?status=${status}&pageSize=50`, { cache: "no-store" });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error(messageFrom(json, "Unable to load the dispatch queue."));
        if (!cancelled) { setData(json as OrderListResponse); setError(""); }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load the dispatch queue."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [status]);

  const advance = async (order: Order) => {
    const nextStatus = order.status === "CONFIRMED" ? "DISPATCHED" : "DELIVERED";
    setBusyId(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(json, "Unable to update this order."));
      setData((current) => current ? { ...current, items: current.items.filter((item) => item.id !== order.id), total: current.total - 1 } : current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update this order."); }
    finally { setBusyId(""); }
  };

  return <div className="space-y-4">
    <div className="flex gap-2">
      {TABS.map(([value, label]) => <button key={value} type="button" onClick={() => setStatus(value)} className={`h-10 rounded-lg border px-4 text-xs font-semibold transition-colors ${status === value ? "border-brand bg-brand text-white" : "text-muted hover:bg-brand-soft/60"}`}>{label}</button>)}
    </div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}
    <section className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5"><div><p className="text-sm font-semibold text-foreground">{status === "CONFIRMED" ? "Ready to dispatch" : "On the way"}</p><p className="mt-0.5 text-xs text-muted">{data?.total ?? 0} order{data?.total === 1 ? "" : "s"}</p></div></div>
      {loading && !data ? <div className="space-y-3 p-4"><div className="h-20 animate-pulse rounded-lg bg-background" /><div className="h-20 animate-pulse rounded-lg bg-background" /></div>
        : data?.items.length ? <div className="divide-y">{data.items.map((order) => <div key={order.id} className="p-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{order.orderNumber}</p><p className="mt-0.5 truncate text-xs text-muted">{order.client.salonName} · {order.client.city}</p></div>
            <div className="shrink-0 text-right"><p className="text-sm font-semibold text-foreground">{money(order.totalAmount)}</p><div className="mt-1"><OrderStatus value={order.status} /></div></div>
          </div>
          <p className="mt-2 text-xs text-muted">{order.items.map((item) => `${item.product.name} × ${item.quantity}`).join(", ")}</p>
          <div className="mt-3">
            <Button variant="secondary" className="h-10" disabled={busyId === order.id} onClick={() => advance(order)}>
              {order.status === "CONFIRMED" ? <><Truck size={15} />{busyId === order.id ? "Updating…" : "Mark dispatched"}</> : <><PackageCheck size={15} />{busyId === order.id ? "Updating…" : "Mark delivered"}</>}
            </Button>
          </div>
        </div>)}</div>
        : <div className="px-5 py-14 text-center">{status === "CONFIRMED" ? <Truck className="mx-auto text-subtle" size={28} /> : <PackageCheck className="mx-auto text-subtle" size={28} />}<p className="mt-3 text-sm font-semibold text-foreground">{status === "CONFIRMED" ? "Nothing waiting to dispatch" : "Nothing on the way"}</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">{status === "CONFIRMED" ? "New confirmed orders from Sales will appear here." : "Orders you mark dispatched will show up here until delivered."}</p></div>}
    </section>
  </div>;
}
