"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, IndianRupee, LoaderCircle, MoreHorizontal, Package, PackageCheck, PackageX, Pencil, Plus, Search, SlidersHorizontal, Trash2, UserCheck, UserX, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";

type Product = { id: string; name: string; category: string; unitPrice: string; hsnCode?: string | null; gstRate?: string | null; stockOnHand: number; isActive: boolean };
export type ProductListResponse = { items: Product[]; page: number; pageSize: number; total: number; hasMore: boolean };
type ProductStats = { totalProducts: number; inStock: number; lowStock: number; outOfStock: number; inventoryValue: number };

const CATEGORIES = [["SHAMPOO", "Shampoo"], ["CONDITIONER", "Conditioner"], ["MASK", "Mask"], ["TREATMENT", "Treatment"], ["KIT", "Kit"], ["COLOR", "Color"], ["DEVELOPER", "Developer"], ["STYLING", "Styling"], ["OIL_SERUM", "Oil / Serum"], ["LIQUID", "Liquid"], ["TOOLS", "Tools"], ["OTHER", "Other"]];
const pretty = (value: string) => value.toLowerCase().split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" / ");
const money = (value: string | number) => `₹${Number(value).toLocaleString("en-IN")}`;
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? (Array.isArray((data as { message: unknown }).message) ? (data as { message: string[] }).message.join(" ") : String((data as { message: unknown }).message)) : fallback;

export function ProductManagement({ initial }: { initial: ProductListResponse | null }) {
  const [data, setData] = useState(initial);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [page, setPage] = useState(initial?.page ?? 1);
  const [editor, setEditor] = useState<{ mode: "create" | "edit"; product?: Product } | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(initial ? "" : "Products could not be loaded. Check the API connection and try again.");

  useEffect(() => { const frame = requestAnimationFrame(() => setHeaderSlot(document.getElementById("page-header-actions"))); return () => cancelAnimationFrame(frame); }, []);

  const reload = async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "24" });
    if (search.trim()) params.set("search", search.trim());
    if (category !== "ALL") params.set("category", category);
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

  useEffect(() => { const timer = setTimeout(() => { void reload().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load products.")); }, 250); return () => clearTimeout(timer); }, [search, category, page]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <>
      {headerSlot && createPortal(<Button onClick={() => setEditor({ mode: "create" })}><Plus size={16} /><span className="hidden sm:inline">Add product</span><span className="sr-only sm:hidden">Add product</span></Button>, headerSlot)}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard icon={Package} label="Total products" value={stats?.totalProducts ?? "—"} detail="Active catalogue" />
        <KpiCard icon={PackageCheck} label="In stock" value={stats?.inStock ?? "—"} detail="Above reorder level" tone="success" />
        <KpiCard icon={AlertTriangle} label="Low stock" value={stats?.lowStock ?? "—"} detail="Reorder soon" tone="warning" />
        <KpiCard icon={PackageX} label="Out of stock" value={stats?.outOfStock ?? "—"} detail="Needs restocking" tone="danger" />
        <KpiCard icon={IndianRupee} label="Inventory value" value={stats ? money(stats.inventoryValue) : "—"} detail="MRP × stock" tone="brand" />
      </div>

      <section className="relative rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={16} />
            <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="pl-9" placeholder="Search products" aria-label="Search products" />
          </label>
          <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="h-11 rounded-lg border bg-white px-3 text-[13px] text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10" aria-label="Filter by category">
            <option value="ALL">All categories</option>
            {CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>

        {(notice || error) && <div className={`mx-4 mt-4 rounded-lg border px-3 py-2.5 text-xs sm:mx-5 ${error ? "border-red-200 bg-red-50 text-danger" : "border-success/25 bg-success-soft text-success"}`} role={error ? "alert" : "status"}>{error || notice}</div>}

        <div className="hidden overflow-visible xl:block">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="border-b bg-background text-[10px] font-bold uppercase tracking-[0.1em] text-muted"><tr><th className="px-5 py-3">Product</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">MRP</th><th className="px-4 py-3">Quantity</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y">
              {data?.items.map((product) => <ProductRow key={product.id} product={product} busy={busyId === product.id} onEdit={() => setEditor({ mode: "edit", product })} onToggleActive={() => toggleActive(product)} onDelete={() => remove(product)} />)}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-3 p-3 xl:hidden">{data?.items.map((product) => <ProductCard key={product.id} product={product} busy={busyId === product.id} onEdit={() => setEditor({ mode: "edit", product })} onToggleActive={() => toggleActive(product)} onDelete={() => remove(product)} />)}</div>
        {!data?.items.length && <div className="px-5 py-12 text-center"><Package className="mx-auto text-subtle" size={24} /><p className="mt-3 text-sm font-semibold text-foreground">No products found</p><p className="mt-1 text-xs text-muted">Adjust the search or add a product.</p></div>}
        {data && data.total > 0 && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hasMore={data.hasMore} onPageChange={setPage} />}
      </section>

      {editor && <ProductEditor mode={editor.mode} product={editor.product} onClose={() => setEditor(null)} onSaved={async (message) => { setEditor(null); await Promise.all([reload(), reloadStats()]); setError(""); setNotice(message); }} onStockAdjusted={() => { void Promise.all([reload(), reloadStats()]); }} />}
    </>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${isActive ? "bg-success-soft text-success" : "bg-gray-100 text-muted"}`}>{isActive ? "Active" : "Inactive"}</span>;
}
function StockCell({ stockOnHand }: { stockOnHand: number }) {
  if (stockOnHand <= 0) return <span className="font-medium text-danger">Out of stock</span>;
  if (stockOnHand <= 10) return <span className="font-medium text-warning">{stockOnHand} left</span>;
  return <span className="font-medium text-foreground">{stockOnHand}</span>;
}

type RowProps = { product: Product; busy: boolean; onEdit: () => void; onToggleActive: () => void; onDelete: () => void };

function ProductRow({ product, busy, onEdit, onToggleActive, onDelete }: RowProps) {
  return <tr className="transition-colors hover:bg-brand-soft/40">
    <td className="px-5 py-4"><p className="font-semibold text-foreground">{product.name}</p></td>
    <td className="px-4 py-4 text-muted">{pretty(product.category)}</td>
    <td className="px-4 py-4 text-muted">{money(product.unitPrice)}</td>
    <td className="px-4 py-4"><StockCell stockOnHand={product.stockOnHand} /></td>
    <td className="px-4 py-4"><StatusBadge isActive={product.isActive} /></td>
    <td className="px-5 py-4"><div className="flex justify-end gap-2"><IconAction icon={Pencil} label="Edit product" onClick={onEdit} /><IconAction icon={product.isActive ? UserX : UserCheck} label={product.isActive ? "Deactivate" : "Activate"} onClick={onToggleActive} busy={busy} /><IconAction icon={Trash2} label="Delete product" onClick={onDelete} busy={busy} danger /></div></td>
  </tr>;
}

function ProductCard({ product, busy, onEdit, onToggleActive, onDelete }: RowProps) {
  return <article className="rounded-xl border bg-white p-4 shadow-[0_3px_12px_rgba(26,31,26,0.04)]">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{product.name}</p><p className="mt-1 text-xs text-muted">{pretty(product.category)}</p></div><div className="flex shrink-0 items-center gap-2"><StatusBadge isActive={product.isActive} /><ProductActions product={product} busy={busy} onEdit={onEdit} onToggleActive={onToggleActive} onDelete={onDelete} /></div></div>
    <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-background p-3 text-xs">
      <div><dt className="text-muted">MRP</dt><dd className="mt-1 font-medium text-foreground">{money(product.unitPrice)}</dd></div>
      <div><dt className="text-muted">Quantity</dt><dd className="mt-1"><StockCell stockOnHand={product.stockOnHand} /></dd></div>
    </dl>
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

function IconAction({ icon: Icon, label, onClick, busy = false, danger = false }: { icon: typeof Pencil; label: string; onClick: () => void; busy?: boolean; danger?: boolean }) {
  return <button type="button" disabled={busy} onClick={onClick} className={`grid size-9 place-items-center rounded-lg border bg-white transition-colors disabled:opacity-50 ${danger ? "text-danger hover:border-red-200 hover:bg-red-50" : "text-muted hover:border-brand/25 hover:bg-brand-soft hover:text-brand"}`} aria-label={label}>{busy ? <LoaderCircle className="animate-spin" size={15} /> : <Icon size={15} />}</button>;
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

function Pagination({ page, pageSize, total, hasMore, onPageChange }: { page: number; pageSize: number; total: number; hasMore: boolean; onPageChange: (page: number) => void }) {
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted sm:px-5"><span>Showing {first}–{last} of {total}</span><div className="flex gap-2"><Button variant="secondary" className="h-9 px-3" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft size={14} />Previous</Button><Button variant="secondary" className="h-9 px-3" disabled={!hasMore} onClick={() => onPageChange(page + 1)}>Next<ChevronRight size={14} /></Button></div></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">{label}</span>{children}</label>; }
