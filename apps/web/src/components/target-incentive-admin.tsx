"use client";

import { LoaderCircle, Pencil, Plus, Target, Trash2, X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SuccessToast } from "@/components/ui/toast";

type DistributionType = "EQUAL" | "SEASONAL";
type IncentiveType = "PERCENTAGE" | "FIXED" | "SLAB";
type CalcBasis = "TOTAL_ELIGIBLE_SALES" | "SALES_ABOVE_TARGET" | "TARGET_AMOUNT";
type SlabValueType = "PERCENTAGE" | "FIXED";
type Season = { name: string; weightagePercent: number; startDate: string; endDate: string };
type Slab = { id?: string; minAchievementPercent: number; maxAchievementPercent: number | null; valueType: SlabValueType; value: number };
type Incentive = { incentiveType: IncentiveType; calculationBasis: CalcBasis; percentValue: number | null; fixedAmount: number | null; minAchievementPercent: number; slabs: Slab[] };
type Plan = { id: string; staffId: string; staffName: string | null; targetYear: number; annualTarget: number; distributionType: DistributionType; seasons: Season[] | null; isActive: boolean; incentive: Incentive | null };
type StaffRow = { staffId: string; name: string; roleKey: string | null; plan: Plan | null; currentMonthAchievement: { targetValue: number; actual: number; achievementPercent: number } | null };

const ROLE_LABELS: Record<string, string> = { SALES_MANAGER: "Sales Manager", SALES_EXECUTIVE: "Sales Executive" };
const BASIS_LABELS: Record<CalcBasis, string> = { TOTAL_ELIGIBLE_SALES: "% of total eligible sales", SALES_ABOVE_TARGET: "% of sales above target", TARGET_AMOUNT: "% of target amount" };
const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback;

function incentiveSummary(incentive: Incentive | null) {
  if (!incentive) return "Not configured";
  if (incentive.incentiveType === "PERCENTAGE") return `${incentive.percentValue ?? 0}% · ${BASIS_LABELS[incentive.calculationBasis]}`;
  if (incentive.incentiveType === "FIXED") return `${money(incentive.fixedAmount ?? 0)} fixed`;
  return `${incentive.slabs.length} slab${incentive.slabs.length === 1 ? "" : "s"}`;
}

function achievementTone(percent: number, minRequired: number) {
  if (percent >= 100) return "bg-success-soft text-success";
  if (percent >= minRequired) return "bg-warning-soft text-warning";
  return "bg-red-50 text-danger";
}

export function TargetIncentiveAdmin() {
  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [deactivating, setDeactivating] = useState<{ id: string; label: string } | null>(null);

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

  if (loading) return <div className="space-y-3"><div className="h-64 animate-pulse rounded-xl bg-background" /></div>;

  return <div className="space-y-4">
    {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}

    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}

    <section className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
      <div className="border-b px-4 py-3 sm:px-5"><p className="text-sm font-semibold text-foreground">Annual targets & incentives</p><p className="mt-0.5 text-xs text-muted">Set one annual sales target per staff member; the CRM distributes it across every period view.</p></div>
      {!rows?.length ? <div className="px-5 py-14 text-center"><Target className="mx-auto text-subtle" size={26} /><p className="mt-3 text-sm font-semibold text-foreground">No sales staff found</p></div>
        : <div className="divide-y">{rows.map((row) => <div key={row.staffId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-foreground">{row.name}</p><span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted">{row.roleKey ? ROLE_LABELS[row.roleKey] ?? row.roleKey : "—"}</span></div>
            {row.plan ? <>
              <p className="mt-0.5 text-xs text-muted">FY {row.plan.targetYear} · Annual target {money(row.plan.annualTarget)} · {row.plan.distributionType === "SEASONAL" ? "Seasonal" : "Equal"} distribution</p>
              <p className="mt-0.5 text-xs text-muted">Incentive: {incentiveSummary(row.plan.incentive)}</p>
            </> : <p className="mt-0.5 text-xs text-muted">No annual target assigned</p>}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {row.currentMonthAchievement && <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${achievementTone(row.currentMonthAchievement.achievementPercent, row.plan?.incentive?.minAchievementPercent ?? 100)}`}>{row.currentMonthAchievement.achievementPercent}% this month</span>}
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setEditing(row)} className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-brand-soft hover:text-brand" aria-label={`${row.plan ? "Edit" : "Assign"} target for ${row.name}`}>{row.plan ? <Pencil size={15} /> : <Plus size={15} />}</button>
              {row.plan && <button type="button" onClick={() => setDeactivating({ id: row.plan!.id, label: row.name })} className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-red-50 hover:text-danger" aria-label={`Remove target for ${row.name}`}><Trash2 size={15} /></button>}
            </div>
          </div>
        </div>)}</div>}
    </section>

    {editing && <PlanEditor row={editing} onClose={() => setEditing(null)} onSaved={async (message) => { setEditing(null); await load(); setNotice(message); }} />}
    {deactivating && <ConfirmDeactivate label={deactivating.label} onClose={() => setDeactivating(null)} onConfirm={deactivate} />}
  </div>;
}

function PlanEditor({ row, onClose, onSaved }: { row: StaffRow; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const plan = row.plan;
  const now = new Date();
  const [targetYear, setTargetYear] = useState(plan?.targetYear ?? now.getFullYear());
  const [annualTarget, setAnnualTarget] = useState(plan ? String(plan.annualTarget) : "");
  const [distributionType, setDistributionType] = useState<DistributionType>(plan?.distributionType ?? "EQUAL");
  const [seasons, setSeasons] = useState<Season[]>(plan?.seasons?.length ? plan.seasons : [{ name: "", weightagePercent: 0, startDate: "", endDate: "" }]);
  const [incentiveType, setIncentiveType] = useState<IncentiveType>(plan?.incentive?.incentiveType ?? "PERCENTAGE");
  const [calculationBasis, setCalculationBasis] = useState<CalcBasis>(plan?.incentive?.calculationBasis ?? "TOTAL_ELIGIBLE_SALES");
  const [percentValue, setPercentValue] = useState(plan?.incentive?.percentValue != null ? String(plan.incentive.percentValue) : "");
  const [fixedAmount, setFixedAmount] = useState(plan?.incentive?.fixedAmount != null ? String(plan.incentive.fixedAmount) : "");
  const [minAchievementPercent, setMinAchievementPercent] = useState(plan?.incentive ? String(plan.incentive.minAchievementPercent) : "100");
  const [slabs, setSlabs] = useState<Slab[]>(plan?.incentive?.slabs.length ? plan.incentive.slabs : [{ minAchievementPercent: 100, maxAchievementPercent: null, valueType: "PERCENTAGE", value: 0 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const seasonTotal = seasons.reduce((sum, s) => sum + (Number.isFinite(s.weightagePercent) ? s.weightagePercent : 0), 0);
  const updateSeason = (index: number, patch: Partial<Season>) => setSeasons((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const updateSlab = (index: number, patch: Partial<Slab>) => setSlabs((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const payload = {
        staffId: row.staffId,
        targetYear,
        annualTarget: Number(annualTarget),
        distributionType,
        seasons: distributionType === "SEASONAL" ? seasons.map((s) => ({ ...s, weightagePercent: Number(s.weightagePercent) })) : undefined,
        incentiveType,
        calculationBasis,
        percentValue: incentiveType === "PERCENTAGE" ? Number(percentValue) : undefined,
        fixedAmount: incentiveType === "FIXED" ? Number(fixedAmount) : undefined,
        minAchievementPercent: Number(minAchievementPercent),
        slabs: incentiveType === "SLAB" ? slabs.map((s) => ({ ...s, minAchievementPercent: Number(s.minAchievementPercent), maxAchievementPercent: s.maxAchievementPercent != null && s.maxAchievementPercent !== ("" as unknown) ? Number(s.maxAchievementPercent) : undefined, value: Number(s.value) })) : undefined,
      };
      const response = await fetch("/api/target-incentive/plans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to save this annual target."));
      await onSaved(`Annual target saved for ${row.name}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save this annual target."); setSaving(false); }
  };

  return <Modal title={plan ? "Edit annual target" : "Assign annual target"} subtitle={row.name} onClose={onClose}>
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target year *"><Input type="number" min="2020" max="2100" value={targetYear} onChange={(e) => setTargetYear(Number(e.target.value))} required /></Field>
        <Field label="Annual target (₹) *"><Input type="number" min="0" value={annualTarget} onChange={(e) => setAnnualTarget(e.target.value)} required /></Field>
      </div>

      <Field label="Distribution method *">
        <div className="flex gap-1 rounded-lg border bg-white p-1">
          {(["EQUAL", "SEASONAL"] as const).map((option) => <button key={option} type="button" onClick={() => setDistributionType(option)} className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${distributionType === option ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background"}`}>{option === "EQUAL" ? "Equal" : "Seasonal"}</button>)}
        </div>
      </Field>

      {distributionType === "SEASONAL" && <div className="space-y-2.5 rounded-lg border bg-background p-3">
        <div className="flex items-center justify-between"><p className="text-xs font-semibold text-foreground">Seasons</p><p className={`text-xs font-semibold ${Math.abs(seasonTotal - 100) < 0.01 ? "text-success" : "text-danger"}`}>{seasonTotal.toFixed(2)}% of 100%</p></div>
        {seasons.map((season, index) => <div key={index} className="space-y-2 rounded-lg border bg-white p-2.5">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Season name" value={season.name} onChange={(e) => updateSeason(index, { name: e.target.value })} />
            <Input type="number" min="0.01" max="100" placeholder="Weightage %" value={season.weightagePercent || ""} onChange={(e) => updateSeason(index, { weightagePercent: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={season.startDate} onChange={(e) => updateSeason(index, { startDate: e.target.value })} />
            <Input type="date" value={season.endDate} onChange={(e) => updateSeason(index, { endDate: e.target.value })} />
          </div>
          {seasons.length > 1 && <button type="button" onClick={() => setSeasons((rows) => rows.filter((_, i) => i !== index))} className="text-xs font-medium text-danger">Remove season</button>}
        </div>)}
        <Button type="button" variant="secondary" className="h-9 w-full text-xs" onClick={() => setSeasons((rows) => [...rows, { name: "", weightagePercent: 0, startDate: "", endDate: "" }])}><Plus size={13} />Add season</Button>
      </div>}

      <Field label="Incentive type *">
        <div className="flex gap-1 rounded-lg border bg-white p-1">
          {(["PERCENTAGE", "FIXED", "SLAB"] as const).map((option) => <button key={option} type="button" onClick={() => setIncentiveType(option)} className={`flex-1 rounded-md px-2 py-2 text-xs font-semibold transition-colors ${incentiveType === option ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background"}`}>{option === "PERCENTAGE" ? "Percentage" : option === "FIXED" ? "Fixed" : "Slab"}</button>)}
        </div>
      </Field>

      {incentiveType === "PERCENTAGE" && <>
        <Field label="Calculation basis *"><Select value={calculationBasis} onChange={(v) => setCalculationBasis(v as CalcBasis)} options={(Object.keys(BASIS_LABELS) as CalcBasis[]).map((b) => ({ value: b, label: BASIS_LABELS[b] }))} /></Field>
        <Field label="Incentive percentage (%) *"><Input type="number" min="0" max="100" step="0.1" value={percentValue} onChange={(e) => setPercentValue(e.target.value)} required /></Field>
      </>}

      {incentiveType === "FIXED" && <Field label="Fixed incentive amount (₹) *"><Input type="number" min="0" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} required /></Field>}

      {incentiveType === "SLAB" && <>
        <Field label="Calculation basis *"><Select value={calculationBasis} onChange={(v) => setCalculationBasis(v as CalcBasis)} options={(Object.keys(BASIS_LABELS) as CalcBasis[]).map((b) => ({ value: b, label: BASIS_LABELS[b] }))} /></Field>
        <div className="space-y-2.5 rounded-lg border bg-background p-3">
          <p className="text-xs font-semibold text-foreground">Achievement slabs</p>
          {slabs.map((slab, index) => <div key={index} className="space-y-2 rounded-lg border bg-white p-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" min="0" placeholder="Min achievement %" value={slab.minAchievementPercent} onChange={(e) => updateSlab(index, { minAchievementPercent: Number(e.target.value) })} />
              <Input type="number" min="0" placeholder="Max achievement % (optional)" value={slab.maxAchievementPercent ?? ""} onChange={(e) => updateSlab(index, { maxAchievementPercent: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={slab.valueType} onChange={(v) => updateSlab(index, { valueType: v as SlabValueType })} options={[{ value: "PERCENTAGE", label: "% of basis" }, { value: "FIXED", label: "Fixed ₹" }]} />
              <Input type="number" min="0" placeholder="Value" value={slab.value} onChange={(e) => updateSlab(index, { value: Number(e.target.value) })} />
            </div>
            {slabs.length > 1 && <button type="button" onClick={() => setSlabs((rows) => rows.filter((_, i) => i !== index))} className="text-xs font-medium text-danger">Remove slab</button>}
          </div>)}
          <Button type="button" variant="secondary" className="h-9 w-full text-xs" onClick={() => setSlabs((rows) => [...rows, { minAchievementPercent: 0, maxAchievementPercent: null, valueType: "PERCENTAGE", value: 0 }])}><Plus size={13} />Add slab</Button>
        </div>
      </>}

      <Field label="Minimum achievement % to unlock incentive *"><Input type="number" min="0" max="1000" value={minAchievementPercent} onChange={(e) => setMinAchievementPercent(e.target.value)} required /></Field>
      <p className="rounded-lg bg-background px-3 py-2.5 text-xs text-muted">The annual target is auto-distributed into Monthly, Quarterly, Half-Yearly and Yearly views{distributionType === "SEASONAL" ? ", plus a Seasonal view using the weightages above." : "."}</p>

      {error && <FormError message={error} />}
      <FormActions saving={saving} disabled={!annualTarget || (distributionType === "SEASONAL" && Math.abs(seasonTotal - 100) > 0.01)} onClose={onClose} />
    </form>
  </Modal>;
}

function ConfirmDeactivate({ label, onClose, onConfirm }: { label: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return <Modal title="Remove annual target" onClose={onClose}>
    <p className="text-sm text-foreground">Remove the annual target and incentive rule for <span className="font-semibold">{label}</span>? Past performance history is kept.</p>
    <div className="mt-5 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
      <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      <button type="button" disabled={busy} onClick={async () => { setBusy(true); await onConfirm(); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-danger px-4 text-[13px] font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50 sm:h-10">{busy && <LoaderCircle className="animate-spin" size={16} />}{busy ? "Removing…" : "Remove"}</button>
    </div>
  </Modal>;
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">{label}</span>{children}</label>; }
function FormError({ message }: { message: string }) { return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{message}</p>; }
function FormActions({ saving, disabled, onClose }: { saving: boolean; disabled?: boolean; onClose: () => void }) {
  return <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
    <Button type="submit" disabled={saving || disabled}>{saving && <LoaderCircle className="animate-spin" size={16} />}{saving ? "Saving…" : "Save"}</Button>
  </div>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/40 p-3 backdrop-blur-[1px] sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
    <div className="my-auto flex max-h-[calc(100dvh-24px)] w-full max-w-lg flex-col rounded-xl border bg-white shadow-[0_20px_48px_rgba(15,23,42,0.18)] sm:max-h-[calc(100dvh-32px)]">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4"><div><h2 className="text-base font-semibold text-foreground">{title}</h2>{subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}</div><button type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-background sm:size-8" aria-label="Close"><X size={17} /></button></div>
      <div className="overflow-y-auto p-4 sm:p-5">{children}</div>
    </div>
  </div>;
}
