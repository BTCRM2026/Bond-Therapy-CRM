"use client";

import { CheckCircle2, IndianRupee, LoaderCircle, Percent, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MyIncentive = {
  period: { month: number; year: number };
  generated: boolean;
  ratePercent: number | null;
  eligibleRevenue: number;
  incentiveAmount: number | null;
  status: "PENDING" | "APPROVED" | "PAID" | null;
  approvedBy: { id: string; name: string } | null;
};
type TeamRow = { userId: string; name: string; eligibleRevenue: number; ratePercent: number | null; incentiveAmount: number | null; status: string | null; statementId: string | null };

const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback;

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-muted">Not set</span>;
  const tone = status === "APPROVED" || status === "PAID" ? "bg-success-soft text-success" : "bg-warning-soft text-warning";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{status[0] + status.slice(1).toLowerCase()}</span>;
}

export function IncentivesModule({ isManager }: { isManager: boolean }) {
  const [mine, setMine] = useState<MyIncentive | null>(null);
  const [team, setTeam] = useState<{ period: { month: number; year: number }; rows: TeamRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rateTarget, setRateTarget] = useState<TeamRow | null>(null);
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    try {
      const requests: Promise<Response>[] = [fetch("/api/incentives/me", { cache: "no-store" })];
      if (isManager) requests.push(fetch("/api/incentives/team", { cache: "no-store" }));
      const [meResponse, teamResponse] = await Promise.all(requests);
      if (meResponse.ok) setMine(await meResponse.json());
      if (teamResponse?.ok) setTeam(await teamResponse.json());
      setError("");
    } catch { setError("Unable to load incentive data."); }
    finally { setLoading(false); }
  };
  useEffect(() => { (async () => { await load(); })(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async (row: TeamRow) => {
    if (!row.statementId) return;
    setBusyId(row.statementId);
    try {
      const response = await fetch(`/api/incentives/${row.statementId}/approve`, { method: "PATCH" });
      if (!response.ok) throw new Error();
      await load();
    } catch { setError("Unable to approve this incentive."); }
    finally { setBusyId(""); }
  };

  if (loading) return <div className="space-y-3"><div className="h-32 animate-pulse rounded-xl bg-background" /></div>;

  return <div className="space-y-5">
    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}
    {mine && <section className="rounded-xl border bg-white p-5 shadow-[0_3px_12px_rgba(15,23,42,0.04)] sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{MONTHS[mine.period.month - 1]} {mine.period.year}</p>
      {mine.generated ? <>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <p className="text-2xl font-semibold tracking-[-0.02em] text-foreground">{money(mine.incentiveAmount ?? 0)}</p>
          <StatusBadge status={mine.status} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-background p-3 text-xs sm:grid-cols-3">
          <div><p className="text-muted">Eligible revenue</p><p className="mt-1 font-medium text-foreground">{money(mine.eligibleRevenue)}</p></div>
          <div><p className="text-muted">Rate</p><p className="mt-1 font-medium text-foreground">{mine.ratePercent}%</p></div>
          <div><p className="text-muted">Approved by</p><p className="mt-1 font-medium text-foreground">{mine.approvedBy?.name ?? "Pending"}</p></div>
        </div>
      </> : <div className="mt-3 rounded-lg border border-warning/25 bg-warning-soft/60 px-3 py-2.5 text-xs text-muted">Your manager has not set an incentive rate for this month yet. Revenue booked so far: <span className="font-semibold text-foreground">{money(mine.eligibleRevenue)}</span>.</div>}
    </section>}

    {isManager && team && <section className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
      <div className="border-b px-4 py-3 sm:px-5"><p className="text-sm font-semibold text-foreground">Team incentives</p><p className="mt-0.5 text-xs text-muted">{MONTHS[team.period.month - 1]} {team.period.year}</p></div>
      <div className="divide-y">{team.rows.map((row) => <div key={row.userId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{row.name}</p><p className="mt-0.5 text-xs text-muted">Revenue {money(row.eligibleRevenue)}{row.ratePercent != null ? ` · ${row.ratePercent}% = ${money(row.incentiveAmount ?? 0)}` : ""}</p></div>
        <div className="flex items-center gap-2">
          <StatusBadge status={row.status} />
          <Button variant="secondary" className="h-9 px-3" onClick={() => setRateTarget(row)}><Percent size={13} />{row.ratePercent != null ? "Update rate" : "Set rate"}</Button>
          {row.status === "PENDING" && <Button className="h-9 px-3" disabled={busyId === row.statementId} onClick={() => approve(row)}><CheckCircle2 size={13} />{busyId === row.statementId ? "…" : "Approve"}</Button>}
        </div>
      </div>)}</div>
    </section>}

    {rateTarget && <RateForm row={rateTarget} period={team!.period} onClose={() => setRateTarget(null)} onSaved={async () => { setRateTarget(null); await load(); }} />}
  </div>;
}

function RateForm({ row, period, onClose, onSaved }: { row: TeamRow; period: { month: number; year: number }; onClose: () => void; onSaved: () => Promise<void> }) {
  const [rate, setRate] = useState(row.ratePercent != null ? String(row.ratePercent) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    const value = Number(rate);
    if (!rate || value < 0 || value > 100) { setError("Enter a rate between 0 and 100."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/incentives/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: row.userId, periodMonth: period.month, periodYear: period.year, ratePercent: value }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to set this rate."));
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to set this rate."); setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 grid place-items-end bg-[#0f172a]/40 p-0 backdrop-blur-[1px] sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Set incentive rate">
    <div className="w-full rounded-t-xl border bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.18)] sm:max-w-sm sm:rounded-xl">
      <div className="flex items-center gap-2"><IndianRupee size={16} className="text-brand" /><h2 className="text-base font-semibold text-foreground">Set incentive rate</h2></div>
      <p className="mt-1 text-xs text-muted">{row.name} · revenue this period {money(row.eligibleRevenue)}</p>
      <label className="mt-4 block space-y-1.5"><span className="text-xs font-medium text-foreground">Commission rate (%)</span><Input type="number" min="0" max="100" step="0.5" value={rate} onChange={(event) => setRate(event.target.value)} autoFocus /></label>
      {error && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</p>}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}><X size={14} />Cancel</Button><Button type="button" disabled={saving} onClick={submit}>{saving && <LoaderCircle className="animate-spin" size={16} />}{saving ? "Saving…" : "Save rate"}</Button></div>
    </div>
  </div>;
}
