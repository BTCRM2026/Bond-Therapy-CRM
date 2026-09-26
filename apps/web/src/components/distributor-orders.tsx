"use client";

import { Check, Clock3, PackageCheck, RotateCcw, Search, Truck, X, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { OrderStatus, type Order, type OrderListResponse } from "@/components/orders-module";
import { Button } from "@/components/ui/button";
import { FilterMenu } from "@/components/ui/filter-menu";
import { Input } from "@/components/ui/input";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";

const GROUPS = [
  { key: "REVIEW", label: "Needs review", statuses: ["SUBMITTED", "UNDER_REVIEW"] },
  { key: "APPROVED", label: "Approved · awaiting pickup", statuses: ["APPROVED"] },
  { key: "FULFILLED", label: "Fulfilled", statuses: ["DISTRIBUTOR_FULFILLED"] },
  { key: "RETURNED", label: "Returned / rejected", statuses: ["RETURNED_FOR_CORRECTION", "REJECTED"] },
] as const;

const money = (value: string | number) => `₹${Number(value).toLocaleString("en-IN")}`;
const messageFrom = (data: unknown, fallback: string) => (data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback);

export function DistributorOrders({ initial, roleKey }: { initial: OrderListResponse | null; roleKey?: string }) {
  const [data, setData] = useState(initial);
  const [group, setGroup] = useState<(typeof GROUPS)[number]["key"]>("REVIEW");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [error] = useState(initial ? "" : "Unable to load orders.");
  const canReview = roleKey === "DISTRIBUTOR_OWNER" || roleKey === "DISTRIBUTOR_ACCOUNTS";
  const canFulfill = roleKey === "DISTRIBUTOR_OWNER" || roleKey === "DISTRIBUTOR_WAREHOUSE";

  const counts = (statuses: readonly string[]) => data?.items.filter((order) => statuses.includes(order.status)).length ?? 0;
  const active = GROUPS.find((item) => item.key === group)!;
  const orders = useMemo(() => {
    let base = data?.items.filter((order) => (active.statuses as readonly string[]).includes(order.status)) ?? [];
    const query = search.trim().toLowerCase();
    if (query) base = base.filter((order) => order.orderNumber.toLowerCase().includes(query) || order.client.salonName.toLowerCase().includes(query));
    return base;
  }, [data, active, search]);

  const applyUpdate = (order: Order) => setData((current) => (current ? { ...current, items: current.items.map((item) => (item.id === order.id ? order : item)) } : current));

  return (
    <div className="space-y-4">
      <KpiStrip columns={3}>
        <KpiCell label="Needs review" value={counts(["SUBMITTED", "UNDER_REVIEW"])} tone="warning" />
        <KpiCell label="Awaiting pickup" value={counts(["APPROVED"])} />
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
                <button type="button" key={order.id} onClick={() => setSelected(order)} className="block w-full p-4 text-left transition-colors hover:bg-background/70 sm:px-5">
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
                </button>
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
      {selected && <DistributorOrderModal order={selected} canReview={canReview} canFulfill={canFulfill} onClose={() => setSelected(null)} onChanged={(order) => { applyUpdate(order); setSelected(order); }} />}
    </div>
  );
}

function DistributorOrderModal({ order, canReview, canFulfill, onClose, onChanged }: { order: Order; canReview: boolean; canFulfill: boolean; onClose: () => void; onChanged: (order: Order) => void }) {
  const [comment, setComment] = useState("");
  const [invoiceReference, setInvoiceReference] = useState(order.distributorInvoiceReference ?? "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const transition = async (status: string, extra: Record<string, string | undefined> = {}) => {
    setBusy(status);
    setError("");
    try {
      const response = await fetch(`/api/distributor/orders/${order.id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, version: order.version, comment: comment.trim() || undefined, ...extra }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to update this order."));
      onChanged(data as Order);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this order.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/40 p-3 backdrop-blur-[1px] sm:p-4" role="dialog" aria-modal="true" aria-label={`${order.orderNumber} details`}>
      <div className="my-auto flex max-h-[calc(100dvh-24px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-white shadow-[0_20px_48px_rgba(15,23,42,0.18)] sm:max-h-[calc(100dvh-32px)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <div className="flex items-center gap-2"><h2 className="text-base font-semibold text-foreground">{order.orderNumber}</h2><OrderStatus value={order.status} /></div>
            <p className="mt-1 text-xs text-muted">{order.client.salonName} · {order.client.city} · {order.client.primaryContact}</p>
          </div>
          <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-background"><X size={18} /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-background px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted"><span>Product</span><span>Qty</span><span>Amount</span></div>
            {order.items.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-3 border-t px-3 py-2.5 text-sm"><span className="text-foreground">{item.product.name}</span><span className="text-muted">{item.quantity}</span><span className="text-right font-medium text-foreground">{money(item.lineTotal)}</span></div>)}
          </div>
          <div className="flex items-center justify-between rounded-lg bg-background p-3 text-sm font-semibold text-foreground"><span>Grand total</span><span>{money(order.totalAmount)}</span></div>
          {order.distributorInvoiceReference && <div className="rounded-lg border p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Your invoice reference</p><p className="mt-1 text-sm text-foreground">{order.distributorInvoiceReference}</p></div>}
          {canReview && order.status === "UNDER_REVIEW" && (
            <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">Your invoice reference to the salon <span className="text-muted">(optional)</span></span><Input value={invoiceReference} onChange={(event) => setInvoiceReference(event.target.value)} placeholder="e.g. your own invoice number" /></label>
          )}
          {canReview && ["SUBMITTED", "UNDER_REVIEW"].includes(order.status) && (
            <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">Comment <span className="text-muted">(required when returning or rejecting)</span></span><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" placeholder="Add a clear note for the salesperson…" /></label>
          )}
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger">{error}</div>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t bg-white p-4">
          {canReview && order.status === "SUBMITTED" && <Button disabled={Boolean(busy)} onClick={() => transition("UNDER_REVIEW")}><Clock3 size={15} />Start review</Button>}
          {canReview && ["SUBMITTED", "UNDER_REVIEW"].includes(order.status) && <>
            <Button variant="secondary" disabled={Boolean(busy) || !comment.trim()} onClick={() => transition("RETURNED_FOR_CORRECTION")}><RotateCcw size={15} />Return</Button>
            <Button variant="secondary" disabled={Boolean(busy) || !comment.trim()} onClick={() => transition("REJECTED")}><XCircle size={15} />Reject</Button>
          </>}
          {canReview && order.status === "UNDER_REVIEW" && <Button disabled={Boolean(busy)} onClick={() => transition("APPROVED", { distributorInvoiceReference: invoiceReference.trim() || undefined })}><Check size={15} />Approve &amp; bill</Button>}
          {canFulfill && order.status === "APPROVED" && <Button disabled={Boolean(busy)} onClick={() => transition("DISTRIBUTOR_FULFILLED")}><Truck size={15} />{busy === "DISTRIBUTOR_FULFILLED" ? "Marking fulfilled…" : "Mark fulfilled"}</Button>}
        </div>
      </div>
    </div>
  );
}
