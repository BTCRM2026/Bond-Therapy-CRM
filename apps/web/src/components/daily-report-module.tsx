"use client";

import { CalendarDays, Camera, CheckCircle2, ClipboardCheck, IndianRupee, LoaderCircle, MapPin, Plus, Search, Store, Trash2, UserRound } from "lucide-react";
import Image from "next/image";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SuccessToast } from "@/components/ui/toast";
import { prepareImageFile } from "@/lib/invoice-file";

type CallType = "EXISTING" | "NEW";
type CallResult = "ORDER" | "NO_ORDER" | "FOLLOW_UP";
type Client = { id: string; salonName: string; city: string; area: string | null };
type SavedCall = { id: string; customerName: string; customerType: CallType; result: CallResult; orderValue: number | null; remark: string | null };
type SavedReport = { id: string; workingTown: string; coworkerId: string | null; tomorrowTown: string; noOrderReason: string | null; calls: SavedCall[]; tomorrowClients: Client[]; summary: Summary };
type ReportData = {
  date: string;
  staff: { id: string; name: string; headquarter: string | null };
  towns: string[];
  clients: Client[];
  coworkers: Array<{ id: string; name: string }>;
  report: SavedReport | null;
  recent: SavedReport[];
  performance: { monthNewCalls: number; monthlyTarget: number | null };
};
type CallRow = { key: string; existingCallId?: string; customerName: string; customerType: CallType; result: CallResult; orderValue: string; remark: string; photo: File | null; photoUrl?: string };
type Summary = { totalCalls: number; productiveCalls: number; totalValue: number; newCalls: number };

const blankCall = (): CallRow => ({ key: crypto.randomUUID(), customerName: "", customerType: "EXISTING", result: "NO_ORDER", orderValue: "", remark: "", photo: null });
const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const control = "h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-foreground outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10";
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? (Array.isArray((data as { message: unknown }).message) ? (data as { message: string[] }).message.join(" ") : String((data as { message: unknown }).message)) : fallback;

export function DailyReportModule() {
  const [data, setData] = useState<ReportData | null>(null);
  const [workingTown, setWorkingTown] = useState("");
  const [coworkerId, setCoworkerId] = useState("");
  const [calls, setCalls] = useState<CallRow[]>([blankCall()]);
  const [tomorrowTown, setTomorrowTown] = useState("");
  const [tomorrowClientIds, setTomorrowClientIds] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [noOrderReason, setNoOrderReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/daily-reports/today", { cache: "no-store" });
      const json = await response.json().catch(() => null) as ReportData | { message?: string } | null;
      if (!response.ok) throw new Error(messageFrom(json, "Unable to load the daily report."));
      const next = json as ReportData;
      setData(next);
      setWorkingTown(next.report?.workingTown ?? next.towns[0] ?? "");
      setCoworkerId(next.report?.coworkerId ?? "");
      setTomorrowTown(next.report?.tomorrowTown ?? "");
      setTomorrowClientIds(next.report?.tomorrowClients.map((client) => client.id) ?? []);
      setNoOrderReason(next.report?.noOrderReason ?? "");
      setCalls(next.report?.calls.length ? next.report.calls.map((call) => ({ key: call.id, existingCallId: call.id, customerName: call.customerName, customerType: call.customerType, result: call.result, orderValue: call.orderValue == null ? "" : String(call.orderValue), remark: call.remark ?? "", photo: null, photoUrl: `/api/daily-reports/calls/${call.id}/photo` })) : [blankCall()]);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load the daily report."); }
    finally { setLoading(false); }
  };

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  const summary = useMemo<Summary>(() => ({
    totalCalls: calls.length,
    productiveCalls: calls.filter((call) => call.result === "ORDER").length,
    totalValue: calls.reduce((total, call) => total + (call.result === "ORDER" ? Number(call.orderValue || 0) : 0), 0),
    newCalls: calls.filter((call) => call.customerType === "NEW").length,
  }), [calls]);
  const monthNewCalls = Math.max(0, (data?.performance.monthNewCalls ?? 0) - (data?.report?.summary.newCalls ?? 0)) + summary.newCalls;
  const tomorrowClients = (data?.clients ?? []).filter((client) => client.city === tomorrowTown && (!clientSearch.trim() || `${client.salonName} ${client.area ?? ""}`.toLowerCase().includes(clientSearch.toLowerCase())));
  const hasOrder = calls.some((call) => call.result === "ORDER");

  const updateCall = (index: number, patch: Partial<CallRow>) => setCalls((current) => current.map((call, callIndex) => callIndex === index ? { ...call, ...patch } : call));
  const removeCall = (index: number) => setCalls((current) => current.filter((_, callIndex) => callIndex !== index));
  const toggleClient = (id: string) => setTomorrowClientIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (!workingTown) return setError("Select today’s working town.");
    if (!calls.length) return setError("Add at least one call.");
    const incomplete = calls.findIndex((call) => call.customerName.trim().length < 2 || (!call.photo && !call.photoUrl) || (call.result === "ORDER" && Number(call.orderValue) <= 0));
    if (incomplete >= 0) return setError(`Complete the name, result, order value and photo for call ${incomplete + 1}.`);
    if (!hasOrder && !noOrderReason.trim()) return setError("Tell us why no order was received today.");
    if (!tomorrowTown || !tomorrowClientIds.length) return setError("Select tomorrow’s town and at least one customer to visit.");
    setSaving(true);
    try {
      const form = new FormData();
      form.append("payload", JSON.stringify({ workingTown, coworkerId: coworkerId || undefined, calls: calls.map((call) => ({ existingCallId: call.existingCallId, customerName: call.customerName.trim(), customerType: call.customerType, result: call.result, orderValue: call.result === "ORDER" ? Number(call.orderValue) : undefined, remark: call.remark.trim() || undefined })), noOrderReason: hasOrder ? undefined : noOrderReason.trim(), tomorrowTown, tomorrowClientIds }));
      calls.forEach((call, index) => { if (call.photo) form.append(`photo-${index}`, call.photo); });
      const response = await fetch("/api/daily-reports/today", { method: "POST", body: form });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(json, "Unable to submit the daily report."));
      await load(); setNotice("Daily report submitted and tomorrow’s route is ready.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit the daily report."); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="space-y-4"><div className="h-28 animate-pulse rounded-xl bg-white" /><div className="h-80 animate-pulse rounded-xl bg-white" /></div>;
  if (!data) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger">{error || "Unable to load the daily report."}</div>;

  return <form onSubmit={submit} className="mx-auto max-w-6xl space-y-5 pb-4">
    {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}
    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-danger" role="alert">{error}</div>}

    <section className="crm-surface overflow-hidden">
      <SectionHeader number="01" title="Basic information" subtitle="Your identity is filled from the Staff Portal." icon={UserRound} />
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
        <ReadOnlyField label="Date" value={new Date(`${data.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} />
        <ReadOnlyField label="BDE name" value={data.staff.name} />
        <ReadOnlyField label="Headquarter" value={data.staff.headquarter ?? "Not assigned"} />
        <label className="space-y-1.5"><span className="text-xs font-medium">Working town <b className="text-danger">*</b></span><select className={control} value={workingTown} onChange={(event) => setWorkingTown(event.target.value)} required><option value="">Select town</option>{data.towns.map((town) => <option key={town}>{town}</option>)}</select></label>
        <label className="space-y-1.5 sm:col-span-2 lg:col-span-4"><span className="text-xs font-medium">Co-working with</span><select className={control} value={coworkerId} onChange={(event) => setCoworkerId(event.target.value)}><option value="">Solo</option>{data.coworkers.map((coworker) => <option key={coworker.id} value={coworker.id}>{coworker.name}</option>)}</select></label>
      </div>
    </section>

    <section className="crm-surface overflow-hidden">
      <SectionHeader number="02" title="Calls done today" subtitle="Add one clear record and one proof photo for every customer call." icon={Store} action={<Button type="button" variant="secondary" onClick={() => setCalls((current) => [...current, blankCall()])}><Plus size={15} />Add call</Button>} />
      <div className="divide-y">
        {calls.map((call, index) => <CallCard key={call.key} call={call} index={index} canRemove={calls.length > 1} onChange={(patch) => updateCall(index, patch)} onRemove={() => removeCall(index)} onError={setError} />)}
      </div>
      <div className="border-t bg-background/50 p-3 sm:hidden"><Button type="button" variant="secondary" className="w-full" onClick={() => setCalls((current) => [...current, blankCall()])}><Plus size={15} />Add another call</Button></div>
    </section>

    <section className="crm-surface overflow-hidden">
      <SectionHeader number="03" title="Today’s summary" subtitle="Calculated automatically from the call records above." icon={ClipboardCheck} />
      <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
        <SummaryCell label="Total calls" value={summary.totalCalls} detail="Recorded today" />
        <SummaryCell label="Productive calls" value={summary.productiveCalls} detail="Calls with orders" />
        <SummaryCell label="Today’s value" value={money(summary.totalValue)} detail="Order value" />
        <SummaryCell label="New calls target" value={data.performance.monthlyTarget == null ? monthNewCalls : `${monthNewCalls} / ${data.performance.monthlyTarget}`} detail="This month" />
      </div>
      {!hasOrder && <div className="border-t bg-warning-soft/45 p-4 sm:p-5"><label className="block space-y-1.5"><span className="text-xs font-semibold text-foreground">Reason for no orders <b className="text-danger">*</b></span><Input value={noOrderReason} onChange={(event) => setNoOrderReason(event.target.value)} maxLength={500} placeholder="Briefly explain the main reason" required /></label></div>}
    </section>

    <section className="crm-surface overflow-hidden">
      <SectionHeader number="04" title="Tomorrow’s plan" subtitle="This automatically becomes tomorrow’s confirmed route." icon={CalendarDays} />
      <div className="grid min-h-0 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="border-b p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <label className="space-y-1.5"><span className="text-xs font-medium">Town <b className="text-danger">*</b></span><select className={control} value={tomorrowTown} onChange={(event) => { setTomorrowTown(event.target.value); setTomorrowClientIds([]); setClientSearch(""); }} required><option value="">Select town</option>{data.towns.map((town) => <option key={town}>{town}</option>)}</select></label>
          <div className="mt-4 rounded-lg bg-background p-3 text-xs text-muted"><MapPin size={15} className="mb-2 text-brand" /><strong className="text-foreground">{tomorrowClientIds.length} customer{tomorrowClientIds.length === 1 ? "" : "s"}</strong> selected for tomorrow.</div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" /><Input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} className="pl-9" placeholder="Search customers in selected town" disabled={!tomorrowTown} /></div>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {!tomorrowTown ? <EmptyPlan text="Select a town to see assigned customers." /> : tomorrowClients.length ? tomorrowClients.map((client) => <label key={client.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${tomorrowClientIds.includes(client.id) ? "border-brand/30 bg-brand-soft/45" : "hover:bg-background"}`}><input type="checkbox" checked={tomorrowClientIds.includes(client.id)} onChange={() => toggleClient(client.id)} className="size-4 shrink-0 accent-[var(--brand)]" /><span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{client.salonName}</span><span className="block truncate text-xs text-muted">{client.area || client.city}</span></span></label>) : <EmptyPlan text="No assigned customers match this town or search." />}
          </div>
        </div>
      </div>
    </section>

    <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom))] z-20 flex flex-col gap-2 rounded-xl border bg-white/95 p-3 shadow-[0_-6px_20px_rgba(29,39,48,0.06)] backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
      <p className="text-xs text-muted">Submitting updates today’s report and tomorrow’s route.</p>
      <Button type="submit" disabled={saving} className="w-full sm:w-auto">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}{saving ? "Submitting…" : data.report ? "Update daily report" : "Submit daily report"}</Button>
    </div>
  </form>;
}

function SectionHeader({ number, title, subtitle, icon: Icon, action }: { number: string; title: string; subtitle: string; icon: typeof Store; action?: ReactNode }) {
  return <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5"><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Icon size={17} /></span><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[10px] font-semibold text-subtle">{number}</span><h2 className="text-sm font-semibold text-foreground">{title}</h2></div><p className="mt-0.5 text-xs text-muted">{subtitle}</p></div></div>{action && <div className="hidden shrink-0 sm:block">{action}</div>}</div>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-medium text-muted">{label}</p><p className="mt-1.5 flex h-10 items-center rounded-lg border bg-background px-3 text-[13px] font-medium text-foreground">{value}</p></div>; }
function SummaryCell({ label, value, detail }: { label: string; value: string | number; detail: string }) { return <div className="p-4 sm:p-5"><p className="text-[11px] font-medium text-muted">{label}</p><p className="mt-1 text-xl font-semibold text-foreground">{value}</p><p className="mt-0.5 text-[11px] text-subtle">{detail}</p></div>; }
function EmptyPlan({ text }: { text: string }) { return <div className="rounded-lg border border-dashed bg-background px-4 py-8 text-center text-xs text-muted">{text}</div>; }

function CallCard({ call, index, canRemove, onChange, onRemove, onError }: { call: CallRow; index: number; canRemove: boolean; onChange: (patch: Partial<CallRow>) => void; onRemove: () => void; onError: (message: string) => void }) {
  return <article className="p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-dark">{index + 1}</span><h3 className="text-sm font-semibold">Customer call</h3></div>{canRemove && <button type="button" onClick={onRemove} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-danger" aria-label={`Remove call ${index + 1}`}><Trash2 size={16} /></button>}</div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
    <label className="space-y-1.5 xl:col-span-4"><span className="text-xs font-medium">Customer or shop name <b className="text-danger">*</b></span><Input value={call.customerName} onChange={(event) => onChange({ customerName: event.target.value })} maxLength={160} placeholder="Enter customer or shop" required /></label>
    <label className="space-y-1.5 xl:col-span-2"><span className="text-xs font-medium">Type</span><select className={control} value={call.customerType} onChange={(event) => onChange({ customerType: event.target.value as CallType })}><option value="EXISTING">Existing</option><option value="NEW">New</option></select></label>
    <label className="space-y-1.5 xl:col-span-2"><span className="text-xs font-medium">Result</span><select className={control} value={call.result} onChange={(event) => onChange({ result: event.target.value as CallResult, orderValue: event.target.value === "ORDER" ? call.orderValue : "" })}><option value="ORDER">Order</option><option value="NO_ORDER">No order</option><option value="FOLLOW_UP">Follow-up</option></select></label>
    <label className="space-y-1.5 xl:col-span-4"><span className="text-xs font-medium">{call.result === "ORDER" ? "Order value *" : "Order value"}</span><div className="relative"><IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" /><Input className="pl-8" type="number" min="1" step="0.01" value={call.orderValue} onChange={(event) => onChange({ orderValue: event.target.value })} disabled={call.result !== "ORDER"} placeholder={call.result === "ORDER" ? "0" : "Not applicable"} required={call.result === "ORDER"} /></div></label>
    <label className="space-y-1.5 md:col-span-2 xl:col-span-7"><span className="text-xs font-medium">Remark</span><Input value={call.remark} onChange={(event) => onChange({ remark: event.target.value })} maxLength={240} placeholder="One-line outcome or next action" /></label>
    <div className="md:col-span-2 xl:col-span-5"><CallPhoto call={call} onChange={onChange} onError={onError} /></div>
  </div></article>;
}

function CallPhoto({ call, onChange, onError }: { call: CallRow; onChange: (patch: Partial<CallRow>) => void; onError: (message: string) => void }) {
  const [preparing, setPreparing] = useState(false);
  const localPreview = useMemo(() => call.photo ? URL.createObjectURL(call.photo) : "", [call.photo]);
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);
  const preview = localPreview || call.photoUrl;
  const select = async (file?: File) => {
    if (!file) return;
    setPreparing(true); onError("");
    const prepared = await prepareImageFile(file, 1280, 0.72, 300 * 1024);
    if (prepared.size > 2 * 1024 * 1024) onError("The call photo is still too large. Please retake it.");
    else onChange({ photo: prepared, photoUrl: undefined });
    setPreparing(false);
  };
  const input = <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => void select(event.target.files?.[0])} />;
  if (!preview) return <label className="flex h-20 cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-background px-4 transition hover:border-brand/35"><span className="grid size-10 shrink-0 place-items-center rounded-lg border bg-white text-brand"><Camera size={18} /></span><span><span className="block text-xs font-semibold text-foreground">{preparing ? "Optimizing photo…" : "Capture call photo *"}</span><span className="mt-0.5 block text-[11px] text-muted">Rear camera · automatically resized</span></span>{input}</label>;
  return <div className="flex min-h-20 items-center gap-3 rounded-lg border bg-background p-2"><div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-white"><Image src={preview} alt="Call proof" fill sizes="64px" className="object-cover" unoptimized /></div><div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 text-xs font-semibold text-success"><CheckCircle2 size={14} />Photo ready</p><label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-foreground"><Camera size={13} />Retake{input}</label></div></div>;
}
