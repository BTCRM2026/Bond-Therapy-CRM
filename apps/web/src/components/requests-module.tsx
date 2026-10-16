"use client";

import { ChevronRight, ClipboardList, LoaderCircle, Plus, Search } from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";
import { Modal } from "@/components/ui/modal";
import { SuccessToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Status = "SUBMITTED" | "NEEDS_INFO" | "APPROVED" | "REJECTED";
type EventType = "SUBMITTED" | "INFO_REQUESTED" | "REPLIED" | "APPROVED" | "REJECTED";
type Row = { id: string; requestNumber: string; title: string; status: Status; createdAt: string; decidedAt: string | null; requester: { id: string; name: string } };
type Detail = Row & { details: string; approvedValue: string | null; validUntil: string | null; decidedBy: { id: string; name: string } | null; events: Array<{ id: string; type: EventType; comment: string | null; createdAt: string; actorId: string; actorName: string }> };
type ListResponse = { items: Row[]; total: number; page: number; pageSize: number; hasMore: boolean; counts: Record<Status, number> };

const STATUS_LABEL: Record<Status, string> = { SUBMITTED: "Submitted", NEEDS_INFO: "Needs info", APPROVED: "Approved", REJECTED: "Rejected" };
const STATUS_TONE: Record<Status, string> = { SUBMITTED: "bg-brand-soft text-brand-dark", NEEDS_INFO: "bg-warning-soft text-warning", APPROVED: "bg-success-soft text-success", REJECTED: "bg-red-50 text-danger" };
const EVENT_LABEL: Record<EventType, string> = { SUBMITTED: "Request submitted", INFO_REQUESTED: "More information requested", REPLIED: "Replied", APPROVED: "Approved", REJECTED: "Rejected" };
const textarea = "w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-base leading-5 outline-none transition placeholder:text-subtle focus:border-brand focus:ring-2 focus:ring-brand/10 sm:text-[13px]";

const stamp = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const messageFrom = (data: unknown, fallback: string) => {
  const message = data && typeof data === "object" && "message" in data ? (data as { message: unknown }).message : null;
  return Array.isArray(message) ? message.join(" ") : typeof message === "string" ? message : fallback;
};
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/requests${path}`, { cache: "no-store", ...init });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(messageFrom(data, "Something went wrong. Please try again."));
  return data as T;
}
const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

function StatusBadge({ status }: { status: Status }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold", STATUS_TONE[status])}>{STATUS_LABEL[status]}</span>;
}

export function RequestsModule({ admin }: { admin: boolean }) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const sync = () => setHeaderSlot(document.getElementById("page-header-actions"));
    sync();
    const frame = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(frame);
  }, []);

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) query.set("status", status);
    if (search.trim()) query.set("search", search.trim());
    try { setData(await call<ListResponse>(`?${query}`)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load requests."); }
  }, [page, pageSize, status, search]);
  useEffect(() => { const timer = setTimeout(() => { load(); }, search ? 300 : 0); return () => clearTimeout(timer); }, [load, search]);

  const filter = (next: Status | "") => { setStatus((current) => (current === next ? "" : next)); setPage(1); };
  const counts = data?.counts;

  return <>
    {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}
    {!admin && headerSlot && createPortal(<Button onClick={() => setCreating(true)}><Plus size={16} /><span className="hidden sm:inline">New request</span><span className="sr-only sm:hidden">New request</span></Button>, headerSlot)}

    <div className="space-y-4">
      <KpiStrip columns={4}>
        <KpiCell label={admin ? "Awaiting decision" : "Submitted"} value={counts?.SUBMITTED ?? "–"} detail="Open requests" active={status === "SUBMITTED"} onClick={() => filter("SUBMITTED")} />
        <KpiCell label="Needs info" value={counts?.NEEDS_INFO ?? "–"} detail={admin ? "Waiting for staff reply" : "Waiting for your reply"} tone={counts?.NEEDS_INFO ? "warning" : "neutral"} active={status === "NEEDS_INFO"} onClick={() => filter("NEEDS_INFO")} />
        <KpiCell label="Approved" value={counts?.APPROVED ?? "–"} detail="Closed" tone="success" active={status === "APPROVED"} onClick={() => filter("APPROVED")} />
        <KpiCell label="Rejected" value={counts?.REJECTED ?? "–"} detail="Closed" active={status === "REJECTED"} onClick={() => filter("REJECTED")} />
      </KpiStrip>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={admin ? "Search by title, request ID or staff name" : "Search by title or request ID"} aria-label="Search requests" className="pl-9" />
        </label>
        {data && data.total > 0 && <CompactPagination page={data.page} pageSize={data.pageSize} total={data.total} hasMore={data.hasMore} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
      </div>

      {error && !data && <FormError message={error} />}
      {!data && !error && <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-white" />)}</div>}
      {data && !data.items.length && <section className="crm-surface px-5 py-14 text-center">
        <ClipboardList className="mx-auto text-subtle" size={26} />
        <p className="mt-3 text-sm font-semibold text-foreground">{search || status ? "No requests match your filters" : admin ? "No requests yet" : "You have not raised any requests"}</p>
        <p className="mt-1 text-xs text-muted">{search || status ? "Try a different search or clear the status filter." : admin ? "Requests raised by staff will appear here for your decision." : "Need a scheme, approval or support? Raise a request and track it here."}</p>
        {!admin && !search && !status && <Button className="mt-4" onClick={() => setCreating(true)}><Plus size={16} />New request</Button>}
      </section>}

      {data && data.items.length > 0 && <>
        <section className="crm-surface hidden overflow-hidden md:block">
          <table className="w-full text-left text-[13px]">
            <thead><tr className="border-b bg-background/60 text-xs font-medium text-muted"><th className="px-4 py-3 font-medium">Request ID</th><th className="px-4 py-3 font-medium">Title</th>{admin && <th className="px-4 py-3 font-medium">Staff</th>}<th className="px-4 py-3 font-medium">Submitted</th><th className="px-4 py-3 font-medium">Status</th><th className="w-10 px-2 py-3" /></tr></thead>
            <tbody className="divide-y">{data.items.map((row) => <tr key={row.id} onClick={() => setOpenId(row.id)} className="cursor-pointer transition-colors hover:bg-background/70">
              <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{row.requestNumber}</td>
              <td className="max-w-[320px] px-4 py-3"><button type="button" onClick={(event) => { event.stopPropagation(); setOpenId(row.id); }} className="block max-w-full truncate text-left font-medium text-foreground hover:text-brand focus-visible:outline-none focus-visible:underline">{row.title}</button></td>
              {admin && <td className="whitespace-nowrap px-4 py-3 text-muted">{row.requester.name}</td>}
              <td className="whitespace-nowrap px-4 py-3 text-muted">{stamp(row.createdAt)}</td>
              <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
              <td className="px-2 py-3 text-subtle"><ChevronRight size={16} /></td>
            </tr>)}</tbody>
          </table>
        </section>
        <div className="space-y-2 md:hidden">{data.items.map((row) => <button key={row.id} type="button" onClick={() => setOpenId(row.id)} className="crm-surface block w-full p-4 text-left transition-colors hover:bg-background/70">
          <div className="flex items-start justify-between gap-3"><p className="min-w-0 text-sm font-semibold leading-5 text-foreground">{row.title}</p><StatusBadge status={row.status} /></div>
          <p className="mt-1.5 text-xs text-muted">{row.requestNumber}{admin ? ` · ${row.requester.name}` : ""} · {day(row.createdAt)}</p>
        </button>)}</div>
      </>}
    </div>

    {creating && <NewRequestModal onClose={() => setCreating(false)} onCreated={(number) => { setCreating(false); setNotice(`Request ${number} submitted.`); setStatus(""); setSearch(""); setPage(1); load(); }} />}
    {openId && <DetailModal id={openId} admin={admin} onClose={() => setOpenId(null)} onChanged={(message) => { setNotice(message); load(); }} />}
  </>;
}

function NewRequestModal({ onClose, onCreated }: { onClose: () => void; onCreated: (requestNumber: string) => void }) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (title.trim().length < 3) { setError("Add a short title of at least 3 characters."); return; }
    if (details.trim().length < 5) { setError("Explain what you need and why."); return; }
    setSaving(true); setError("");
    try { const created = await call<Detail>("", post({ title, details })); onCreated(created.requestNumber); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit your request."); setSaving(false); }
  };
  return <Modal title="New request" subtitle="Request ID, your name, date and status are added automatically." onClose={onClose} maxWidth="max-w-lg">
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Title *">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="e.g. Need a 10% scheme on Brand X in Surat" className="text-base sm:text-sm" autoFocus />
        <span className="block text-right text-[11px] text-subtle">{title.length}/160</span>
      </Field>
      <Field label="Details *">
        <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={4000} rows={6} placeholder="What do you need, and why? Add any numbers or client names that help." className={textarea} />
        <span className="block text-right text-[11px] text-subtle">{details.length}/4000</span>
      </Field>
      {error && <FormError message={error} />}
      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving && <LoaderCircle className="animate-spin" size={16} />}{saving ? "Submitting…" : "Submit request"}</Button>
      </div>
    </form>
  </Modal>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-2"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>{children}</section>;
}

function DetailModal({ id, admin, onClose, onChanged }: { id: string; admin: boolean; onClose: () => void; onChanged: (message: string) => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [comment, setComment] = useState("");
  const [approvedValue, setApprovedValue] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { (async () => { try { setDetail(await call<Detail>(`/${id}`)); } catch (cause) { setLoadError(cause instanceof Error ? cause.message : "Unable to load this request."); } })(); }, [id]);

  const decide = async (decision: "APPROVE" | "REJECT" | "NEED_INFO") => {
    if (decision === "REJECT" && !comment.trim()) { setError("Add the reason for rejecting this request."); return; }
    if (decision === "NEED_INFO" && !comment.trim()) { setError("Tell the requester what information you need."); return; }
    setBusy(decision); setError("");
    try {
      const updated = await call<Detail>(`/${id}/decision`, post({ decision, comment: comment.trim() || undefined, approvedValue: decision === "APPROVE" ? approvedValue.trim() || undefined : undefined, validUntil: decision === "APPROVE" ? validUntil || undefined : undefined }));
      setDetail(updated); setComment(""); setApprovedValue(""); setValidUntil("");
      onChanged(decision === "APPROVE" ? `Request ${updated.requestNumber} approved.` : decision === "REJECT" ? `Request ${updated.requestNumber} rejected.` : `More information requested on ${updated.requestNumber}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save your decision."); }
    finally { setBusy(null); }
  };

  const reply = async () => {
    if (!comment.trim()) { setError("Type your reply first."); return; }
    setBusy("REPLY"); setError("");
    try { const updated = await call<Detail>(`/${id}/reply`, post({ comment: comment.trim() })); setDetail(updated); setComment(""); onChanged(`Reply sent on ${updated.requestNumber}.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to send your reply."); }
    finally { setBusy(null); }
  };

  const open = detail && (detail.status === "SUBMITTED" || detail.status === "NEEDS_INFO");
  const spinner = (key: string) => busy === key && <LoaderCircle className="animate-spin" size={15} />;

  return <Modal title={detail?.title ?? "Request"} subtitle={detail ? `${detail.requestNumber} · ${detail.requester.name} · ${stamp(detail.createdAt)}` : undefined} onClose={onClose} maxWidth="max-w-2xl">
    {loadError && <FormError message={loadError} />}
    {!detail && !loadError && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-background" />)}</div>}
    {detail && <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2"><StatusBadge status={detail.status} />{detail.decidedBy && detail.decidedAt && <span className="text-xs text-muted">{STATUS_LABEL[detail.status]} by {detail.decidedBy.name} on {day(detail.decidedAt)}</span>}</div>

      <Section title="Details"><p className="whitespace-pre-wrap break-words rounded-lg bg-background p-3 text-[13px] leading-5 text-foreground" style={{ overflowWrap: "anywhere" }}>{detail.details}</p></Section>

      {detail.status === "APPROVED" && (detail.approvedValue || detail.validUntil) && <Section title="Approval">
        <dl className="grid gap-3 rounded-lg border border-success/20 bg-success-soft/50 p-3 sm:grid-cols-2">
          {detail.approvedValue && <div><dt className="text-xs text-muted">Approved value</dt><dd className="mt-0.5 text-sm font-semibold text-foreground">{detail.approvedValue}</dd></div>}
          {detail.validUntil && <div><dt className="text-xs text-muted">Valid until</dt><dd className="mt-0.5 text-sm font-semibold text-foreground">{day(detail.validUntil)}</dd></div>}
        </dl>
      </Section>}

      <Section title="Activity"><ol className="space-y-3 border-l pl-4">{detail.events.map((event) => <li key={event.id} className="relative">
        <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-white bg-brand" aria-hidden="true" />
        <p className="text-[13px] font-medium text-foreground">{EVENT_LABEL[event.type]} <span className="font-normal text-muted">· {event.actorName}</span></p>
        <p className="text-[11px] text-subtle">{stamp(event.createdAt)}</p>
        {event.comment && <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-background px-3 py-2 text-[13px] leading-5 text-foreground" style={{ overflowWrap: "anywhere" }}>{event.comment}</p>}
      </li>)}</ol></Section>

      {open && admin && <Section title="Your decision">
        <div className="space-y-3 rounded-lg border p-3">
          <Field label="Comment"><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} maxLength={1000} placeholder="Required to reject or ask for more information. Optional when approving." className={textarea} /></Field>
          <details className="group rounded-lg bg-background px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-muted">Approval details <span className="text-subtle">· optional, for schemes and similar</span></summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Approved value"><Input value={approvedValue} onChange={(event) => setApprovedValue(event.target.value)} maxLength={120} placeholder="e.g. 10% on Brand X" className="text-base sm:text-sm" /></Field>
              <Field label="Valid until"><Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} className="text-base sm:text-sm" /></Field>
            </div>
          </details>
          {error && <FormError message={error} />}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" disabled={busy !== null} onClick={() => decide("REJECT")} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-[13px] font-semibold text-danger transition-colors hover:bg-red-50 disabled:opacity-50 sm:h-10">{spinner("REJECT")}Reject</button>
            <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => decide("NEED_INFO")}>{spinner("NEED_INFO")}Need more info</Button>
            <Button type="button" disabled={busy !== null} onClick={() => decide("APPROVE")}>{spinner("APPROVE")}Approve</Button>
          </div>
        </div>
      </Section>}

      {open && !admin && detail.status === "NEEDS_INFO" && <Section title="Your reply">
        <div className="space-y-3 rounded-lg border border-warning/30 bg-warning-soft/40 p-3">
          <p className="text-xs text-muted">The administrator asked for more information. Reply below and the request goes back for review.</p>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} maxLength={2000} placeholder="Type your reply" aria-label="Your reply" className={textarea} />
          {error && <FormError message={error} />}
          <div className="flex justify-end"><Button type="button" disabled={busy !== null} onClick={reply}>{spinner("REPLY")}Send reply</Button></div>
        </div>
      </Section>}

      {open && !admin && detail.status === "SUBMITTED" && <p className="rounded-lg bg-background px-3 py-2.5 text-xs text-muted">Your request is with the administrator. You will be notified if they need more information.</p>}
    </div>}
  </Modal>;
}
