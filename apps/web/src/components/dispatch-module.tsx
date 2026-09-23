"use client";

import { Camera, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, MapPin, PackageCheck, PackageOpen, Route, Search, Truck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { OrderStatus, type Order, type OrderListResponse } from "@/components/orders-module";
import { Button } from "@/components/ui/button";
import { FilterMenu } from "@/components/ui/filter-menu";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageSizeMenu } from "@/components/ui/page-size-menu";

const money = (value: string | number) => `₹${Number(value).toLocaleString("en-IN")}`;
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback;
const GROUPS = [
  { key: "PENDING", label: "Pending work", statuses: ["INVOICE_GENERATED", "STOCK_RESERVED", "PICKING", "PACKED", "READY_FOR_DISPATCH", "CONFIRMED", "OUT_FOR_DELIVERY", "ARRIVED_AT_CUSTOMER", "DISPATCHED"] },
  { key: "DONE", label: "Work done", statuses: ["DELIVERED"] },
] as const;

export function DispatchModule({ initial }: { initial: OrderListResponse | null }) {
  const [data, setData] = useState(initial); const [group, setGroup] = useState<(typeof GROUPS)[number]["key"]>("PENDING"); const [loading, setLoading] = useState(false); const [error, setError] = useState(initial ? "" : "Unable to load warehouse orders."); const [busyId, setBusyId] = useState(""); const [dispatching, setDispatching] = useState<Order | null>(null); const [preparingId, setPreparingId] = useState(""); const [viewingId, setViewingId] = useState("");
  const [search, setSearch] = useState(""); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10);
  const preparing = data?.items.find((item) => item.id === preparingId) ?? null;
  const viewing = data?.items.find((item) => item.id === viewingId) ?? null;
  const load = async () => { setLoading(true); try { const response = await fetch("/api/orders?pageSize=100", { cache: "no-store" }); const json = await response.json().catch(() => null); if (!response.ok) throw new Error(messageFrom(json, "Unable to load warehouse orders.")); setData(json); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load warehouse orders."); } finally { setLoading(false); } };
  useEffect(() => { const timer = setInterval(() => void load(), 30000); return () => clearInterval(timer); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const active = GROUPS.find((item) => item.key === group)!;
  const counts = (statuses: readonly string[]) => data?.items.filter((order) => statuses.includes(order.status)).length ?? 0;
  const orders = useMemo(() => {
    let base = data?.items.filter((order) => (active.statuses as readonly string[]).includes(order.status)) ?? [];
    const query = search.trim().toLowerCase();
    if (query) base = base.filter((order) => order.orderNumber.toLowerCase().includes(query) || order.client.salonName.toLowerCase().includes(query));
    return base;
  }, [data, active, search]);
  const filterKey = `${group}:${search}:${pageSize}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) { setPrevFilterKey(filterKey); setPage(1); }
  const pageCount = Math.max(1, Math.ceil(orders.length / pageSize));
  const pageSafe = Math.min(page, pageCount);
  const paginated = orders.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const transition = async (order: Order, status: string, extra: Record<string, string> = {}) => { setBusyId(order.id); setError(""); try { const response = await fetch(`/api/orders/${order.id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, version: order.version, ...extra }) }); const json = await response.json().catch(() => null); if (!response.ok) throw new Error(messageFrom(json, "Unable to update this order.")); setData((current) => current ? { ...current, items: current.items.map((item) => item.id === order.id ? json : item) } : current); setDispatching(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update this order."); } finally { setBusyId(""); } };
  const chain = async (order: Order, statuses: string[]) => {
    setBusyId(order.id); setError("");
    let current = order;
    try {
      for (const status of statuses) {
        const response = await fetch(`/api/orders/${current.id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, version: current.version }) });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error(messageFrom(json, "Unable to update this order."));
        current = json as Order;
      }
      setData((prev) => prev ? { ...prev, items: prev.items.map((item) => item.id === current.id ? current : item) } : prev);
      if (current.status === "READY_FOR_DISPATCH") setPreparingId("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update this order."); }
    finally { setBusyId(""); }
  };
  const upload = async (order: Order, kind: "arrival" | "delivery", file?: File) => { if (!file) return; setBusyId(order.id); setError(""); try { const form = new FormData(); form.set("photo", file); const response = await fetch(`/api/orders/${order.id}/delivery-proof/${kind}`, { method: "POST", body: form }); const json = await response.json().catch(() => null); if (!response.ok) throw new Error(messageFrom(json, "Unable to upload the photo.")); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to upload the photo."); } finally { setBusyId(""); } };

  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><KpiCard icon={ClipboardCheck} label="Awaiting stock" value={counts(["INVOICE_GENERATED"])} /><KpiCard icon={PackageOpen} label="In fulfilment" value={counts(["STOCK_RESERVED", "PICKING", "PACKED"])} tone="warning" /><KpiCard icon={PackageCheck} label="Ready" value={counts(["READY_FOR_DISPATCH", "CONFIRMED"])} tone="success" /><KpiCard icon={Truck} label="In transit" value={counts(["OUT_FOR_DELIVERY", "ARRIVED_AT_CUSTOMER", "DISPATCHED"])} /></div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger">{error}</div>}
    <div className="flex gap-2">
      <label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={17} /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order number or salon name" aria-label="Search orders" /></label>
      <FilterMenu value={group} onSelect={setGroup} options={GROUPS.map((item) => ({ key: item.key, label: item.label, count: counts(item.statuses) }))} />
    </div>
    <section className="rounded-xl border bg-white">
      <div className="flex items-center justify-between gap-3 rounded-t-xl border-b px-5 py-4">
        <div className="min-w-0"><h2 className="text-sm font-semibold text-foreground">{active.label}</h2><p className="mt-0.5 text-xs text-muted">Operational steps are recorded automatically. Packing proof remains on CCTV.</p></div>
        {orders.length > 0 && <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
          <span className="hidden sm:inline">{(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, orders.length)} of {orders.length}</span>
          <PageSizeMenu pageSize={pageSize} onSelect={setPageSize} />
          <button type="button" disabled={pageSafe <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="grid size-7 place-items-center rounded-md border bg-white text-muted transition-colors hover:bg-background disabled:pointer-events-none disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={14} /></button>
          <button type="button" disabled={pageSafe >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="grid size-7 place-items-center rounded-md border bg-white text-muted transition-colors hover:bg-background disabled:pointer-events-none disabled:opacity-40" aria-label="Next page"><ChevronRight size={14} /></button>
        </div>}
      </div>
      <div className="overflow-hidden rounded-b-xl">
      {loading && !data ? <div className="p-5"><div className="h-24 animate-pulse rounded-lg bg-background" /></div> : paginated.length ? <div className="divide-y">{paginated.map((order) => <article key={order.id} className="p-4 sm:px-5"><button type="button" onClick={() => setViewingId(order.id)} className="flex w-full items-start justify-between gap-3 text-left"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{order.orderNumber}</p><OrderStatus value={order.status} /></div><p className="mt-1 text-xs text-muted">{order.client.salonName} · {order.client.city} · {order.client.primaryContact}</p></div><p className="text-sm font-semibold">{money(order.totalAmount)}</p></button><div className="mt-3 flex flex-wrap gap-2"><OrderAction order={order} busy={busyId === order.id} transition={transition} onPrepare={() => setPreparingId(order.id)} onDispatch={() => setDispatching(order)} upload={upload} /></div></article>)}</div> : <div className="px-5 py-14 text-center"><PackageCheck className="mx-auto text-subtle" size={28} /><p className="mt-3 text-sm font-semibold">No orders in this stage</p><p className="mt-1 text-xs text-muted">Orders move here automatically as each previous step is completed.</p></div>}
      </div>
    </section>
    {dispatching && <DispatchModal order={dispatching} busy={busyId === dispatching.id} onClose={() => setDispatching(null)} onSubmit={(status, values) => transition(dispatching, status, values)} />}
    {preparing && <PrepModal order={preparing} busy={busyId === preparing.id} onClose={() => setPreparingId("")} onAdvance={chain} />}
    {viewing && <OrderDetailPopup order={viewing} onClose={() => setViewingId("")} />}
  </div>;
}

function OrderDetailPopup({ order, onClose }: { order: Order; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/35 p-4" role="dialog" aria-modal="true" aria-label="Order details">
    <div className="w-full max-w-lg rounded-xl border bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b p-4">
        <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">{order.orderNumber}</h2><OrderStatus value={order.status} /></div><p className="mt-1 text-xs text-muted">{order.client.salonName} · {order.client.city} · {order.client.primaryContact}</p></div>
        <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-background"><X size={18} /></button>
      </div>
      <div className="max-h-[65dvh] space-y-4 overflow-y-auto p-4">
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-background px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted"><span>Product</span><span>Qty</span><span>Amount</span></div>
          {order.items.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-3 border-t px-3 py-2.5 text-sm"><span className="text-foreground">{item.product.name}</span><span className="text-muted">{item.quantity}</span><span className="text-right font-medium text-foreground">{money(item.lineTotal)}</span></div>)}
        </div>
        <div className="flex items-center justify-between rounded-lg bg-background p-3 text-sm font-semibold text-foreground"><span>Grand total</span><span>{money(order.totalAmount)}</span></div>
        {(order.deliveryPersonName || order.trackingNumber) && <div className="rounded-lg border p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Dispatch</p>
          {order.deliveryPersonName && <p className="mt-1.5 text-sm text-foreground">Delivery person: <span className="font-semibold">{order.deliveryPersonName}</span> · {order.deliveryPersonMobile}</p>}
          {order.trackingNumber && <p className="mt-1.5 text-sm text-foreground">{order.courierName}: <span className="font-semibold">{order.trackingNumber}</span></p>}
        </div>}
      </div>
      <div className="flex justify-end border-t p-4"><Button variant="secondary" onClick={onClose}>Close</Button></div>
    </div>
  </div>;
}

function OrderAction({ order, busy, transition, onPrepare, onDispatch, upload }: { order: Order; busy: boolean; transition: (order: Order, status: string) => void; onPrepare: () => void; onDispatch: () => void; upload: (order: Order, kind: "arrival" | "delivery", file?: File) => void }) {
  if (["INVOICE_GENERATED", "STOCK_RESERVED", "PICKING", "PACKED"].includes(order.status)) return <Button disabled={busy} onClick={onPrepare}><ClipboardCheck size={15} />Prepare order</Button>;
  if (["READY_FOR_DISPATCH", "CONFIRMED"].includes(order.status)) return <Button disabled={busy} onClick={onDispatch}><Route size={15} />Plan dispatch</Button>;
  if (order.status === "OUT_FOR_DELIVERY") return <>{order.deliveryProof?.arrivalPhotoMime ? <><a href={`/api/orders/${order.id}/delivery-proof/arrival`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold">View arrival photo</a><Button disabled={busy} onClick={() => transition(order, "ARRIVED_AT_CUSTOMER")}><MapPin size={15} />Confirm arrival</Button></> : <PhotoButton label="Upload arrival photo" onFile={(file) => upload(order, "arrival", file)} />}</>;
  if (order.status === "ARRIVED_AT_CUSTOMER") return <>{order.deliveryProof?.deliveryPhotoMime ? <><a href={`/api/orders/${order.id}/delivery-proof/delivery`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold">View delivery photo</a><Button disabled={busy} onClick={() => transition(order, "DELIVERED")}><CheckCircle2 size={15} />Mark delivered</Button></> : <PhotoButton label="Upload delivery photo" onFile={(file) => upload(order, "delivery", file)} />}</>;
  if (order.status === "DISPATCHED") return <Button disabled={busy} onClick={() => transition(order, "DELIVERED")}><CheckCircle2 size={15} />Confirm delivered</Button>;
  return null;
}

function PrepModal({ order, busy, onClose, onAdvance }: { order: Order; busy: boolean; onClose: () => void; onAdvance: (order: Order, statuses: string[]) => void }) {
  const stepOneDone = !["INVOICE_GENERATED", "STOCK_RESERVED"].includes(order.status);
  const stage = stepOneDone ? 2 : 1;
  const chainForStage = stage === 1
    ? (order.status === "INVOICE_GENERATED" ? ["STOCK_RESERVED", "PICKING"] : ["PICKING"])
    : (order.status === "PICKING" ? ["PACKED", "READY_FOR_DISPATCH"] : ["READY_FOR_DISPATCH"]);
  const label = stage === 1 ? "Reserve & pick stock" : "Pack & mark ready";
  return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4" role="dialog" aria-modal="true" aria-label="Prepare order">
    <div className="w-full max-w-md rounded-xl border bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b p-4"><div><h2 className="text-base font-semibold">Prepare for dispatch</h2><p className="mt-1 text-xs text-muted">{order.orderNumber} · {order.client.salonName}</p></div><button onClick={onClose} className="grid size-9 place-items-center rounded-lg hover:bg-background"><X size={18} /></button></div>
      <div className="space-y-3 p-4">
        <div className="rounded-lg bg-background p-3 text-xs text-muted">{order.items.map((item) => `${item.product.name} × ${item.quantity}`).join(" · ")}</div>
        <div className="space-y-2">
          <StepRow number={1} label="Reserve & pick stock" done={stepOneDone} current={stage === 1} />
          <StepRow number={2} label="Pack & mark ready" done={false} current={stage === 2} />
        </div>
        <p className="rounded-lg border border-brand/15 bg-brand-soft/40 px-3 py-2.5 text-xs leading-5 text-muted">No packing photo needed here — CCTV covers packing proof.</p>
      </div>
      <div className="flex justify-end gap-2 border-t p-4"><Button variant="secondary" onClick={onClose}>Close</Button><Button disabled={busy} onClick={() => onAdvance(order, chainForStage)}>{busy ? "Working…" : label}</Button></div>
    </div>
  </div>;
}
function StepRow({ number, label, done, current }: { number: number; label: string; done: boolean; current: boolean }) {
  return <div className={`flex items-center gap-3 rounded-lg border p-3 ${current ? "border-brand/30 bg-brand-soft/40" : done ? "border-success/20 bg-success-soft/40" : "border-border"}`}>
    <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? "bg-success text-white" : current ? "bg-brand text-white" : "bg-background text-muted"}`}>{done ? <Check size={14} /> : number}</span>
    <span className={`text-sm font-medium ${done ? "text-success" : current ? "text-brand-dark" : "text-muted"}`}>{label}</span>
  </div>;
}
function PhotoButton({ label, onFile }: { label: string; onFile: (file?: File) => void }) { return <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-brand px-3 text-xs font-semibold text-white"><Camera size={15} />{label}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => onFile(event.target.files?.[0])} /></label>; }

function DispatchModal({ order, busy, onClose, onSubmit }: { order: Order; busy: boolean; onClose: () => void; onSubmit: (status: string, values: Record<string, string>) => void }) {
  const [mode, setMode] = useState<"LOCAL" | "OUTSTATION">(order.client.city.trim().toLowerCase() === "vadodara" ? "LOCAL" : "OUTSTATION"); const [name, setName] = useState(""); const [mobile, setMobile] = useState(""); const [tracking, setTracking] = useState("");
  return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4"><div className="w-full max-w-lg rounded-xl border bg-white shadow-2xl"><div className="flex items-start justify-between border-b p-4"><div><h2 className="text-base font-semibold">Plan dispatch</h2><p className="mt-1 text-xs text-muted">{order.orderNumber} · {order.client.salonName}</p></div><button onClick={onClose} className="grid size-9 place-items-center rounded-lg hover:bg-background"><X size={18} /></button></div><div className="space-y-4 p-4"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setMode("LOCAL")} className={`rounded-lg border p-3 text-left ${mode === "LOCAL" ? "border-brand bg-brand-soft" : ""}`}><MapPin size={17} className="text-brand" /><p className="mt-2 text-sm font-semibold">Vadodara</p><p className="text-xs text-muted">Own delivery person + photo proof</p></button><button type="button" onClick={() => setMode("OUTSTATION")} className={`rounded-lg border p-3 text-left ${mode === "OUTSTATION" ? "border-brand bg-brand-soft" : ""}`}><Truck size={17} className="text-brand" /><p className="mt-2 text-sm font-semibold">Outstation</p><p className="text-xs text-muted">Mark Courier + tracking sticker</p></button></div>{mode === "LOCAL" ? <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5"><span className="text-xs font-medium">Delivery person</span><Input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="space-y-1.5"><span className="text-xs font-medium">Mobile number</span><Input value={mobile} onChange={(event) => setMobile(event.target.value)} inputMode="tel" /></label></div> : <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5"><span className="text-xs font-medium">Courier</span><Input value="Mark Courier" readOnly className="bg-background" /></label><label className="space-y-1.5"><span className="text-xs font-medium">Sticker / tracking number</span><Input value={tracking} onChange={(event) => setTracking(event.target.value)} /></label></div>}<p className="rounded-lg bg-background px-3 py-2.5 text-xs text-muted">No packing photo or video is stored in CRM. Packing proof is maintained through CCTV.</p></div><div className="flex justify-end gap-2 border-t p-4"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={busy || (mode === "LOCAL" ? !name.trim() || !mobile.trim() : !tracking.trim())} onClick={() => onSubmit(mode === "LOCAL" ? "OUT_FOR_DELIVERY" : "DISPATCHED", mode === "LOCAL" ? { deliveryMode: "VADODARA_LOCAL", deliveryPersonName: name.trim(), deliveryPersonMobile: mobile.trim() } : { deliveryMode: "OUTSTATION_COURIER", courierName: "Mark Courier", trackingNumber: tracking.trim() })}>{mode === "LOCAL" ? "Start local delivery" : "Mark dispatched"}</Button></div></div></div>;
}
