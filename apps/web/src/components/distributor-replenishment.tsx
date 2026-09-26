"use client";

import { Minus, Package, Plus, Search, Send, Truck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Product = { id: string; name: string; sku: string; unit: string };
type CartLine = { product: Product; quantity: number };
export type ReplenishmentRequest = {
  id: string;
  requestNumber: string;
  status: "REQUESTED" | "APPROVED" | "FULFILLED" | "REJECTED";
  notes: string | null;
  createdAt: string;
  fulfilledAt: string | null;
  items: Array<{ id: string; quantity: number; product: { name: string; unit: string } }>;
};

const messageFrom = (data: unknown, fallback: string) => (data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback);
const STATUS_TONE: Record<ReplenishmentRequest["status"], string> = { REQUESTED: "bg-warning-soft text-warning", APPROVED: "bg-brand-soft text-brand", FULFILLED: "bg-success-soft text-success", REJECTED: "bg-red-50 text-danger" };

export function DistributorReplenishment({ initial, roleKey }: { initial: ReplenishmentRequest[]; roleKey?: string }) {
  const [requests, setRequests] = useState(initial);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const canRequest = roleKey === "DISTRIBUTOR_OWNER" || roleKey === "DISTRIBUTOR_ACCOUNTS";

  const refresh = async () => {
    const response = await fetch("/api/distributor/replenishment", { cache: "no-store" });
    if (response.ok) setRequests(await response.json());
  };

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger">{error}</div>}
      {canRequest && <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Send size={15} />Request replenishment</Button>
      </div>}
      <section className="crm-surface">
        <div className="rounded-t-xl border-b px-5 py-4"><h2 className="text-sm font-semibold text-foreground">Replenishment history</h2><p className="mt-0.5 text-xs text-muted">Requests you&apos;ve sent to Bond Therapy&apos;s central warehouse</p></div>
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
                <p className="mt-1.5 text-xs text-muted">{request.items.map((item) => `${item.product.name} × ${item.quantity}`).join(" · ")}</p>
                {request.notes && <p className="mt-1 text-xs italic text-subtle">&quot;{request.notes}&quot;</p>}
              </article>
            ))}</div>
          ) : (
            <div className="px-5 py-14 text-center"><Truck className="mx-auto text-subtle" size={28} /><p className="mt-3 text-sm font-semibold">No requests yet</p><p className="mt-1 text-xs text-muted">Request stock from Bond Therapy when you&apos;re running low.</p></div>
          )}
        </div>
      </section>
      {open && <RequestModal onClose={() => setOpen(false)} onSubmitted={async () => { setOpen(false); await refresh(); }} onError={setError} />}
    </div>
  );
}

function RequestModal({ onClose, onSubmitted, onError }: { onClose: () => void; onSubmitted: () => void; onError: (message: string) => void }) {
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
          <div><h2 className="text-base font-semibold text-foreground">Request replenishment</h2><p className="mt-1 text-xs text-muted">Bond Therapy will review and dispatch from central stock</p></div>
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
