"use client";

import { Check, ChevronLeft, ChevronRight, Clock3, FileCheck2, FileText, Minus, Package, Plus, RotateCcw, Search, Send, ShoppingCart, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { FilterMenu } from "@/components/ui/filter-menu";
import { Input } from "@/components/ui/input";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";
import { PageSizeMenu } from "@/components/ui/page-size-menu";

const APPROVED_ONWARD = ["APPROVED", "INVOICE_GENERATED", "STOCK_RESERVED", "PICKING", "PACKED", "READY_FOR_DISPATCH", "OUT_FOR_DELIVERY", "ARRIVED_AT_CUSTOMER", "CONFIRMED", "DISPATCHED", "DELIVERED"];
const GROUPS = [
  { key: "ALL", label: "All orders", statuses: [] as string[] },
  { key: "DRAFTS", label: "Drafts", statuses: ["DRAFT"] },
  { key: "REVIEW", label: "Needs review", statuses: ["SUBMITTED", "UNDER_REVIEW"] },
  { key: "APPROVED", label: "Approved", statuses: APPROVED_ONWARD },
  { key: "RETURNED", label: "Returned / Rejected", statuses: ["RETURNED_FOR_CORRECTION", "REJECTED", "CANCELLED"] },
] as const;

type OrderItemRow = { id: string; quantity: number; unitPrice: string; discountAmount: string; taxableAmount: string; gstRate: string; taxAmount: string; lineTotal: string; product: { id: string; name: string; sku: string; unit: string; stockOnHand: number } };
export type Order = { id: string; orderNumber: string; status: string; version: number; subtotal: string; discountAmount: string; taxableAmount: string; taxAmount: string; cgstAmount: string; sgstAmount: string; igstAmount: string; totalAmount: string; notes: string | null; reviewComment: string | null; createdAt: string; submittedAt: string | null; approvedAt: string | null; deliveryMode: string | null; deliveryPersonName: string | null; deliveryPersonMobile: string | null; courierName: string | null; trackingNumber: string | null; distributorInvoiceReference?: string | null; distributor?: { id: string; businessName: string } | null; client: { id: string; salonName: string; city: string; primaryContact: string }; salesperson: { id: string; name: string }; reviewedBy: { id: string; name: string } | null; invoice: { id: string; invoiceNumber: string; status: string; amountPaid: string; balanceDue: string } | null; deliveryProof: { id: string; arrivalPhotoMime: string | null; deliveryPhotoMime: string | null } | null; items: OrderItemRow[] };
export type OrderListResponse = { items: Order[]; page: number; pageSize: number; total: number; hasMore: boolean };

const money = (value: string | number) => `₹${Number(value).toLocaleString("en-IN")}`;
const pretty = (value: string) => value.toLowerCase().split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback;

function actionHint(order: Order, isAccounts: boolean): { label: string; tone: "warning" | "brand" } | null {
  if (!isAccounts) return null;
  if (order.status === "SUBMITTED") return { label: "Needs your review", tone: "warning" };
  if (order.status === "UNDER_REVIEW") return { label: "Review in progress", tone: "warning" };
  if (order.status === "APPROVED" && !order.invoice) return { label: "Ready to invoice", tone: "brand" };
  return null;
}

export function OrderStatus({ value }: { value: string }) {
  const tone = ["APPROVED", "INVOICE_GENERATED", "DELIVERED", "DISTRIBUTOR_FULFILLED"].includes(value) ? "bg-success-soft text-success" : ["REJECTED", "CANCELLED"].includes(value) ? "bg-red-50 text-danger" : ["UNDER_REVIEW", "DISPATCHED", "FORWARDED_TO_DISTRIBUTOR"].includes(value) ? "bg-brand-soft text-brand" : ["SUBMITTED", "RETURNED_FOR_CORRECTION"].includes(value) ? "bg-warning-soft text-warning" : "bg-gray-100 text-muted";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{pretty(value)}</span>;
}

export function OrdersModule({ initial, roleKey }: { initial: OrderListResponse | null; roleKey: string }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initial ? "" : "Unable to load orders. Please try again.");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [selected, setSelected] = useState<Order | null>(null);
  const [group, setGroup] = useState<(typeof GROUPS)[number]["key"]>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [distributorFilter, setDistributorFilter] = useState("");
  const [distributors, setDistributors] = useState<Array<{ id: string; businessName: string }>>([]);
  const isSales = ["SALES_MANAGER", "SALES_EXECUTIVE"].includes(roleKey);
  const isAccounts = roleKey === "ACCOUNTS_BILLING" || roleKey === "SUPER_ADMIN";
  const isAdmin = roleKey === "SUPER_ADMIN";

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const response = await fetch("/api/distributors", { cache: "no-store" });
      if (response.ok) setDistributors(await response.json());
    })();
  }, [isAdmin]);

  useEffect(() => { const sync = () => setHeaderSlot(document.getElementById("page-header-actions")); sync(); const frame = requestAnimationFrame(sync); return () => cancelAnimationFrame(frame); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/orders?page=1&pageSize=100", { cache: "no-store" });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error(messageFrom(json, "Unable to load orders."));
        if (!cancelled) { setData(json as OrderListResponse); setError(""); }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load orders."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [refreshToken]);

  const reload = async () => { setRefreshToken((value) => value + 1); };

  const counts = (statuses: readonly string[]) => statuses.length ? data?.items.filter((order) => (statuses as string[]).includes(order.status)).length ?? 0 : data?.items.length ?? 0;
  const active = GROUPS.find((item) => item.key === group)!;
  const filtered = useMemo(() => {
    let base = active.statuses.length ? data?.items.filter((order) => (active.statuses as readonly string[]).includes(order.status)) ?? [] : data?.items ?? [];
    const query = search.trim().toLowerCase();
    if (query) base = base.filter((order) => order.orderNumber.toLowerCase().includes(query) || order.client.salonName.toLowerCase().includes(query));
    if (distributorFilter) base = base.filter((order) => distributorFilter === "NONE" ? !order.distributor : order.distributor?.id === distributorFilter);
    if (group !== "ALL") return base;
    return [...base].sort((a, b) => (actionHint(b, isAccounts) ? 1 : 0) - (actionHint(a, isAccounts) ? 1 : 0));
  }, [data, active, group, isAccounts, search, distributorFilter]);
  const filterKey = `${group}:${search}:${pageSize}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) { setPrevFilterKey(filterKey); setPage(1); }
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, pageCount);
  const paginated = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  return <>
    {headerSlot && isSales && createPortal(<Button onClick={() => { setEditing(null); setBookingOpen(true); }}><Plus size={16} /><span className="hidden sm:inline">New draft</span><span className="sr-only sm:hidden">New draft</span></Button>, headerSlot)}
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}
      <KpiStrip columns={4}>
        <KpiCell label="Total orders" value={data?.items.length ?? 0} detail="All visible orders" />
        <KpiCell label="Needs review" value={counts(GROUPS[2].statuses)} detail="Needs Accounts action" tone="warning" />
        <KpiCell label="Approved" value={counts(APPROVED_ONWARD)} detail="Approved through delivery" tone="success" />
        <KpiCell label="Order value" value={money(data?.items.reduce((sum, order) => sum + Number(order.totalAmount), 0) ?? 0)} detail="Across all visible orders" />
      </KpiStrip>
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={17} /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order number or salon name" aria-label="Search orders" /></label>
        <FilterMenu value={group} onSelect={setGroup} options={GROUPS.map((item) => ({ key: item.key, label: item.label, count: counts(item.statuses) }))} />
        {isAdmin && distributors.length > 0 && <FilterMenu value={distributorFilter} showLabelOnMobile ariaLabel="Filter by distributor" onSelect={setDistributorFilter} options={[{ key: "", label: "All distributors" }, { key: "NONE", label: "Direct (no distributor)" }, ...distributors.map((d) => ({ key: d.id, label: d.businessName }))]} />}
      </div>
      <section className="crm-surface">
        <div className="flex items-center justify-between gap-3 rounded-t-xl border-b px-4 py-3 sm:px-5">
          <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{active.label}</p><p className="mt-0.5 text-xs text-muted">{filtered.length} record{filtered.length === 1 ? "" : "s"} · click a row to review</p></div>
          {filtered.length > 0 && <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
            <span className="hidden sm:inline">{(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, filtered.length)} of {filtered.length}</span>
            <PageSizeMenu pageSize={pageSize} onSelect={setPageSize} />
            <button type="button" disabled={pageSafe <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="grid size-7 place-items-center rounded-md border bg-white text-muted transition-colors hover:bg-background disabled:pointer-events-none disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={14} /></button>
            <button type="button" disabled={pageSafe >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="grid size-7 place-items-center rounded-md border bg-white text-muted transition-colors hover:bg-background disabled:pointer-events-none disabled:opacity-40" aria-label="Next page"><ChevronRight size={14} /></button>
          </div>}
        </div>
        <div className="overflow-hidden rounded-b-xl">
        {loading && !data ? <div className="space-y-3 p-4"><div className="h-16 animate-pulse rounded-lg bg-background" /><div className="h-16 animate-pulse rounded-lg bg-background" /></div>
          : paginated.length ? <div className="divide-y">{paginated.map((order) => { const hint = actionHint(order, isAccounts); return <button type="button" onClick={() => setSelected(order)} key={order.id} className="block w-full p-4 text-left transition-colors hover:bg-background/70 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{order.orderNumber}</p><p className="mt-0.5 truncate text-xs text-muted">{order.client.salonName} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(order.createdAt))}{isAdmin && order.distributor ? ` · ${order.distributor.businessName}` : ""}</p></div>
              <div className="flex shrink-0 flex-col items-end gap-1"><p className="text-sm font-semibold text-foreground">{money(order.totalAmount)}</p><OrderStatus value={order.status} />{hint && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${hint.tone === "warning" ? "bg-warning-soft text-warning" : "bg-brand-soft text-brand"}`}><Clock3 size={10} />{hint.label}</span>}</div>
            </div>
          </button>; })}</div>
          : <div className="px-5 py-14 text-center"><ShoppingCart className="mx-auto text-subtle" size={28} /><p className="mt-3 text-sm font-semibold text-foreground">No orders in this view</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">{isSales ? "Create a draft for a customer and submit it to Accounts when ready." : "Orders will appear here as they move through this stage."}</p>{isSales && group === "DRAFTS" && <Button className="mt-5" onClick={() => setBookingOpen(true)}><Plus size={15} />New draft</Button>}</div>}
        </div>
      </section>
    </div>
    {bookingOpen && <OrderBookingModal initialOrder={editing ?? undefined} onClose={() => { setBookingOpen(false); setEditing(null); }} onBooked={async () => { setBookingOpen(false); setEditing(null); await reload(); }} />}
    {selected && <OrderDetailModal order={selected} canReview={isAccounts} canSubmit={isSales} onEdit={() => { setEditing(selected); setSelected(null); setBookingOpen(true); }} onClose={() => setSelected(null)} onChanged={async (order) => { setSelected(order); await reload(); }} />}
  </>;
}

function OrderDetailModal({ order, canReview, canSubmit, onEdit, onClose, onChanged }: { order: Order; canReview: boolean; canSubmit: boolean; onEdit: () => void; onClose: () => void; onChanged: (order: Order) => Promise<void> }) {
  const [comment, setComment] = useState(""); const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  const transition = async (status: string) => { setBusy(status); setError(""); try { const response = await fetch(`/api/orders/${order.id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, version: order.version, comment: comment.trim() || undefined }) }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(messageFrom(data, "Unable to update this order.")); setComment(""); await onChanged(data as Order); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update this order."); } finally { setBusy(""); } };
  const generateInvoice = async () => { setBusy("INVOICE"); setError(""); try { const response = await fetch(`/api/billing/orders/${order.id}/invoice`, { method: "POST" }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(messageFrom(data, "Unable to generate invoice.")); const refreshed = await fetch(`/api/orders/${order.id}`, { cache: "no-store" }); await onChanged(await refreshed.json()); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to generate invoice."); } finally { setBusy(""); } };
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/40 p-3 backdrop-blur-[1px] sm:p-4" role="dialog" aria-modal="true" aria-label={`${order.orderNumber} details`}>
    <div className="my-auto flex max-h-[calc(100dvh-24px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-white shadow-[0_20px_48px_rgba(15,23,42,0.18)] sm:max-h-[calc(100dvh-32px)]">
    <div className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4"><div><div className="flex items-center gap-2"><h2 className="text-base font-semibold text-foreground">{order.orderNumber}</h2><OrderStatus value={order.status} /></div><p className="mt-1 text-xs text-muted">{order.client.salonName} · Sales: {order.salesperson.name}{order.reviewedBy && ` · Reviewed by ${order.reviewedBy.name}`}</p></div><button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-background"><X size={18} /></button></div>
    <div className="flex-1 space-y-5 overflow-y-auto p-5"><div className="overflow-hidden rounded-lg border"><div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-background px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted"><span>Product</span><span>Qty</span><span>Amount</span></div>{order.items.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-3 border-t px-3 py-3 text-sm"><div><p className="font-medium text-foreground">{item.product.name}</p><p className="text-xs text-muted">{item.product.sku} · GST {Number(item.gstRate)}%</p></div><span className="text-muted">{item.quantity}</span><span className="min-w-24 text-right font-medium text-foreground">{money(item.lineTotal)}</span></div>)}</div>
      <div className="ml-auto max-w-sm space-y-2 rounded-lg bg-background p-4 text-sm"><Row label="Subtotal" value={money(order.subtotal)} /><Row label="Discount" value={`− ${money(order.discountAmount)}`} /><Row label="Taxable" value={money(order.taxableAmount)} /><Row label={Number(order.igstAmount) > 0 ? "IGST" : "CGST + SGST"} value={money(order.taxAmount)} /><div className="flex justify-between border-t pt-2 font-semibold text-foreground"><span>Grand total</span><span>{money(order.totalAmount)}</span></div></div>
      {(order.notes || order.reviewComment) && <div className="grid gap-3 sm:grid-cols-2">{order.notes && <Note label="Sales notes" value={order.notes} />}{order.reviewComment && <Note label="Review comment" value={order.reviewComment} />}</div>}
      {order.invoice && <div className="flex flex-col gap-3 rounded-lg border border-brand/20 bg-brand-soft/45 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-medium text-brand">Invoice generated</p><p className="mt-1 text-sm font-semibold text-foreground">{order.invoice.invoiceNumber}</p></div><a href={`/api/billing/invoices/${order.invoice.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-brand/20 bg-white px-3 text-xs font-semibold text-brand"><FileText size={15} />View PDF</a></div>}
      {canReview && ["SUBMITTED", "UNDER_REVIEW"].includes(order.status) && <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">Review comment <span className="text-muted">(required when returning or rejecting)</span></span><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" placeholder="Add a clear note for Sales…" /></label>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger">{error}</div>}
    </div>
    <div className="flex flex-wrap justify-end gap-2 border-t bg-white p-4">{canSubmit && ["DRAFT", "RETURNED_FOR_CORRECTION"].includes(order.status) && <><Button variant="secondary" disabled={Boolean(busy)} onClick={onEdit}>Edit draft</Button><Button disabled={Boolean(busy)} onClick={() => transition("SUBMITTED")}><Send size={15} />Submit to Accounts</Button></>}{canReview && order.status === "SUBMITTED" && <Button disabled={Boolean(busy)} onClick={() => transition("UNDER_REVIEW")}><Clock3 size={15} />Start review</Button>}{canReview && ["SUBMITTED", "UNDER_REVIEW"].includes(order.status) && <><Button variant="secondary" disabled={Boolean(busy) || !comment.trim()} onClick={() => transition("RETURNED_FOR_CORRECTION")}><RotateCcw size={15} />Return</Button><Button variant="secondary" disabled={Boolean(busy) || !comment.trim()} onClick={() => transition("REJECTED")}><XCircle size={15} />Reject</Button></>}{canReview && order.status === "UNDER_REVIEW" && <Button disabled={Boolean(busy)} onClick={() => transition("APPROVED")}><Check size={15} />Approve</Button>}{canReview && order.status === "APPROVED" && <Button disabled={Boolean(busy)} onClick={generateInvoice}><FileCheck2 size={15} />{busy === "INVOICE" ? "Generating…" : "Generate invoice"}</Button>}</div>
  </div></div>;
}
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-5"><span className="text-muted">{label}</span><span className="font-medium text-foreground">{value}</span></div>; }
function Note({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p><p className="mt-1.5 text-sm text-foreground">{value}</p></div>; }

type ClientOption = { id: string; salonName: string; city: string; primaryContact: string };
type ProductOption = { id: string; name: string; unit: string; unitPrice: string; stockOnHand: number; gstRate: string | null };
type CartLine = { product: ProductOption; quantity: number };

export function OrderBookingModal({ clientId, clientName, initialOrder, onClose, onBooked }: { clientId?: string; clientName?: string; initialOrder?: Order; onClose: () => void; onBooked: (order: Order) => Promise<void> | void }) {
  const [client, setClient] = useState<ClientOption | null>(initialOrder ? initialOrder.client : clientId && clientName ? { id: clientId, salonName: clientName, city: "", primaryContact: "" } : null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientOption[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [cart, setCart] = useState<CartLine[]>(initialOrder?.items.map((item) => ({ product: { id: item.product.id, name: item.product.name, unit: item.product.unit, unitPrice: item.unitPrice, stockOnHand: item.product.stockOnHand, gstRate: item.gstRate }, quantity: item.quantity })) ?? []);
  const [discountAmount, setDiscountAmount] = useState(initialOrder && Number(initialOrder.discountAmount) > 0 ? initialOrder.discountAmount : "");
  const [notes, setNotes] = useState(initialOrder?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [shortfalls, setShortfalls] = useState<Array<{ name: string; available: number; requested: number }>>([]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (client || !clientSearch.trim()) { setClientResults([]); return; }
      const response = await fetch(`/api/clients?search=${encodeURIComponent(clientSearch.trim())}&pageSize=6`, { cache: "no-store" });
      if (response.ok) { const json = await response.json(); setClientResults(json.items ?? []); }
    }, 250);
    return () => clearTimeout(timer);
  }, [clientSearch, client]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ pageSize: "40" });
      if (productSearch.trim()) params.set("search", productSearch.trim());
      const response = await fetch(`/api/products?${params}`, { cache: "no-store" });
      if (response.ok) { const json = await response.json(); setProducts(json.items ?? []); }
    }, 250);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const addToCart = (product: ProductOption) => setCart((current) => {
    const existing = current.find((line) => line.product.id === product.id);
    if (existing) return current.map((line) => line.product.id === product.id ? { ...line, quantity: Math.min(line.quantity + 1, product.stockOnHand || line.quantity + 1) } : line);
    return [...current, { product, quantity: 1 }];
  });
  const changeQuantity = (productId: string, delta: number) => setCart((current) => current.map((line) => line.product.id === productId ? { ...line, quantity: Math.max(1, line.quantity + delta) } : line).filter((line) => line.quantity > 0));
  const removeLine = (productId: string) => setCart((current) => current.filter((line) => line.product.id !== productId));

  const subtotal = cart.reduce((sum, line) => sum + Number(line.product.unitPrice) * line.quantity, 0);
  const discount = Number(discountAmount) || 0;
  const taxable = Math.max(0, subtotal - discount);
  const estimatedTax = cart.reduce((sum, line) => sum + Math.max(0, Number(line.product.unitPrice) * line.quantity - (subtotal ? discount * (Number(line.product.unitPrice) * line.quantity / subtotal) : 0)) * Number(line.product.gstRate ?? 18) / 100, 0);
  const total = taxable + estimatedTax;

  const submit = async () => {
    if (!client || !cart.length) return;
    setSaving(true); setError(""); setShortfalls([]);
    try {
      const response = await fetch(initialOrder ? `/api/orders/${initialOrder.id}` : "/api/orders", {
        method: initialOrder ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId: client.id, items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })), discountAmount: discount || undefined, notes: notes.trim() || undefined, ...(initialOrder ? { version: initialOrder.version } : {}) }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (data?.shortfalls) { setShortfalls(data.shortfalls); setError(messageFrom(data, "Not enough stock for one or more products.")); return; }
        throw new Error(messageFrom(data, "Unable to book this order."));
      }
      await onBooked(data as Order);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to book this order."); }
    finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/40 p-0 backdrop-blur-[1px] sm:p-4" role="dialog" aria-modal="true" aria-label="New order">
    <div className="flex min-h-full w-full flex-col bg-white sm:my-4 sm:min-h-0 sm:max-h-[calc(100dvh-32px)] sm:max-w-2xl sm:rounded-xl sm:border sm:shadow-[0_20px_48px_rgba(15,23,42,0.18)]">
      <div className="flex items-center justify-between border-b px-4 py-4 sm:px-5"><div><h2 className="text-base font-semibold text-foreground">{initialOrder ? `Edit ${initialOrder.orderNumber}` : "New order draft"}</h2><p className="mt-1 text-xs text-muted">Prices and GST come from the product master; stock is reserved only after approval</p></div><button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-lg text-muted hover:bg-background sm:size-8" aria-label="Close"><X size={18} /></button></div>
      <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
        <div>
          <p className="mb-2 text-xs font-semibold text-foreground">Salon</p>
          {client ? <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2.5"><span className="text-sm font-medium text-foreground">{client.salonName}</span><button type="button" onClick={() => { setClient(null); setClientSearch(""); }} className="text-xs font-semibold text-brand">Change</button></div>
            : <div className="relative">
              <label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={17} /><Input className="pl-9" value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Search salon name or phone" autoFocus /></label>
              {clientResults.length > 0 && <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-[0_12px_32px_rgba(15,23,42,0.14)]">{clientResults.map((option) => <button key={option.id} type="button" onClick={() => { setClient(option); setClientResults([]); }} className="flex w-full flex-col items-start px-3 py-2.5 text-left hover:bg-brand-soft/40"><span className="text-sm font-medium text-foreground">{option.salonName}</span><span className="text-xs text-muted">{option.city}</span></button>)}</div>}
            </div>}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-foreground">Products</p>
          <label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={17} /><Input className="pl-9" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search products" /></label>
          <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto rounded-lg border bg-background p-2">
            {products.length ? products.map((product) => <button key={product.id} type="button" disabled={product.stockOnHand <= 0} onClick={() => addToCart(product)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{product.name}</span><span className="text-xs text-muted">{money(product.unitPrice)} / {product.unit} · {product.stockOnHand > 0 ? `${product.stockOnHand} in stock` : "Out of stock"}</span></span>
              <Plus size={16} className="shrink-0 text-brand" />
            </button>) : <p className="px-2 py-3 text-center text-xs text-muted">No products found</p>}
          </div>
        </div>

        {cart.length > 0 && <div>
          <p className="mb-2 text-xs font-semibold text-foreground">Order items</p>
          <div className="space-y-2">
            {cart.map((line) => <div key={line.product.id} className="flex items-center gap-3 rounded-lg border p-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Package size={16} /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{line.product.name}</p><p className="text-xs text-muted">{money(line.product.unitPrice)} × {line.quantity} = {money(Number(line.product.unitPrice) * line.quantity)}</p></div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => changeQuantity(line.product.id, -1)} className="grid size-8 place-items-center rounded-lg border text-muted hover:bg-background" aria-label="Decrease quantity"><Minus size={14} /></button>
                <span className="w-6 text-center text-sm font-semibold text-foreground">{line.quantity}</span>
                <button type="button" onClick={() => changeQuantity(line.product.id, 1)} className="grid size-8 place-items-center rounded-lg border text-muted hover:bg-background" aria-label="Increase quantity"><Plus size={14} /></button>
                <button type="button" onClick={() => removeLine(line.product.id)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-danger" aria-label="Remove item"><X size={14} /></button>
              </div>
            </div>)}
          </div>
        </div>}

        {cart.length > 0 && <div className="space-y-3 rounded-lg border bg-background p-3">
          <div className="flex items-center justify-between text-xs"><span className="text-muted">Subtotal</span><span className="font-medium text-foreground">{money(subtotal)}</span></div>
          <label className="flex items-center justify-between gap-3 text-xs"><span className="text-muted">Discount</span><Input className="h-9 w-28 text-right" type="number" min="0" value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} placeholder="0" /></label>
          <div className="flex items-center justify-between text-xs"><span className="text-muted">Estimated GST</span><span className="font-medium text-foreground">{money(estimatedTax)}</span></div>
          <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold text-foreground"><span>Grand total</span><span>{money(total)}</span></div>
        </div>}

        <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">Notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={500} className="w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" /></label>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}{shortfalls.length > 0 && <ul className="mt-1.5 list-disc space-y-0.5 pl-4">{shortfalls.map((item) => <li key={item.name}>{item.name}: only {item.available} available, {item.requested} requested</li>)}</ul>}</div>}
      </div>
      <div className="sticky bottom-0 flex gap-2 border-t bg-white p-4 sm:justify-end sm:px-5"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" disabled={!client || !cart.length || saving} onClick={submit}>{saving ? "Saving…" : initialOrder ? "Save changes" : "Save draft"}</Button></div>
    </div>
  </div>;
}
