"use client";

import { LoaderCircle, Pencil, Plus, Search, Target, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { FilterMenu, type FilterOption } from "@/components/ui/filter-menu";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { SuccessToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type DistributionType = "EQUAL" | "SEASONAL";
type IncentiveType = "PERCENTAGE" | "FIXED" | "SLAB";
type CalcBasis = "TOTAL_ELIGIBLE_SALES" | "SALES_ABOVE_TARGET" | "TARGET_AMOUNT";
type SlabValueType = "PERCENTAGE" | "FIXED";
type Season = { name: string; weightagePercent: number; startDate: string; endDate: string };
type Slab = { id?: string; minAchievementPercent: number; maxAchievementPercent: number | null; valueType: SlabValueType; value: number };
type Incentive = { incentiveType: IncentiveType; calculationBasis: CalcBasis; percentValue: number | null; fixedAmount: number | null; minAchievementPercent: number; slabs: Slab[] };
type Plan = { id: string; staffId: string; staffName: string | null; targetYear: number; annualTarget: number; distributionType: DistributionType; seasons: Season[] | null; isActive: boolean; incentive: Incentive | null };
type StaffRow = { staffId: string; name: string; roleKey: string | null; plan: Plan | null; currentMonthAchievement: { targetValue: number; actual: number; achievementPercent: number } | null };
type StatusFilter = "ALL" | "ASSIGNED" | "UNASSIGNED";

const ROLE_LABELS: Record<string, string> = { SALES_MANAGER: "Area Sales Manager", SALES_EXECUTIVE: "Sales Executive" };
const BASIS_LABELS: Record<CalcBasis, string> = { TOTAL_ELIGIBLE_SALES: "Total sales made", SALES_ABOVE_TARGET: "Sales above the target only", TARGET_AMOUNT: "The target amount" };
const BASIS_SHORT: Record<CalcBasis, string> = { TOTAL_ELIGIBLE_SALES: "of total sales", SALES_ABOVE_TARGET: "of sales above target", TARGET_AMOUNT: "of target" };
const TYPE_INFO: Record<IncentiveType, { label: string; hint: string }> = {
  PERCENTAGE: { label: "Percentage", hint: "Staff earn a percentage of their sales." },
  FIXED: { label: "Fixed amount", hint: "Staff earn one fixed amount when they reach the minimum." },
  SLAB: { label: "Slabs", hint: "The payout depends on how far above target they sell." },
};
const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const messageFrom = (data: unknown, fallback: string) => {
  if (!data || typeof data !== "object" || !("message" in data)) return fallback;
  const message = (data as { message: unknown }).message;
  return Array.isArray(message) ? message.join(" ") : String(message);
};
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("");

function incentiveSummary(incentive: Incentive | null) {
  if (!incentive) return null;
  if (incentive.incentiveType === "PERCENTAGE") return `${incentive.percentValue ?? 0}% ${BASIS_SHORT[incentive.calculationBasis]}`;
  if (incentive.incentiveType === "FIXED") return `${money(incentive.fixedAmount ?? 0)} fixed`;
  return `${incentive.slabs.length} slab${incentive.slabs.length === 1 ? "" : "s"} by achievement`;
}

export function TargetIncentiveAdmin() {
  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [deactivating, setDeactivating] = useState<{ id: string; label: string } | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const load = async () => {
    try {
      const response = await fetch("/api/target-incentive/plans", { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(json, "Unable to load target & incentive data."));
      setRows(json as StaffRow[]);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load target & incentive data."); }
    finally { setLoading(false); }
  };
  useEffect(() => { (async () => { await load(); })(); }, []);

  const deactivate = async () => {
    if (!deactivating) return;
    try {
      const response = await fetch(`/api/target-incentive/plans/${deactivating.id}`, { method: "DELETE" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(json, "Unable to remove this target."));
      setDeactivating(null);
      await load();
      setNotice(`Annual target removed for ${deactivating.label}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to remove this target."); setDeactivating(null); }
  };

  const assigned = rows?.filter((row) => row.plan).length ?? 0;
  const total = rows?.length ?? 0;
  const filterOptions: readonly FilterOption<StatusFilter>[] = [
    { key: "ALL", label: "All staff", count: total },
    { key: "ASSIGNED", label: "Target assigned", count: assigned },
    { key: "UNASSIGNED", label: "Not assigned", count: total - assigned },
  ];
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (rows ?? []).filter((row) => (status === "ALL" || (status === "ASSIGNED") === Boolean(row.plan)) && (!term || row.name.toLowerCase().includes(term)));
  }, [rows, search, status]);

  if (loading) return <div className="space-y-4"><div className="h-24 animate-pulse rounded-[10px] bg-background" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-64 animate-pulse rounded-[10px] bg-background" />)}</div></div>;

  return <div className="space-y-4">
    {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}
    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}

    <KpiStrip columns={3}>
      <KpiCell label="Sales staff" value={total} detail="Managers and executives" />
      <KpiCell label="Target assigned" value={assigned} detail={total ? `${Math.round((assigned / total) * 100)}% covered` : undefined} tone="success" />
      <KpiCell label="Awaiting target" value={total - assigned} detail={total - assigned ? "Assign a target to start tracking" : "Everyone has a target"} tone={total - assigned ? "warning" : "neutral"} className="col-span-2 sm:col-span-1" />
    </KpiStrip>

    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff by name" className="pl-9" aria-label="Search staff" />
      </div>
      <FilterMenu value={status} options={filterOptions} onSelect={setStatus} showLabelOnMobile fullWidth ariaLabel="Filter staff by target status" />
    </div>

    {!visibleRows.length
      ? <section className="crm-surface px-5 py-14 text-center"><Target className="mx-auto text-subtle" size={26} /><p className="mt-3 text-sm font-semibold text-foreground">{total ? "No staff match your search" : "No sales staff found"}</p><p className="mt-1 text-xs text-muted">{total ? "Try a different name or filter." : "Add sales staff in Staff & Access to assign targets."}</p></section>
      : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visibleRows.map((row) => <StaffTargetCard key={row.staffId} row={row} onEdit={() => setEditing(row)} onRemove={() => row.plan && setDeactivating({ id: row.plan.id, label: row.name })} />)}</div>}

    {editing && <PlanEditor row={editing} onClose={() => setEditing(null)} onSaved={async (message) => { setEditing(null); await load(); setNotice(message); }} />}
    {deactivating && <ConfirmDeactivate label={deactivating.label} onClose={() => setDeactivating(null)} onConfirm={deactivate} />}
  </div>;
}

function StaffTargetCard({ row, onEdit, onRemove }: { row: StaffRow; onEdit: () => void; onRemove: () => void }) {
  const { plan, currentMonthAchievement: month } = row;
  const incentive = incentiveSummary(plan?.incentive ?? null);
  const percent = month?.achievementPercent ?? 0;
  return <article className="flex min-w-0 flex-col rounded-[10px] border bg-white shadow-[0_1px_2px_rgba(29,39,48,0.025)]">
    <div className="flex items-start gap-3 p-4 pb-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-[13px] font-semibold text-brand-dark" aria-hidden="true">{initials(row.name)}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground" title={row.name}>{row.name}</p>
        <p className="truncate text-xs text-muted">{row.roleKey ? ROLE_LABELS[row.roleKey] ?? row.roleKey : "Sales staff"}</p>
      </div>
      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", plan ? "bg-success-soft text-success" : "bg-background text-muted")}>{plan ? `FY ${plan.targetYear}` : "Not set"}</span>
    </div>

    <div className="mx-4 flex-1 space-y-3 rounded-lg bg-background p-3">
      {plan ? <>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">Annual target</p>
          <p className="mt-0.5 text-xl font-semibold tracking-[-0.01em] text-foreground">{money(plan.annualTarget)}</p>
          <p className="text-xs text-muted">{plan.distributionType === "SEASONAL" ? `Seasonal · ${plan.seasons?.length ?? 0} seasons` : "Equal across months"}</p>
        </div>
        <div>
          <div className="flex items-baseline justify-between text-xs"><span className="text-muted">This month</span><span className="font-semibold text-foreground">{month ? `${percent}%` : "—"}</span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={Math.min(percent, 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${row.name} monthly achievement`}><div className={cn("h-full rounded-full transition-[width] duration-200", percent >= 100 ? "bg-success" : "bg-brand")} style={{ width: `${Math.min(percent, 100)}%` }} /></div>
          {month && <p className="mt-1 truncate text-[11px] text-muted">{money(month.actual)} of {money(month.targetValue)}</p>}
        </div>
        <div className="border-t pt-2.5 text-xs"><span className="text-muted">Incentive: </span>{incentive ? <span className="font-medium text-foreground">{incentive}</span> : <span className="text-subtle">None</span>}</div>
      </> : <div className="flex h-full min-h-[132px] flex-col items-center justify-center text-center"><Target size={20} className="text-subtle" /><p className="mt-2 text-xs font-medium text-foreground">No annual target yet</p><p className="mt-0.5 text-[11px] text-muted">Assign one to start tracking sales.</p></div>}
    </div>

    <div className="flex items-center gap-2 p-4 pt-3">
      <Button type="button" variant={plan ? "secondary" : undefined} onClick={onEdit} className="h-9 flex-1 text-xs">{plan ? <Pencil size={14} /> : <Plus size={14} />}{plan ? "Edit target" : "Assign target"}</Button>
      {plan && <button type="button" onClick={onRemove} className="grid size-9 shrink-0 place-items-center rounded-lg border text-muted transition-colors hover:bg-red-50 hover:text-danger" aria-label={`Remove target for ${row.name}`}><Trash2 size={15} /></button>}
    </div>
  </article>;
}

function exampleFor(type: IncentiveType, basis: CalcBasis, annual: number, value: number, minPercent: number) {
  if (!(annual > 0) || !(value > 0)) return "";
  const monthly = annual / 12;
  if (type === "FIXED") return `Example: ${money(value)} is paid when sales reach at least ${minPercent}% of the target.`;
  if (type !== "PERCENTAGE") return "";
  const achievement = Math.max(minPercent, basis === "SALES_ABOVE_TARGET" ? 120 : 100);
  const sales = (monthly * achievement) / 100;
  const base = basis === "TOTAL_ELIGIBLE_SALES" ? sales : basis === "SALES_ABOVE_TARGET" ? Math.max(0, sales - monthly) : monthly;
  return `Example: on a monthly target of ${money(monthly)}, sales of ${money(sales)} (${achievement}% of target) earn ${money((base * value) / 100)}.`;
}

function PlanEditor({ row, onClose, onSaved }: { row: StaffRow; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const plan = row.plan;
  const now = new Date();
  const [targetYear, setTargetYear] = useState(plan?.targetYear ?? now.getFullYear());
  const [annualTarget, setAnnualTarget] = useState(plan ? String(plan.annualTarget) : "");
  const [distributionType, setDistributionType] = useState<DistributionType>(plan?.distributionType ?? "EQUAL");
  const [seasons, setSeasons] = useState<Season[]>(plan?.seasons?.length ? plan.seasons : [{ name: "", weightagePercent: 0, startDate: "", endDate: "" }]);
  const [withIncentive, setWithIncentive] = useState(Boolean(plan?.incentive));
  const [incentiveType, setIncentiveType] = useState<IncentiveType>(plan?.incentive?.incentiveType ?? "PERCENTAGE");
  const [calculationBasis, setCalculationBasis] = useState<CalcBasis>(plan?.incentive?.calculationBasis ?? "TOTAL_ELIGIBLE_SALES");
  const [percentValue, setPercentValue] = useState(plan?.incentive?.percentValue != null ? String(plan.incentive.percentValue) : "");
  const [fixedAmount, setFixedAmount] = useState(plan?.incentive?.fixedAmount != null ? String(plan.incentive.fixedAmount) : "");
  const [minAchievementPercent, setMinAchievementPercent] = useState(plan?.incentive ? String(plan.incentive.minAchievementPercent) : "100");
  const [slabs, setSlabs] = useState<Slab[]>(plan?.incentive?.slabs.length ? plan.incentive.slabs : [{ minAchievementPercent: 100, maxAchievementPercent: null, valueType: "PERCENTAGE", value: 0 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const seasonTotal = seasons.reduce((sum, s) => sum + (Number.isFinite(s.weightagePercent) ? s.weightagePercent : 0), 0);
  const updateSeason = (index: number, patch: Partial<Season>) => setSeasons((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const updateSlab = (index: number, patch: Partial<Slab>) => setSlabs((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const example = withIncentive ? exampleFor(incentiveType, calculationBasis, Number(annualTarget), Number(incentiveType === "FIXED" ? fixedAmount : percentValue), Number(minAchievementPercent) || 0) : "";
  const incentiveReady = !withIncentive || (incentiveType === "PERCENTAGE" ? percentValue !== "" : incentiveType === "FIXED" ? fixedAmount !== "" : slabs.length > 0);
  const invalid = !(Number(annualTarget) > 0) || (distributionType === "SEASONAL" && Math.abs(seasonTotal - 100) > 0.01) || !incentiveReady;

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const payload = {
        staffId: row.staffId,
        targetYear,
        annualTarget: Number(annualTarget),
        distributionType,
        seasons: distributionType === "SEASONAL" ? seasons.map((s) => ({ ...s, weightagePercent: Number(s.weightagePercent) })) : undefined,
        ...(withIncentive ? {
          incentiveType,
          calculationBasis,
          percentValue: incentiveType === "PERCENTAGE" ? Number(percentValue) : undefined,
          fixedAmount: incentiveType === "FIXED" ? Number(fixedAmount) : undefined,
          minAchievementPercent: Number(minAchievementPercent) || 0,
          slabs: incentiveType === "SLAB" ? slabs.map((s) => ({ ...s, minAchievementPercent: Number(s.minAchievementPercent), maxAchievementPercent: s.maxAchievementPercent == null ? undefined : Number(s.maxAchievementPercent), value: Number(s.value) })) : undefined,
        } : {}),
      };
      const response = await fetch("/api/target-incentive/plans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to save this annual target."));
      await onSaved(`Annual target saved for ${row.name}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save this annual target."); setSaving(false); }
  };

  const segment = (active: boolean) => cn("flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors", active ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background");
  const basisOptions = (Object.keys(BASIS_LABELS) as CalcBasis[]).map((b) => ({ value: b, label: BASIS_LABELS[b] }));

  return <Modal title={plan ? "Edit annual target" : "Assign annual target"} subtitle={row.name} onClose={onClose} maxWidth="max-w-xl">
    <form onSubmit={submit} className="space-y-6">
      <section className="space-y-4">
        <div className="border-b pb-2"><h3 className="text-sm font-semibold text-foreground">Sales target</h3><p className="mt-0.5 text-xs text-muted">Required. Split automatically into monthly, quarterly, half-yearly and yearly targets.</p></div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target year *"><Input type="number" min="2020" max="2100" value={targetYear} onChange={(e) => setTargetYear(Number(e.target.value))} required /></Field>
          <Field label="Annual target (₹) *"><Input type="number" min="1" inputMode="decimal" value={annualTarget} onChange={(e) => setAnnualTarget(e.target.value)} placeholder="e.g. 1200000" required /></Field>
        </div>
        <Field label="How to split the target">
          <div className="flex gap-1 rounded-lg border bg-white p-1" role="radiogroup" aria-label="Distribution method">
            {(["EQUAL", "SEASONAL"] as const).map((option) => <button key={option} type="button" role="radio" aria-checked={distributionType === option} onClick={() => setDistributionType(option)} className={segment(distributionType === option)}>{option === "EQUAL" ? "Equal every month" : "By season"}</button>)}
          </div>
        </Field>

        {distributionType === "SEASONAL" && <div className="space-y-2.5 rounded-lg border bg-background p-3">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold text-foreground">Seasons</p><p className={cn("text-xs font-semibold", Math.abs(seasonTotal - 100) < 0.01 ? "text-success" : "text-danger")}>{seasonTotal.toFixed(2)}% of 100%</p></div>
          {seasons.map((season, index) => <div key={index} className="space-y-2 rounded-lg border bg-white p-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Season name" aria-label="Season name" value={season.name} onChange={(e) => updateSeason(index, { name: e.target.value })} />
              <Input type="number" min="0.01" max="100" placeholder="Share of target %" aria-label="Share of target in percent" value={season.weightagePercent || ""} onChange={(e) => updateSeason(index, { weightagePercent: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" aria-label="Season start date" value={season.startDate} onChange={(e) => updateSeason(index, { startDate: e.target.value })} />
              <Input type="date" aria-label="Season end date" value={season.endDate} onChange={(e) => updateSeason(index, { endDate: e.target.value })} />
            </div>
            {seasons.length > 1 && <button type="button" onClick={() => setSeasons((list) => list.filter((_, i) => i !== index))} className="text-xs font-medium text-danger">Remove season</button>}
          </div>)}
          <Button type="button" variant="secondary" className="h-9 w-full text-xs" onClick={() => setSeasons((list) => [...list, { name: "", weightagePercent: 0, startDate: "", endDate: "" }])}><Plus size={13} />Add season</Button>
        </div>}
      </section>

      <section className="space-y-4">
        <div className="flex items-start justify-between gap-3 border-b pb-2">
          <div><h3 className="text-sm font-semibold text-foreground">Incentive <span className="font-normal text-subtle">· optional</span></h3><p className="mt-0.5 text-xs text-muted">A bonus paid when the staff member reaches the target. Leave off if not needed.</p></div>
          <button type="button" role="switch" aria-checked={withIncentive} aria-label="Add an incentive" onClick={() => setWithIncentive((value) => !value)} className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30", withIncentive ? "bg-brand" : "bg-border")}><span className={cn("absolute left-0.5 top-0.5 size-5 rounded-full bg-white transition-transform duration-150", withIncentive && "translate-x-5")} /></button>
        </div>

        {withIncentive && <div className="space-y-4">
          <Field label="Incentive type">
            <div className="flex gap-1 rounded-lg border bg-white p-1" role="radiogroup" aria-label="Incentive type">
              {(["PERCENTAGE", "FIXED", "SLAB"] as const).map((option) => <button key={option} type="button" role="radio" aria-checked={incentiveType === option} onClick={() => setIncentiveType(option)} className={segment(incentiveType === option)}>{TYPE_INFO[option].label}</button>)}
            </div>
          </Field>
          <p className="-mt-2 text-xs text-muted">{TYPE_INFO[incentiveType].hint}</p>

          {incentiveType === "PERCENTAGE" && <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Percentage (%) *"><Input type="number" min="0" max="100" step="0.1" value={percentValue} onChange={(e) => setPercentValue(e.target.value)} required /></Field>
            <Field label="Calculated on"><Select value={calculationBasis} onChange={(v) => setCalculationBasis(v as CalcBasis)} options={basisOptions} /></Field>
          </div>}

          {incentiveType === "FIXED" && <Field label="Fixed amount (₹) *"><Input type="number" min="0" inputMode="decimal" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} required /></Field>}

          {incentiveType === "SLAB" && <>
            <Field label="Slab payout is calculated on"><Select value={calculationBasis} onChange={(v) => setCalculationBasis(v as CalcBasis)} options={basisOptions} /></Field>
            <div className="space-y-2.5 rounded-lg border bg-background p-3">
              <p className="text-xs font-semibold text-foreground">Slabs <span className="font-normal text-muted">· achievement range and what it pays</span></p>
              {slabs.map((slab, index) => <div key={index} className="space-y-2 rounded-lg border bg-white p-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="From achievement %"><Input type="number" min="0" value={slab.minAchievementPercent} onChange={(e) => updateSlab(index, { minAchievementPercent: Number(e.target.value) })} /></Field>
                  <Field label="Up to % (blank = no limit)"><Input type="number" min="0" value={slab.maxAchievementPercent ?? ""} onChange={(e) => updateSlab(index, { maxAchievementPercent: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Pays"><Select value={slab.valueType} onChange={(v) => updateSlab(index, { valueType: v as SlabValueType })} options={[{ value: "PERCENTAGE", label: "% of basis" }, { value: "FIXED", label: "Fixed ₹" }]} /></Field>
                  <Field label="Value"><Input type="number" min="0" value={slab.value} onChange={(e) => updateSlab(index, { value: Number(e.target.value) })} /></Field>
                </div>
                {slabs.length > 1 && <button type="button" onClick={() => setSlabs((list) => list.filter((_, i) => i !== index))} className="text-xs font-medium text-danger">Remove slab</button>}
              </div>)}
              <Button type="button" variant="secondary" className="h-9 w-full text-xs" onClick={() => setSlabs((list) => [...list, { minAchievementPercent: 0, maxAchievementPercent: null, valueType: "PERCENTAGE", value: 0 }])}><Plus size={13} />Add slab</Button>
            </div>
          </>}

          <Field label="Minimum achievement to earn it (%)"><Input type="number" min="0" max="1000" value={minAchievementPercent} onChange={(e) => setMinAchievementPercent(e.target.value)} /></Field>
          <p className="-mt-2 text-xs text-muted">100 means the full target must be reached. Use 80 to start paying from 80%.</p>
          {example && <p className="rounded-lg bg-background px-3 py-2.5 text-xs text-foreground">{example}</p>}
        </div>}
      </section>

      {error && <FormError message={error} />}
      <FormActions saving={saving} disabled={invalid} onClose={onClose} label={plan ? "Save changes" : "Assign target"} />
    </form>
  </Modal>;
}

function ConfirmDeactivate({ label, onClose, onConfirm }: { label: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return <Modal title="Remove annual target" onClose={onClose} maxWidth="max-w-lg">
    <p className="text-sm text-foreground">Remove the annual target and incentive rule for <span className="font-semibold">{label}</span>? Past performance history is kept.</p>
    <div className="mt-5 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
      <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      <button type="button" disabled={busy} onClick={async () => { setBusy(true); await onConfirm(); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-danger px-4 text-[13px] font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50 sm:h-10">{busy && <LoaderCircle className="animate-spin" size={16} />}{busy ? "Removing…" : "Remove"}</button>
    </div>
  </Modal>;
}
