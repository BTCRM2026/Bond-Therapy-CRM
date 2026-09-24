"use client";

import { AlertTriangle, ArrowDown, ArrowUp, Calendar, Camera, CheckCircle2, Clock3, LoaderCircle, MapPin, Plus, RotateCcw, Star, Trash2, X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SuccessToast } from "@/components/ui/toast";

type Salon = { id: string; salonName: string; city: string; area: string | null; potential: string | null; beat: { id: string; name: string } | null };
type Activity = { id: string; checkInAt: string | null; checkOutAt: string | null; visitOutcome: string | null; status: string; note: string | null };
type RouteStop = { id: string; clientId: string; sequence: number; plannedTime: string | null; status: "PLANNED" | "VISITED" | "UNABLE_TO_MEET" | "RESCHEDULED" | "REMOVED"; note: string | null; client: { id: string; salonName: string; city: string; area: string | null; primaryContact: string; potential: string | null; latitude: string | null; longitude: string | null }; activity: Activity | null };
type RouteData = { id: string | null; staffId: string; routeDate: string; status: "DRAFT" | "PLANNED" | "IN_PROGRESS" | "PARTIALLY_COMPLETED" | "COMPLETED" | "CANCELLED"; notes: string | null; stops: RouteStop[] };

const OUTCOMES = [
  { value: "PRODUCTIVE", label: "Productive" },
  { value: "ORDER_GENERATED", label: "Order generated" },
  { value: "QUOTATION_REQUIRED", label: "Quotation required" },
  { value: "FOLLOW_UP_REQUIRED", label: "Follow-up required" },
  { value: "OWNER_UNAVAILABLE", label: "Owner unavailable" },
  { value: "CLOSED", label: "Closed" },
  { value: "NOT_INTERESTED", label: "Not interested" },
  { value: "RESCHEDULED", label: "Rescheduled" },
  { value: "OTHER", label: "Other" },
] as const;

const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback;
const timeOf = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : null;
const dayLabel = (dateStr: string) => new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

export function RoutePlanner() {
  const today = useMemo(() => dateKey(new Date()), []);
  const tomorrow = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); return dateKey(d); }, []);
  const [tab, setTab] = useState<"today" | "tomorrow">("today");
  const [salons, setSalons] = useState<Salon[]>([]);
  const [routes, setRoutes] = useState<Record<string, RouteData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [visiting, setVisiting] = useState<RouteStop | null>(null);
  const [starting, setStarting] = useState<RouteStop | null>(null);
  const [resolving, setResolving] = useState<{ stop: RouteStop; mode: "UNABLE_TO_MEET" | "RESCHEDULED" } | null>(null);

  const load = async () => {
    try {
      const [salonsRes, todayRes, tomorrowRes] = await Promise.all([fetch("/api/routes/salons", { cache: "no-store" }), fetch(`/api/routes/${today}`, { cache: "no-store" }), fetch(`/api/routes/${tomorrow}`, { cache: "no-store" })]);
      const salonsData = await salonsRes.json().catch(() => null);
      if (!salonsRes.ok) throw new Error(messageFrom(salonsData, "Unable to load your assigned salons."));
      setSalons(salonsData as Salon[]);
      const todayData = await todayRes.json().catch(() => null);
      const tomorrowData = await tomorrowRes.json().catch(() => null);
      if (!todayRes.ok || !tomorrowRes.ok) throw new Error("Unable to load your route.");
      setRoutes({ [today]: todayData as RouteData, [tomorrow]: tomorrowData as RouteData });
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load your route."); }
    finally { setLoading(false); }
  };
  useEffect(() => { (async () => { await load(); })(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveStops = async (date: string, stops: Array<{ clientId: string; plannedTime: string | null }>) => {
    const response = await fetch(`/api/routes/${date}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stops: stops.map((stop) => ({ clientId: stop.clientId, plannedTime: stop.plannedTime ? `${date}T${stop.plannedTime}:00` : undefined })) }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(messageFrom(data, "Unable to save this route."));
    setRoutes((current) => ({ ...current, [date]: data as RouteData }));
  };

  const submitRoute = async (date: string) => {
    try {
      const response = await fetch(`/api/routes/${date}/submit`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to submit this route."));
      await load();
      setNotice(`Route for ${dayLabel(date)} confirmed.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit this route."); }
  };

  const resolveStop = async (date: string, stopId: string, status: "UNABLE_TO_MEET" | "RESCHEDULED", reason: string, rescheduleDate?: string) => {
    try {
      const response = await fetch(`/api/routes/${date}/stops/${stopId}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, reason: reason || undefined, rescheduleDate }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to update this visit."));
      setResolving(null);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update this visit."); }
  };

  const removeStop = async (date: string, stopId: string) => {
    try {
      const response = await fetch(`/api/routes/${date}/stops/${stopId}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "REMOVED" }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to remove this stop."));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to remove this stop."); }
  };

  if (loading) return <div className="space-y-3"><div className="h-11 w-56 animate-pulse rounded-lg bg-background" /><div className="h-64 animate-pulse rounded-xl bg-background" /></div>;

  const activeDate = tab === "today" ? today : tomorrow;
  const route = routes[activeDate];

  return <div className="space-y-4">
    {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}
    <div className="flex gap-1 rounded-lg border bg-white p-1">
      <button type="button" onClick={() => setTab("today")} className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${tab === "today" ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background"}`}>Today · {dayLabel(today)}</button>
      <button type="button" onClick={() => setTab("tomorrow")} className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${tab === "tomorrow" ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background"}`}>Tomorrow · {dayLabel(tomorrow)}</button>
    </div>

    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}

    {route && (tab === "tomorrow"
      ? <RouteBuilder date={activeDate} route={route} salons={salons} onSave={saveStops} onSubmit={() => submitRoute(activeDate)} />
      : <TodayRoute date={activeDate} route={route} salons={salons} onSave={saveStops} onStart={setStarting} onComplete={setVisiting} onResolve={(stop, mode) => setResolving({ stop, mode })} onRemove={(stopId) => removeStop(activeDate, stopId)} />)}

    {starting && <StartVisitModal stop={starting} date={today} onClose={() => setStarting(null)} onDone={async () => { setStarting(null); await load(); setNotice("Visit check-in recorded."); }} />}
    {visiting && <CompleteVisitModal stop={visiting} date={today} onClose={() => setVisiting(null)} onDone={async () => { setVisiting(null); await load(); setNotice("Visit recorded."); }} />}
    {resolving && <ResolveStopModal stop={resolving.stop} mode={resolving.mode} onClose={() => setResolving(null)} onConfirm={(reason, rescheduleDate) => resolveStop(today, resolving.stop.id, resolving.mode, reason, rescheduleDate)} />}
  </div>;
}

function activeStops(route: RouteData) { return route.stops.filter((stop) => stop.status !== "REMOVED").sort((a, b) => a.sequence - b.sequence); }

function RouteBuilder({ date, route, salons, onSave, onSubmit }: { date: string; route: RouteData; salons: Salon[]; onSave: (date: string, stops: Array<{ clientId: string; plannedTime: string | null }>) => Promise<void>; onSubmit: () => void }) {
  const initial = activeStops(route).map((stop) => ({ clientId: stop.clientId, plannedTime: stop.plannedTime ? new Date(stop.plannedTime).toTimeString().slice(0, 5) : "" }));
  const [picks, setPicks] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const salonMap = useMemo(() => new Map(salons.map((salon) => [salon.id, salon])), [salons]);
  const available = salons.filter((salon) => !picks.some((pick) => pick.clientId === salon.id));

  const move = (index: number, delta: number) => setPicks((current) => { const next = [...current]; const target = index + delta; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; });
  const remove = (index: number) => setPicks((current) => current.filter((_, i) => i !== index));
  const add = (clientId: string) => { setPicks((current) => [...current, { clientId, plannedTime: "" }]); setPicking(false); };
  const setTime = (index: number, value: string) => setPicks((current) => current.map((pick, i) => i === index ? { ...pick, plannedTime: value } : pick));

  const save = async () => { setSaving(true); try { await onSave(date, picks); } finally { setSaving(false); } };
  const dirty = JSON.stringify(picks) !== JSON.stringify(initial);

  return <section className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
      <div><h2 className="text-sm font-semibold text-foreground">{dayLabel(date)}</h2><p className="mt-0.5 text-xs text-muted">{picks.length} salon{picks.length === 1 ? "" : "s"} planned</p></div>
      <RouteStatusBadge status={route.status} />
    </div>
    {picks.length === 0 ? <div className="px-5 py-10 text-center"><Calendar className="mx-auto text-subtle" size={26} /><p className="mt-3 text-sm font-semibold text-foreground">No salons added yet</p><p className="mt-1 text-xs text-muted">Add salons from your assigned list to plan this route.</p></div>
      : <div className="divide-y">{picks.map((pick, index) => { const salon = salonMap.get(pick.clientId); return <div key={pick.clientId} className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-background text-xs font-bold text-muted">{index + 1}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{salon?.salonName ?? "Salon"}</p><p className="mt-0.5 truncate text-xs text-muted">{[salon?.area, salon?.city].filter(Boolean).join(" · ")}</p></div>
        </div>
        <div className="flex items-center gap-2 pl-10 sm:shrink-0 sm:pl-0">
          <input type="time" value={pick.plannedTime} onChange={(event) => setTime(index, event.target.value)} className="h-9 w-full min-w-0 flex-1 rounded-lg border bg-white px-2 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:w-28 sm:flex-none" />
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-background disabled:opacity-30" aria-label="Move up"><ArrowUp size={14} /></button>
            <button type="button" disabled={index === picks.length - 1} onClick={() => move(index, 1)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-background disabled:opacity-30" aria-label="Move down"><ArrowDown size={14} /></button>
            <button type="button" onClick={() => remove(index)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-danger" aria-label="Remove"><Trash2 size={14} /></button>
          </div>
        </div>
      </div>; })}</div>}
    <div className="space-y-3 border-t p-4 sm:p-5">
      {picking ? <div className="rounded-lg border bg-background p-3">
        {available.length === 0 ? <p className="px-1 py-2 text-xs text-muted">All your assigned salons are already on this route.</p> : <div className="max-h-56 space-y-1 overflow-y-auto">{available.map((salon) => <button key={salon.id} type="button" onClick={() => add(salon.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-white"><span className="min-w-0"><span className="block truncate font-medium text-foreground">{salon.salonName}</span><span className="block truncate text-muted">{[salon.area, salon.city].filter(Boolean).join(" · ")}</span></span>{salon.potential === "HIGH" && <Star size={12} className="shrink-0 fill-warning text-warning" />}</button>)}</div>}
        <Button type="button" variant="secondary" className="mt-2 h-8 w-full text-xs" onClick={() => setPicking(false)}>Close</Button>
      </div> : <Button type="button" variant="secondary" onClick={() => setPicking(true)}><Plus size={15} />Add salon</Button>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={saving || !dirty} onClick={save}>{saving && <LoaderCircle className="animate-spin" size={16} />}{saving ? "Saving…" : "Save route"}</Button>
        <Button type="button" disabled={picks.length === 0 || route.status !== "DRAFT" || dirty} onClick={onSubmit}>{route.status === "DRAFT" ? "Confirm route" : "Route confirmed"}</Button>
      </div>
    </div>
  </section>;
}

function TodayRoute({ date, route, salons, onSave, onStart, onComplete, onResolve, onRemove }: { date: string; route: RouteData; salons: Salon[]; onSave: (date: string, stops: Array<{ clientId: string; plannedTime: string | null }>) => Promise<void>; onStart: (stop: RouteStop) => void; onComplete: (stop: RouteStop) => void; onResolve: (stop: RouteStop, mode: "UNABLE_TO_MEET" | "RESCHEDULED") => void; onRemove: (stopId: string) => void }) {
  const [picking, setPicking] = useState(false);
  const stops = activeStops(route);
  const available = salons.filter((salon) => !stops.some((stop) => stop.clientId === salon.id));
  const addToday = async (clientId: string) => { setPicking(false); await onSave(date, [...stops.map((stop) => ({ clientId: stop.clientId, plannedTime: stop.plannedTime ? new Date(stop.plannedTime).toTimeString().slice(0, 5) : "" })), { clientId, plannedTime: "" }]); };

  return <section className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
      <div><h2 className="text-sm font-semibold text-foreground">{dayLabel(date)}</h2><p className="mt-0.5 text-xs text-muted">{stops.filter((s) => s.status === "VISITED").length} of {stops.length} visited</p></div>
      <RouteStatusBadge status={route.status} />
    </div>
    {stops.length === 0 ? <div className="px-5 py-10 text-center"><Calendar className="mx-auto text-subtle" size={26} /><p className="mt-3 text-sm font-semibold text-foreground">No route planned for today</p><p className="mt-1 text-xs text-muted">Add salons below to start today&apos;s route.</p></div>
      : <div className="divide-y">{stops.map((stop) => <TodayStopRow key={stop.id} stop={stop} onStart={() => onStart(stop)} onComplete={() => onComplete(stop)} onUnableToMeet={() => onResolve(stop, "UNABLE_TO_MEET")} onReschedule={() => onResolve(stop, "RESCHEDULED")} onRemove={() => onRemove(stop.id)} />)}</div>}
    <div className="border-t p-4 sm:p-5">
      {picking ? <div className="rounded-lg border bg-background p-3">
        {available.length === 0 ? <p className="px-1 py-2 text-xs text-muted">All your assigned salons are already on today&apos;s route.</p> : <div className="max-h-56 space-y-1 overflow-y-auto">{available.map((salon) => <button key={salon.id} type="button" onClick={() => addToday(salon.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-white"><span className="min-w-0"><span className="block truncate font-medium text-foreground">{salon.salonName}</span><span className="block truncate text-muted">{[salon.area, salon.city].filter(Boolean).join(" · ")}</span></span>{salon.potential === "HIGH" && <Star size={12} className="shrink-0 fill-warning text-warning" />}</button>)}</div>}
        <Button type="button" variant="secondary" className="mt-2 h-8 w-full text-xs" onClick={() => setPicking(false)}>Close</Button>
      </div> : <Button type="button" variant="secondary" onClick={() => setPicking(true)}><Plus size={15} />Add salon to today</Button>}
    </div>
  </section>;
}

function TodayStopRow({ stop, onStart, onComplete, onUnableToMeet, onReschedule, onRemove }: { stop: RouteStop; onStart: () => void; onComplete: () => void; onUnableToMeet: () => void; onReschedule: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const started = Boolean(stop.activity?.checkInAt) && !stop.activity?.checkOutAt;
  return <div className="p-4 sm:px-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-foreground">{stop.client.salonName}</p><StopStatusBadge stop={stop} /></div><p className="mt-0.5 text-xs text-muted">{[stop.client.area, stop.client.city].filter(Boolean).join(" · ")}{stop.plannedTime && ` · ${timeOf(stop.plannedTime)}`}</p>{stop.note && <p className="mt-1 text-xs text-muted">{stop.note}</p>}</div>
      {stop.status === "PLANNED" && <button type="button" onClick={() => setOpen((v) => !v)} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-background" aria-label="More actions"><Clock3 size={15} /></button>}
    </div>
    {stop.status === "PLANNED" && <div className="mt-3 flex flex-wrap gap-2">
      {!started ? <Button type="button" className="h-9 px-3" onClick={onStart}><MapPin size={14} />Start visit</Button> : <Button type="button" className="h-9 px-3" onClick={onComplete}><CheckCircle2 size={14} />Complete visit</Button>}
      {open && <>
        <Button type="button" variant="secondary" className="h-9 px-3" onClick={onUnableToMeet}><AlertTriangle size={14} />Unable to meet</Button>
        <Button type="button" variant="secondary" className="h-9 px-3" onClick={onReschedule}><RotateCcw size={14} />Reschedule</Button>
        <button type="button" onClick={onRemove} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-danger hover:bg-red-50"><Trash2 size={14} />Remove</button>
      </>}
    </div>}
    {stop.status === "VISITED" && stop.activity?.visitOutcome && <p className="mt-2 text-xs text-muted">Outcome: <span className="font-medium text-foreground">{OUTCOMES.find((o) => o.value === stop.activity?.visitOutcome)?.label ?? stop.activity.visitOutcome}</span></p>}
    {(stop.status === "UNABLE_TO_MEET" || stop.status === "RESCHEDULED") && stop.note && <p className="mt-2 text-xs text-muted">Reason: {stop.note}</p>}
  </div>;
}

function RouteStatusBadge({ status }: { status: RouteData["status"] }) {
  const tone: Record<RouteData["status"], string> = { DRAFT: "bg-gray-100 text-muted", PLANNED: "bg-brand-soft text-brand-dark", IN_PROGRESS: "bg-warning-soft text-warning", PARTIALLY_COMPLETED: "bg-warning-soft text-warning", COMPLETED: "bg-success-soft text-success", CANCELLED: "bg-red-50 text-danger" };
  const label: Record<RouteData["status"], string> = { DRAFT: "Draft", PLANNED: "Confirmed", IN_PROGRESS: "In progress", PARTIALLY_COMPLETED: "Partially completed", COMPLETED: "Completed", CANCELLED: "Cancelled" };
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone[status]}`}>{label[status]}</span>;
}

function StopStatusBadge({ stop }: { stop: RouteStop }) {
  if (stop.status === "VISITED") return <span className="inline-flex rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">Visited</span>;
  if (stop.status === "UNABLE_TO_MEET") return <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-danger">Unable to meet</span>;
  if (stop.status === "RESCHEDULED") return <span className="inline-flex rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning">Rescheduled</span>;
  if (stop.activity?.checkInAt) return <span className="inline-flex rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-dark">In progress</span>;
  return <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-muted">Pending</span>;
}

function CompleteVisitModal({ stop, date, onClose, onDone }: { stop: RouteStop; date: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [outcome, setOutcome] = useState<string>("PRODUCTIVE");
  const [personMet, setPersonMet] = useState("");
  const [sampleGiven, setSampleGiven] = useState(false);
  const [nextAction, setNextAction] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch(`/api/routes/${date}/stops/${stop.id}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outcome, personMet: personMet || undefined, sampleGiven, nextAction: nextAction || undefined, note: note || undefined }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to record this visit."));
      await onDone();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to record this visit."); setSaving(false); }
  };
  return <Modal title="Complete visit" subtitle={stop.client.salonName} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Outcome *"><select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10">{OUTCOMES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
      <Field label="Person met"><Input value={personMet} onChange={(e) => setPersonMet(e.target.value)} maxLength={120} placeholder="e.g. Owner, Manager" /></Field>
      <label className="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2.5"><input type="checkbox" checked={sampleGiven} onChange={(e) => setSampleGiven(e.target.checked)} className="size-4 accent-[var(--brand)]" /><span className="text-xs font-medium text-foreground">Sample given during this visit</span></label>
      <Field label="Next action"><Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} maxLength={300} placeholder="e.g. Send quotation by Friday" /></Field>
      <Field label="Notes"><textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} className="w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" /></Field>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onClose={onClose} label="Save visit" />
    </form>
  </Modal>;
}

function StartVisitModal({ stop, date, onClose, onDone }: { stop: RouteStop; date: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState("Locating…");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!navigator.geolocation) { const timer = window.setTimeout(() => setLocationStatus("Location is not supported on this device."), 0); return () => window.clearTimeout(timer); }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLocation({ latitude: coords.latitude, longitude: coords.longitude });
      if (stop.client.latitude == null || stop.client.longitude == null) setLocationStatus("Salon location not set — GPS distance will be recorded without verification.");
      else setLocationStatus("Location captured. The server will verify your distance from the salon.");
    }, () => setLocationStatus("Allow location access to start this visit."), { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
  }, [stop.client.latitude, stop.client.longitude]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!photo || !location) return; setSaving(true); setError("");
    try {
      const form = new FormData(); form.append("photo", photo); form.append("latitude", String(location.latitude)); form.append("longitude", String(location.longitude));
      const response = await fetch(`/api/routes/${date}/stops/${stop.id}/start`, { method: "POST", body: form }); const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to start this visit.")); await onDone();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to start this visit."); setSaving(false); }
  };
  return <Modal title="Start visit" subtitle={stop.client.salonName} onClose={onClose}><form onSubmit={submit} className="space-y-4">
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${location ? "border-success/20 bg-success-soft/50 text-success" : "border-warning/20 bg-warning-soft/50 text-warning"}`}><MapPin className="mt-0.5 shrink-0" size={15} /><span>{locationStatus}</span></div>
    <label className="block cursor-pointer rounded-xl border border-dashed bg-background p-5 text-center hover:border-brand/40"><Camera className="mx-auto text-brand" size={24} /><span className="mt-2 block text-sm font-semibold text-foreground">{photo ? photo.name : "Capture check-in photo"}</span><span className="mt-1 block text-xs text-muted">Use the live camera at the salon entrance.</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label>
    {error && <FormError message={error} />}
    <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving || !photo || !location}>{saving && <LoaderCircle className="animate-spin" size={16} />}{saving ? "Starting…" : "Start visit"}</Button></div>
  </form></Modal>;
}

function ResolveStopModal({ stop, mode, onClose, onConfirm }: { stop: RouteStop; mode: "UNABLE_TO_MEET" | "RESCHEDULED"; onClose: () => void; onConfirm: (reason: string, rescheduleDate?: string) => void }) {
  const [reason, setReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = (event: FormEvent) => { event.preventDefault(); setSaving(true); onConfirm(reason, mode === "RESCHEDULED" ? rescheduleDate || undefined : undefined); };
  return <Modal title={mode === "UNABLE_TO_MEET" ? "Mark unable to meet" : "Reschedule visit"} subtitle={stop.client.salonName} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Owner unavailable" /></Field>
      {mode === "RESCHEDULED" && <Field label="Move to date"><Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} /></Field>}
      <FormActions saving={saving} onClose={onClose} label="Confirm" />
    </form>
  </Modal>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">{label}</span>{children}</label>; }
function FormError({ message }: { message: string }) { return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{message}</p>; }
function FormActions({ saving, onClose, label }: { saving: boolean; onClose: () => void; label: string }) {
  return <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
    <Button type="submit" disabled={saving}>{saving && <LoaderCircle className="animate-spin" size={16} />}{saving ? "Saving…" : label}</Button>
  </div>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/40 p-3 backdrop-blur-[1px] sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
    <div className="my-auto flex max-h-[calc(100dvh-24px)] w-full max-w-md flex-col rounded-xl border bg-white shadow-[0_20px_48px_rgba(15,23,42,0.18)] sm:max-h-[calc(100dvh-32px)]">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4"><div><h2 className="text-base font-semibold text-foreground">{title}</h2><p className="mt-1 text-xs text-muted">{subtitle}</p></div><button type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-background sm:size-8" aria-label="Close"><X size={17} /></button></div>
      <div className="overflow-y-auto p-4 sm:p-5">{children}</div>
    </div>
  </div>;
}
