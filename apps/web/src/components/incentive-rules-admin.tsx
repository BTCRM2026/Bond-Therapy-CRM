"use client";

import { CheckCircle2, IndianRupee, Play, Plus, XCircle } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { SuccessToast } from "@/components/ui/toast";

type SourceType = "INVOICE" | "PAYMENT" | "ORDER";
type CalcType = "PERCENT" | "FIXED" | "SLAB";
type Slab = { minAmount: number; maxAmount?: number; percent?: number; fixedAmount?: number };
type Version = { id: string; ruleId: string; versionNumber: number; sourceType: SourceType; calcType: CalcType; percent: number | null; fixedAmount: number | null; slabs: Slab[] | null; roleEligibility: string[] | null; effectiveFrom: string; effectiveUntil: string | null; requiresApproval: boolean; status: "DRAFT" | "ACTIVE" | "INACTIVE" };
type Rule = { id: string; name: string; description: string | null; versions: Version[] };
type CalcStatus = "CALCULATED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "PAID";
type Calculation = { id: string; userId: string; user: { id: string; name: string }; ruleName: string; ruleVersionNumber: number; sourceType: SourceType; sourceReference: string; sourceDate: string; eligibleAmount: number; incentiveAmount: number; status: CalcStatus; rejectedReason: string | null };

const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback;
const ROLE_OPTIONS = [{ value: "SALES_EXECUTIVE", label: "Sales Executive" }, { value: "SALES_MANAGER", label: "Sales Manager" }];
const STATUS_TONE: Record<CalcStatus, string> = { CALCULATED: "bg-background text-muted", PENDING_APPROVAL: "bg-warning-soft text-warning", APPROVED: "bg-brand-soft text-brand-dark", REJECTED: "bg-red-50 text-danger", PAID: "bg-success-soft text-success" };
const STATUS_LABEL: Record<CalcStatus, string> = { CALCULATED: "Calculated", PENDING_APPROVAL: "Pending approval", APPROVED: "Approved", REJECTED: "Rejected", PAID: "Paid" };

function versionSummary(version: Version) {
  if (version.calcType === "PERCENT") return `${version.percent}% of ${version.sourceType.toLowerCase()}`;
  if (version.calcType === "FIXED") return `${money(version.fixedAmount ?? 0)} fixed per ${version.sourceType.toLowerCase()}`;
  return `${version.slabs?.length ?? 0} slab${version.slabs?.length === 1 ? "" : "s"}`;
}
export function IncentiveRulesAdmin() {
  const [tab, setTab] = useState<"rules" | "approvals">("rules");
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [calculations, setCalculations] = useState<Calculation[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<CalcStatus | "ALL">("PENDING_APPROVAL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [newRule, setNewRule] = useState(false);
  const [newVersionFor, setNewVersionFor] = useState<Rule | null>(null);
  const [running, setRunning] = useState<Version | null>(null);
  const [rejecting, setRejecting] = useState<Calculation | null>(null);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    const syncHeaderSlot = () => setHeaderSlot(document.getElementById("page-header-actions"));
    syncHeaderSlot();
    const frame = requestAnimationFrame(syncHeaderSlot);
    return () => cancelAnimationFrame(frame);
  }, []);

  const load = async () => {
    try {
      const [rulesRes, calcRes] = await Promise.all([fetch("/api/incentive-rules", { cache: "no-store" }), fetch("/api/incentive-rules/calculations", { cache: "no-store" })]);
      const rulesJson = await rulesRes.json().catch(() => null);
      if (!rulesRes.ok) throw new Error(messageFrom(rulesJson, "Unable to load incentive rules."));
      setRules(rulesJson as Rule[]);
      const calcJson = await calcRes.json().catch(() => null);
      if (!calcRes.ok) throw new Error(messageFrom(calcJson, "Unable to load incentive calculations."));
      setCalculations(calcJson as Calculation[]);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load incentive data."); }
    finally { setLoading(false); }
  };
  useEffect(() => { (async () => { await load(); })(); }, []);

  const act = async (id: string, action: "approve" | "reject" | "paid", reason?: string) => {
    setBusyId(id);
    try {
      const response = await fetch(`/api/incentive-rules/calculations/${id}/${action}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to update this incentive."));
      setRejecting(null);
      await load();
      setNotice(action === "approve" ? "Incentive approved." : action === "reject" ? "Incentive rejected." : "Incentive marked as paid.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update this incentive."); }
    finally { setBusyId(""); }
  };

  const totals = useMemo(() => {
    const rows = calculations ?? [];
    return {
      pending: rows.filter((r) => r.status === "PENDING_APPROVAL" || r.status === "CALCULATED").reduce((sum, r) => sum + r.incentiveAmount, 0),
      approved: rows.filter((r) => r.status === "APPROVED").reduce((sum, r) => sum + r.incentiveAmount, 0),
      paid: rows.filter((r) => r.status === "PAID").reduce((sum, r) => sum + r.incentiveAmount, 0),
    };
  }, [calculations]);
  const filteredCalcs = (calculations ?? []).filter((row) => statusFilter === "ALL" || row.status === statusFilter);

  if (loading) return <div className="space-y-3"><div className="h-11 w-56 animate-pulse rounded-lg bg-background" /><div className="h-64 animate-pulse rounded-xl bg-background" /></div>;

  return <div className="space-y-4">
    {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}
    {headerSlot && tab === "rules" && createPortal(<Button onClick={() => setNewRule(true)}><Plus size={16} />New rule</Button>, headerSlot)}

    <div className="flex gap-1 rounded-lg border bg-white p-1">
      <button type="button" onClick={() => setTab("rules")} className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${tab === "rules" ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background"}`}>Rules</button>
      <button type="button" onClick={() => setTab("approvals")} className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${tab === "approvals" ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background"}`}>Approvals</button>
    </div>

    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}

    {tab === "rules" && <div className="space-y-4">
      {!rules?.length ? <div className="crm-surface px-5 py-14 text-center"><IndianRupee className="mx-auto text-subtle" size={26} /><p className="mt-3 text-sm font-semibold text-foreground">No incentive rules yet</p></div>
        : rules.map((rule) => <section key={rule.id} className="crm-surface overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
            <div><p className="text-sm font-semibold text-foreground">{rule.name}</p>{rule.description && <p className="mt-0.5 text-xs text-muted">{rule.description}</p>}</div>
            <Button variant="secondary" className="h-9 shrink-0 px-3 text-xs" onClick={() => setNewVersionFor(rule)}><Plus size={13} />New version</Button>
          </div>
          {!rule.versions.length ? <p className="px-4 py-6 text-center text-xs text-muted sm:px-5">No versions yet</p> : <div className="divide-y">{rule.versions.map((version) => <div key={version.id} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
            <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">v{version.versionNumber} · {versionSummary(version)}</p><p className="mt-0.5 truncate text-xs text-muted">{new Date(version.effectiveFrom).toLocaleDateString("en-IN")} – {version.effectiveUntil ? new Date(version.effectiveUntil).toLocaleDateString("en-IN") : "ongoing"} · {version.requiresApproval ? "Needs approval" : "Auto-approved"}</p></div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${version.status === "ACTIVE" ? "bg-success-soft text-success" : version.status === "DRAFT" ? "bg-background text-muted" : "bg-red-50 text-danger"}`}>{version.status[0] + version.status.slice(1).toLowerCase()}</span>
              {version.status === "ACTIVE" && <Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => setRunning(version)}><Play size={12} />Run</Button>}
            </div>
          </div>)}</div>}
        </section>)}
    </div>}

    {tab === "approvals" && <div className="space-y-4">
      <KpiStrip columns={3}>
        <KpiCell label="Pending" value={money(totals.pending)} tone="warning" />
        <KpiCell label="Approved (unpaid)" value={money(totals.approved)} tone="brand" />
        <KpiCell label="Paid" value={money(totals.paid)} tone="success" />
      </KpiStrip>
      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-white p-1">
        {(["PENDING_APPROVAL", "APPROVED", "REJECTED", "PAID", "ALL"] as const).map((status) => <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${statusFilter === status ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background"}`}>{status === "ALL" ? "All" : STATUS_LABEL[status]}</button>)}
      </div>
      <section className="crm-surface overflow-hidden">
        {!filteredCalcs.length ? <div className="px-5 py-14 text-center"><IndianRupee className="mx-auto text-subtle" size={26} /><p className="mt-3 text-sm font-semibold text-foreground">Nothing here</p></div>
          : <div className="divide-y">{filteredCalcs.map((row) => <div key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-foreground">{row.user.name}</p><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[row.status]}`}>{STATUS_LABEL[row.status]}</span></div>
              <p className="mt-0.5 text-xs text-muted">{row.ruleName} v{row.ruleVersionNumber} · {row.sourceReference} · {new Date(row.sourceDate).toLocaleDateString("en-IN")} · Eligible {money(row.eligibleAmount)}</p>
              {row.rejectedReason && <p className="mt-1 text-xs text-danger">Rejected: {row.rejectedReason}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{money(row.incentiveAmount)}</p>
              {(row.status === "PENDING_APPROVAL" || row.status === "CALCULATED") && <>
                <Button className="h-9 px-3" disabled={busyId === row.id} onClick={() => act(row.id, "approve")}><CheckCircle2 size={13} />Approve</Button>
                <Button variant="secondary" className="h-9 px-3" disabled={busyId === row.id} onClick={() => setRejecting(row)}><XCircle size={13} />Reject</Button>
              </>}
              {row.status === "APPROVED" && <Button className="h-9 px-3" disabled={busyId === row.id} onClick={() => act(row.id, "paid")}>{busyId === row.id ? "…" : "Mark paid"}</Button>}
            </div>
          </div>)}</div>}
      </section>
    </div>}

    {newRule && <NewRuleModal onClose={() => setNewRule(false)} onSaved={async (message) => { setNewRule(false); await load(); setNotice(message); }} />}
    {newVersionFor && <NewVersionModal rule={newVersionFor} onClose={() => setNewVersionFor(null)} onSaved={async (message) => { setNewVersionFor(null); await load(); setNotice(message); }} />}
    {running && <RunModal version={running} onClose={() => setRunning(null)} onSaved={async (message) => { setRunning(null); await load(); setNotice(message); }} />}
    {rejecting && <RejectModal calc={rejecting} onClose={() => setRejecting(null)} onConfirm={(reason) => act(rejecting.id, "reject", reason)} />}
  </div>;
}

function NewRuleModal({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/incentive-rules", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description: description || undefined }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to create this rule."));
      await onSaved(`${name} was created. Add a version to activate it.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create this rule."); setSaving(false); }
  };
  return <Modal title="New incentive rule" onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Rule name *"><Input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={160} required /></Field>
      <Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} className="w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" /></Field>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onClose={onClose} label="Create rule" />
    </form>
  </Modal>;
}

function NewVersionModal({ rule, onClose, onSaved }: { rule: Rule; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [sourceType, setSourceType] = useState<SourceType>("INVOICE");
  const [calcType, setCalcType] = useState<CalcType>("PERCENT");
  const [percent, setPercent] = useState("5");
  const [fixedAmount, setFixedAmount] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toggleRole = (role: string) => setRoles((current) => current.includes(role) ? current.filter((r) => r !== role) : [...current, role]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch(`/api/incentive-rules/${rule.id}/versions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceType, calcType, percent: calcType === "PERCENT" ? Number(percent) : undefined, fixedAmount: calcType === "FIXED" ? Number(fixedAmount) : undefined, roleEligibility: roles.length ? roles : undefined, effectiveFrom, effectiveUntil: effectiveUntil || undefined, requiresApproval }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to create this version."));
      await onSaved(`New version added to ${rule.name}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create this version."); setSaving(false); }
  };

  return <Modal title={`New version · ${rule.name}`} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Eligible transaction *"><Select value={sourceType} onChange={(v) => setSourceType(v as SourceType)} options={[{ value: "INVOICE", label: "Invoices" }, { value: "PAYMENT", label: "Collections (payments)" }, { value: "ORDER", label: "Delivered orders" }]} /></Field>
      <Field label="Calculation type *"><Select value={calcType} onChange={(v) => setCalcType(v as CalcType)} options={[{ value: "PERCENT", label: "Percentage" }, { value: "FIXED", label: "Fixed amount" }]} /></Field>
      {calcType === "PERCENT" && <Field label="Commission rate (%) *"><Input type="number" min="0" max="100" step="0.5" value={percent} onChange={(e) => setPercent(e.target.value)} required /></Field>}
      {calcType === "FIXED" && <Field label="Fixed amount per transaction *"><Input type="number" min="0" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} required /></Field>}
      <Field label="Eligible roles"><div className="flex flex-wrap gap-2">{ROLE_OPTIONS.map((role) => <button key={role.value} type="button" onClick={() => toggleRole(role.value)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${roles.includes(role.value) ? "border-brand bg-brand-soft text-brand-dark" : "text-muted hover:bg-background"}`}>{role.label}</button>)}</div><p className="mt-1 text-[11px] text-subtle">Leave empty to apply to all sales roles.</p></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Effective from *"><Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required /></Field>
        <Field label="Effective until"><Input type="date" value={effectiveUntil} onChange={(e) => setEffectiveUntil(e.target.value)} min={effectiveFrom} /></Field>
      </div>
      <label className="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2.5"><input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} className="size-4 accent-[var(--brand)]" /><span className="text-xs font-medium text-foreground">Requires manager/admin approval before payout</span></label>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onClose={onClose} label="Create version" />
    </form>
  </Modal>;
}

function RunModal({ version, onClose, onSaved }: { version: Version; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch(`/api/incentive-rules/versions/${version.id}/run`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ periodMonth: month, periodYear: year }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to run this calculation."));
      const result = data as { created: number; updated: number; matched: number };
      await onSaved(`Calculated ${result.matched} transaction${result.matched === 1 ? "" : "s"}: ${result.created} new, ${result.updated} updated.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to run this calculation."); setSaving(false); }
  };
  return <Modal title="Run calculation" subtitle={`v${version.versionNumber} · ${versionSummary(version)}`} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Month"><select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10">{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(2000, i).toLocaleDateString("en-IN", { month: "long" })}</option>)}</select></Field>
        <Field label="Year"><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></Field>
      </div>
      <p className="rounded-lg bg-background px-3 py-2.5 text-xs text-muted">Scans eligible transactions for this period and creates or updates incentive calculations. Already approved or paid rows are never changed.</p>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onClose={onClose} label="Run" />
    </form>
  </Modal>;
}

function RejectModal({ calc, onClose, onConfirm }: { calc: Calculation; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = (event: FormEvent) => { event.preventDefault(); setSaving(true); onConfirm(reason); };
  return <Modal title="Reject incentive" subtitle={`${calc.user.name} · ${money(calc.incentiveAmount)}`} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Duplicate transaction" /></Field>
      <FormActions saving={saving} onClose={onClose} label="Reject" />
    </form>
  </Modal>;
}
