"use client";

import { DayGateBanner } from "@/components/day-gate-banner";
import { AlertTriangle, ArrowDown, ArrowUp, Calendar, CheckCircle2, ClipboardList, Clock3, LoaderCircle, MapPin, Plus, RotateCcw, Star, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { CameraCapture } from "@/components/ui/camera-capture";
import { Modal } from "@/components/ui/modal";
import { SuccessToast } from "@/components/ui/toast";

type Salon = { id: string; salonName: string; city: string; area: string | null; potential: string | null; profileIncomplete?: boolean; beat: { id: string; name: string } | null };
type Activity = { id: string; checkInAt: string | null; checkOutAt: string | null; visitOutcome: string | null; status: string; note: string | null };
type RouteStop = { id: string; clientId: string; sequence: number; plannedTime: string | null; status: "PLANNED" | "VISITED" | "UNABLE_TO_MEET" | "RESCHEDULED" | "REMOVED"; note: string | null; client: { id: string; salonName: string; city: string; area: string | null; primaryContact: string; potential: string | null; latitude: string | null; longitude: string | null; status?: string; profileIncomplete?: boolean }; activity: Activity | null };
type RouteData = { id: string | null; staffId: string; routeDate: string; status: "DRAFT" | "PLANNED" | "IN_PROGRESS" | "PARTIALLY_COMPLETED" | "COMPLETED" | "CANCELLED"; notes: string | null; stops: RouteStop[]; visitRadiusMeters?: number };

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
  const [starting, setStarting] = useState<RouteStop | null>(null);
  const [profiling, setProfiling] = useState<RouteStop | null>(null);
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

  // A salon typed by name: saved as a prospect client for this salesperson, then used like any other salon in the route.
  const createSalon = async (name: string, city: string): Promise<Salon> => {
    const response = await fetch("/api/routes/salons", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, city }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(messageFrom(data, "Unable to add this salon."));
    const salon = data as Salon;
    setSalons((current) => current.some((item) => item.id === salon.id) ? current : [...current, salon]);
    return salon;
  };

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

  // Leaving a salon is one tap: only the time is recorded.
  const checkOut = async (stop: RouteStop) => {
    setError("");
    try {
      const response = await fetch(`/api/routes/${today}/stops/${stop.id}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to check out."));
      await load();
      setNotice(`Checked out of ${stop.client.salonName}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to check out."); }
  };

  if (loading) return <div className="space-y-3"><div className="h-11 w-56 animate-pulse rounded-lg bg-background" /><div className="h-64 animate-pulse rounded-xl bg-background" /></div>;

  const activeDate = tab === "today" ? today : tomorrow;
  const route = routes[activeDate];

  return <div className="space-y-4">
    <DayGateBanner />
    {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}
    <div className="flex gap-1 rounded-lg border bg-white p-1">
      <button type="button" onClick={() => setTab("today")} className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${tab === "today" ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background"}`}>Today · {dayLabel(today)}</button>
      <button type="button" onClick={() => setTab("tomorrow")} className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${tab === "tomorrow" ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background"}`}>Tomorrow · {dayLabel(tomorrow)}</button>
    </div>

    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}

    {route && (tab === "tomorrow"
      ? <RouteBuilder date={activeDate} route={route} salons={salons} onSave={saveStops} onCreateSalon={createSalon} onSubmit={() => submitRoute(activeDate)} />
      : <TodayRoute date={activeDate} route={route} salons={salons} onSave={saveStops} onCreateSalon={createSalon} onFillProfile={setProfiling} onStart={setStarting} onComplete={checkOut} onResolve={(stop, mode) => setResolving({ stop, mode })} onRemove={(stopId) => removeStop(activeDate, stopId)} />)}

    {profiling && <FillProfileModal stop={profiling} date={today} onClose={() => setProfiling(null)} onDone={async () => { setProfiling(null); await load(); setNotice("Client profile saved. Now tap “I’ve arrived” to check in."); }} />}
    {starting && <StartVisitModal stop={starting} date={today} radius={routes[today]?.visitRadiusMeters ?? 100} onClose={() => setStarting(null)} onDone={async () => { setStarting(null); await load(); setNotice("Checked in. Your attendance for today has started."); }} />}
    {resolving && <ResolveStopModal stop={resolving.stop} mode={resolving.mode} onClose={() => setResolving(null)} onConfirm={(reason, rescheduleDate) => resolveStop(today, resolving.stop.id, resolving.mode, reason, rescheduleDate)} />}
  </div>;
}

function activeStops(route: RouteData) { return route.stops.filter((stop) => stop.status !== "REMOVED").sort((a, b) => a.sequence - b.sequence); }

function RouteBuilder({ date, route, salons, onSave, onCreateSalon, onSubmit }: { date: string; route: RouteData; salons: Salon[]; onSave: (date: string, stops: Array<{ clientId: string; plannedTime: string | null }>) => Promise<void>; onCreateSalon: (name: string, city: string) => Promise<Salon>; onSubmit: () => void }) {
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

  return <section className="crm-surface overflow-hidden">
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
      <div><h2 className="text-sm font-semibold text-foreground">{dayLabel(date)}</h2><p className="mt-0.5 text-xs text-muted">{picks.length} salon{picks.length === 1 ? "" : "s"} planned</p></div>
      <RouteStatusBadge status={route.status} />
    </div>
    {picks.length === 0 ? <div className="px-5 py-10 text-center"><Calendar className="mx-auto text-subtle" size={26} /><p className="mt-3 text-sm font-semibold text-foreground">No salons added yet</p><p className="mt-1 text-xs text-muted">Type a salon name below, or pick one from your client profiles.</p></div>
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
      <AddSalonByName salons={salons} onCreate={onCreateSalon} onAdded={add} />
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

function TodayRoute({ date, route, salons, onSave, onCreateSalon, onFillProfile, onStart, onComplete, onResolve, onRemove }: { date: string; route: RouteData; salons: Salon[]; onSave: (date: string, stops: Array<{ clientId: string; plannedTime: string | null }>) => Promise<void>; onCreateSalon: (name: string, city: string) => Promise<Salon>; onFillProfile: (stop: RouteStop) => void; onStart: (stop: RouteStop) => void; onComplete: (stop: RouteStop) => Promise<void>; onResolve: (stop: RouteStop, mode: "UNABLE_TO_MEET" | "RESCHEDULED") => void; onRemove: (stopId: string) => void }) {
  const [picking, setPicking] = useState(false);
  const stops = activeStops(route);
  const available = salons.filter((salon) => !stops.some((stop) => stop.clientId === salon.id));
  const addToday = async (clientId: string) => { setPicking(false); await onSave(date, [...stops.map((stop) => ({ clientId: stop.clientId, plannedTime: stop.plannedTime ? new Date(stop.plannedTime).toTimeString().slice(0, 5) : "" })), { clientId, plannedTime: "" }]); };

  return <section className="crm-surface overflow-hidden">
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
      <div><h2 className="text-sm font-semibold text-foreground">{dayLabel(date)}</h2><p className="mt-0.5 text-xs text-muted">{stops.filter((s) => s.status === "VISITED").length} of {stops.length} visited</p></div>
      <RouteStatusBadge status={route.status} />
    </div>
    {stops.length === 0 ? <div className="px-5 py-10 text-center"><Calendar className="mx-auto text-subtle" size={26} /><p className="mt-3 text-sm font-semibold text-foreground">No route planned for today</p><p className="mt-1 text-xs text-muted">Add salons below to start today&apos;s route.</p></div>
      : <div className="divide-y">{stops.map((stop) => <TodayStopRow key={stop.id} stop={stop} onFillProfile={() => onFillProfile(stop)} onStart={() => onStart(stop)} onComplete={() => onComplete(stop)} onUnableToMeet={() => onResolve(stop, "UNABLE_TO_MEET")} onReschedule={() => onResolve(stop, "RESCHEDULED")} onRemove={() => onRemove(stop.id)} />)}</div>}
    <div className="space-y-3 border-t p-4 sm:p-5">
      <AddSalonByName salons={salons} onCreate={onCreateSalon} onAdded={addToday} />
      {picking ? <div className="rounded-lg border bg-background p-3">
        {available.length === 0 ? <p className="px-1 py-2 text-xs text-muted">All your assigned salons are already on today&apos;s route.</p> : <div className="max-h-56 space-y-1 overflow-y-auto">{available.map((salon) => <button key={salon.id} type="button" onClick={() => addToday(salon.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-white"><span className="min-w-0"><span className="block truncate font-medium text-foreground">{salon.salonName}</span><span className="block truncate text-muted">{[salon.area, salon.city].filter(Boolean).join(" · ")}</span></span>{salon.potential === "HIGH" && <Star size={12} className="shrink-0 fill-warning text-warning" />}</button>)}</div>}
        <Button type="button" variant="secondary" className="mt-2 h-8 w-full text-xs" onClick={() => setPicking(false)}>Close</Button>
      </div> : <Button type="button" variant="secondary" onClick={() => setPicking(true)}><Plus size={15} />Add salon to today</Button>}
    </div>
  </section>;
}

const STANDARD_TOWNS = ["Navsari", "Surat", "Vadodara", "Ahmedabad", "Bhavnagar", "Junagadh", "Rajkot", "Gandhinagar", "Jaipur", "Indore"];

// For salons that have no client profile yet: type the name and town and the salon is added to the route. Its client profile is completed at the salon.
function AddSalonByName({ salons, onCreate, onAdded }: { salons: Salon[]; onCreate: (name: string, city: string) => Promise<Salon>; onAdded: (clientId: string) => void | Promise<void> }) {
  const common = useMemo(() => { const counts = new Map<string, number>(); for (const salon of salons) counts.set(salon.city, (counts.get(salon.city) ?? 0) + 1); return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""; }, [salons]);
  const cities = useMemo(() => [...new Set([...salons.map((salon) => salon.city), ...STANDARD_TOWNS])].sort((a, b) => a.localeCompare(b)), [salons]);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const town = city || common;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) return setProblem("Enter the salon name.");
    if (town.trim().length < 2) return setProblem("Enter the town.");
    setBusy(true); setProblem("");
    try { const salon = await onCreate(name.trim(), town.trim()); setName(""); await onAdded(salon.id); }
    catch (cause) { setProblem(cause instanceof Error ? cause.message : "Unable to add this salon."); }
    finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="rounded-lg border border-brand/25 bg-brand-soft/40 p-3" aria-label="Add a salon by name">
    <p className="text-xs font-semibold text-foreground">Add a salon by name</p>
    <p className="mt-0.5 text-[11px] leading-4 text-muted">No client profile needed yet. When you reach the salon, save its location and complete its client profile there.</p>
    <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_170px_auto]">
      <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Salon name" aria-label="Salon name" />
      <Input value={city} onChange={(event) => setCity(event.target.value)} maxLength={100} placeholder={common || "Town"} list="route-towns" aria-label="Town" />
      <Button type="submit" disabled={busy || name.trim().length < 2}>{busy ? <LoaderCircle className="animate-spin" size={15} /> : <Plus size={15} />}Add</Button>
    </div>
    <datalist id="route-towns">{cities.map((item) => <option key={item} value={item} />)}</datalist>
    {problem && <p role="alert" className="mt-2 text-xs text-danger">{problem}</p>}
  </form>;
}

function TodayStopRow({ stop, onFillProfile, onStart, onComplete, onUnableToMeet, onReschedule, onRemove }: { stop: RouteStop; onFillProfile: () => void; onStart: () => void; onComplete: () => Promise<void>; onUnableToMeet: () => void; onReschedule: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const started = Boolean(stop.activity?.checkInAt) && !stop.activity?.checkOutAt;
  return <div className="p-4 sm:px-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-foreground">{stop.client.salonName}</p><StopStatusBadge stop={stop} />{stop.client.profileIncomplete && <span className="inline-flex rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning">Profile not filled</span>}</div><p className="mt-0.5 text-xs text-muted">{[stop.client.area, stop.client.city].filter(Boolean).join(" · ")}{stop.plannedTime && ` · ${timeOf(stop.plannedTime)}`}</p>{stop.note && <p className="mt-1 text-xs text-muted">{stop.note}</p>}</div>
      {stop.status === "PLANNED" && <button type="button" onClick={() => setOpen((v) => !v)} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-background" aria-label="More actions"><Clock3 size={15} /></button>}
    </div>
    {stop.status === "PLANNED" && <div className="mt-3 flex flex-wrap gap-2">
      {!started ? (stop.client.profileIncomplete ? <Button type="button" className="h-9 px-3" onClick={onFillProfile}><ClipboardList size={14} />Add client profile</Button> : <Button type="button" className="h-9 px-3" onClick={onStart}><MapPin size={14} />I’ve arrived</Button>) : <Button type="button" className="h-9 px-3" disabled={leaving} onClick={async () => { setLeaving(true); try { await onComplete(); } finally { setLeaving(false); } }}>{leaving ? <LoaderCircle className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}{leaving ? "Checking out…" : "Check out"}</Button>}
      {open && <>
        <Button type="button" variant="secondary" className="h-9 px-3" onClick={onUnableToMeet}><AlertTriangle size={14} />Unable to meet</Button>
        <Button type="button" variant="secondary" className="h-9 px-3" onClick={onReschedule}><RotateCcw size={14} />Reschedule</Button>
        <button type="button" onClick={onRemove} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-danger hover:bg-red-50"><Trash2 size={14} />Remove</button>
      </>}
    </div>}
    {stop.status === "PLANNED" && stop.client.profileIncomplete && !started && <p className="mt-2 text-xs leading-4 text-muted">At the salon, add its client profile first. Its location is saved from your phone, then you can check in.</p>}
    {stop.activity?.checkInAt && <p className="mt-2 text-xs text-muted">Arrived <span className="font-medium text-foreground">{timeOf(stop.activity.checkInAt)}</span>{stop.activity.checkOutAt && <> · Left <span className="font-medium text-foreground">{timeOf(stop.activity.checkOutAt)}</span></>}</p>}
    {stop.status === "VISITED" && stop.activity?.visitOutcome && <p className="mt-2 text-xs text-muted">Outcome: <span className="font-medium text-foreground">{OUTCOMES.find((o) => o.value === stop.activity?.visitOutcome)?.label ?? stop.activity.visitOutcome}</span></p>}
    {(stop.status === "UNABLE_TO_MEET" || stop.status === "RESCHEDULED") && stop.note && <p className="mt-2 text-xs text-muted">Reason: {stop.note}</p>}
  </div>;
}

function RouteStatusBadge({ status }: { status: RouteData["status"] }) {
  const tone: Record<RouteData["status"], string> = { DRAFT: "bg-background text-muted", PLANNED: "bg-brand-soft text-brand-dark", IN_PROGRESS: "bg-warning-soft text-warning", PARTIALLY_COMPLETED: "bg-warning-soft text-warning", COMPLETED: "bg-success-soft text-success", CANCELLED: "bg-red-50 text-danger" };
  const label: Record<RouteData["status"], string> = { DRAFT: "Draft", PLANNED: "Confirmed", IN_PROGRESS: "In progress", PARTIALLY_COMPLETED: "Partially completed", COMPLETED: "Completed", CANCELLED: "Cancelled" };
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone[status]}`}>{label[status]}</span>;
}

function StopStatusBadge({ stop }: { stop: RouteStop }) {
  if (stop.status === "VISITED") return <span className="inline-flex rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">Visited</span>;
  if (stop.status === "UNABLE_TO_MEET") return <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-danger">Unable to meet</span>;
  if (stop.status === "RESCHEDULED") return <span className="inline-flex rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning">Rescheduled</span>;
  if (stop.activity?.checkInAt) return <span className="inline-flex rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-dark">In progress</span>;
  return <span className="inline-flex rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold text-muted">Pending</span>;
}

const distanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const rad = (degrees: number) => degrees * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};
const MAX_ACCURACY = 100;
type Position = { latitude: number; longitude: number; accuracy: number };

// Strict arrival: the phone must be within the salon's saved radius, with a usable GPS fix, and a selfie taken on the spot.
function StartVisitModal({ stop, date, radius, onClose, onDone }: { stop: RouteStop; date: string; radius: number; onClose: () => void; onDone: () => Promise<void> }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [captureToken, setCaptureToken] = useState("");
  const [position, setPosition] = useState<Position | null>(null);
  const [gpsMessage, setGpsMessage] = useState("Finding your location…");
  const [salonPoint, setSalonPoint] = useState<{ latitude: number; longitude: number } | null>(stop.client.latitude != null && stop.client.longitude != null ? { latitude: Number(stop.client.latitude), longitude: Number(stop.client.longitude) } : null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!navigator.geolocation) { const timer = window.setTimeout(() => setGpsMessage("Location is not supported on this device."), 0); return () => window.clearTimeout(timer); }
    const watch = navigator.geolocation.watchPosition(
      ({ coords }) => { setPosition({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }); setGpsMessage(""); },
      () => setGpsMessage("Allow location access to check in at the salon."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  const accurate = position ? position.accuracy <= MAX_ACCURACY : false;
  const distance = position && salonPoint ? distanceMeters(salonPoint.latitude, salonPoint.longitude, position.latitude, position.longitude) : null;
  const within = distance != null && distance <= radius;
  const ready = Boolean(photo && position && accurate && within);

  const saveSalonLocation = async () => {
    if (!position || !accurate) return;
    setSavingLocation(true); setError("");
    try {
      const response = await fetch(`/api/routes/${date}/stops/${stop.id}/salon-location`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to save the salon location."));
      setSalonPoint({ latitude: position.latitude, longitude: position.longitude });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save the salon location."); }
    finally { setSavingLocation(false); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!photo || !position || !ready) return; setSaving(true); setError("");
    try {
      const form = new FormData();
      form.append("photo", photo); form.append("captureToken", captureToken); form.append("latitude", String(position.latitude)); form.append("longitude", String(position.longitude)); form.append("accuracy", String(Math.round(position.accuracy)));
      const response = await fetch(`/api/routes/${date}/stops/${stop.id}/start`, { method: "POST", body: form }); const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to check in.")); await onDone();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to check in."); setSaving(false); }
  };

  const panel = (tone: "ok" | "bad" | "warn", message: string) => <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${tone === "ok" ? "border-success/20 bg-success-soft/50 text-success" : tone === "bad" ? "border-red-200 bg-red-50 text-danger" : "border-warning/20 bg-warning-soft/50 text-warning"}`} role="status" aria-live="polite"><MapPin className="mt-0.5 shrink-0" size={15} /><span>{message}</span></div>;

  return <Modal title="Check in at salon" subtitle={stop.client.salonName} onClose={onClose}><form onSubmit={submit} className="space-y-4">
    {gpsMessage && panel("warn", gpsMessage)}
    {!gpsMessage && position && !accurate && panel("warn", `Your GPS signal is weak (about ${Math.round(position.accuracy)} m off). Step outside or wait a few seconds for a better fix.`)}
    {!gpsMessage && position && accurate && !salonPoint && <div className="space-y-2.5">
      {panel("warn", "This salon has no saved location yet. Stand at the salon and save its location once; later visits are matched against it.")}
      <Button type="button" variant="secondary" className="w-full" disabled={savingLocation} onClick={saveSalonLocation}>{savingLocation ? <LoaderCircle className="animate-spin" size={16} /> : <MapPin size={16} />}{savingLocation ? "Saving…" : "Save salon location here"}</Button>
    </div>}
    {!gpsMessage && position && accurate && salonPoint && distance != null && (within
      ? panel("ok", `You are at the salon (about ${distance} m away). You can check in.`)
      : panel("bad", `You are about ${distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${distance} m`} from the salon. Move within ${radius} m to check in.`))}
    <CameraCapture photo={photo} purpose="VISIT_CHECK_IN" scopeId={stop.id} facing="user" label="Take arrival selfie" hint="Opens the front camera. Gallery photos are not accepted." onChange={(file, token) => { setPhoto(file); setCaptureToken(token); }} onError={setError} />
    {error && <FormError message={error} />}
    <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving || !ready}>{saving && <LoaderCircle className="animate-spin" size={16} />}{saving ? "Checking in…" : "I’ve arrived"}</Button></div>
  </form></Modal>;
}

const CATEGORIES = [["SALON", "Salon"], ["UNISEX", "Unisex salon"], ["STUDIO", "Studio"], ["ACADEMY", "Academy"]] as const;

// At a salon that was typed into the route: fill its client profile. The phone's GPS becomes the salon's location, and only then can the visit be checked in.
function FillProfileModal({ stop, date, onClose, onDone }: { stop: RouteStop; date: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [position, setPosition] = useState<Position | null>(null);
  const [gpsMessage, setGpsMessage] = useState("Finding your location…");
  const [form, setForm] = useState({ salonName: stop.client.salonName, category: "SALON", ownerName: "", primaryContact: "", fullAddress: "", city: stop.client.city, area: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!navigator.geolocation) { const timer = window.setTimeout(() => setGpsMessage("Location is not supported on this device."), 0); return () => window.clearTimeout(timer); }
    const watch = navigator.geolocation.watchPosition(
      ({ coords }) => { setPosition({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }); setGpsMessage(""); },
      () => setGpsMessage("Allow location access to save the salon’s location."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const accurate = position ? position.accuracy <= MAX_ACCURACY : false;
  const filled = form.salonName.trim().length >= 2 && form.ownerName.trim().length >= 2 && form.primaryContact.trim().length >= 7 && form.fullAddress.trim().length >= 5 && form.city.trim().length >= 2;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!position || !accurate || !filled) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/routes/${date}/stops/${stop.id}/complete-profile`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, area: form.area.trim() || undefined, latitude: position.latitude, longitude: position.longitude, accuracy: Math.round(position.accuracy) }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(Array.isArray((data as { message?: unknown })?.message) ? ((data as { message: string[] }).message).join(" ") : messageFrom(data, "Unable to save the client profile."));
      await onDone();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save the client profile."); setSaving(false); }
  };
  const gps = gpsMessage ? <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning-soft/50 p-3 text-xs text-warning" role="status"><MapPin size={14} className="mt-0.5 shrink-0" />{gpsMessage}</div>
    : position && !accurate ? <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning-soft/50 p-3 text-xs text-warning" role="status"><MapPin size={14} className="mt-0.5 shrink-0" />Your GPS signal is weak (about {Math.round(position.accuracy)} m off). Step outside or wait a few seconds for a better fix.</div>
    : position ? <div className="flex items-start gap-2 rounded-lg border border-success/20 bg-success-soft/50 p-3 text-xs text-success" role="status"><CheckCircle2 size={14} className="mt-0.5 shrink-0" />Location found (about {Math.round(position.accuracy)} m accuracy). It will be saved as the salon’s location.</div> : null;
  return <Modal title="Add client profile" subtitle={`${stop.client.salonName} · fill this at the salon`} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      {gps}
      <Field label="Salon name *"><Input value={form.salonName} onChange={set("salonName")} maxLength={160} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type *"><select value={form.category} onChange={set("category")} className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10">{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Owner name *"><Input value={form.ownerName} onChange={set("ownerName")} maxLength={120} required /></Field>
        <Field label="Contact number *"><Input value={form.primaryContact} onChange={set("primaryContact")} type="tel" inputMode="tel" maxLength={20} required /></Field>
        <Field label="Town *"><Input value={form.city} onChange={set("city")} maxLength={100} required /></Field>
      </div>
      <Field label="Address *"><Input value={form.fullAddress} onChange={set("fullAddress")} maxLength={500} placeholder="Shop number, street, landmark" required /></Field>
      <Field label="Area"><Input value={form.area} onChange={set("area")} maxLength={120} placeholder="Optional" /></Field>
      <p className="text-xs leading-5 text-muted">You can add more details later from Client Profile. After saving, tap “I’ve arrived” to check in.</p>
      {error && <FormError message={error} />}
      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving || !position || !accurate || !filled}>{saving && <LoaderCircle className="animate-spin" size={16} />}{saving ? "Saving…" : "Save profile"}</Button></div>
    </form>
  </Modal>;
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
