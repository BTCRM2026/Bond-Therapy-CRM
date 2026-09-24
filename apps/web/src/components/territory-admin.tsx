"use client";

import { LoaderCircle, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SuccessToast } from "@/components/ui/toast";

type Region = { id: string; name: string; code: string | null; isActive: boolean };
type State = { id: string; name: string; regionId: string; isActive: boolean };
type City = { id: string; name: string; stateId: string; isActive: boolean };
type Territory = { id: string; name: string; regionId: string; stateId: string; cityId: string; isActive: boolean };
type Beat = { id: string; name: string; territoryId: string; assignedStaffId: string | null; assignedStaff: { id: string; name: string } | null; visitFrequencyDays: number | null; isActive: boolean; _count: { clients: number } };
type Hierarchy = { regions: Region[]; states: State[]; cities: City[]; territories: Territory[]; beats: Beat[] };
type StaffOption = { id: string; name: string };

const LEVEL_TABS = [
  { key: "regions", label: "Regions", singular: "region" },
  { key: "states", label: "States", singular: "state" },
  { key: "cities", label: "Cities", singular: "city" },
  { key: "territories", label: "Territories", singular: "territory" },
  { key: "beats", label: "Beats", singular: "beat" },
] as const;
const TABS = [...LEVEL_TABS, { key: "routes", label: "Routes", singular: "" }] as const;
type TabKey = (typeof TABS)[number]["key"];

const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback;

export function TerritoryAdmin() {
  const [data, setData] = useState<Hierarchy | null>(null);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [tab, setTab] = useState<TabKey>("regions");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState<{ mode: "create" | "edit"; id?: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const syncHeaderSlot = () => setHeaderSlot(document.getElementById("page-header-actions"));
    syncHeaderSlot();
    const frame = requestAnimationFrame(syncHeaderSlot);
    return () => cancelAnimationFrame(frame);
  }, []);

  const load = async () => {
    try {
      const [hierarchyResponse, staffResponse] = await Promise.all([fetch("/api/territory/hierarchy", { cache: "no-store" }), fetch("/api/staff", { cache: "no-store" })]);
      const hierarchy = await hierarchyResponse.json().catch(() => null);
      if (!hierarchyResponse.ok) throw new Error(messageFrom(hierarchy, "Unable to load the territory structure."));
      setData(hierarchy as Hierarchy);
      const directory = await staffResponse.json().catch(() => null);
      if (staffResponse.ok && directory) setStaff((directory.users as Array<{ id: string; name: string; roles: Array<{ key: string }> }>).filter((user) => user.roles.some((role) => ["SALES_MANAGER", "SALES_EXECUTIVE"].includes(role.key))).map((user) => ({ id: user.id, name: user.name })));
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load the territory structure."); }
    finally { setLoading(false); }
  };
  useEffect(() => { (async () => { await load(); })(); }, []);

  const remove = async () => {
    if (!deleting || tab === "routes") return;
    try {
      const response = await fetch(`/api/territory/${tab}/${deleting.id}`, { method: "DELETE" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(json, "Unable to delete this record."));
      setDeleting(null);
      await load();
      setNotice(`${deleting.name} was deleted.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete this record."); setDeleting(null); }
  };

  const addLabel = TABS.find((item) => item.key === tab)!.singular;

  if (loading) return <div className="space-y-3"><div className="h-11 w-72 animate-pulse rounded-lg bg-background" /><div className="h-64 animate-pulse rounded-xl bg-background" /></div>;

  return <div className="space-y-4">
    {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}
    {headerSlot && tab !== "routes" && createPortal(<Button onClick={() => setEditing({ mode: "create" })}><Plus size={16} />Add {addLabel}</Button>, headerSlot)}

    <div className="flex gap-1 overflow-x-auto rounded-lg border bg-white p-1">
      {TABS.map((item) => <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${tab === item.key ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background"}`}>{item.label}</button>)}
    </div>

    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}

    {tab === "routes" ? <RouteOversight /> : data && <section className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
      {tab === "regions" && <RowList empty="No regions yet" items={data.regions.map((region) => ({ id: region.id, name: region.name, meta: region.code ?? undefined, isActive: region.isActive }))} onEdit={(id) => setEditing({ mode: "edit", id })} onDelete={(id, name) => setDeleting({ id, name })} />}
      {tab === "states" && <RowList empty="No states yet" items={data.states.map((state) => ({ id: state.id, name: state.name, meta: data.regions.find((r) => r.id === state.regionId)?.name, isActive: state.isActive }))} onEdit={(id) => setEditing({ mode: "edit", id })} onDelete={(id, name) => setDeleting({ id, name })} />}
      {tab === "cities" && <RowList empty="No cities yet" items={data.cities.map((city) => ({ id: city.id, name: city.name, meta: data.states.find((s) => s.id === city.stateId)?.name, isActive: city.isActive }))} onEdit={(id) => setEditing({ mode: "edit", id })} onDelete={(id, name) => setDeleting({ id, name })} />}
      {tab === "territories" && <RowList empty="No territories yet" items={data.territories.map((territory) => ({ id: territory.id, name: territory.name, meta: [data.cities.find((c) => c.id === territory.cityId)?.name, data.states.find((s) => s.id === territory.stateId)?.name].filter(Boolean).join(" · "), isActive: territory.isActive }))} onEdit={(id) => setEditing({ mode: "edit", id })} onDelete={(id, name) => setDeleting({ id, name })} />}
      {tab === "beats" && <RowList empty="No beats yet" items={data.beats.map((beat) => ({ id: beat.id, name: beat.name, meta: [data.territories.find((t) => t.id === beat.territoryId)?.name, beat.assignedStaff?.name ?? "Unassigned", `${beat._count.clients} salon${beat._count.clients === 1 ? "" : "s"}`].filter(Boolean).join(" · "), isActive: beat.isActive }))} onEdit={(id) => setEditing({ mode: "edit", id })} onDelete={(id, name) => setDeleting({ id, name })} />}
    </section>}

    {editing && data && tab !== "routes" && <LevelEditor tab={tab} mode={editing.mode} id={editing.id} data={data} staff={staff} onClose={() => setEditing(null)} onSaved={async (message) => { setEditing(null); await load(); setNotice(message); }} />}
    {deleting && <ConfirmDelete name={deleting.name} onClose={() => setDeleting(null)} onConfirm={remove} />}
  </div>;
}

type StaffRoute = { id: string; staff: { id: string; name: string }; status: string; planned: number; visited: number; unableToMeet: number; rescheduled: number; total: number };
const ROUTE_STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", PLANNED: "Confirmed", IN_PROGRESS: "In progress", PARTIALLY_COMPLETED: "Partially completed", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const ROUTE_STATUS_TONE: Record<string, string> = { DRAFT: "bg-gray-100 text-muted", PLANNED: "bg-brand-soft text-brand-dark", IN_PROGRESS: "bg-warning-soft text-warning", PARTIALLY_COMPLETED: "bg-warning-soft text-warning", COMPLETED: "bg-success-soft text-success", CANCELLED: "bg-red-50 text-danger" };

function RouteOversight() {
  const [rows, setRows] = useState<StaffRoute[] | null>(null);
  const [error, setError] = useState("");
  const today = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }, []);

  useEffect(() => { (async () => {
    try {
      const response = await fetch(`/api/routes/admin?date=${today}`, { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(json, "Unable to load today's routes."));
      setRows(json as StaffRoute[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load today's routes."); }
  })(); }, [today]);

  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>;
  if (!rows) return <div className="h-48 animate-pulse rounded-xl bg-background" />;
  if (!rows.length) return <div className="rounded-xl border bg-white px-5 py-14 text-center shadow-[0_3px_12px_rgba(15,23,42,0.04)]"><MapPin className="mx-auto text-subtle" size={26} /><p className="mt-3 text-sm font-semibold text-foreground">No routes planned for today</p></div>;

  return <section className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
    <div className="border-b px-4 py-3 sm:px-5"><p className="text-sm font-semibold text-foreground">Today&apos;s routes</p></div>
    <div className="divide-y">{rows.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
      <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{row.staff.name}</p><p className="mt-0.5 text-xs text-muted">{row.visited} visited · {row.planned} pending{row.unableToMeet ? ` · ${row.unableToMeet} unable to meet` : ""}{row.rescheduled ? ` · ${row.rescheduled} rescheduled` : ""} · {row.total} total</p></div>
      <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${ROUTE_STATUS_TONE[row.status] ?? "bg-gray-100 text-muted"}`}>{ROUTE_STATUS_LABEL[row.status] ?? row.status}</span>
    </div>)}</div>
  </section>;
}

function RowList({ items, empty, onEdit, onDelete }: { items: Array<{ id: string; name: string; meta?: string; isActive: boolean }>; empty: string; onEdit: (id: string) => void; onDelete: (id: string, name: string) => void }) {
  if (!items.length) return <div className="px-5 py-14 text-center"><MapPin className="mx-auto text-subtle" size={26} /><p className="mt-3 text-sm font-semibold text-foreground">{empty}</p></div>;
  return <div className="divide-y">{items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
    <div className="min-w-0">
      <div className="flex items-center gap-2"><p className="truncate text-sm font-medium text-foreground">{item.name}</p>{!item.isActive && <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-muted">Inactive</span>}</div>
      {item.meta && <p className="mt-0.5 truncate text-xs text-muted">{item.meta}</p>}
    </div>
    <div className="flex shrink-0 items-center gap-1.5">
      <button type="button" onClick={() => onEdit(item.id)} className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-brand-soft hover:text-brand" aria-label={`Edit ${item.name}`}><Pencil size={15} /></button>
      <button type="button" onClick={() => onDelete(item.id, item.name)} className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-red-50 hover:text-danger" aria-label={`Delete ${item.name}`}><Trash2 size={15} /></button>
    </div>
  </div>)}</div>;
}

function LevelEditor({ tab, mode, id, data, staff, onClose, onSaved }: { tab: TabKey; mode: "create" | "edit"; id?: string; data: Hierarchy; staff: StaffOption[]; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  if (tab === "regions") return <RegionForm mode={mode} region={data.regions.find((r) => r.id === id)} onClose={onClose} onSaved={onSaved} />;
  if (tab === "states") return <StateForm mode={mode} state={data.states.find((s) => s.id === id)} regions={data.regions} onClose={onClose} onSaved={onSaved} />;
  if (tab === "cities") return <CityForm mode={mode} city={data.cities.find((c) => c.id === id)} states={data.states} onClose={onClose} onSaved={onSaved} />;
  if (tab === "territories") return <TerritoryForm mode={mode} territory={data.territories.find((t) => t.id === id)} data={data} onClose={onClose} onSaved={onSaved} />;
  return <BeatForm mode={mode} beat={data.beats.find((b) => b.id === id)} territories={data.territories} staff={staff} onClose={onClose} onSaved={onSaved} />;
}

function RegionForm({ mode, region, onClose, onSaved }: { mode: "create" | "edit"; region?: Region; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [name, setName] = useState(region?.name ?? "");
  const [code, setCode] = useState(region?.code ?? "");
  const { saving, error, submit } = useLevelSubmit(async () => {
    const response = await fetch(mode === "create" ? "/api/territory/regions" : `/api/territory/regions/${region!.id}`, { method: mode === "create" ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, code: code || undefined }) });
    return { response, message: `${name} was ${mode === "create" ? "added" : "updated"}.` };
  }, onSaved);
  return <Modal title={mode === "create" ? "Add region" : "Edit region"} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Region name *"><Input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} required /></Field>
      <Field label="Code"><Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} placeholder="e.g. WEST" /></Field>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onClose={onClose} />
    </form>
  </Modal>;
}

function StateForm({ mode, state, regions, onClose, onSaved }: { mode: "create" | "edit"; state?: State; regions: Region[]; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [name, setName] = useState(state?.name ?? "");
  const [regionId, setRegionId] = useState(state?.regionId ?? regions[0]?.id ?? "");
  const { saving, error, submit } = useLevelSubmit(async () => {
    const response = await fetch(mode === "create" ? "/api/territory/states" : `/api/territory/states/${state!.id}`, { method: mode === "create" ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, regionId }) });
    return { response, message: `${name} was ${mode === "create" ? "added" : "updated"}.` };
  }, onSaved);
  return <Modal title={mode === "create" ? "Add state" : "Edit state"} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Region *"><Select value={regionId} onChange={setRegionId} options={regions.map((r) => ({ value: r.id, label: r.name }))} /></Field>
      <Field label="State name *"><Input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} required /></Field>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onClose={onClose} disabled={!regionId} />
    </form>
  </Modal>;
}

function CityForm({ mode, city, states, onClose, onSaved }: { mode: "create" | "edit"; city?: City; states: State[]; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [name, setName] = useState(city?.name ?? "");
  const [stateId, setStateId] = useState(city?.stateId ?? states[0]?.id ?? "");
  const { saving, error, submit } = useLevelSubmit(async () => {
    const response = await fetch(mode === "create" ? "/api/territory/cities" : `/api/territory/cities/${city!.id}`, { method: mode === "create" ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, stateId }) });
    return { response, message: `${name} was ${mode === "create" ? "added" : "updated"}.` };
  }, onSaved);
  return <Modal title={mode === "create" ? "Add city" : "Edit city"} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="State *"><Select value={stateId} onChange={setStateId} options={states.map((s) => ({ value: s.id, label: s.name }))} /></Field>
      <Field label="City name *"><Input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} required /></Field>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onClose={onClose} disabled={!stateId} />
    </form>
  </Modal>;
}

function TerritoryForm({ mode, territory, data, onClose, onSaved }: { mode: "create" | "edit"; territory?: Territory; data: Hierarchy; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [name, setName] = useState(territory?.name ?? "");
  const [regionId, setRegionId] = useState(territory?.regionId ?? data.regions[0]?.id ?? "");
  const statesInRegion = useMemo(() => data.states.filter((s) => s.regionId === regionId), [data.states, regionId]);
  const [stateId, setStateId] = useState(territory?.stateId ?? statesInRegion[0]?.id ?? "");
  const citiesInState = useMemo(() => data.cities.filter((c) => c.stateId === stateId), [data.cities, stateId]);
  const [cityId, setCityId] = useState(territory?.cityId ?? citiesInState[0]?.id ?? "");
  const { saving, error, submit } = useLevelSubmit(async () => {
    const response = await fetch(mode === "create" ? "/api/territory/territories" : `/api/territory/territories/${territory!.id}`, { method: mode === "create" ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, regionId, stateId, cityId }) });
    return { response, message: `${name} was ${mode === "create" ? "added" : "updated"}.` };
  }, onSaved);
  return <Modal title={mode === "create" ? "Add territory" : "Edit territory"} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Region *"><Select value={regionId} onChange={(v) => { setRegionId(v); const next = data.states.filter((s) => s.regionId === v); setStateId(next[0]?.id ?? ""); setCityId(""); }} options={data.regions.map((r) => ({ value: r.id, label: r.name }))} /></Field>
      <Field label="State *"><Select value={stateId} onChange={(v) => { setStateId(v); const next = data.cities.filter((c) => c.stateId === v); setCityId(next[0]?.id ?? ""); }} options={statesInRegion.map((s) => ({ value: s.id, label: s.name }))} /></Field>
      <Field label="City *"><Select value={cityId} onChange={setCityId} options={citiesInState.map((c) => ({ value: c.id, label: c.name }))} /></Field>
      <Field label="Territory name *"><Input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} required /></Field>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onClose={onClose} disabled={!regionId || !stateId || !cityId} />
    </form>
  </Modal>;
}

function BeatForm({ mode, beat, territories, staff, onClose, onSaved }: { mode: "create" | "edit"; beat?: Beat; territories: Territory[]; staff: StaffOption[]; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [name, setName] = useState(beat?.name ?? "");
  const [territoryId, setTerritoryId] = useState(beat?.territoryId ?? territories[0]?.id ?? "");
  const [assignedStaffId, setAssignedStaffId] = useState(beat?.assignedStaffId ?? "");
  const [visitFrequencyDays, setVisitFrequencyDays] = useState(beat?.visitFrequencyDays ? String(beat.visitFrequencyDays) : "");
  const { saving, error, submit } = useLevelSubmit(async () => {
    const response = await fetch(mode === "create" ? "/api/territory/beats" : `/api/territory/beats/${beat!.id}`, { method: mode === "create" ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, territoryId, assignedStaffId: assignedStaffId || undefined, visitFrequencyDays: visitFrequencyDays ? Number(visitFrequencyDays) : undefined }) });
    return { response, message: `${name} was ${mode === "create" ? "added" : "updated"}.` };
  }, onSaved);
  return <Modal title={mode === "create" ? "Add beat" : "Edit beat"} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Territory *"><Select value={territoryId} onChange={setTerritoryId} options={territories.map((t) => ({ value: t.id, label: t.name }))} /></Field>
      <Field label="Beat name *"><Input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} required /></Field>
      <Field label="Assigned staff"><Select value={assignedStaffId} onChange={setAssignedStaffId} options={[{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} /></Field>
      <Field label="Visit frequency (days)"><Input type="number" min="1" max="60" value={visitFrequencyDays} onChange={(e) => setVisitFrequencyDays(e.target.value)} placeholder="e.g. 7" /></Field>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onClose={onClose} disabled={!territoryId} />
    </form>
  </Modal>;
}

function useLevelSubmit(run: () => Promise<{ response: Response; message: string }>, onSaved: (message: string) => Promise<void>) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const { response, message } = await run();
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to save this record."));
      await onSaved(message);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save this record."); setSaving(false); }
  };
  return { saving, error, submit };
}

function ConfirmDelete({ name, onClose, onConfirm }: { name: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false);
  return <Modal title="Delete record" onClose={onClose}>
    <p className="text-sm text-foreground">Delete <span className="font-semibold">{name}</span>? This cannot be undone.</p>
    <div className="mt-5 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
      <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      <button type="button" disabled={deleting} onClick={async () => { setDeleting(true); await onConfirm(); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-danger px-4 text-[13px] font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50 sm:h-10">{deleting && <LoaderCircle className="animate-spin" size={16} />}{deleting ? "Deleting…" : "Delete"}</button>
    </div>
  </Modal>;
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">{label}</span>{children}</label>; }
function FormError({ message }: { message: string }) { return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{message}</p>; }
function FormActions({ saving, disabled, onClose }: { saving: boolean; disabled?: boolean; onClose: () => void }) {
  return <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
    <Button type="submit" disabled={saving || disabled}>{saving && <LoaderCircle className="animate-spin" size={16} />}{saving ? "Saving…" : "Save"}</Button>
  </div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/40 p-3 backdrop-blur-[1px] sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
    <div className="my-auto flex max-h-[calc(100dvh-24px)] w-full max-w-md flex-col rounded-xl border bg-white shadow-[0_20px_48px_rgba(15,23,42,0.18)] sm:max-h-[calc(100dvh-32px)]">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4"><h2 className="text-base font-semibold text-foreground">{title}</h2><button type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-background sm:size-8" aria-label="Close"><X size={17} /></button></div>
      <div className="overflow-y-auto p-4 sm:p-5">{children}</div>
    </div>
  </div>;
}
