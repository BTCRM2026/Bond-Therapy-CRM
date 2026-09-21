"use client";

import { Package, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

type Product = { id: string; name: string; category: string; variant: string | null; unit: string; unitPrice: string; stockOnHand: number; isActive: boolean };
export type ProductListResponse = { items: Product[]; page: number; pageSize: number; total: number; hasMore: boolean };

const CATEGORIES = [
  ["", "All"], ["SHAMPOO", "Shampoo"], ["CONDITIONER", "Conditioner"], ["MASK", "Mask"], ["TREATMENT", "Treatment"], ["KIT", "Kit"], ["COLOR", "Color"], ["DEVELOPER", "Developer"], ["STYLING", "Styling"], ["OIL_SERUM", "Oil / Serum"], ["LIQUID", "Liquid"], ["TOOLS", "Tools"], ["OTHER", "Other"],
] as const;
const pretty = (value: string) => value[0] + value.slice(1).toLowerCase();
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback;

function StockBadge({ stockOnHand }: { stockOnHand: number }) {
  if (stockOnHand <= 0) return <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-danger">Out of stock</span>;
  if (stockOnHand <= 10) return <span className="inline-flex rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning">Low stock · {stockOnHand} left</span>;
  return <span className="inline-flex rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">In stock · {stockOnHand}</span>;
}

export function ProductsCatalogue({ initial }: { initial: ProductListResponse | null }) {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initial ? "" : "Unable to load products. Please try again.");

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: "1", pageSize: "100" });
        if (search.trim()) params.set("search", search.trim());
        if (category) params.set("category", category);
        const response = await fetch(`/api/products?${params}`, { cache: "no-store" });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error(messageFrom(json, "Unable to load products."));
        setData(json as ProductListResponse);
        setError("");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load products."); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [search, category]);

  return <div className="space-y-4">
    <label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={17} /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" aria-label="Search products" /></label>
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {CATEGORIES.map(([value, label]) => <button key={value} type="button" onClick={() => setCategory(value)} className={`h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-colors ${category === value ? "border-brand bg-brand text-white" : "text-muted hover:bg-brand-soft/60"}`}>{label}</button>)}
    </div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}
    {loading && !data ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="h-40 animate-pulse rounded-xl bg-background" /><div className="h-40 animate-pulse rounded-xl bg-background" /><div className="h-40 animate-pulse rounded-xl bg-background" /></div>
      : data?.items.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((product) => <article key={product.id} className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
          <div className="flex h-28 items-center justify-center bg-background text-subtle">
            <Package size={28} />
          </div>
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-subtle">{product.variant ? `${product.variant} · ` : ""}{pretty(product.category)}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{product.name}</p>
            <div className="mt-3 flex items-center justify-between"><p className="text-base font-semibold text-foreground">₹{Number(product.unitPrice).toLocaleString("en-IN")}<span className="text-xs font-normal text-muted"> / {product.unit}</span></p></div>
            <div className="mt-2"><StockBadge stockOnHand={product.stockOnHand} /></div>
          </div>
        </article>)}
      </div>
      : <section className="rounded-xl border bg-white px-5 py-14 text-center shadow-[0_3px_12px_rgba(15,23,42,0.04)]"><Package className="mx-auto text-subtle" size={28} /><p className="mt-3 text-sm font-semibold text-foreground">No products found</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">Try a different search or category.</p></section>}
  </div>;
}
