"use client";

import { AlertTriangle, PackagePlus, PackageX, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Product = { id: string; name: string; category: string; unit: string; unitPrice: string; stockOnHand: number };
type ProductListResponse = { items: Product[]; page: number; pageSize: number; total: number; hasMore: boolean };

const CATEGORIES = [
  ["", "All"], ["SHAMPOO", "Shampoo"], ["CONDITIONER", "Conditioner"], ["TREATMENT", "Treatment"], ["COLOR", "Color"], ["STYLING", "Styling"], ["TOOLS", "Tools"], ["OTHER", "Other"],
] as const;
const pretty = (value: string) => value[0] + value.slice(1).toLowerCase();
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback;

function StockBadge({ stockOnHand }: { stockOnHand: number }) {
  if (stockOnHand <= 0) return <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-danger">Out of stock</span>;
  if (stockOnHand <= 10) return <span className="inline-flex rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning">Low · {stockOnHand}</span>;
  return <span className="inline-flex rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">{stockOnHand} in stock</span>;
}

export function InventoryModule({ initial }: { initial: ProductListResponse | null }) {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initial ? "" : "Unable to load inventory. Please try again.");
  const [movementTarget, setMovementTarget] = useState<{ product: Product; type: "RECEIVED" | "DAMAGED" } | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (search.trim()) params.set("search", search.trim());
      if (category) params.set("category", category);
      const response = await fetch(`/api/products?${params}`, { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(json, "Unable to load inventory."));
      setData(json as ProductListResponse);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load inventory."); }
    finally { setLoading(false); }
  };

  useEffect(() => { const timer = setTimeout(() => { void reload(); }, 250); return () => clearTimeout(timer); }, [search, category]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="space-y-4">
    <label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={17} /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" aria-label="Search inventory" /></label>
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {CATEGORIES.map(([value, label]) => <button key={value} type="button" onClick={() => setCategory(value)} className={`h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-colors ${category === value ? "border-brand bg-brand text-white" : "text-muted hover:bg-brand-soft/60"}`}>{label}</button>)}
    </div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}
    <section className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
      {loading && !data ? <div className="space-y-3 p-4"><div className="h-16 animate-pulse rounded-lg bg-background" /><div className="h-16 animate-pulse rounded-lg bg-background" /></div>
        : data?.items.length ? <div className="divide-y">{data.items.map((product) => <div key={product.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{product.name}</p>
            <p className="mt-0.5 text-xs text-muted">{pretty(product.category)} · {product.unit}</p>
          </div>
          <div className="flex items-center gap-3">
            <StockBadge stockOnHand={product.stockOnHand} />
            <Button variant="secondary" className="h-10 px-3" onClick={() => setMovementTarget({ product, type: "RECEIVED" })}><PackagePlus size={15} />Receive</Button>
            <Button variant="secondary" className="h-10 px-3" onClick={() => setMovementTarget({ product, type: "DAMAGED" })}><PackageX size={15} />Damage</Button>
          </div>
        </div>)}</div>
        : <div className="px-5 py-14 text-center"><AlertTriangle className="mx-auto text-subtle" size={28} /><p className="mt-3 text-sm font-semibold text-foreground">No products found</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">Try a different search or category.</p></div>}
    </section>
    {movementTarget && <StockMovementForm product={movementTarget.product} type={movementTarget.type} onClose={() => setMovementTarget(null)} onSaved={async () => { setMovementTarget(null); await reload(); }} />}
  </div>;
}

function StockMovementForm({ product, type, onClose, onSaved }: { product: Product; type: "RECEIVED" | "DAMAGED"; onClose: () => void; onSaved: () => Promise<void> }) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const qty = Number(quantity);
    if (!qty || qty <= 0) { setError("Enter a quantity greater than zero."); return; }
    setSaving(true); setError("");
    try {
      const quantityChange = type === "RECEIVED" ? qty : -qty;
      const response = await fetch(`/api/products/${product.id}/movements`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, quantityChange, reason: reason.trim() || undefined }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to record this stock movement."));
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to record this stock movement."); setSaving(false); }
  };

  return <div className="fixed inset-0 z-50 grid place-items-end bg-[#0f172a]/40 p-0 backdrop-blur-[1px] sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label={type === "RECEIVED" ? "Receive stock" : "Report damaged stock"}>
    <div className="w-full rounded-xl border bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.18)] sm:max-w-sm">
      <h2 className="text-base font-semibold text-foreground">{type === "RECEIVED" ? "Receive stock" : "Report damaged stock"}</h2>
      <p className="mt-1 text-xs text-muted">{product.name} · currently {product.stockOnHand} {product.unit}</p>
      <div className="mt-4 space-y-3">
        <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">Quantity</span><Input type="number" min="1" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} autoFocus /></label>
        <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">Reason {type === "DAMAGED" ? "*" : "(optional)"}</span><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={type === "RECEIVED" ? "e.g. GRN against PO-114" : "e.g. Damaged in transit"} /></label>
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</p>}
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" disabled={saving} onClick={submit}>{saving ? "Saving…" : type === "RECEIVED" ? "Add to stock" : "Record damage"}</Button></div>
    </div>
  </div>;
}
