"use client";

import { IndianRupee, LoaderCircle, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { SuccessToast } from "@/components/ui/toast";

type ScopeOption = { id: string; name: string };
type Scope = "STAFF" | "TERRITORY" | "REGION";
type Metric = "REVENUE" | "COLLECTION" | "NEW_ACTIVE_SALONS" | "VISITS" | "PRODUCTIVE_VISITS" | "CALLS" | "FOLLOW_UPS";
type TargetRow = { id: string; scope: Scope; scopeId: string; scopeName: string; metric: Metric; period: "MONTHLY" | "QUARTERLY"; periodYear: number; periodIndex: number; targetValue: number };
type Overview = { period: { month: number; year: number }; metrics: Record<Metric, number>; conversionRatePercent: number | null; leadsCreated: number; leadsConverted: number; productMix: Array<{ productId: string; name: string; quantity: number; revenue: number }> };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const METRICS: Metric[] = ["REVENUE", "COLLECTION", "NEW_ACTIVE_SALONS", "VISITS", "PRODUCTIVE_VISITS", "CALLS", "FOLLOW_UPS"];
const METRIC_LABELS: Record<Metric, string> = { REVENUE: "Revenue", COLLECTION: "Collection", NEW_ACTIVE_SALONS: "New Active Salons", VISITS: "Visits", PRODUCTIVE_VISITS: "Productive Visits", CALLS: "Calls", FOLLOW_UPS: "Follow-ups" };
const CURRENCY_METRICS = new Set<Metric>(["REVENUE", "COLLECTION"]);
const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const format = (metric: Metric, value: number) => CURRENCY_METRICS.has(metric) ? money(value) : value.toLocaleString("en-IN");
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback;

export function TargetsAdmin() {
  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [overview, setOverview] = useState<Overview | null>(null);
  const [targets, setTargets] = useState<TargetRow[] | null>(null);
  const [staff, setStaff] = useState<ScopeOption[]>([]);
  const [territories, setTerritories] = useState<ScopeOption[]>([]);
  const [regions, setRegions] = useState<ScopeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState<{ mode: "create" | "edit"; target?: TargetRow } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => {
    const syncHeaderSlot = () => setHeaderSlot(document.getElementById("page-header-actions"));
    syncHeaderSlot();
    const frame = requestAnimationFrame(syncHeaderSlot);
    return () => cancelAnimationFrame(frame);
  }, []);

  const load = async () => {
    try {
      const [overviewRes, targetsRes] = await Promise.all([
        fetch(`/api/targets/performance/admin?month=${month}&year=${year}`, { cache: "no-store" }),
        fetch(`/api/targets?period=MONTHLY&periodYear=${year}&periodIndex=${month}`, { cache: "no-store" }),
      ]);
      const overviewJson = await overviewRes.json().catch(() => null);
      if (!overviewRes.ok) throw new Error(messageFrom(overviewJson, "Unable to load performance."));
      setOverview(overviewJson as Overview);
      const targetsJson = await targetsRes.json().catch(() => null);
      if (!targetsRes.ok) throw new Error(messageFrom(targetsJson, "Unable to load targets."));
      setTargets(targetsJson as TargetRow[]);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load target data."); }
    finally { setLoading(false); }
  };
  useEffect(() => { (async () => { await load(); })(); }, [month, year]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { (async () => {
    const [staffRes, hierarchyRes] = await Promise.all([fetch("/api/staff", { cache: "no-store" }), fetch("/api/territory/hierarchy", { cache: "no-store" })]);
    const staffJson = await staffRes.json().catch(() => null);
    if (staffRes.ok && staffJson) setStaff((staffJson.users as Array<{ id: string; name: string; roles: Array<{ key: string }> }>).filter((u) => u.roles.some((r) => ["SALES_MANAGER", "SALES_EXECUTIVE"].includes(r.key))).map((u) => ({ id: u.id, name: u.name })));
    const hierarchyJson = await hierarchyRes.json().catch(() => null);
    if (hierarchyRes.ok && hierarchyJson) { setTerritories(hierarchyJson.territories.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))); setRegions(hierarchyJson.regions.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }))); }
  })(); }, []);

  const remove = async () => {
    if (!deleting) return;
    try {
      const response = await fetch(`/api/targets/${deleting.id}`, { method: "DELETE" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(json, "Unable to delete this target."));
      setDeleting(null);
      await load();
      setNotice(`Target for ${deleting.label} removed.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete this target."); setDeleting(null); }
  };

  if (loading) return <div className="space-y-3"><div className="h-32 animate-pulse rounded-xl bg-background" /><div className="h-64 animate-pulse rounded-xl bg-background" /></div>;

  return <div className="space-y-5">
    {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}
    {headerSlot && createPortal(<Button onClick={() => setEditing({ mode: "create" })}><Plus size={16} />Add target</Button>, headerSlot)}

    <div className="flex items-center gap-2">
      <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-10 rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10">{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
      <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-10 rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10">{[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}</select>
    </div>

    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}

    {overview && <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {METRICS.map((metric) => <KpiCard key={metric} icon={CURRENCY_METRICS.has(metric) ? IndianRupee : TrendingUp} label={METRIC_LABELS[metric]} value={format(metric, overview.metrics[metric] ?? 0)} />)}
      <KpiCard icon={TrendingUp} label="Lead conversion" value={overview.conversionRatePercent != null ? `${overview.conversionRatePercent}%` : "—"} detail={`${overview.leadsConverted} of ${overview.leadsCreated} leads`} />
    </div>}

    <section className="crm-surface overflow-hidden">
      <div className="border-b px-4 py-3 sm:px-5"><p className="text-sm font-semibold text-foreground">Targets · {MONTHS[month - 1]} {year}</p></div>
      {!targets?.length ? <div className="px-5 py-14 text-center"><TrendingUp className="mx-auto text-subtle" size={26} /><p className="mt-3 text-sm font-semibold text-foreground">No targets set for this period</p></div>
        : <div className="divide-y">{targets.map((target) => <div key={target.id} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
          <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{target.scopeName}</p><p className="mt-0.5 text-xs text-muted">{METRIC_LABELS[target.metric]} · {target.scope[0] + target.scope.slice(1).toLowerCase()} · {format(target.metric, target.targetValue)}</p></div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={() => setEditing({ mode: "edit", target })} className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-brand-soft hover:text-brand" aria-label={`Edit target for ${target.scopeName}`}><Pencil size={15} /></button>
            <button type="button" onClick={() => setDeleting({ id: target.id, label: `${target.scopeName} · ${METRIC_LABELS[target.metric]}` })} className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-red-50 hover:text-danger" aria-label={`Delete target for ${target.scopeName}`}><Trash2 size={15} /></button>
          </div>
        </div>)}</div>}
    </section>

    {overview && overview.productMix.length > 0 && <section className="crm-surface overflow-hidden">
      <div className="border-b px-4 py-3 sm:px-5"><p className="text-sm font-semibold text-foreground">Product mix</p><p className="mt-0.5 text-xs text-muted">Company-wide top sellers this period</p></div>
      <div className="divide-y">{overview.productMix.map((row) => <div key={row.productId} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{row.name}</p><p className="mt-0.5 text-xs text-muted">{row.quantity} unit{row.quantity === 1 ? "" : "s"}</p></div><p className="shrink-0 text-sm font-semibold text-foreground">{money(row.revenue)}</p></div>)}</div>
    </section>}

    {editing && <TargetEditor mode={editing.mode} target={editing.target} month={month} year={year} staff={staff} territories={territories} regions={regions} onClose={() => setEditing(null)} onSaved={async (message) => { setEditing(null); await load(); setNotice(message); }} />}
    {deleting && <ConfirmDelete label={deleting.label} onClose={() => setDeleting(null)} onConfirm={remove} />}
  </div>;
}

function scopeOptions(scope: Scope, staff: ScopeOption[], territories: ScopeOption[], regions: ScopeOption[]) {
  return scope === "STAFF" ? staff : scope === "TERRITORY" ? territories : regions;
}

function TargetEditor({ mode, target, month, year, staff, territories, regions, onClose, onSaved }: { mode: "create" | "edit"; target?: TargetRow; month: number; year: number; staff: ScopeOption[]; territories: ScopeOption[]; regions: ScopeOption[]; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [scope, setScope] = useState<Scope>(target?.scope ?? "STAFF");
  const options = scopeOptions(scope, staff, territories, regions);
  const [scopeId, setScopeId] = useState(target?.scopeId ?? options[0]?.id ?? "");
  const [metric, setMetric] = useState<Metric>(target?.metric ?? "REVENUE");
  const [targetValue, setTargetValue] = useState(target ? String(target.targetValue) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const changeScope = (value: Scope) => { setScope(value); setScopeId(scopeOptions(value, staff, territories, regions)[0]?.id ?? ""); };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/targets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope, scopeId, metric, period: "MONTHLY", periodYear: year, periodIndex: month, targetValue: Number(targetValue) }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to save this target."));
      await onSaved(`Target saved for ${options.find((o) => o.id === scopeId)?.name ?? "selected scope"}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save this target."); setSaving(false); }
  };

  return <Modal title={mode === "create" ? "Add target" : "Edit target"} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Scope *"><Select value={scope} onChange={(v) => changeScope(v as Scope)} options={[{ value: "STAFF", label: "Staff" }, { value: "TERRITORY", label: "Territory" }, { value: "REGION", label: "Region" }]} /></Field>
      <Field label={scope === "STAFF" ? "Staff member *" : scope === "TERRITORY" ? "Territory *" : "Region *"}><Select value={scopeId} onChange={setScopeId} options={options.map((o) => ({ value: o.id, label: o.name }))} /></Field>
      <Field label="Metric *"><Select value={metric} onChange={(v) => setMetric(v as Metric)} options={METRICS.map((m) => ({ value: m, label: METRIC_LABELS[m] }))} /></Field>
      <Field label="Target value *"><Input type="number" min="0" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} required /></Field>
      <p className="rounded-lg bg-background px-3 py-2.5 text-xs text-muted">Applies to {new Date(year, month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}.</p>
      {error && <FormError message={error} />}
      <FormActions saving={saving} disabled={!scopeId || !targetValue} onClose={onClose} />
    </form>
  </Modal>;
}

function ConfirmDelete({ label, onClose, onConfirm }: { label: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false);
  return <Modal title="Delete target" onClose={onClose}>
    <p className="text-sm text-foreground">Delete the target for <span className="font-semibold">{label}</span>?</p>
    <div className="mt-5 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
      <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      <button type="button" disabled={deleting} onClick={async () => { setDeleting(true); await onConfirm(); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-danger px-4 text-[13px] font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50 sm:h-10">{deleting && <LoaderCircle className="animate-spin" size={16} />}{deleting ? "Deleting…" : "Delete"}</button>
    </div>
  </Modal>;
}
