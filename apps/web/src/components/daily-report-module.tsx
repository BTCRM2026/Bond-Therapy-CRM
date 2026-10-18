"use client";

import { CalendarDays, CheckCircle2, ClipboardCheck, Clock3, IndianRupee, Lock, LoaderCircle, MapPin, Plus, Search, Store, Trash2, TriangleAlert, UserRound } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CameraCapture } from "@/components/ui/camera-capture";
import { Input } from "@/components/ui/input";
import { SuccessToast } from "@/components/ui/toast";

type CallType = "EXISTING" | "NEW";
type CallResult = "ORDER" | "NO_ORDER" | "FOLLOW_UP";
type Client = { id: string; salonName: string; city: string; area: string | null };
type SavedCall = { id: string; visitActivityId: string | null; customerName: string; customerType: CallType; result: CallResult; orderValue: number | null; remark: string | null };
type SavedReport = { id: string; submittedAt: string; workingTown: string; coworkerId: string | null; tomorrowTown: string; tomorrowExtraStops: string[] | null; noOrderReason: string | null; calls: SavedCall[]; tomorrowClients: Client[]; summary: Summary };
type Visit = { activityId: string; stopId: string | null; clientId: string; salonName: string; city: string; checkInAt: string; checkOutAt: string | null; distanceMeters: number | null };
type ReportData = {
  date: string;
  visits: Visit[];
  staff: { id: string; name: string; headquarter: string | null };
  towns: string[];
  clients: Client[];
  coworkers: Array<{ id: string; name: string }>;
  report: SavedReport | null;
  recent: SavedReport[];
  performance: { monthNewCalls: number; monthlyTarget: number | null };
  rules: { fullDayCalls: number; halfDayCalls: number; deadlineAt: string; locked: boolean };
  gate: { blocked: boolean; approved: boolean; requiredDate: string | null; message: string | null };
};
type CallRow = { key: string; existingCallId?: string; customerName: string; customerType: CallType; result: CallResult; orderValue: string; remark: string; photo: File | null; captureToken?: string; photoUrl?: string };
type VisitInput = { result: CallResult; orderValue: string; remark: string };
type Summary = { totalCalls: number; productiveCalls: number; totalValue: number; newCalls: number };

const blankCall = (): CallRow => ({ key: crypto.randomUUID(), customerName: "", customerType: "NEW", result: "NO_ORDER", orderValue: "", remark: "", photo: null });
const blankVisit = (): VisitInput => ({ result: "NO_ORDER", orderValue: "", remark: "" });
const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const control = "h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-foreground outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10";
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? (Array.isArray((data as { message: unknown }).message) ? (data as { message: string[] }).message.join(" ") : String((data as { message: unknown }).message)) : fallback;

export function DailyReportModule() {
  const [data, setData] = useState<ReportData | null>(null);
  const [workingTown, setWorkingTown] = useState("");
  const [coworkerId, setCoworkerId] = useState("");
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [visitInputs, setVisitInputs] = useState<Record<string, VisitInput>>({});
  const [tomorrowTown, setTomorrowTown] = useState("");
  const [tomorrowClientIds, setTomorrowClientIds] = useState<string[]>([]);
  // Temporary: salons without a client profile yet can still be planned by name.
  const [tomorrowNewSalons, setTomorrowNewSalons] = useState<string[]>([]);
  const [newSalonInput, setNewSalonInput] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [noOrderReason, setNoOrderReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);

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
      setTomorrowNewSalons(next.report?.tomorrowExtraStops ?? []);
      setNoOrderReason(next.report?.noOrderReason ?? "");
      const saved = next.report?.calls ?? [];
      setVisitInputs(Object.fromEntries(next.visits.map((visit) => {
        const call = saved.find((item) => item.visitActivityId === visit.activityId);
        return [visit.activityId, call ? { result: call.result, orderValue: call.orderValue == null ? "" : String(call.orderValue), remark: call.remark ?? "" } : blankVisit()];
      })));
      setCalls(saved.filter((call) => !call.visitActivityId).map((call) => ({ key: call.id, existingCallId: call.id, customerName: call.customerName, customerType: call.customerType, result: call.result, orderValue: call.orderValue == null ? "" : String(call.orderValue), remark: call.remark ?? "", photo: null, photoUrl: `/api/daily-reports/calls/${call.id}/photo` })));
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load the daily report."); }
    finally { setLoading(false); }
  };

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  const visits = useMemo(() => data?.visits ?? [], [data]);
  const visitList = visits.map((visit) => ({ visit, input: visitInputs[visit.activityId] ?? blankVisit() }));
  const summary = useMemo<Summary>(() => {
    const all = [...visits.map((visit) => visitInputs[visit.activityId] ?? blankVisit()), ...calls];
    return {
      totalCalls: all.length,
      productiveCalls: all.filter((call) => call.result === "ORDER").length,
      totalValue: all.reduce((total, call) => total + (call.result === "ORDER" ? Number(call.orderValue || 0) : 0), 0),
      newCalls: calls.filter((call) => call.customerType === "NEW").length,
    };
  }, [calls, visits, visitInputs]);
  const monthNewCalls = Math.max(0, (data?.performance.monthNewCalls ?? 0) - (data?.report?.summary.newCalls ?? 0)) + summary.newCalls;
  const tomorrowClients = (data?.clients ?? []).filter((client) => client.city === tomorrowTown && (!clientSearch.trim() || `${client.salonName} ${client.area ?? ""}`.toLowerCase().includes(clientSearch.toLowerCase())));
  const hasOrder = summary.productiveCalls > 0;
  const locked = Boolean(data?.report);
  const openVisits = visits.filter((visit) => !visit.checkOutAt);

  const updateCall = (index: number, patch: Partial<CallRow>) => setCalls((current) => current.map((call, callIndex) => callIndex === index ? { ...call, ...patch } : call));
  const removeCall = (index: number) => setCalls((current) => current.filter((_, callIndex) => callIndex !== index));
  const updateVisit = (id: string, patch: Partial<VisitInput>) => setVisitInputs((current) => ({ ...current, [id]: { ...(current[id] ?? blankVisit()), ...patch } }));
  const toggleClient = (id: string) => setTomorrowClientIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const addNewSalon = () => {
    const name = newSalonInput.trim();
    if (name.length < 2) return;
    setTomorrowNewSalons((current) => current.some((item) => item.toLowerCase() === name.toLowerCase()) || current.length >= 15 ? current : [...current, name]);
    setNewSalonInput("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (locked) return setError("Today’s report is already submitted and locked.");
    if (openVisits.length) return setError(`Check out of ${openVisits.map((visit) => visit.salonName).join(", ")} from My Route before submitting.`);
    if (!workingTown) return setError("Select today’s working town.");
    if (!visits.length && !calls.length) return setError("You have no salon visits yet. Check in at a salon from My Route, or add a call below.");
    const badVisit = visitList.findIndex(({ input }) => input.result === "ORDER" && Number(input.orderValue) <= 0);
    if (badVisit >= 0) return setError(`Enter the order value for ${visitList[badVisit]!.visit.salonName}.`);
    const incomplete = calls.findIndex((call) => call.customerName.trim().length < 2 || (!call.photo && !call.photoUrl) || (call.result === "ORDER" && Number(call.orderValue) <= 0));
    if (incomplete >= 0) return setError(`Complete the name, result, order value and photo for extra call ${incomplete + 1}.`);
    if (!hasOrder && !noOrderReason.trim()) return setError("Tell us why no order was received today.");
    if (!tomorrowTown || (!tomorrowClientIds.length && !tomorrowNewSalons.length)) return setError("Select tomorrow’s town and at least one salon to visit.");
    setSaving(true);
    try {
      const form = new FormData();
      const visitCalls = visitList.map(({ visit, input }) => ({ visitActivityId: visit.activityId, customerName: visit.salonName, customerType: "EXISTING" as const, result: input.result, orderValue: input.result === "ORDER" ? Number(input.orderValue) : undefined, remark: input.remark.trim() || undefined }));
      const manualCalls = calls.map((call) => ({ existingCallId: call.existingCallId, captureToken: call.photo ? call.captureToken : undefined, customerName: call.customerName.trim(), customerType: call.customerType, result: call.result, orderValue: call.result === "ORDER" ? Number(call.orderValue) : undefined, remark: call.remark.trim() || undefined }));
      form.append("payload", JSON.stringify({ workingTown, coworkerId: coworkerId || undefined, calls: [...visitCalls, ...manualCalls], noOrderReason: hasOrder ? undefined : noOrderReason.trim(), tomorrowTown, tomorrowClientIds, tomorrowNewSalons: tomorrowNewSalons.length ? tomorrowNewSalons : undefined }));
      calls.forEach((call, index) => { if (call.photo) form.append(`photo-${visitCalls.length + index}`, call.photo); });
      const response = await fetch("/api/daily-reports/today", { method: "POST", body: form });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(json, "Unable to submit the daily report."));
      await load(); setNotice("Day submitted. Tomorrow’s route is ready.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit the daily report."); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="space-y-4"><div className="h-28 animate-pulse rounded-xl bg-white" /><div className="h-80 animate-pulse rounded-xl bg-white" /></div>;
  if (!data) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger">{error || "Unable to load the daily report."}</div>;

  return <form onSubmit={submit} className="mx-auto max-w-6xl space-y-5 pb-4">
    {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}
    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-danger" role="alert">{error}</div>}
    <DayRulesCard data={data} verified={visits.length} openVisits={openVisits.length} now={now} />
    <fieldset disabled={locked} className="m-0 min-w-0 space-y-5 border-0 p-0">

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
      <SectionHeader number="02" title="Salon visits today" subtitle="Recorded automatically when you check in at a salon. Just add the result." icon={MapPin} />
      {visitList.length === 0
        ? <div className="px-5 py-10 text-center"><MapPin size={24} className="mx-auto text-subtle" /><p className="mt-2 text-sm font-semibold text-foreground">No salon check-ins yet today</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">Open My Route, go to a salon and tap “I’ve arrived”. Your verified visits then appear here.</p><Link href="/dashboard/route" className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border bg-white px-4 text-[13px] font-semibold text-foreground hover:bg-background">Open My Route</Link></div>
        : <div className="divide-y">{visitList.map(({ visit, input }, index) => <VisitCard key={visit.activityId} visit={visit} input={input} index={index} onChange={(patch) => updateVisit(visit.activityId, patch)} />)}</div>}
    </section>

    <section className="crm-surface overflow-hidden">
      <SectionHeader number="03" title="Other calls" subtitle="Only for calls that are not on your route, such as a walk-in. A photo is needed. They do not count towards your 8 verified calls." icon={Store} action={<Button type="button" variant="secondary" onClick={() => setCalls((current) => [...current, blankCall()])}><Plus size={15} />Add call</Button>} />
      {calls.length === 0
        ? <p className="px-5 py-6 text-center text-xs text-muted">No extra calls. Your salon visits above are enough for most days.</p>
        : <div className="divide-y">{calls.map((call, index) => <CallCard key={call.key} call={call} index={index} canRemove onChange={(patch) => updateCall(index, patch)} onRemove={() => removeCall(index)} onError={setError} />)}</div>}
      <div className="border-t bg-background/50 p-3 sm:hidden"><Button type="button" variant="secondary" className="w-full" onClick={() => setCalls((current) => [...current, blankCall()])}><Plus size={15} />Add another call</Button></div>
    </section>

    <section className="crm-surface overflow-hidden">
      <SectionHeader number="04" title="Today’s summary" subtitle="Calculated automatically from your visits and calls." icon={ClipboardCheck} />
      <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
        <SummaryCell label="Total calls" value={summary.totalCalls} detail="Recorded today" />
        <SummaryCell label="Productive calls" value={summary.productiveCalls} detail="Calls with orders" />
        <SummaryCell label="Today’s value" value={money(summary.totalValue)} detail="Order value" />
        <SummaryCell label="New calls target" value={data.performance.monthlyTarget == null ? monthNewCalls : `${monthNewCalls} / ${data.performance.monthlyTarget}`} detail="This month" />
      </div>
      {!hasOrder && <div className="border-t bg-warning-soft/45 p-4 sm:p-5"><label className="block space-y-1.5"><span className="text-xs font-semibold text-foreground">Reason for no orders <b className="text-danger">*</b></span><Input value={noOrderReason} onChange={(event) => setNoOrderReason(event.target.value)} maxLength={500} placeholder="Briefly explain the main reason" required /></label></div>}
    </section>

    <section className="crm-surface overflow-hidden">
      <SectionHeader number="05" title="Tomorrow’s plan" subtitle="This automatically becomes tomorrow’s route in My Route." icon={CalendarDays} />
      <div className="grid min-h-0 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="border-b p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <label className="space-y-1.5"><span className="text-xs font-medium">Town <b className="text-danger">*</b></span><select className={control} value={tomorrowTown} onChange={(event) => { setTomorrowTown(event.target.value); setTomorrowClientIds([]); setClientSearch(""); }} required><option value="">Select town</option>{data.towns.map((town) => <option key={town}>{town}</option>)}</select></label>
          <div className="mt-4 rounded-lg bg-background p-3 text-xs text-muted"><MapPin size={15} className="mb-2 text-brand" /><strong className="text-foreground">{tomorrowClientIds.length + tomorrowNewSalons.length} salon{tomorrowClientIds.length + tomorrowNewSalons.length === 1 ? "" : "s"}</strong> planned for tomorrow.</div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" /><Input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} className="pl-9" placeholder="Search salons in selected town" disabled={!tomorrowTown} /></div>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {!tomorrowTown ? <EmptyPlan text="Select a town to see assigned salons." /> : tomorrowClients.length ? tomorrowClients.map((client) => <label key={client.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${tomorrowClientIds.includes(client.id) ? "border-brand/30 bg-brand-soft/45" : "hover:bg-background"}`}><input type="checkbox" checked={tomorrowClientIds.includes(client.id)} onChange={() => toggleClient(client.id)} className="size-4 shrink-0 accent-[var(--brand)]" /><span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{client.salonName}</span><span className="block truncate text-xs text-muted">{client.area || client.city}</span></span></label>) : <EmptyPlan text="No assigned salons match this town or search." />}
          </div>
          <div className="mt-4 rounded-lg border border-dashed bg-background p-3">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground">Salon without a client profile yet<span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning">Temporary</span></p>
            <p className="mt-1 text-[11px] leading-4 text-muted">Type the salon name to plan it. When you reach it, create its client profile so its GPS location is saved for future visits.</p>
            <div className="mt-2 flex gap-2"><Input value={newSalonInput} onChange={(event) => setNewSalonInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addNewSalon(); } }} maxLength={120} placeholder="Salon name" /><Button type="button" variant="secondary" onClick={addNewSalon} disabled={newSalonInput.trim().length < 2}>Add</Button></div>
            {tomorrowNewSalons.length > 0 && <ul className="mt-2.5 flex flex-wrap gap-1.5">{tomorrowNewSalons.map((name) => <li key={name} className="inline-flex items-center gap-1 rounded-full border bg-white py-1 pl-2.5 pr-1 text-xs text-foreground">{name}<button type="button" onClick={() => setTomorrowNewSalons((current) => current.filter((item) => item !== name))} className="grid size-5 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-danger" aria-label={`Remove ${name}`}><Trash2 size={11} /></button></li>)}</ul>}
          </div>
        </div>
      </div>
    </section>

    </fieldset>

    {!locked && <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom))] z-20 flex flex-col gap-2 rounded-xl border bg-white/95 p-3 shadow-[0_-6px_20px_rgba(29,39,48,0.06)] backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
      <p className="text-xs text-muted">{openVisits.length ? `Check out of ${openVisits.map((visit) => visit.salonName).join(", ")} from My Route first.` : "Submitting closes today and sets tomorrow’s route. It cannot be changed afterwards."}</p>
      <Button type="submit" disabled={saving || openVisits.length > 0} className="w-full sm:w-auto">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}{saving ? "Submitting…" : "Submit day"}</Button>
    </div>}
  </form>;
}

function DayRulesCard({ data, verified, openVisits, now }: { data: ReportData; verified: number; openVisits: number; now: number }) {
  const { fullDayCalls, halfDayCalls, deadlineAt, locked } = data.rules;
  const left = new Date(deadlineAt).getTime() - now;
  const late = left <= 0;
  const outcome = verified >= fullDayCalls ? "Full day" : verified >= halfDayCalls ? "Half day" : "Absent";
  const countdown = left > 3_600_000 ? `${Math.floor(left / 3_600_000)} h ${Math.floor((left % 3_600_000) / 60_000)} min left` : `${Math.max(0, Math.ceil(left / 60_000))} min left`;
  const percent = Math.min(100, Math.round((verified / fullDayCalls) * 100));
  return <section className="crm-surface overflow-hidden" aria-label="Today's rules">
    {data.gate.blocked && <div role="alert" className="flex items-start gap-2.5 border-b border-danger/20 bg-red-50 px-4 py-3 text-xs text-danger sm:px-5"><TriangleAlert size={15} className="mt-0.5 shrink-0" /><p>{data.gate.message}</p></div>}
    {locked
      ? <div className="flex items-start gap-3 bg-success-soft/50 px-4 py-4 sm:px-5"><Lock size={16} className="mt-0.5 shrink-0 text-success" /><div><p className="text-sm font-semibold text-foreground">Day submitted and locked</p><p className="mt-0.5 text-xs text-muted">{data.report?.submittedAt ? `Submitted at ${clock(data.report.submittedAt)}. ` : ""}Tomorrow’s route is ready in My Route.</p></div></div>
      : <div className="grid gap-4 p-4 sm:grid-cols-[1.2fr_1fr] sm:p-5">
        <div>
          <div className="flex items-baseline justify-between gap-3"><p className="text-xs font-semibold text-foreground">GPS-verified calls today</p><p className="text-sm font-semibold text-foreground">{verified} <span className="font-normal text-muted">of {fullDayCalls}</span></p></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-background" role="progressbar" aria-label="Verified calls" aria-valuemin={0} aria-valuemax={fullDayCalls} aria-valuenow={Math.min(verified, fullDayCalls)}><div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${percent}%` }} /></div>
          <p className="mt-2 text-xs text-muted">Counts as <strong className="text-foreground">{outcome}</strong> right now. {fullDayCalls} calls make a full day, {halfDayCalls} make a half day, fewer than {halfDayCalls} is an absent day.</p>
        </div>
        <div className={`rounded-lg px-3.5 py-3 ${late ? "bg-warning-soft/60" : "bg-background"}`}>
          <p className="flex items-center gap-2 text-xs font-semibold text-foreground"><Clock3 size={14} className={late ? "text-warning" : "text-brand"} />Submit by 11:00 PM</p>
          <p className="mt-1 text-xs text-muted">{late ? "The deadline has passed. Today can count as a half day at most." : `${countdown}. Late or missing means a half day, and you will need admin approval to start tomorrow.`}</p>
          {openVisits > 0 && <p className="mt-2 text-xs font-medium text-warning">{openVisits} {openVisits === 1 ? "visit is" : "visits are"} still checked in. Check out from My Route first.</p>}
        </div>
      </div>}
  </section>;
}

function VisitCard({ visit, input, index, onChange }: { visit: Visit; input: VisitInput; index: number; onChange: (patch: Partial<VisitInput>) => void }) {
  return <article className="p-4 sm:p-5">
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-dark">{index + 1}</span>
      <h3 className="min-w-0 truncate text-sm font-semibold">{visit.salonName}</h3>
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success"><CheckCircle2 size={11} />GPS verified</span>
      <span className="text-xs text-muted">Arrived {clock(visit.checkInAt)}{visit.checkOutAt ? ` · Left ${clock(visit.checkOutAt)}` : <span className="font-medium text-warning"> · still checked in</span>}</span>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
      <label className="space-y-1.5 xl:col-span-3"><span className="text-xs font-medium">Result</span><select className={control} value={input.result} onChange={(event) => onChange({ result: event.target.value as CallResult, orderValue: event.target.value === "ORDER" ? input.orderValue : "" })}><option value="ORDER">Order</option><option value="NO_ORDER">No order</option><option value="FOLLOW_UP">Follow-up</option></select></label>
      <label className="space-y-1.5 xl:col-span-3"><span className="text-xs font-medium">{input.result === "ORDER" ? "Order value *" : "Order value"}</span><div className="relative"><IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" /><Input className="pl-8" type="number" min="1" step="0.01" value={input.orderValue} onChange={(event) => onChange({ orderValue: event.target.value })} disabled={input.result !== "ORDER"} placeholder={input.result === "ORDER" ? "0" : "Not applicable"} /></div></label>
      <label className="space-y-1.5 md:col-span-2 xl:col-span-6"><span className="text-xs font-medium">Remark</span><Input value={input.remark} onChange={(event) => onChange({ remark: event.target.value })} maxLength={240} placeholder="One-line outcome or next action" /></label>
    </div>
  </article>;
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
  return <CameraCapture photo={call.photo} existingUrl={call.photoUrl} purpose="REPORT_CALL" facing="environment" label="Capture call photo *" hint="Opens the rear camera. Gallery photos are not accepted." maxBytes={2 * 1024 * 1024} onChange={(file, token) => onChange({ photo: file, captureToken: token, photoUrl: undefined })} onError={onError} />;
}
