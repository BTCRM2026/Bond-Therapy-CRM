"use client";

import { CheckCircle2, IndianRupee, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";

type CalcStatus = "CALCULATED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "PAID";
type Calculation = { id: string; userId: string; user: { id: string; name: string }; ruleName: string; ruleVersionNumber: number; sourceType: string; sourceReference: string; sourceDate: string; eligibleAmount: number; incentiveAmount: number; status: CalcStatus; approvedBy: { id: string; name: string } | null; rejectedReason: string | null; paidAt: string | null };

const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback;
const STATUS_TONE: Record<CalcStatus, string> = { CALCULATED: "bg-background text-muted", PENDING_APPROVAL: "bg-warning-soft text-warning", APPROVED: "bg-brand-soft text-brand-dark", REJECTED: "bg-red-50 text-danger", PAID: "bg-success-soft text-success" };
const STATUS_LABEL: Record<CalcStatus, string> = { CALCULATED: "Calculated", PENDING_APPROVAL: "Pending approval", APPROVED: "Approved", REJECTED: "Rejected", PAID: "Paid" };

export function IncentivesModule({ isManager, currentUserId }: { isManager: boolean; currentUserId: string }) {
  const [rows, setRows] = useState<Calculation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    try {
      const response = await fetch("/api/incentive-rules/calculations", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to load incentive data."));
      setRows(data as Calculation[]);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load incentive data."); }
    finally { setLoading(false); }
  };
  useEffect(() => { (async () => { await load(); })(); }, []);

  const act = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    try {
      const response = await fetch(`/api/incentive-rules/calculations/${id}/${action}`, { method: "PATCH" });
      if (!response.ok) throw new Error();
      await load();
    } catch { setError("Unable to update this incentive."); }
    finally { setBusyId(""); }
  };

  const mine = useMemo(() => (rows ?? []).filter((row) => row.userId === currentUserId), [rows, currentUserId]);
  const team = useMemo(() => (rows ?? []).filter((row) => row.userId !== currentUserId && (row.status === "PENDING_APPROVAL" || row.status === "CALCULATED")), [rows, currentUserId]);
  const totals = useMemo(() => ({
    pending: mine.filter((r) => r.status === "PENDING_APPROVAL" || r.status === "CALCULATED").reduce((sum, r) => sum + r.incentiveAmount, 0),
    approved: mine.filter((r) => r.status === "APPROVED").reduce((sum, r) => sum + r.incentiveAmount, 0),
    paid: mine.filter((r) => r.status === "PAID").reduce((sum, r) => sum + r.incentiveAmount, 0),
  }), [mine]);

  if (loading) return <div className="space-y-3"><div className="h-24 animate-pulse rounded-xl bg-background" /></div>;

  return <div className="space-y-5">
    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}

    <KpiStrip columns={3}>
      <KpiCell label="Pending approval" value={money(totals.pending)} tone="warning" />
      <KpiCell label="Approved" value={money(totals.approved)} tone="brand" />
      <KpiCell label="Paid" value={money(totals.paid)} tone="success" />
    </KpiStrip>

    <section className="crm-surface overflow-hidden">
      <div className="border-b px-4 py-3 sm:px-5"><p className="text-sm font-semibold text-foreground">My incentives</p></div>
      {!mine.length ? <div className="px-5 py-10 text-center"><IndianRupee className="mx-auto text-subtle" size={24} /><p className="mt-3 text-sm font-semibold text-foreground">No incentives calculated yet</p><p className="mt-1 text-xs text-muted">These are generated automatically from your invoices and collections.</p></div>
        : <div className="divide-y">{mine.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-foreground">{row.ruleName} <span className="text-muted">v{row.ruleVersionNumber}</span></p><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[row.status]}`}>{STATUS_LABEL[row.status]}</span></div>
            <p className="mt-0.5 text-xs text-muted">{row.sourceReference} · {new Date(row.sourceDate).toLocaleDateString("en-IN")} · Eligible {money(row.eligibleAmount)}{row.approvedBy ? ` · Approved by ${row.approvedBy.name}` : ""}</p>
            {row.rejectedReason && <p className="mt-1 text-xs text-danger">Rejected: {row.rejectedReason}</p>}
          </div>
          <p className="shrink-0 text-sm font-semibold text-foreground">{money(row.incentiveAmount)}</p>
        </div>)}</div>}
    </section>

    {isManager && <section className="crm-surface overflow-hidden">
      <div className="border-b px-4 py-3 sm:px-5"><p className="text-sm font-semibold text-foreground">Team approvals</p><p className="mt-0.5 text-xs text-muted">{team.length} pending</p></div>
      {!team.length ? <p className="px-5 py-8 text-center text-xs text-muted">Nothing waiting on you.</p> : <div className="divide-y">{team.map((row) => <div key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{row.user.name}</p><p className="mt-0.5 text-xs text-muted">{row.ruleName} v{row.ruleVersionNumber} · {row.sourceReference} · {money(row.incentiveAmount)}</p></div>
        <div className="flex shrink-0 items-center gap-2">
          <Button className="h-9 px-3" disabled={busyId === row.id} onClick={() => act(row.id, "approve")}><CheckCircle2 size={13} />Approve</Button>
          <Button variant="secondary" className="h-9 px-3" disabled={busyId === row.id} onClick={() => act(row.id, "reject")}><XCircle size={13} />Reject</Button>
        </div>
      </div>)}</div>}
    </section>}
  </div>;
}
