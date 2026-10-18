"use client";

import { CalendarRange, Info, LoaderCircle, Plus } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";
import { Modal } from "@/components/ui/modal";
import { SuccessToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { type LeaveItem, type MonthSplit, PaySplit, StatusBadge, jsonInit, leaveApi, monthLabel, plural, rangeLabel } from "@/components/leave-shared";

type LeavePage = { items: LeaveItem[]; total: number; page: number; pageSize: number; hasMore: boolean };
type Summary = { month: string; paidAllowance: number; paidUsed: number; paidAvailable: number; unpaidDays: number; pending: number };
type Preview = { totalDays: number; paidDays: number; unpaidDays: number; months: MonthSplit[] };

const textarea = "w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-base leading-5 outline-none transition placeholder:text-subtle focus:border-brand focus:ring-2 focus:ring-brand/10 sm:text-[13px]";
const isoDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

export function LeaveStaff() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [data, setData] = useState<LeavePage | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const items = data?.items ?? null;
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const sync = () => setHeaderSlot(document.getElementById("page-header-actions"));
    sync();
    const frame = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(frame);
  }, []);

  const load = useCallback(async () => {
    try {
      const [nextSummary, nextPage] = await Promise.all([leaveApi<Summary>("/summary"), leaveApi<LeavePage>(`/mine?page=${page}&pageSize=${pageSize}`)]);
      if (!nextPage.items.length && page > 1) { setPage(page - 1); return; } setSummary(nextSummary); setData(nextPage); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load your leave."); }
  }, [page, pageSize]);
  useEffect(() => { (async () => { await load(); })(); }, [load]);

  const cancel = async (id: string) => {
    setBusyId(id);
    try { await leaveApi(`/${id}`, jsonInit("DELETE")); setConfirmId(null); setNotice("Leave request cancelled."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to cancel this request."); }
    finally { setBusyId(null); }
  };

  return <>
    {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}
    {headerSlot && createPortal(<Button onClick={() => setApplying(true)}><Plus size={16} /><span className="hidden sm:inline">Apply for leave</span><span className="sr-only sm:hidden">Apply for leave</span></Button>, headerSlot)}

    <div className="space-y-4">
      <KpiStrip columns={3}>
        <KpiCell label="Paid leave left" value={summary ? summary.paidAvailable : "–"} detail={summary ? `of ${summary.paidAllowance} in ${monthLabel(summary.month)}` : undefined} tone={summary && summary.paidAvailable > 0 ? "success" : "neutral"} />
        <KpiCell label="Unpaid days" value={summary ? summary.unpaidDays : "–"} detail="Approved this month" tone={summary && summary.unpaidDays > 0 ? "warning" : "neutral"} />
        <KpiCell label="Awaiting approval" value={summary ? summary.pending : "–"} detail="Pending requests" className="col-span-2 sm:col-span-1" />
      </KpiStrip>

      <div className="flex items-start gap-2.5 rounded-lg border bg-white px-4 py-3 text-xs leading-5 text-muted">
        <Info size={15} className="mt-0.5 shrink-0 text-brand" />
        <p>You get <span className="font-semibold text-foreground">1 paid leave every month</span>; it does not carry over. Every other leave day is <span className="font-semibold text-foreground">unpaid and deducted from your salary</span>. Weekly offs and holidays are not counted.</p>
      </div>

      {error && <FormError message={error} />}
      {!items && !error && <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-white" />)}</div>}
      {data && data.total === 0 && <section className="crm-surface px-5 py-14 text-center">
        <CalendarRange className="mx-auto text-subtle" size={26} />
        <p className="mt-3 text-sm font-semibold text-foreground">You haven’t applied for any leave</p>
        <p className="mt-1 text-xs text-muted">When you need time off, apply here and track the decision.</p>
        <Button className="mt-4" onClick={() => setApplying(true)}><Plus size={16} />Apply for leave</Button>
      </section>}

      {data && data.total > 0 && <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted">Your leave history</p><CompactPagination page={data.page} pageSize={data.pageSize} total={data.total} hasMore={data.hasMore} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /></div>}
      {items && items.length > 0 && <>
        <section className="crm-surface hidden overflow-hidden md:block">
          <table className="w-full text-left text-[13px]">
            <thead><tr className="border-b bg-background/60 text-xs text-muted"><th className="px-4 py-3 font-medium">Dates</th><th className="px-4 py-3 font-medium">Days</th><th className="px-4 py-3 font-medium">Pay</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Details</th></tr></thead>
            <tbody className="divide-y">{items.map((item) => <tr key={item.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{rangeLabel(item.startDate, item.endDate)}</td>
              <td className="px-4 py-3 text-muted">{item.totalDays}</td>
              <td className="px-4 py-3"><PaySplit item={item} /></td>
              <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
              <td className="max-w-[320px] px-4 py-3"><Details item={item} confirming={confirmId === item.id} busy={busyId === item.id} onAsk={() => setConfirmId(item.id)} onKeep={() => setConfirmId(null)} onCancel={() => cancel(item.id)} /></td>
            </tr>)}</tbody>
          </table>
        </section>
        <div className="space-y-2 md:hidden">{items.map((item) => <article key={item.id} className="crm-surface space-y-2.5 p-4">
          <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-foreground">{rangeLabel(item.startDate, item.endDate)}</p><StatusBadge status={item.status} /></div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted"><span>{plural(item.totalDays, "day")}</span><span aria-hidden="true">·</span><PaySplit item={item} /></div>
          <Details item={item} confirming={confirmId === item.id} busy={busyId === item.id} onAsk={() => setConfirmId(item.id)} onKeep={() => setConfirmId(null)} onCancel={() => cancel(item.id)} />
        </article>)}</div>
      </>}
    </div>

    {applying && <ApplyModal onClose={() => setApplying(false)} onDone={async () => { setApplying(false); setNotice("Leave request submitted for approval."); await load(); }} />}
  </>;
}

function Details({ item, confirming, busy, onAsk, onKeep, onCancel }: { item: LeaveItem; confirming: boolean; busy: boolean; onAsk: () => void; onKeep: () => void; onCancel: () => void }) {
  return <div className="space-y-1.5 text-xs">
    <p className="break-words text-muted" style={{ overflowWrap: "anywhere" }}>{item.reason}</p>
    {item.status !== "PENDING" && (item.reviewNote || item.reviewedByName) && <p className="break-words rounded-lg bg-background px-2.5 py-1.5 text-foreground" style={{ overflowWrap: "anywhere" }}><span className="text-muted">{item.reviewedByName ? `${item.reviewedByName}: ` : "Note: "}</span>{item.reviewNote ?? (item.status === "APPROVED" ? "Approved" : "Rejected")}</p>}
    {item.status === "PENDING" && (confirming
      ? <p className="flex flex-wrap items-center gap-2"><span className="text-muted">Cancel this request?</span><button type="button" disabled={busy} onClick={onCancel} className="font-semibold text-danger disabled:opacity-50">{busy ? "Cancelling…" : "Yes, cancel"}</button><button type="button" disabled={busy} onClick={onKeep} className="font-medium text-muted">Keep it</button></p>
      : <button type="button" onClick={onAsk} className="font-semibold text-muted underline-offset-2 hover:text-danger hover:underline">Cancel request</button>)}
  </div>;
}

function ApplyModal({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const [{ today, earliest }] = useState(() => ({ today: isoDate(new Date()), earliest: isoDate(new Date(Date.now() - 30 * 86_400_000)) }));
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const validRange = Boolean(start && end && end >= start);

  useEffect(() => {
    if (!validRange) return;
    let live = true;
    const timer = setTimeout(async () => {
      try { const result = await leaveApi<Preview>(`/preview?startDate=${start}&endDate=${end}`); if (live) { setPreview(result); setPreviewError(""); } }
      catch (cause) { if (live) { setPreview(null); setPreviewError(cause instanceof Error ? cause.message : "Unable to check these dates."); } }
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [start, end, validRange]);

  const changeStart = (value: string) => { setStart(value); if (end < value) setEnd(value); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < 3) { setError("Add a short reason for your leave."); return; }
    setSaving(true); setError("");
    try { await leaveApi("", jsonInit("POST", { startDate: start, endDate: end, reason })); await onDone(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit your request."); setSaving(false); }
  };
  const blocked = !validRange || !preview || preview.totalDays === 0;

  return <Modal title="Apply for leave" subtitle="Your request goes to the administrator for approval." onClose={onClose} maxWidth="max-w-lg">
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="From *"><Input type="date" value={start} min={earliest} onChange={(event) => changeStart(event.target.value)} className="text-base sm:text-sm" required /></Field>
        <Field label="To *"><Input type="date" value={end} min={start || earliest} onChange={(event) => setEnd(event.target.value)} className="text-base sm:text-sm" required /></Field>
      </div>

      <div className={cn("rounded-lg border px-3 py-2.5 text-xs", preview && preview.totalDays > 0 ? "bg-background" : "bg-white")} aria-live="polite">
        {!validRange && <p className="text-muted">Choose a valid date range.</p>}
        {validRange && !preview && !previewError && <p className="flex items-center gap-2 text-muted"><LoaderCircle className="animate-spin" size={13} />Checking these dates…</p>}
        {validRange && previewError && <p className="text-danger">{previewError}</p>}
        {validRange && preview && preview.totalDays === 0 && <p className="text-warning">These dates are weekly offs or holidays, so no leave is needed.</p>}
        {validRange && preview && preview.totalDays > 0 && <div className="space-y-2">
          <p className="font-semibold text-foreground">{plural(preview.totalDays, "leave day")}</p>
          <ul className="space-y-1">{preview.months.map((entry) => <li key={entry.month} className="flex flex-wrap items-center justify-between gap-2"><span className="text-muted">{monthLabel(entry.month)} · {plural(entry.days, "day")}</span><span className="flex gap-1.5">{entry.paid > 0 && <span className="rounded-full bg-success-soft px-2 py-0.5 font-semibold text-success">{entry.paid} paid</span>}{entry.unpaid > 0 && <span className="rounded-full bg-warning-soft px-2 py-0.5 font-semibold text-warning">{entry.unpaid} unpaid</span>}</span></li>)}</ul>
          {preview.unpaidDays > 0 && <p className="border-t pt-2 text-muted">{plural(preview.unpaidDays, "day")} will be unpaid and deducted from your salary.</p>}
          {preview.unpaidDays === 0 && <p className="border-t pt-2 text-muted">Fully covered by your paid leave.</p>}
        </div>}
      </div>

      <Field label="Reason *"><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} placeholder="Why do you need this leave?" className={textarea} /></Field>
      {error && <FormError message={error} />}
      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving || blocked}>{saving && <LoaderCircle className="animate-spin" size={16} />}{saving ? "Submitting…" : "Submit request"}</Button>
      </div>
    </form>
  </Modal>;
}
