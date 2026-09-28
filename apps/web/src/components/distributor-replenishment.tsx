"use client";

import { Camera, Check, FileSpreadsheet, MessageCircle, Minus, Package, Plus, Search, Send, Truck, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Product = { id: string; name: string; sku: string; unit: string };
type CartLine = { product: Product; quantity: number };
export type ReplenishmentRequest = {
  id: string;
  requestNumber: string;
  status: "REQUESTED" | "APPROVED" | "PICKING" | "PACKED" | "DISPATCHED" | "RECEIVED" | "PARTIALLY_RECEIVED" | "FULFILLED" | "REJECTED";
  notes: string | null;
  createdAt: string;
  fulfilledAt: string | null;
  invoiceReference: string | null;
  invoiceFileName: string | null;
  confirmationToken: string | null;
  distributor: { id: string; businessName: string };
  sourceDistributor: { id: string; businessName: string } | null;
  items: Array<{ id: string; quantity: number; acceptedQuantity: number | null; dispatchedQuantity: number | null; receivedQuantity: number | null; damagedQuantity: number | null; product: { name: string; unit: string } }>;
};

const messageFrom = (data: unknown, fallback: string) => (data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback);
const STATUS_TONE: Record<ReplenishmentRequest["status"], string> = { REQUESTED: "bg-warning-soft text-warning", APPROVED: "bg-brand-soft text-brand", PICKING: "bg-brand-soft text-brand", PACKED: "bg-brand-soft text-brand", DISPATCHED: "bg-brand-soft text-brand", RECEIVED: "bg-success-soft text-success", PARTIALLY_RECEIVED: "bg-warning-soft text-warning", FULFILLED: "bg-success-soft text-success", REJECTED: "bg-red-50 text-danger" };

export function DistributorReplenishment({ initial, roleKey, partnerId, partnerType }: { initial: ReplenishmentRequest[]; roleKey?: string; partnerId: string; partnerType: "SUPER_STOCKIST" | "DISTRIBUTOR" }) {
  const [requests, setRequests] = useState(initial);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [invoiceRefs, setInvoiceRefs] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [damaged, setDamaged] = useState<Record<string, number>>({});
  const canRequest = roleKey === "DISTRIBUTOR_OWNER" || roleKey === "DISTRIBUTOR_ACCOUNTS";

  const refresh = async () => {
    const response = await fetch("/api/distributor/replenishment", { cache: "no-store" });
    if (response.ok) setRequests(await response.json());
  };
  const update = async (request: ReplenishmentRequest, action: "approve" | "reject" | "fulfill" | "receive") => {
    setBusy(request.id); setError("");
    try {
      const itemBody = request.items.map((item) => ({ itemId: item.id, quantity: quantities[item.id] ?? (action === "receive" ? item.dispatchedQuantity ?? item.acceptedQuantity ?? item.quantity : item.quantity), ...(action === "receive" ? { damagedQuantity: damaged[item.id] ?? 0 } : {}) }));
      const response = await fetch(`/api/distributor/replenishment/${request.id}/${action}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(action === "fulfill" ? { invoiceReference: invoiceRefs[request.id]?.trim() || request.invoiceReference, items: itemBody } : action === "approve" || action === "receive" ? { items: itemBody } : action === "reject" ? { comment: "Rejected by supplying partner" } : {}) });
      const data = await response.json().catch(() => null); if (!response.ok) throw new Error(messageFrom(data, "Unable to update this request.")); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update this request."); } finally { setBusy(""); }
  };
  const uploadInvoice = async (request: ReplenishmentRequest, file?: File) => {
    if (!file) return; setBusy(request.id); setError("");
    try { const body = new FormData(); body.set("invoice", file); const response = await fetch(`/api/distributor/replenishment/${request.id}/invoice-attachment`, { method: "POST", body }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(messageFrom(data, "Unable to upload invoice.")); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to upload invoice."); } finally { setBusy(""); }
  };
  const bulkUpload = async (file?: File) => {
    if (!file) return; setBusy("bulk"); setError("");
    try { const body = new FormData(); body.set("file", file); const response = await fetch("/api/distributor/replenishment/bulk-invoices", { method: "POST", body }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(messageFrom(data, "Unable to import invoices.")); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to import invoices."); } finally { setBusy(""); }
  };

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger">{error}</div>}
      {canRequest && <div className="flex flex-wrap justify-end gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 text-sm font-semibold hover:bg-background"><FileSpreadsheet size={15} />Import invoice CSV<input type="file" accept=".csv,text/csv" className="sr-only" disabled={busy === "bulk"} onChange={(event) => bulkUpload(event.target.files?.[0])} /></label>
        <Button onClick={() => setOpen(true)}><Send size={15} />Request replenishment</Button>
      </div>}
      <section className="crm-surface">
        <div className="rounded-t-xl border-b px-5 py-4"><h2 className="text-sm font-semibold text-foreground">Replenishment control</h2><p className="mt-0.5 text-xs text-muted">{partnerType === "SUPER_STOCKIST" ? "Mother Depot requests and demand from assigned distributors" : "Requests sent to your assigned Super Stockist"}</p></div>
        <div className="overflow-hidden rounded-b-xl">
          {requests.length ? (
            <div className="divide-y">{requests.map((request) => (
              <article key={request.id} className="p-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{request.requestNumber}</p>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[request.status]}`}>{request.status.charAt(0) + request.status.slice(1).toLowerCase()}</span>
                  </div>
                  <p className="text-xs text-muted">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(request.createdAt))}</p>
                </div>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">{request.items.map((item) => <div key={item.id} className="flex items-center justify-between rounded-md bg-background px-2.5 py-2 text-xs"><span className="min-w-0 truncate text-muted">{item.product.name}</span><span className="ml-2 shrink-0 font-semibold">{item.acceptedQuantity ?? item.quantity} / {item.quantity} {item.product.unit}</span></div>)}</div>
                <p className="mt-1 text-xs text-muted">{request.sourceDistributor ? `${request.sourceDistributor.businessName} → ${request.distributor.businessName}` : `Mother Depot → ${request.distributor.businessName}`}</p>
                {request.notes && <p className="mt-1 text-xs italic text-subtle">&quot;{request.notes}&quot;</p>}
                {request.invoiceReference && <p className="mt-2 text-xs font-medium text-foreground">Invoice: {request.invoiceReference}</p>}
                {request.invoiceFileName && <a href={`/api/distributor/replenishment/${request.id}/invoice-attachment`} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs font-semibold text-brand hover:underline">View attached invoice</a>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {request.distributor.id === partnerId && request.status === "REQUESTED" && <a className="inline-flex h-9 items-center gap-2 rounded-lg border bg-white px-3 text-xs font-semibold hover:bg-background" href={`https://wa.me/?text=${encodeURIComponent(`New Bond Therapy stock request ${request.requestNumber}\nFrom: ${request.sourceDistributor?.businessName ?? "Mother Depot"}\nTo: ${request.distributor.businessName}\nItems: ${request.items.map((item) => `${item.product.name} x ${item.quantity}`).join(", ")}${request.sourceDistributor && request.confirmationToken ? `\nOpen and confirm: ${typeof window !== "undefined" ? window.location.origin : ""}/partner/replenishment/${request.confirmationToken}` : ""}`)}`} target="_blank" rel="noreferrer"><MessageCircle size={14} />Share on WhatsApp</a>}
                  {request.sourceDistributor?.id === partnerId && request.status === "REQUESTED" && <div className="w-full space-y-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Accepted quantities</p><div className="grid gap-2 sm:grid-cols-2">{request.items.map((item) => <label key={item.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"><span className="truncate">{item.product.name}</span><Input type="number" min={0} max={item.quantity} className="h-8 w-20 text-right" value={quantities[item.id] ?? item.quantity} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))} /></label>)}</div><div className="flex gap-2"><Button disabled={busy === request.id} onClick={() => update(request, "approve")}><Check size={14} />Accept selected</Button><Button variant="secondary" disabled={busy === request.id} onClick={() => update(request, "reject")}>Reject</Button></div></div>}
                  {request.sourceDistributor?.id === partnerId && ["APPROVED", "PICKING", "PACKED"].includes(request.status) && <div className="w-full space-y-2"><div className="grid gap-2 sm:grid-cols-2">{request.items.filter((item) => (item.acceptedQuantity ?? item.quantity) > 0).map((item) => <label key={item.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"><span className="truncate">{item.product.name} · accepted {item.acceptedQuantity ?? item.quantity}</span><Input type="number" min={0} max={item.acceptedQuantity ?? item.quantity} className="h-8 w-20 text-right" value={quantities[item.id] ?? item.acceptedQuantity ?? item.quantity} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))} /></label>)}</div><Input className="h-9 w-full sm:max-w-64" value={invoiceRefs[request.id] ?? request.invoiceReference ?? ""} onChange={(event) => setInvoiceRefs((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Tally / Marg invoice number" /><div className="flex flex-wrap gap-2"><label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 text-xs font-semibold hover:bg-background"><Camera size={14} />Take photo<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => uploadInvoice(request, event.target.files?.[0])} /></label><label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 text-xs font-semibold hover:bg-background"><Upload size={14} />PDF / photo<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => uploadInvoice(request, event.target.files?.[0])} /></label><Button disabled={busy === request.id || !(invoiceRefs[request.id]?.trim() || request.invoiceReference) || !request.invoiceFileName} onClick={() => update(request, "fulfill")}><Truck size={14} />Confirm dispatch</Button></div></div>}
                  {request.distributor.id === partnerId && request.status === "DISPATCHED" && <div className="w-full space-y-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Receipt check</p><div className="grid gap-2 sm:grid-cols-2">{request.items.filter((item) => (item.dispatchedQuantity ?? 0) > 0).map((item) => <div key={item.id} className="rounded-lg border p-2.5"><p className="truncate text-xs font-medium">{item.product.name} · sent {item.dispatchedQuantity}</p><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[11px] text-muted">Received<Input type="number" min={0} max={item.dispatchedQuantity ?? 0} className="mt-1 h-8 text-right" value={quantities[item.id] ?? item.dispatchedQuantity ?? 0} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))} /></label><label className="text-[11px] text-muted">Damaged<Input type="number" min={0} max={item.dispatchedQuantity ?? 0} className="mt-1 h-8 text-right" value={damaged[item.id] ?? 0} onChange={(event) => setDamaged((current) => ({ ...current, [item.id]: Number(event.target.value) }))} /></label></div></div>)}</div><Button disabled={busy === request.id} onClick={() => update(request, "receive")}><Package size={14} />Confirm receipt</Button></div>}
                </div>
              </article>
            ))}</div>
          ) : (
            <div className="px-5 py-14 text-center"><Truck className="mx-auto text-subtle" size={28} /><p className="mt-3 text-sm font-semibold">No requests yet</p><p className="mt-1 text-xs text-muted">Request stock from Bond Therapy when you&apos;re running low.</p></div>
          )}
        </div>
      </section>
      {open && <RequestModal supplierLabel={partnerType === "SUPER_STOCKIST" ? "Mother Depot" : "your assigned Super Stockist"} onClose={() => setOpen(false)} onSubmitted={async () => { setOpen(false); await refresh(); }} onError={setError} />}
    </div>
  );
}

function RequestModal({ supplierLabel, onClose, onSubmitted, onError }: { supplierLabel: string; onClose: () => void; onSubmitted: () => void; onError: (message: string) => void }) {
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    const timer = setTimeout(async () => {
      const params = new URLSearchParams();
      if (productSearch.trim()) params.set("search", productSearch.trim());
      const response = await fetch(`/api/distributor/replenishment/products?${params}`, { cache: "no-store" });
      if (response.ok) setProducts(await response.json());
    }, 250);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const addToCart = (product: Product) => setCart((current) => (current.some((line) => line.product.id === product.id) ? current : [...current, { product, quantity: 1 }]));
  const changeQuantity = (productId: string, delta: number) => setCart((current) => current.map((line) => (line.product.id === productId ? { ...line, quantity: Math.max(1, line.quantity + delta) } : line)));
  const removeLine = (productId: string) => setCart((current) => current.filter((line) => line.product.id !== productId));

  const submit = async () => {
    if (!cart.length) return;
    setSaving(true);
    setLocalError("");
    try {
      const response = await fetch("/api/distributor/replenishment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })), notes: notes.trim() || undefined }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to submit this request."));
      onSubmitted();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to submit this request.";
      setLocalError(message);
      onError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/40 p-0 backdrop-blur-[1px] sm:p-4" role="dialog" aria-modal="true" aria-label="Request replenishment">
      <div className="flex min-h-full w-full flex-col bg-white sm:my-4 sm:min-h-0 sm:max-h-[calc(100dvh-32px)] sm:max-w-lg sm:rounded-xl sm:border sm:shadow-[0_20px_48px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between border-b px-4 py-4 sm:px-5">
          <div><h2 className="text-base font-semibold text-foreground">Request replenishment</h2><p className="mt-1 text-xs text-muted">Request stock from {supplierLabel}</p></div>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-lg text-muted hover:bg-background sm:size-8" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <div>
            <p className="mb-2 text-xs font-semibold text-foreground">Products</p>
            <label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={17} /><Input className="pl-9" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search products" /></label>
            <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto rounded-lg border bg-background p-2">
              {products.length ? products.map((product) => (
                <button key={product.id} type="button" onClick={() => addToCart(product)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white">
                  <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{product.name}</span><span className="text-xs text-muted">{product.sku} · {product.unit}</span></span>
                  <Plus size={16} className="shrink-0 text-brand" />
                </button>
              )) : <p className="px-2 py-3 text-center text-xs text-muted">No products found</p>}
            </div>
          </div>

          {cart.length > 0 && <div>
            <p className="mb-2 text-xs font-semibold text-foreground">Requested items</p>
            <div className="space-y-2">{cart.map((line) => (
              <div key={line.product.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{line.product.name}</p><p className="text-xs text-muted">{line.product.unit}</p></div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => changeQuantity(line.product.id, -1)} className="grid size-7 place-items-center rounded-md border text-muted hover:bg-background" aria-label="Decrease quantity"><Minus size={14} /></button>
                  <span className="w-6 text-center text-sm font-semibold">{line.quantity}</span>
                  <button type="button" onClick={() => changeQuantity(line.product.id, 1)} className="grid size-7 place-items-center rounded-md border text-muted hover:bg-background" aria-label="Increase quantity"><Plus size={14} /></button>
                  <button type="button" onClick={() => removeLine(line.product.id)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-background" aria-label="Remove"><X size={14} /></button>
                </div>
              </div>
            ))}</div>
          </div>}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="repl-notes">Notes (optional)</label>
            <textarea id="repl-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={500} className="w-full rounded-lg border bg-white px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20" placeholder="Anything Bond Therapy should know" />
          </div>

          {localError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger">{localError}</div>}
          {cart.length === 0 && <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-2.5 text-xs text-muted"><Package size={15} />Add at least one product to continue.</div>}
        </div>
        <div className="flex justify-end gap-2 border-t p-4 sm:px-5"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={saving || !cart.length} onClick={submit}>{saving ? "Submitting…" : "Submit request"}</Button></div>
      </div>
    </div>
  );
}
