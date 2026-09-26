"use client";

import { PackageCheck, Search, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { OrderStatus, type Order, type OrderListResponse } from "@/components/orders-module";
import { Button } from "@/components/ui/button";
import { FilterMenu } from "@/components/ui/filter-menu";
import { Input } from "@/components/ui/input";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";

const GROUPS = [
  { key: "PENDING", label: "Pending fulfillment", statuses: ["FORWARDED_TO_DISTRIBUTOR"] },
  { key: "FULFILLED", label: "Fulfilled", statuses: ["DISTRIBUTOR_FULFILLED"] },
] as const;

const money = (value: string | number) => `₹${Number(value).toLocaleString("en-IN")}`;
const messageFrom = (data: unknown, fallback: string) => (data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback);

export function DistributorOrders({ initial }: { initial: OrderListResponse | null }) {
  const [data, setData] = useState(initial);
  const [group, setGroup] = useState<(typeof GROUPS)[number]["key"]>("PENDING");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState(initial ? "" : "Unable to load orders.");

  const counts = (statuses: readonly string[]) => data?.items.filter((order) => statuses.includes(order.status)).length ?? 0;
  const active = GROUPS.find((item) => item.key === group)!;
  const orders = useMemo(() => {
    let base = data?.items.filter((order) => (active.statuses as readonly string[]).includes(order.status)) ?? [];
    const query = search.trim().toLowerCase();
    if (query) base = base.filter((order) => order.orderNumber.toLowerCase().includes(query) || order.client.salonName.toLowerCase().includes(query));
    return base;
  }, [data, active, search]);

  const fulfill = async (order: Order) => {
    setBusyId(order.id);
    setError("");
    try {
      const response = await fetch(`/api/distributor/orders/${order.id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "DISTRIBUTOR_FULFILLED", version: order.version }) });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(json, "Unable to fulfill this order."));
      setData((current) => (current ? { ...current, items: current.items.map((item) => (item.id === order.id ? json : item)) } : current));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to fulfill this order.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-4">
      <KpiStrip columns={2}>
        <KpiCell label="Pending fulfillment" value={counts(["FORWARDED_TO_DISTRIBUTOR"])} tone="warning" />
        <KpiCell label="Fulfilled" value={counts(["DISTRIBUTOR_FULFILLED"])} tone="success" />
      </KpiStrip>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger">{error}</div>}
      <div className="flex gap-2">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={17} />
          <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order number or salon name" aria-label="Search orders" />
        </label>
        <FilterMenu value={group} onSelect={setGroup} options={GROUPS.map((item) => ({ key: item.key, label: item.label, count: counts(item.statuses) }))} />
      </div>
      <section className="crm-surface">
        <div className="rounded-t-xl border-b px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">{active.label}</h2>
          <p className="mt-0.5 text-xs text-muted">Orders routed to you by Bond Therapy salespeople in your territory.</p>
        </div>
        <div className="overflow-hidden rounded-b-xl">
          {orders.length ? (
            <div className="divide-y">
              {orders.map((order) => (
                <article key={order.id} className="p-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{order.orderNumber}</p>
                        <OrderStatus value={order.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted">{order.client.salonName} · {order.client.city} · {order.client.primaryContact}</p>
                      <p className="mt-1.5 text-xs text-muted">{order.items.map((item) => `${item.product.name} × ${item.quantity}`).join(" · ")}</p>
                    </div>
                    <p className="text-sm font-semibold">{money(order.totalAmount)}</p>
                  </div>
                  {order.status === "FORWARDED_TO_DISTRIBUTOR" && (
                    <div className="mt-3">
                      <Button disabled={busyId === order.id} onClick={() => fulfill(order)}>
                        <Truck size={15} />
                        {busyId === order.id ? "Marking fulfilled…" : "Mark fulfilled"}
                      </Button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="px-5 py-14 text-center">
              <PackageCheck className="mx-auto text-subtle" size={28} />
              <p className="mt-3 text-sm font-semibold">No orders here</p>
              <p className="mt-1 text-xs text-muted">Orders forwarded to you by Bond Therapy will show up automatically.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
