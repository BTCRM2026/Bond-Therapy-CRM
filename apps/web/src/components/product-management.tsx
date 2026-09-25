"use client";

import { ArrowDown, ArrowUp, LoaderCircle, MoreHorizontal, Package, Pencil, Plus, Search, SlidersHorizontal, Trash2, UserCheck, UserX, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { Field } from "@/components/ui/field";
import { FilterMenu } from "@/components/ui/filter-menu";
import { Input } from "@/components/ui/input";
import { SuccessToast } from "@/components/ui/toast";

type Product = { id: string; sku?: string; name: string; category: string; unitPrice: string; hsnCode?: string | null; gstRate?: string | null; stockOnHand: number; isActive: boolean };
export type ProductListResponse = { items: Product[]; page: number; pageSize: number; total: number; hasMore: boolean };
type ProductStats = { totalProducts: number; inStock: number; lowStock: number; outOfStock: number; inventoryValue: number };

const CATEGORIES = [["SHAMPOO", "Shampoo"], ["CONDITIONER", "Conditioner"], ["MASK", "Mask"], ["TREATMENT", "Treatment"], ["KIT", "Kit"], ["COLOR", "Color"], ["DEVELOPER", "Developer"], ["STYLING", "Styling"], ["OIL_SERUM", "Oil / Serum"], ["LIQUID", "Liquid"], ["TOOLS", "Tools"], ["OTHER", "Other"]] as const;
const CATEGORY_FILTERS = [["ALL", "All categories"], ...CATEGORIES] as const;
const STOCK_FILTERS = [["ALL", "All stock"], ["LOW", "Low stock"], ["OUT", "Out of stock"]] as const;
const CATALOGUE_FILTERS = [["ALL", "All products"], ["ACTIVE", "Active"], ["INACTIVE", "Inactive"]] as const;
type StockFilter = typeof STOCK_FILTERS[number][0];
type CatalogueFilter = typeof CATALOGUE_FILTERS[number][0];
type SortKey = "name" | "unitPrice" | "stockOnHand";
const pretty = (value: string) => value.toLowerCase().split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" / ");
const money = (value: string | number) => `₹${Number(value).toLocaleString("en-IN")}`;
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? (Array.isArray((data as { message: unknown }).message) ? (data as { message: string[] }).message.join(" ") : String((data as { message: unknown }).message)) : fallback;

export function ProductManagement({ initial }: { initial: ProductListResponse | null }) {
  const [data, setData] = useState(initial);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [stockStatus, setStockStatus] = useState<StockFilter>("ALL");
  const [catalogueStatus, setCatalogueStatus] = useState<CatalogueFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(initial?.page ?? 1);
  const [pageSize, setPageSize] = useState(10);
  const [editor, setEditor] = useState<{ mode: "create" | "edit"; product?: Product } | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(initial ? "" : "Products could not be loaded. Check the API connection and try again.");

  useEffect(() => { const sync = () => setHeaderSlot(document.getElementById("page-header-actions")); sync(); const frame = requestAnimationFrame(sync); return () => cancelAnimationFrame(frame); }, []);

  const reload = async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search.trim()) params.set("search", search.trim());
    if (category !== "ALL") params.set("category", category);
    if (stockStatus !== "ALL") params.set("stockStatus", stockStatus);
    if (catalogueStatus !== "ALL") params.set("catalogueStatus", catalogueStatus);
    params.set("sortBy", sortBy);
    params.set("sortDirection", sortDirection);
    const response = await fetch(`/api/products?${params}`, { cache: "no-store" });
    const json = await response.json().catch(() => null);
    if (!response.ok) throw new Error(messageFrom(json, "Unable to refresh products."));
    setData(json as ProductListResponse);
  };

  const reloadStats = async () => {
    const response = await fetch("/api/products/stats", { cache: "no-store" });
    const json = await response.json().catch(() => null);
    if (!response.ok) throw new Error(messageFrom(json, "Unable to load product statistics."));
    setStats(json as ProductStats);
  };

  useEffect(() => { const timer = setTimeout(() => { void reloadStats().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load product statistics.")); }, 0); return () => clearTimeout(timer); }, []);

  useEffect(() => { const timer = setTimeout(() => { void reload().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load products.")); }, 250); return () => clearTimeout(timer); }, [search, category, stockStatus, catalogueStatus, sortBy, sortDirection, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSort = (key: SortKey) => {
    setPage(1);
    if (sortBy === key) setSortDirection((value) => value === "asc" ? "desc" : "asc");
    else { setSortBy(key); setSortDirection("asc"); }
  };

  const clearFilters = () => { setSearch(""); setCategory("ALL"); setStockStatus("ALL"); setCatalogueStatus("ALL"); setPage(1); };
  const hasFilters = Boolean(search.trim()) || category !== "ALL" || stockStatus !== "ALL" || catalogueStatus !== "ALL";

  const toggleActive = async (product: Product) => {
    setBusyId(product.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/products/${product.id}/active`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isActive: !product.isActive }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to update this product."));
      await Promise.all([reload(), reloadStats()]);
      setNotice(`${product.name} is now ${product.isActive ? "inactive" : "active"}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update this product."); }
    finally { setBusyId(""); }
  };

  const remove = async (product: Product) => {
    if (!window.confirm(`Delete ${product.name}? This cannot be undone.`)) return;
    setBusyId(product.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(json, "Unable to delete this product."));
      await Promise.all([reload(), reloadStats()]);
      setNotice(`${product.name} was deleted.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete this product."); }
    finally { setBusyId(""); }
  };

  return (
    <div className="text-foreground">
      {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}
      {headerSlot && createPortal(<Button onClick={() => setEditor({ mode: "create" })}><Plus size={16} /><span className="hidden sm:inline">Add new product</span><span className="sr-only sm:hidden">Add product</span></Button>, headerSlot)}

      <section className="crm-surface mb-4 grid grid-cols-2 overflow-hidden lg:grid-cols-4" aria-label="Product overview">
        <ProductMetric label="Total products" value={stats?.totalProducts ?? "—"} detail="Complete catalogue" active={!hasFilters} onClick={clearFilters} />
        <ProductMetric label="Inventory value" value={stats ? money(stats.inventoryValue) : "—"} detail="MRP × available stock" />
        <ProductMetric label="Low stock" value={stats?.lowStock ?? "—"} detail="10 units or fewer" warning active={stockStatus === "LOW"} onClick={() => { setStockStatus("LOW"); setPage(1); }} />
        <ProductMetric label="Out of stock" value={stats?.outOfStock ?? "—"} detail="Needs restocking" danger active={stockStatus === "OUT"} onClick={() => { setStockStatus("OUT"); setPage(1); }} />
      </section>

      <section className="crm-surface relative overflow-hidden">
        <div className="border-b p-3 sm:p-4">
          <div className="flex flex-col gap-2 min-[1360px]:flex-row min-[1360px]:items-center">
            <div className="flex min-w-0 flex-1 flex-col gap-2 min-[1360px]:flex-row min-[1360px]:items-center">
              <label className="relative block w-full min-[1360px]:min-w-[220px] min-[1360px]:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={16} />
                <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="h-10 rounded-lg pl-9 text-[13px]" placeholder="Search name or SKU" aria-label="Search products" />
              </label>
              <div className="flex w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&>div]:min-w-[150px] sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:[&>div]:min-w-0 sm:[&>div>button]:w-full min-[1360px]:flex min-[1360px]:w-auto min-[1360px]:shrink-0 min-[1360px]:[&>div]:w-auto min-[1360px]:[&>div>button]:w-auto">
                <FilterMenu value={category} showLabelOnMobile onSelect={(value) => { setCategory(value); setPage(1); }} options={CATEGORY_FILTERS.map(([key, label]) => ({ key, label }))} />
                <FilterMenu value={stockStatus} showLabelOnMobile onSelect={(value) => { setStockStatus(value); setPage(1); }} options={STOCK_FILTERS.map(([key, label]) => ({ key, label }))} />
                <FilterMenu value={catalogueStatus} showLabelOnMobile onSelect={(value) => { setCatalogueStatus(value); setPage(1); }} options={CATALOGUE_FILTERS.map(([key, label]) => ({ key, label }))} />
              </div>
            </div>
            <div className="flex w-full items-center sm:w-auto sm:self-end min-[1360px]:shrink-0 min-[1360px]:self-auto">
              {data && data.total > 0 && <CompactPagination page={data.page} pageSize={data.pageSize} total={data.total} hasMore={data.hasMore} onPageChange={setPage} onPageSizeChange={(value) => { setPage(1); setPageSize(value); }} />}
            </div>
          </div>
          {hasFilters && <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
            <span className="mr-1 text-[11px] font-medium text-muted">Applied:</span>
            {search.trim() && <FilterChip label={`Search: ${search.trim()}`} onRemove={() => setSearch("")} />}
            {category !== "ALL" && <FilterChip label={CATEGORY_FILTERS.find(([key]) => key === category)?.[1] ?? category} onRemove={() => setCategory("ALL")} />}
            {stockStatus !== "ALL" && <FilterChip label={STOCK_FILTERS.find(([key]) => key === stockStatus)?.[1] ?? stockStatus} onRemove={() => setStockStatus("ALL")} />}
            {catalogueStatus !== "ALL" && <FilterChip label={CATALOGUE_FILTERS.find(([key]) => key === catalogueStatus)?.[1] ?? catalogueStatus} onRemove={() => setCatalogueStatus("ALL")} />}
            <button type="button" className="ml-1 text-[11px] font-semibold text-brand hover:text-brand-dark" onClick={clearFilters}>Clear all</button>
          </div>
          }
        </div>

        {error && <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger sm:mx-5" role="alert">{error}</div>}

        <div className="hidden max-h-[calc(100vh-290px)] overflow-auto lg:block">
          <table className="w-full min-w-[840px] text-left text-sm [&_td:not(:first-child)]:text-center [&_th:not(:first-child)]:text-center">
            <thead className="sticky top-0 z-10 border-b bg-background text-[12px] font-semibold text-muted"><tr><th className="px-5 py-3"><SortButton label="Product" column="name" sortBy={sortBy} direction={sortDirection} onSort={setSort} /></th><th className="px-4 py-3">Category</th><th className="px-4 py-3"><SortButton label="MRP" column="unitPrice" sortBy={sortBy} direction={sortDirection} onSort={setSort} /></th><th className="px-4 py-3"><SortButton label="Inventory" column="stockOnHand" sortBy={sortBy} direction={sortDirection} onSort={setSort} /></th><th className="px-4 py-3">Stock status</th><th className="px-4 py-3">Catalogue</th><th className="px-5 py-3">Actions</th></tr></thead>
            <tbody className="divide-y">
              {data?.items.map((product) => <ProductRow key={product.id} product={product} busy={busyId === product.id} onEdit={() => setEditor({ mode: "edit", product })} onToggleActive={() => toggleActive(product)} onDelete={() => remove(product)} />)}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-1 gap-2 p-2.5 sm:grid-cols-2 lg:hidden">{data?.items.map((product) => <ProductCard key={product.id} product={product} busy={busyId === product.id} onEdit={() => setEditor({ mode: "edit", product })} onToggleActive={() => toggleActive(product)} onDelete={() => remove(product)} />)}</div>
        {!data?.items.length && <div className="px-5 py-12 text-center"><Package className="mx-auto text-subtle" size={24} /><p className="mt-3 text-sm font-semibold text-foreground">No products found</p><p className="mt-1 text-xs text-muted">Adjust the search or add a product.</p></div>}
      </section>

      {editor && <ProductEditor mode={editor.mode} product={editor.product} onClose={() => setEditor(null)} onSaved={async (message) => { setEditor(null); await Promise.all([reload(), reloadStats()]); setError(""); setNotice(message); }} onStockAdjusted={() => { void Promise.all([reload(), reloadStats()]); }} />}
    </div>
  );
}
function ProductMetric({ label, value, detail, warning = false, danger = false, active = false, onClick }: { label: string; value: string | number; detail: string; warning?: boolean; danger?: boolean; active?: boolean; onClick?: () => void }) {
  const content = <><p className="text-xs font-medium text-muted">{label}</p><p className="mt-1 truncate text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-[27px]">{value}</p><p className={`mt-1 truncate text-xs ${danger ? "text-danger" : warning ? "text-warning" : "text-subtle"}`}>{detail}</p></>;
  const className = `min-w-0 border-b border-r p-4 text-left transition-colors [&:nth-child(2n)]:border-r-0 [&:nth-child(n+3)]:border-b-0 lg:border-b-0 lg:border-r lg:p-5 lg:[&:nth-child(2n)]:border-r lg:[&:last-child]:border-r-0 ${active ? "bg-brand-soft/75" : "bg-white"} ${onClick ? "cursor-pointer hover:bg-brand-soft/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand" : ""}`;
  return onClick ? <button type="button" className={className} onClick={onClick} aria-pressed={active}>{content}</button> : <div className={className}>{content}</div>;
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return <span className={`inline-flex rounded px-2 py-1 text-[10px] font-semibold ${isActive ? "bg-success-soft text-success" : "bg-background text-muted"}`}>{isActive ? "Active" : "Inactive"}</span>;
}
function AvailabilityBadge({ stockOnHand }: { stockOnHand: number }) {
  if (stockOnHand <= 0) return <span className="inline-flex rounded bg-red-50 px-2 py-1 text-[10px] font-semibold text-danger">Out of stock</span>;
  if (stockOnHand <= 10) return <span className="inline-flex rounded bg-warning-soft px-2 py-1 text-[10px] font-semibold text-warning">Low stock</span>;
  return <span className="inline-flex rounded bg-success-soft px-2 py-1 text-[10px] font-semibold text-success">In stock</span>;
}
function StockCell({ stockOnHand }: { stockOnHand: number }) {
  return <span className={`font-semibold tabular-nums ${stockOnHand <= 0 ? "text-danger" : stockOnHand <= 10 ? "text-warning" : "text-foreground"}`}>{stockOnHand}</span>;
}

type RowProps = { product: Product; busy: boolean; onEdit: () => void; onToggleActive: () => void; onDelete: () => void };

function ProductRow({ product, busy, onEdit, onToggleActive, onDelete }: RowProps) {
  return <tr className="transition-colors hover:bg-brand-soft/30">
    <td className={`border-l-2 px-5 py-3 ${product.stockOnHand <= 10 ? "border-l-warning" : "border-l-transparent"}`}><div><p className="font-semibold leading-5 text-foreground">{product.name}</p>{product.sku && <p className="mt-0.5 text-[11px] text-subtle">{product.sku}</p>}</div></td>
    <td className="px-4 py-3 text-muted">{pretty(product.category)}</td>
    <td className="px-4 py-3 font-semibold tabular-nums text-foreground">{money(product.unitPrice)}</td>
    <td className="px-4 py-3"><StockCell stockOnHand={product.stockOnHand} /></td>
    <td className="px-4 py-3"><AvailabilityBadge stockOnHand={product.stockOnHand} /></td>
    <td className="px-4 py-3"><StatusBadge isActive={product.isActive} /></td>
    <td className="px-5 py-3"><div className="flex justify-center"><ProductActions product={product} busy={busy} onEdit={onEdit} onToggleActive={onToggleActive} onDelete={onDelete} /></div></td>
  </tr>;
}

function ProductCard({ product, busy, onEdit, onToggleActive, onDelete }: RowProps) {
  return <article className={`rounded-lg border bg-white p-3 ${product.stockOnHand <= 10 ? "border-l-2 border-l-warning" : ""}`}>
    <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="break-words text-sm font-semibold leading-5 text-foreground">{product.name}</p>{product.sku && <p className="mt-0.5 text-[10px] text-subtle">{product.sku}</p>}<p className="mt-1 text-xs text-muted">{pretty(product.category)}</p></div><ProductActions product={product} busy={busy} onEdit={onEdit} onToggleActive={onToggleActive} onDelete={onDelete} /></div>
    <dl className="mt-4 grid grid-cols-2 gap-4 border-t pt-3 text-xs">
      <div><dt className="text-muted">MRP</dt><dd className="mt-1 text-sm font-semibold text-foreground">{money(product.unitPrice)}</dd></div>
      <div><dt className="text-muted">Quantity</dt><dd className="mt-1 text-sm font-semibold text-foreground">{product.stockOnHand}</dd></div>
    </dl>
    <div className="mt-3 flex items-center gap-2"><AvailabilityBadge stockOnHand={product.stockOnHand} /><StatusBadge isActive={product.isActive} /></div>
  </article>;
}

function ProductActions({ product, busy, onEdit, onToggleActive, onDelete }: RowProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const run = (action: () => void) => { setOpen(false); action(); };
  return <div className="relative" ref={root}>
    <button type="button" disabled={busy} onClick={() => setOpen((value) => !value)} className="grid size-9 place-items-center rounded-lg border bg-white text-muted transition-colors hover:border-brand/25 hover:bg-brand-soft hover:text-brand disabled:opacity-50" aria-label={`Open actions for ${product.name}`} aria-expanded={open}>{busy ? <LoaderCircle className="animate-spin" size={16} /> : <MoreHorizontal size={17} />}</button>
    {open && <div className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-lg border bg-white p-1.5 shadow-[0_12px_32px_rgba(26,31,26,0.14)]"><MenuAction icon={Pencil} label="Edit product" onClick={() => run(onEdit)} /><MenuAction icon={product.isActive ? UserX : UserCheck} label={product.isActive ? "Deactivate" : "Activate"} onClick={() => run(onToggleActive)} /><div className="my-1 border-t" /><MenuAction icon={Trash2} label="Delete product" danger onClick={() => run(onDelete)} /></div>}
  </div>;
}

function MenuAction({ icon: Icon, label, danger = false, onClick }: { icon: typeof Pencil; label: string; danger?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-xs font-medium transition-colors ${danger ? "text-danger hover:bg-red-50" : "text-muted hover:bg-background hover:text-foreground"}`}><Icon size={15} />{label}</button>;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) { return <span className="inline-flex h-7 items-center gap-1 rounded-md bg-brand-soft px-2 text-[11px] font-semibold text-brand-dark">{label}<button type="button" onClick={onRemove} className="grid size-4 place-items-center rounded hover:bg-white/70" aria-label={`Remove ${label} filter`}><X size={11} /></button></span>; }

function SortButton({ label, column, sortBy, direction, onSort }: { label: string; column: SortKey; sortBy: SortKey; direction: "asc" | "desc"; onSort: (column: SortKey) => void }) {
  const active = sortBy === column;
  return <button type="button" onClick={() => onSort(column)} className={`inline-flex items-center gap-1.5 hover:text-foreground ${active ? "text-brand-dark" : "text-muted"}`}>{label}{active ? direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : null}</button>;
}

type FormState = { name: string; category: string; unitPrice: string; stockOnHand: string; hsnCode: string; gstRate: string };
function toFormState(product?: Product): FormState {
  return { name: product?.name ?? "", category: product?.category ?? "SHAMPOO", unitPrice: product?.unitPrice ?? "", stockOnHand: product ? String(product.stockOnHand) : "", hsnCode: product?.hsnCode ?? "", gstRate: product?.gstRate ?? "" };
}

function ProductEditor({ mode, product, onClose, onSaved, onStockAdjusted }: { mode: "create" | "edit"; product?: Product; onClose: () => void; onSaved: (message: string) => Promise<void>; onStockAdjusted: () => void }) {
  const [form, setForm] = useState<FormState>(toFormState(product));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const set = (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((value) => ({ ...value, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const payload = { name: form.name, category: form.category, unitPrice: Number(form.unitPrice), hsnCode: form.hsnCode || undefined, gstRate: form.gstRate ? Number(form.gstRate) : undefined, ...(mode === "create" ? { stockOnHand: form.stockOnHand ? Number(form.stockOnHand) : 0 } : {}) };
      const response = await fetch(mode === "create" ? "/api/products" : `/api/products/${product?.id}`, { method: mode === "create" ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, `Unable to ${mode === "create" ? "add" : "update"} this product.`));
      await onSaved(mode === "create" ? `${form.name} was added to the catalogue.` : `${form.name} was updated.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save this product."); setSaving(false); }
  };

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/40 p-3 backdrop-blur-[1px] sm:p-4" role="dialog" aria-modal="true" aria-label={mode === "create" ? "Add product" : "Edit product"}>
    <div className="my-auto flex max-h-[calc(100dvh-24px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border bg-white shadow-[0_20px_48px_rgba(15,23,42,0.18)] sm:max-h-[calc(100dvh-32px)]">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4"><div><h2 className="text-base font-semibold text-foreground">{mode === "create" ? "Add product" : "Edit product"}</h2><p className="mt-1 text-xs text-muted">Visible to Sales and Warehouse once saved</p></div><button type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-background sm:size-8" aria-label="Close"><X size={17} /></button></div>
      <form onSubmit={submit} className="overflow-y-auto p-4 sm:p-5">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Product name *"><Input value={form.name} onChange={set("name")} required minLength={2} maxLength={160} autoFocus /></Field><Field label="Category *"><select value={form.category} onChange={set("category")} className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10">{CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quantity *">
              <div className="flex items-center gap-2">
                <Input value={form.stockOnHand} onChange={set("stockOnHand")} required={mode === "create"} type="number" min="0" inputMode="numeric" placeholder="0" readOnly={mode === "edit"} className={mode === "edit" ? "bg-background text-muted" : undefined} />
                {mode === "edit" && <Button type="button" variant="secondary" className="h-11 shrink-0 px-3 sm:h-10" onClick={() => setAdjusting(true)}><SlidersHorizontal size={14} />Adjust</Button>}
              </div>
            </Field>
            <Field label="MRP (₹) *"><Input value={form.unitPrice} onChange={set("unitPrice")} required type="number" min="0" step="0.01" inputMode="decimal" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="HSN / SAC code"><Input value={form.hsnCode} onChange={set("hsnCode")} maxLength={20} placeholder="Optional" /></Field><Field label="GST rate (%)"><Input value={form.gstRate} onChange={set("gstRate")} type="number" min="0" max="100" step="0.01" placeholder="Use global default" /></Field></div>
          {mode === "edit" && <p className="rounded-lg border border-brand/15 bg-brand-soft/50 px-3 py-2.5 text-xs leading-5 text-muted">Quantity is not typed directly here — use Adjust to record a correction, so it stays on the stock movement audit trail.</p>}
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</p>}
        </div>
        <div className="sticky bottom-0 mt-5 flex flex-col-reverse gap-2 border-t bg-white pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <LoaderCircle className="animate-spin" size={16} />}{saving ? "Saving…" : mode === "create" ? "Add product" : "Save changes"}</Button></div>
      </form>
    </div>
    {adjusting && product && <AdjustStockForm product={product} currentStock={Number(form.stockOnHand) || 0} onClose={() => setAdjusting(false)} onAdjusted={(newStock) => { setForm((value) => ({ ...value, stockOnHand: String(newStock) })); setAdjusting(false); onStockAdjusted(); }} />}
  </div>;
}

function AdjustStockForm({ product, currentStock, onClose, onAdjusted }: { product: Product; currentStock: number; onClose: () => void; onAdjusted: (newStock: number) => void }) {
  const [newQuantity, setNewQuantity] = useState(String(currentStock));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const target = Number(newQuantity);
    if (!Number.isInteger(target) || target < 0) { setError("Enter a valid quantity of 0 or more."); return; }
    const quantityChange = target - currentStock;
    if (quantityChange === 0) { setError("Enter a different quantity to record an adjustment."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/products/${product.id}/movements`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "ADJUSTMENT", quantityChange, reason: reason.trim() || undefined }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to adjust stock for this product."));
      onAdjusted(target);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to adjust stock for this product."); setSaving(false); }
  };

  return <div className="fixed inset-0 z-[60] grid place-items-center bg-foreground/40 p-3 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-label="Adjust stock">
    <div className="w-full max-w-sm rounded-xl border bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.18)]">
      <h2 className="text-base font-semibold text-foreground">Adjust stock</h2>
      <p className="mt-1 text-xs text-muted">{product.name} · currently {currentStock}</p>
      <div className="mt-4 space-y-3">
        <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">New quantity</span><Input type="number" min="0" inputMode="numeric" value={newQuantity} onChange={(event) => setNewQuantity(event.target.value)} autoFocus /></label>
        <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">Reason (optional)</span><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Physical count correction" /></label>
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</p>}
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" disabled={saving} onClick={submit}>{saving ? "Saving…" : "Save adjustment"}</Button></div>
    </div>
  </div>;
}
