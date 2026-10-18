"use client";

import { CalendarRange, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { Field, FormError } from "@/components/ui/field";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";
import { Modal } from "@/components/ui/modal";
import { SuccessToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { type LeaveItem, type LeaveStatus, PaySplit, STATUS_LABEL, StatusBadge, jsonInit, leaveApi, longDate, monthLabel, plural, rangeLabel } from "@/components/leave-shared";

type Report = { month: string; paidAllowance: number; rows: Array<{ userId: string; name: string; days: number; paid: number; unpaid: number; requests: number }>; totals: { staff: number; days: number; paid: number; unpaid: number } };
type Filter = LeaveStatus | "ALL";
type QueuePage = { items: LeaveItem[]; total: number; page: number; pageSize: number; hasMore: boolean; counts: Record<LeaveStatus, number> };

const textarea = "w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-base leading-5 outline-none transition placeholder:text-subtle focus:border-brand focus:ring-2 focus:ring-brand/10 sm:text-[13px]";
const currentMonth = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; };
const shiftMonth = (month: string, by: number) => { const [year, index] = month.split("-").map(Number) as [number, number]; const date = new Date(Date.UTC(year, index - 1 + by, 1)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; };

export function LeaveAdmin() {
  const [tab, setTab] = useState<"requests" | "deductions">("requests");
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [data, setData] = useState<QueuePage | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<LeaveItem | null>(null);

  const loadItems = useCallback(async () => {
    try { const next = await leaveApi<QueuePage>(`/requests?page=${page}&pageSize=${pageSize}${filter === "ALL" ? "" : `&status=${filter}`}`); if (!next.items.length && page > 1) { setPage(page - 1); return; } setData(next); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load leave requests."); }
  }, [page, pageSize, filter]);
  const loadReport = useCallback(async () => {
    try { setReport(await leaveApi<Report>(`/report?month=${month}`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load the salary report."); }
  }, [month]);
  useEffect(() => { (async () => { await loadItems(); })(); }, [loadItems]);
  useEffect(() => { (async () => { await loadReport(); })(); }, [loadReport]);

  const items = data?.items ?? null;
  const counts = useMemo(() => ({ PENDING: data?.counts.PENDING ?? 0, APPROVED: data?.counts.APPROVED ?? 0, REJECTED: data?.counts.REJECTED ?? 0, ALL: data ? data.counts.PENDING + data.counts.APPROVED + data.counts.REJECTED : 0 }), [data]);
  const visible = items ?? [];
  const changeFilter = (next: Filter) => { setFilter(next); setPage(1); };

  const decide = async (item: LeaveItem, status: "APPROVED" | "REJECTED", reviewNote?: string) => {
    setBusyId(item.id); setError("");
    try {
      await leaveApi(`/${item.id}/review`, jsonInit("POST", { status, reviewNote }));
      setNotice(status === "APPROVED" ? `Leave approved for ${item.staff?.name ?? "staff"}.` : `Leave rejected for ${item.staff?.name ?? "staff"}.`);
      setRejecting(null);
      await Promise.all([loadItems(), loadReport()]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save your decision."); setRejecting(null); }
    finally { setBusyId(null); }
  };

  const tabs: Array<[typeof tab, string]> = [["requests", "Requests"], ["deductions", "Salary deductions"]];
  const filters: Array<[Filter, string]> = [["PENDING", "Pending"], ["APPROVED", "Approved"], ["REJECTED", "Rejected"], ["ALL", "All"]];

  return <>
    {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}
    <div className="space-y-4">
      <KpiStrip columns={4}>
        <KpiCell label="Pending requests" value={items ? counts.PENDING : "–"} detail="Waiting for a decision" tone={counts.PENDING ? "warning" : "neutral"} active={tab === "requests" && filter === "PENDING"} onClick={() => { setTab("requests"); changeFilter("PENDING"); }} />
        <KpiCell label="Leave days" value={report ? report.totals.days : "–"} detail={monthLabel(month)} />
        <KpiCell label="Paid days" value={report ? report.totals.paid : "–"} detail={`${report?.paidAllowance ?? 1} paid per person each month`} tone="success" />
        <KpiCell label="Unpaid · deduct" value={report ? report.totals.unpaid : "–"} detail="From salary this month" tone={report && report.totals.unpaid > 0 ? "warning" : "neutral"} active={tab === "deductions"} onClick={() => setTab("deductions")} />
      </KpiStrip>

      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-white p-1" role="tablist" aria-label="Leave sections">
        {tabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn("shrink-0 rounded-md px-3 py-2 text-xs font-semibold transition-colors", tab === key ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background")}>{label}</button>)}
      </div>

      {error && <FormError message={error} />}

      {tab === "requests" && <>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {filters.map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => changeFilter(key)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors", filter === key ? "border-brand/30 bg-brand-soft text-brand-dark" : "bg-white text-muted hover:bg-background")}>{label}<span className="rounded-full bg-background px-1.5 text-[10px]">{counts[key]}</span></button>)}
        </div>
        {data && data.total > 0 && <div className="flex justify-end"><CompactPagination page={data.page} pageSize={data.pageSize} total={data.total} hasMore={data.hasMore} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /></div>}
        {!items && !error && <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-white" />)}</div>}
        {items && !visible.length && <section className="crm-surface px-5 py-14 text-center"><CalendarRange className="mx-auto text-subtle" size={26} /><p className="mt-3 text-sm font-semibold text-foreground">{filter === "PENDING" ? "No leave waiting for a decision" : `No ${filter === "ALL" ? "" : STATUS_LABEL[filter].toLowerCase() + " "}leave requests`}</p><p className="mt-1 text-xs text-muted">Requests from staff will appear here.</p></section>}
        {visible.length > 0 && <>
          <section className="crm-surface hidden overflow-hidden lg:block">
            <table className="w-full text-left text-[13px]">
              <thead><tr className="border-b bg-background/60 text-xs text-muted"><th className="px-4 py-3 font-medium">Staff</th><th className="px-4 py-3 font-medium">Dates</th><th className="px-4 py-3 font-medium">Days</th><th className="px-4 py-3 font-medium">Pay</th><th className="px-4 py-3 font-medium">Reason</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Action</th></tr></thead>
              <tbody className="divide-y">{visible.map((item) => <tr key={item.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{item.staff?.name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{rangeLabel(item.startDate, item.endDate)}</td>
                <td className="px-4 py-3 text-muted">{item.totalDays}</td>
                <td className="px-4 py-3"><PaySplit item={item} /></td>
                <td className="max-w-[260px] px-4 py-3 text-muted"><span className="line-clamp-2 break-words" title={item.reason}>{item.reason}</span>{item.reviewNote && <span className="mt-1 block text-xs text-subtle">Note: {item.reviewNote}</span>}</td>
                <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-3"><Actions item={item} busy={busyId === item.id} onApprove={() => decide(item, "APPROVED")} onReject={() => setRejecting(item)} /></td>
              </tr>)}</tbody>
            </table>
          </section>
          <div className="space-y-2 lg:hidden">{visible.map((item) => <article key={item.id} className="crm-surface space-y-2.5 p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-foreground">{item.staff?.name}</p><p className="mt-0.5 text-xs text-muted">{rangeLabel(item.startDate, item.endDate)} · {plural(item.totalDays, "day")}</p></div><StatusBadge status={item.status} /></div>
            <PaySplit item={item} />
            <p className="break-words text-xs text-muted" style={{ overflowWrap: "anywhere" }}>{item.reason}</p>
            {item.reviewNote && <p className="rounded-lg bg-background px-2.5 py-1.5 text-xs text-foreground">Note: {item.reviewNote}</p>}
            <Actions item={item} busy={busyId === item.id} onApprove={() => decide(item, "APPROVED")} onReject={() => setRejecting(item)} full />
          </article>)}</div>
        </>}
      </>}

      {tab === "deductions" && <section className="crm-surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div><h2 className="text-sm font-semibold text-foreground">Salary deductions</h2><p className="mt-0.5 text-xs text-muted">Unpaid leave days to deduct from each person’s salary.</p></div>
          <div className="flex items-center gap-1 rounded-lg border bg-white p-1">
            <button type="button" onClick={() => setMonth((value) => shiftMonth(value, -1))} className="grid size-8 place-items-center rounded-md text-muted hover:bg-background" aria-label="Previous month"><ChevronLeft size={16} /></button>
            <span className="min-w-[116px] text-center text-xs font-semibold text-foreground" aria-live="polite">{monthLabel(month)}</span>
            <button type="button" onClick={() => setMonth((value) => shiftMonth(value, 1))} className="grid size-8 place-items-center rounded-md text-muted hover:bg-background" aria-label="Next month"><ChevronRight size={16} /></button>
          </div>
        </div>
        {!report && !error && <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-background" />)}</div>}
        {report && !report.rows.length && <div className="px-5 py-14 text-center"><p className="text-sm font-semibold text-foreground">No approved leave in {monthLabel(month)}</p><p className="mt-1 text-xs text-muted">Nothing to deduct for this month.</p></div>}
        {report && report.rows.length > 0 && <>
          <table className="hidden w-full text-left text-[13px] sm:table">
            <thead><tr className="border-b bg-background/60 text-xs text-muted"><th className="px-5 py-3 font-medium">Staff</th><th className="px-4 py-3 font-medium">Requests</th><th className="px-4 py-3 font-medium">Leave days</th><th className="px-4 py-3 font-medium">Paid</th><th className="px-5 py-3 text-right font-medium">Unpaid · deduct</th></tr></thead>
            <tbody className="divide-y">{report.rows.map((row) => <tr key={row.userId}><td className="px-5 py-3 font-medium text-foreground">{row.name}</td><td className="px-4 py-3 text-muted">{row.requests}</td><td className="px-4 py-3 text-muted">{row.days}</td><td className="px-4 py-3 text-success">{row.paid}</td><td className={cn("px-5 py-3 text-right font-semibold", row.unpaid ? "text-warning" : "text-subtle")}>{row.unpaid}</td></tr>)}</tbody>
            <tfoot><tr className="border-t bg-background/60 font-semibold text-foreground"><td className="px-5 py-3">Total · {plural(report.totals.staff, "person")}</td><td className="px-4 py-3" /><td className="px-4 py-3">{report.totals.days}</td><td className="px-4 py-3 text-success">{report.totals.paid}</td><td className="px-5 py-3 text-right text-warning">{report.totals.unpaid}</td></tr></tfoot>
          </table>
          <div className="divide-y sm:hidden">{report.rows.map((row) => <div key={row.userId} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{row.name}</p><p className="text-xs text-muted">{plural(row.days, "day")} · {row.paid} paid</p></div><span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", row.unpaid ? "bg-warning-soft text-warning" : "bg-background text-muted")}>{row.unpaid} to deduct</span></div>)}<div className="flex items-center justify-between bg-background/60 px-4 py-3 text-sm font-semibold text-foreground"><span>Total to deduct</span><span className="text-warning">{report.totals.unpaid} {report.totals.unpaid === 1 ? "day" : "days"}</span></div></div>
        </>}
      </section>}
    </div>

    {rejecting && <RejectModal item={rejecting} busy={busyId === rejecting.id} onClose={() => setRejecting(null)} onConfirm={(note) => decide(rejecting, "REJECTED", note)} />}
  </>;
}

function Actions({ item, busy, onApprove, onReject, full = false }: { item: LeaveItem; busy: boolean; onApprove: () => void; onReject: () => void; full?: boolean }) {
  if (item.status !== "PENDING") return item.reviewedAt ? <p className={cn("text-xs text-subtle", full ? "" : "text-right")}>{item.reviewedByName ? `${item.reviewedByName} · ` : ""}{longDate(item.reviewedAt)}</p> : null;
  return <div className={cn("flex gap-2", full ? "" : "justify-end")}>
    <button type="button" disabled={busy} onClick={onReject} className={cn("inline-flex h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-danger transition-colors hover:bg-red-50 disabled:opacity-50", full && "flex-1")}>Reject</button>
    <Button type="button" disabled={busy} onClick={onApprove} className={cn("h-10 px-3 text-xs", full && "flex-1")}>{busy && <LoaderCircle className="animate-spin" size={14} />}Approve</Button>
  </div>;
}

function RejectModal({ item, busy, onClose, onConfirm }: { item: LeaveItem; busy: boolean; onClose: () => void; onConfirm: (note: string) => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  return <Modal title="Reject leave request" subtitle={`${item.staff?.name ?? "Staff"} · ${rangeLabel(item.startDate, item.endDate)}`} onClose={() => !busy && onClose()} maxWidth="max-w-md">
    <form onSubmit={(event) => { event.preventDefault(); if (!note.trim()) { setError("Add the reason so the staff member knows why."); return; } onConfirm(note.trim()); }} className="space-y-4" noValidate>
      <Field label="Reason for rejecting *"><textarea value={note} onChange={(event) => { setNote(event.target.value); setError(""); }} rows={3} maxLength={500} placeholder="e.g. Month-end deliveries need the whole team" className={textarea} autoFocus /></Field>
      {error && <FormError message={error} />}
      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
        <button type="submit" disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-danger px-4 text-[13px] font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50 sm:h-10">{busy && <LoaderCircle className="animate-spin" size={16} />}{busy ? "Rejecting…" : "Reject request"}</button>
      </div>
    </form>
  </Modal>;
}
