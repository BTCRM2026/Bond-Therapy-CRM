"use client";

import { CalendarPlus, CheckCircle2, Flag, Plus, Search, Users, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Demo = {
  id: string; status: string; purpose: string | null; personMet: string | null; note: string | null; scheduledAt: string | null; attendeeCount: number | null; outcome: string | null;
  requestedProducts: Array<{ productId: string; name: string; quantity: number }> | null;
  client: { id: string; salonName: string; city: string; primaryContact: string };
  assignedTo: { id: string; name: string } | null;
};
type ClientOption = { id: string; salonName: string; city: string };
type Trainer = { id: string; name: string };
type ProductOption = { id: string; name: string; unitPrice: string };

const OUTCOMES = [
  ["INTERESTED", "Interested"], ["TRIAL_REQUIRED", "Trial required"], ["QUOTATION_REQUESTED", "Quotation requested"], ["NOT_INTERESTED", "Not interested"], ["FOLLOW_UP_REQUIRED", "Follow-up required"],
];
const pretty = (value?: string | null) => value ? value.toLowerCase().split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ") : "";
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback;
const isPast = (value: string | null) => value ? new Date(value).getTime() < Date.now() : false;

function OutcomeBadge({ outcome }: { outcome: string }) {
  const tone = outcome === "INTERESTED" || outcome === "QUOTATION_REQUESTED" ? "bg-success-soft text-success" : outcome === "NOT_INTERESTED" ? "bg-gray-100 text-muted" : "bg-warning-soft text-warning";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{pretty(outcome)}</span>;
}

export function DemoBookingModule() {
  const [demos, setDemos] = useState<Demo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [outcomeTarget, setOutcomeTarget] = useState<Demo | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  useEffect(() => { const sync = () => setHeaderSlot(document.getElementById("page-header-actions")); sync(); const frame = requestAnimationFrame(sync); return () => cancelAnimationFrame(frame); }, []);

  const reload = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/clients/activities?type=DEMO&scope=all", { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(json, "Unable to load demos."));
      setDemos(json as Demo[]);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load demos."); }
    finally { setLoading(false); }
  };
  useEffect(() => { (async () => { await reload(); })(); }, []);

  const upcoming = demos?.filter((demo) => demo.status === "OPEN") ?? [];
  const past = demos?.filter((demo) => demo.status !== "OPEN") ?? [];

  return <>
    {headerSlot && createPortal(<Button onClick={() => setFormOpen(true)}><Plus size={16} /><span className="hidden sm:inline">Book demo</span><span className="sr-only sm:hidden">Book demo</span></Button>, headerSlot)}
    <div className="space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}
      <section className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
        <div className="border-b px-4 py-3 sm:px-5"><p className="text-sm font-semibold text-foreground">Upcoming demos</p><p className="mt-0.5 text-xs text-muted">{upcoming.length} scheduled</p></div>
        {loading && !demos ? <div className="space-y-3 p-4"><div className="h-20 animate-pulse rounded-lg bg-background" /></div>
          : upcoming.length ? <div className="divide-y">{upcoming.map((demo) => <DemoRow key={demo.id} demo={demo} onLogOutcome={() => setOutcomeTarget(demo)} />)}</div>
          : <div className="px-5 py-10 text-center"><CalendarPlus className="mx-auto text-subtle" size={26} /><p className="mt-3 text-sm font-semibold text-foreground">No demos booked</p><p className="mt-1 text-xs text-muted">Book a Demo Team slot for a salon.</p><Button className="mt-4" onClick={() => setFormOpen(true)}><Plus size={15} />Book demo</Button></div>}
      </section>
      {past.length > 0 && <section className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
        <div className="border-b px-4 py-3 sm:px-5"><p className="text-sm font-semibold text-foreground">Past demos</p><p className="mt-0.5 text-xs text-muted">{past.length} completed</p></div>
        <div className="divide-y">{past.map((demo) => <DemoRow key={demo.id} demo={demo} onLogOutcome={() => setOutcomeTarget(demo)} />)}</div>
      </section>}
    </div>
    {formOpen && <BookDemoForm onClose={() => setFormOpen(false)} onSaved={async () => { setFormOpen(false); await reload(); }} />}
    {outcomeTarget && <OutcomeForm demo={outcomeTarget} onClose={() => setOutcomeTarget(null)} onSaved={async () => { setOutcomeTarget(null); await reload(); }} />}
  </>;
}

function DemoRow({ demo, onLogOutcome }: { demo: Demo; onLogOutcome: () => void }) {
  const overdue = demo.status === "OPEN" && isPast(demo.scheduledAt);
  return <div className="flex gap-3 p-4 sm:px-5">
    <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${overdue ? "bg-red-50 text-danger" : "bg-brand-soft text-brand"}`}><Flag size={16} /></span>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{demo.client.salonName}</p>
        <span className={`text-[11px] font-semibold ${overdue ? "text-danger" : "text-muted"}`}>{demo.scheduledAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(demo.scheduledAt)) : "No date set"}</span>
      </div>
      <p className="mt-1 text-xs text-muted">{demo.purpose || "Demo"}{demo.assignedTo ? ` · ${demo.assignedTo.name}` : ""}{demo.attendeeCount ? ` · ${demo.attendeeCount} attendees` : ""}</p>
      {demo.requestedProducts && demo.requestedProducts.length > 0 && <p className="mt-1 text-xs text-muted">{demo.requestedProducts.map((item) => `${item.name} × ${item.quantity}`).join(", ")}</p>}
      <div className="mt-2 flex items-center gap-2">
        {demo.outcome && <OutcomeBadge outcome={demo.outcome} />}
        {demo.status === "OPEN" && <Button variant="secondary" className="h-9 px-3" onClick={onLogOutcome}><CheckCircle2 size={13} />Log outcome</Button>}
      </div>
    </div>
  </div>;
}

function BookDemoForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientOption[]>([]);
  const [client, setClient] = useState<ClientOption | null>(null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [assignedToId, setAssignedToId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [attendeeCount, setAttendeeCount] = useState("");
  const [note, setNote] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [requestedProducts, setRequestedProducts] = useState<Array<{ productId: string; name: string; quantity: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { fetch("/api/clients/trainers", { cache: "no-store" }).then((response) => response.ok ? response.json() : []).then(setTrainers).catch(() => {}); }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (client || !clientSearch.trim()) { setClientResults([]); return; }
      const response = await fetch(`/api/clients?search=${encodeURIComponent(clientSearch.trim())}&pageSize=6`, { cache: "no-store" });
      if (response.ok) { const json = await response.json(); setClientResults(json.items ?? []); }
    }, 250);
    return () => clearTimeout(timer);
  }, [clientSearch, client]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!productSearch.trim()) { setProductResults([]); return; }
      const response = await fetch(`/api/products?search=${encodeURIComponent(productSearch.trim())}&pageSize=6`, { cache: "no-store" });
      if (response.ok) { const json = await response.json(); setProductResults(json.items ?? []); }
    }, 250);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const addProduct = (product: ProductOption) => {
    if (requestedProducts.some((item) => item.productId === product.id)) return;
    setRequestedProducts((current) => [...current, { productId: product.id, name: product.name, quantity: 1 }]);
    setProductSearch(""); setProductResults([]);
  };
  const removeProduct = (productId: string) => setRequestedProducts((current) => current.filter((item) => item.productId !== productId));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!client) { setError("Select a salon first."); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        type: "DEMO", purpose: purpose.trim() || undefined, note: note.trim() || undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        assignedToId: assignedToId || undefined, attendeeCount: attendeeCount ? Number(attendeeCount) : undefined,
        requestedProducts: requestedProducts.length ? requestedProducts : undefined,
      };
      const response = await fetch(`/api/clients/${client.id}/activities`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to book this demo."));
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to book this demo."); setSaving(false); }
  };

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/40 p-0 backdrop-blur-[1px] sm:p-4" role="dialog" aria-modal="true" aria-label="Book demo">
    <div className="flex min-h-full w-full flex-col overflow-hidden bg-white sm:my-4 sm:min-h-0 sm:max-h-[calc(100dvh-32px)] sm:max-w-lg sm:rounded-xl sm:border sm:shadow-[0_20px_48px_rgba(15,23,42,0.18)]">
      <div className="flex items-center justify-between border-b px-4 py-4 sm:px-5"><div><h2 className="text-base font-semibold text-foreground">Book demo</h2><p className="mt-1 text-xs text-muted">Reserve a Demo Team slot for a salon</p></div><button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-lg text-muted hover:bg-background sm:size-8" aria-label="Close"><X size={18} /></button></div>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <div>
            <p className="mb-1.5 text-xs font-medium text-foreground">Salon *</p>
            {client ? <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2.5"><span className="text-sm font-medium text-foreground">{client.salonName}</span><button type="button" onClick={() => setClient(null)} className="text-xs font-semibold text-brand">Change</button></div>
              : <div className="relative"><label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={17} /><Input className="pl-9" value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Search salon name" autoFocus /></label>
                {clientResults.length > 0 && <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-[0_12px_32px_rgba(15,23,42,0.14)]">{clientResults.map((option) => <button key={option.id} type="button" onClick={() => { setClient(option); setClientResults([]); }} className="flex w-full flex-col items-start px-3 py-2.5 text-left hover:bg-brand-soft/40"><span className="text-sm font-medium text-foreground">{option.salonName}</span><span className="text-xs text-muted">{option.city}</span></button>)}</div>}
              </div>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">Trainer</span><select value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)} className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10"><option value="">Not yet assigned</option>{trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.name}</option>)}</select></label>
            <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">Preferred date & time</span><Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
          </div>
          <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">Objective</span><Input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="e.g. Bond repair range demo" maxLength={160} /></label>
          <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">Salon staff attending</span><Input type="number" min="0" inputMode="numeric" value={attendeeCount} onChange={(event) => setAttendeeCount(event.target.value)} placeholder="0" /></label>
          <div>
            <p className="mb-1.5 text-xs font-medium text-foreground">Requested products</p>
            <label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={17} /><Input className="pl-9" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search product" /></label>
            {productResults.length > 0 && <div className="mt-1.5 max-h-36 space-y-1 overflow-y-auto rounded-lg border bg-background p-1.5">{productResults.map((product) => <button key={product.id} type="button" onClick={() => addProduct(product)} className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white"><span className="text-foreground">{product.name}</span><Plus size={14} className="text-brand" /></button>)}</div>}
            {requestedProducts.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{requestedProducts.map((item) => <span key={item.productId} className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand">{item.name}<button type="button" onClick={() => removeProduct(item.productId)} aria-label={`Remove ${item.name}`}><X size={12} /></button></span>)}</div>}
          </div>
          <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">Notes</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={1000} className="w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" /></label>
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</p>}
        </div>
        <div className="sticky bottom-0 flex gap-2 border-t bg-white p-4 sm:justify-end sm:px-5"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Booking…" : "Book demo"}</Button></div>
      </form>
    </div>
  </div>;
}

function OutcomeForm({ demo, onClose, onSaved }: { demo: Demo; onClose: () => void; onSaved: () => Promise<void> }) {
  const [outcome, setOutcome] = useState("INTERESTED");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/clients/activities/${demo.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "COMPLETED", outcome, note: note.trim() || undefined }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to log this outcome."));
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to log this outcome."); setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/40 p-0 backdrop-blur-[1px] sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Log demo outcome">
    <div className="w-full rounded-xl border bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.18)] sm:max-w-sm">
      <div className="flex items-center gap-2"><Users size={16} className="text-brand" /><h2 className="text-base font-semibold text-foreground">Log outcome</h2></div>
      <p className="mt-1 text-xs text-muted">{demo.client.salonName}</p>
      <div className="mt-4 space-y-3">
        <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">Outcome</span><select value={outcome} onChange={(event) => setOutcome(event.target.value)} className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10">{OUTCOMES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">Notes</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={1000} className="w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" /></label>
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</p>}
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" disabled={saving} onClick={submit}>{saving ? "Saving…" : "Save outcome"}</Button></div>
    </div>
  </div>;
}
