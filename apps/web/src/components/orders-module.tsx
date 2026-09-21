"use client";

import { ChevronLeft, ChevronRight, Minus, Package, Plus, Search, ShoppingCart, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OrderItemRow = { id: string; quantity: number; unitPrice: string; lineTotal: string; product: { id: string; name: string; sku: string; unit: string } };
export type Order = { id: string; orderNumber: string; status: string; subtotal: string; discountAmount: string; totalAmount: string; notes: string | null; createdAt: string; client: { id: string; salonName: string; city: string; primaryContact: string }; salesperson: { id: string; name: string }; items: OrderItemRow[] };
export type OrderListResponse = { items: Order[]; page: number; pageSize: number; total: number; hasMore: boolean };

const money = (value: string | number) => `₹${Number(value).toLocaleString("en-IN")}`;
const pretty = (value: string) => value[0] + value.slice(1).toLowerCase();
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback;

export function OrderStatus({ value }: { value: string }) {
  const tone = value === "DELIVERED" ? "bg-success-soft text-success" : value === "CANCELLED" ? "bg-gray-100 text-muted" : value === "DISPATCHED" ? "bg-brand-soft text-brand" : "bg-warning-soft text-warning";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{pretty(value)}</span>;
}

export function OrdersModule({ initial }: { initial: OrderListResponse | null }) {
  const [data, setData] = useState(initial);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initial ? "" : "Unable to load orders. Please try again.");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => { const frame = requestAnimationFrame(() => setHeaderSlot(document.getElementById("page-header-actions"))); return () => cancelAnimationFrame(frame); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/orders?page=${page}&pageSize=20`, { cache: "no-store" });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error(messageFrom(json, "Unable to load orders."));
        if (!cancelled) { setData(json as OrderListResponse); setError(""); }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load orders."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [page, refreshToken]);

  const reload = async () => { setPage(1); setRefreshToken((value) => value + 1); };

  return <>
    {headerSlot && createPortal(<Button onClick={() => setBookingOpen(true)}><Plus size={16} /><span className="hidden sm:inline">New order</span><span className="sr-only sm:hidden">New order</span></Button>, headerSlot)}
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}
      <section className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5"><div><p className="text-sm font-semibold text-foreground">Orders</p><p className="mt-0.5 text-xs text-muted">{data?.total ?? 0} order{data?.total === 1 ? "" : "s"}</p></div></div>
        {loading && !data ? <div className="space-y-3 p-4"><div className="h-16 animate-pulse rounded-lg bg-background" /><div className="h-16 animate-pulse rounded-lg bg-background" /></div>
          : data?.items.length ? <div className="divide-y">{data.items.map((order) => <div key={order.id} className="p-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{order.orderNumber}</p><p className="mt-0.5 truncate text-xs text-muted">{order.client.salonName} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(order.createdAt))}</p></div>
              <div className="shrink-0 text-right"><p className="text-sm font-semibold text-foreground">{money(order.totalAmount)}</p><div className="mt-1"><OrderStatus value={order.status} /></div></div>
            </div>
            <p className="mt-2 text-xs text-muted">{order.items.map((item) => `${item.product.name} × ${item.quantity}`).join(", ")}</p>
          </div>)}</div>
          : <div className="px-5 py-14 text-center"><ShoppingCart className="mx-auto text-subtle" size={28} /><p className="mt-3 text-sm font-semibold text-foreground">No orders yet</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">Book your first order for a salon — stock is checked live so nothing gets promised that is not available.</p><Button className="mt-5" onClick={() => setBookingOpen(true)}><Plus size={15} />New order</Button></div>}
        {data && data.total > data.pageSize && <div className="flex items-center justify-between border-t px-4 py-3"><p className="text-xs text-muted">Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</p><div className="flex gap-2"><Button variant="secondary" className="h-9 px-3" disabled={data.page <= 1 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={15} />Previous</Button><Button variant="secondary" className="h-9 px-3" disabled={!data.hasMore || loading} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight size={15} /></Button></div></div>}
      </section>
    </div>
    {bookingOpen && <OrderBookingModal onClose={() => setBookingOpen(false)} onBooked={async () => { setBookingOpen(false); await reload(); }} />}
  </>;
}

type ClientOption = { id: string; salonName: string; city: string; primaryContact: string };
type ProductOption = { id: string; sku: string; name: string; unit: string; unitPrice: string; stockOnHand: number };
type CartLine = { product: ProductOption; quantity: number };

export function OrderBookingModal({ clientId, clientName, onClose, onBooked }: { clientId?: string; clientName?: string; onClose: () => void; onBooked: (order: Order) => Promise<void> | void }) {
  const [client, setClient] = useState<ClientOption | null>(clientId && clientName ? { id: clientId, salonName: clientName, city: "", primaryContact: "" } : null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientOption[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountAmount, setDiscountAmount] = useState("");
  const [notes, setNotes] = useState("");
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
  const total = Math.max(0, subtotal - discount);

  const submit = async () => {
    if (!client || !cart.length) return;
    setSaving(true); setError(""); setShortfalls([]);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId: client.id, items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })), discountAmount: discount || undefined, notes: notes.trim() || undefined }),
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

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#0f172a]/40 p-0 backdrop-blur-[1px] sm:p-4" role="dialog" aria-modal="true" aria-label="New order">
    <div className="flex min-h-full w-full flex-col bg-white sm:my-4 sm:min-h-0 sm:max-h-[calc(100dvh-32px)] sm:max-w-2xl sm:rounded-xl sm:border sm:shadow-[0_20px_48px_rgba(15,23,42,0.18)]">
      <div className="flex items-center justify-between border-b px-4 py-4 sm:px-5"><div><h2 className="text-base font-semibold text-foreground">New order</h2><p className="mt-1 text-xs text-muted">Stock is checked live before the order is confirmed</p></div><button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-lg text-muted hover:bg-background sm:size-8" aria-label="Close"><X size={18} /></button></div>
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
          <label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={17} /><Input className="pl-9" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search product or SKU" /></label>
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
          <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold text-foreground"><span>Total</span><span>{money(total)}</span></div>
        </div>}

        <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">Notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={500} className="w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" /></label>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}{shortfalls.length > 0 && <ul className="mt-1.5 list-disc space-y-0.5 pl-4">{shortfalls.map((item) => <li key={item.name}>{item.name}: only {item.available} available, {item.requested} requested</li>)}</ul>}</div>}
      </div>
      <div className="sticky bottom-0 flex gap-2 border-t bg-white p-4 sm:justify-end sm:px-5"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" disabled={!client || !cart.length || saving} onClick={submit}>{saving ? "Booking…" : "Book order"}</Button></div>
    </div>
  </div>;
}
