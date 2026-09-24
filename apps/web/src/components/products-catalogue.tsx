"use client";

import { Package, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { FilterMenu } from "@/components/ui/filter-menu";
import { Input } from "@/components/ui/input";

type Product = { id: string; name: string; category: string; unitPrice: string; stockOnHand: number; isActive: boolean };
export type ProductListResponse = { items: Product[]; page: number; pageSize: number; total: number; hasMore: boolean };
const CATEGORIES = [["", "All categories"], ["SHAMPOO", "Shampoo"], ["CONDITIONER", "Conditioner"], ["MASK", "Mask"], ["TREATMENT", "Treatment"], ["KIT", "Kit"], ["COLOR", "Color"], ["DEVELOPER", "Developer"], ["STYLING", "Styling"], ["OIL_SERUM", "Oil / Serum"], ["LIQUID", "Liquid"], ["TOOLS", "Tools"], ["OTHER", "Other"]] as const;
const pretty = (value: string) => value.toLowerCase().split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" / ");
const money = (value: string | number) => `₹${Number(value).toLocaleString("en-IN")}`;
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
  const [page, setPage] = useState(initial?.page ?? 1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initial ? "" : "Unable to load products. Please try again.");

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (search.trim()) params.set("search", search.trim());
        if (category) params.set("category", category);
        const response = await fetch(`/api/products?${params}`, { cache: "no-store" });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error(messageFrom(json, "Unable to load products."));
        setData(json as ProductListResponse); setError("");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load products."); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [search, category, page, pageSize]);

  return <div className="space-y-4">
    <section className="relative rounded-xl border bg-white shadow-[0_3px_12px_rgba(26,31,26,0.04)]">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={16} /><Input className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search products" aria-label="Search products" /></label>
        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
          <FilterMenu value={category} showLabelOnMobile onSelect={(value) => { setCategory(value); setPage(1); }} options={CATEGORIES.map(([key, label]) => ({ key, label }))} />
          {data && data.total > 0 && <CompactPagination page={data.page} pageSize={data.pageSize} total={data.total} hasMore={data.hasMore} onPageChange={setPage} onPageSizeChange={(value) => { setPage(1); setPageSize(value); }} />}
        </div>
      </div>
      {error && <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger sm:mx-5" role="alert">{error}</div>}
      {loading && !data ? <div className="grid gap-3 p-3 sm:grid-cols-2"><div className="h-40 animate-pulse rounded-xl bg-background" /><div className="h-40 animate-pulse rounded-xl bg-background" /></div>
        : data?.items.length ? <><div className="hidden overflow-visible xl:block"><table className="w-full text-left text-[13px]"><thead className="border-b bg-background text-[10px] font-bold uppercase tracking-[0.1em] text-muted"><tr><th className="px-5 py-3">Product</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">MRP</th><th className="px-4 py-3">Quantity</th><th className="px-5 py-3">Availability</th></tr></thead><tbody className="divide-y">{data.items.map((product) => <tr key={product.id} className="transition-colors hover:bg-brand-soft/40"><td className="px-5 py-4 font-semibold text-foreground">{product.name}</td><td className="px-4 py-4 text-muted">{pretty(product.category)}</td><td className="px-4 py-4 text-muted">{money(product.unitPrice)}</td><td className="px-4 py-4 text-foreground">{product.stockOnHand}</td><td className="px-5 py-4"><StockBadge stockOnHand={product.stockOnHand} /></td></tr>)}</tbody></table></div><div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:hidden">{data.items.map((product) => <article key={product.id} className="rounded-lg border bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-subtle">{pretty(product.category)}</p><p className="mt-1 break-words text-sm font-semibold leading-5 text-foreground">{product.name}</p><dl className="mt-4 grid grid-cols-2 gap-4 border-t pt-3 text-xs"><div><dt className="text-muted">MRP</dt><dd className="mt-1 text-sm font-semibold text-foreground">{money(product.unitPrice)}</dd></div><div><dt className="text-muted">Stock</dt><dd className="mt-1 text-sm font-medium text-foreground">{product.stockOnHand}</dd></div></dl><div className="mt-3"><StockBadge stockOnHand={product.stockOnHand} /></div></article>)}</div></>
        : <div className="px-5 py-12 text-center"><Package className="mx-auto text-subtle" size={24} /><p className="mt-3 text-sm font-semibold text-foreground">No products found</p><p className="mt-1 text-xs text-muted">Adjust the search or category.</p></div>}
    </section>
  </div>;
}
