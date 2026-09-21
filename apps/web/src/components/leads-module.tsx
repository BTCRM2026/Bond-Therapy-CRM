"use client";

import { ArrowRightCircle, ChevronLeft, ChevronRight, MessageCircle, Phone, Plus, Search, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Lead = {
  id: string; salonName: string; contactName: string | null; phone: string; whatsappNumber: string | null; city: string | null; area: string | null;
  source: string; status: string; notes: string | null; lostReason: string | null; nextActionAt: string | null;
  assignedTo: { id: string; name: string } | null; convertedClient: { id: string; salonName: string } | null; createdAt: string; updatedAt: string;
};
export type LeadListResponse = { items: Lead[]; page: number; pageSize: number; total: number; hasMore: boolean };

const STAGES = [
  ["", "All"], ["NEW", "New"], ["CONTACTED", "Contacted"], ["QUALIFIED", "Qualified"], ["CONVERTED", "Converted"], ["LOST", "Lost"],
] as const;
const pretty = (value?: string | null) => value ? value.toLowerCase().split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ") : "Not set";
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? (Array.isArray((data as { message: unknown }).message) ? (data as { message: string[] }).message.join(" ") : String((data as { message: unknown }).message)) : fallback;
const isOverdue = (value: string | null) => value ? new Date(value).getTime() < Date.now() : false;

export function LeadsModule({ initial }: { initial: LeadListResponse | null }) {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initial ? "" : "Unable to load leads. Please try again.");

  useEffect(() => { const frame = requestAnimationFrame(() => setHeaderSlot(document.getElementById("page-header-actions"))); return () => cancelAnimationFrame(frame); }, []);
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: "20" });
        if (search.trim()) params.set("search", search.trim());
        if (status) params.set("status", status);
        const response = await fetch(`/api/leads?${params}`, { cache: "no-store" });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error(messageFrom(json, "Unable to load leads."));
        setData(json as LeadListResponse);
        setError("");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load leads."); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [page, search, status]);

  const reload = async () => { const response = await fetch(`/api/leads?page=1&pageSize=20`, { cache: "no-store" }); if (response.ok) setData(await response.json() as LeadListResponse); };

  return <>
    {headerSlot && createPortal(<Button onClick={() => setFormOpen(true)}><Plus size={16} /><span className="hidden sm:inline">Add lead</span><span className="sr-only sm:hidden">Add lead</span></Button>, headerSlot)}
    <div className="space-y-4">
      <label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={17} /><Input className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search salon, contact or phone" aria-label="Search leads" /></label>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {STAGES.map(([value, label]) => (
          <button key={value} type="button" onClick={() => { setStatus(value); setPage(1); }} className={`h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-colors ${status === value ? "border-brand bg-brand text-white" : "text-muted hover:bg-brand-soft/60"}`}>{label}</button>
        ))}
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}
      <section className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5"><div><p className="text-sm font-semibold text-foreground">Pipeline</p><p className="mt-0.5 text-xs text-muted">{data?.total ?? 0} lead{data?.total === 1 ? "" : "s"}</p></div></div>
        {loading && !data ? <div className="space-y-3 p-4"><div className="h-20 animate-pulse rounded-lg bg-background" /><div className="h-20 animate-pulse rounded-lg bg-background" /></div> : data?.items.length ? <>
          <div className="hidden xl:block">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b bg-background text-[10px] font-bold uppercase tracking-[0.1em] text-muted"><tr><th className="px-5 py-3">Salon</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Next action</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y">
                {data.items.map((lead) => <tr key={lead.id} className="transition-colors hover:bg-brand-soft/40">
                  <td className="px-5 py-4"><button type="button" onClick={() => setEditing(lead)} className="text-left font-semibold text-foreground hover:text-brand">{lead.salonName}</button><p className="mt-0.5 text-xs text-muted">{[lead.area, lead.city].filter(Boolean).join(", ") || "Location not set"}</p></td>
                  <td className="px-4 py-4 text-muted">{lead.contactName || "—"}<br /><span className="text-xs">{lead.phone}</span></td>
                  <td className="px-4 py-4 text-muted">{pretty(lead.source)}</td>
                  <td className="px-4 py-4">{lead.nextActionAt ? <span className={isOverdue(lead.nextActionAt) ? "font-medium text-danger" : "text-muted"}>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(lead.nextActionAt))}</span> : <span className="text-subtle">Not set</span>}</td>
                  <td className="px-4 py-4"><LeadStatus value={lead.status} /></td>
                  <td className="px-5 py-4 text-right"><LeadActions lead={lead} onEdit={() => setEditing(lead)} onConverted={reload} /></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="divide-y xl:hidden">{data.items.map((lead) => <LeadCard key={lead.id} lead={lead} onEdit={() => setEditing(lead)} onConverted={reload} />)}</div>
        </> : <EmptyLeads onAdd={() => setFormOpen(true)} />}
        {data && data.total > data.pageSize && <div className="flex items-center justify-between border-t px-4 py-3"><p className="text-xs text-muted">Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</p><div className="flex gap-2"><Button variant="secondary" className="h-9 px-3" disabled={data.page <= 1 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={15} />Previous</Button><Button variant="secondary" className="h-9 px-3" disabled={!data.hasMore || loading} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight size={15} /></Button></div></div>}
      </section>
    </div>
    {formOpen && <LeadForm onClose={() => setFormOpen(false)} onSaved={async () => { setFormOpen(false); await reload(); }} />}
    {editing && <LeadForm lead={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload(); }} />}
  </>;
}

function LeadStatus({ value }: { value: string }) {
  const tone = value === "CONVERTED" ? "bg-success-soft text-success" : value === "LOST" ? "bg-gray-100 text-muted" : value === "QUALIFIED" ? "bg-brand-soft text-brand" : "bg-warning-soft text-warning";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{pretty(value)}</span>;
}

function LeadActions({ lead, onEdit, onConverted }: { lead: Lead; onEdit: () => void; onConverted: () => Promise<void> }) {
  const router = useRouter();
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState("");
  const convert = async () => {
    setConverting(true); setConvertError("");
    try {
      const response = await fetch(`/api/leads/${lead.id}/convert`, { method: "POST" });
      const client = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(client, "Unable to convert this lead."));
      await onConverted();
      router.push(`/dashboard/clients/${client.id}`);
    } catch (cause) { setConvertError(cause instanceof Error ? cause.message : "Unable to convert this lead."); setConverting(false); }
  };
  if (lead.convertedClient) return <a href={`/dashboard/clients/${lead.convertedClient.id}`} className="text-xs font-semibold text-brand hover:text-brand-dark">View salon</a>;
  return <div className="inline-flex items-center gap-2">
    {convertError && <span className="text-xs text-danger">{convertError}</span>}
    <button type="button" onClick={onEdit} className="text-xs font-semibold text-muted hover:text-foreground">Edit</button>
    {lead.status !== "LOST" && <button type="button" disabled={converting} onClick={convert} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-dark disabled:opacity-50"><ArrowRightCircle size={14} />{converting ? "Converting…" : "Convert"}</button>}
  </div>;
}

function LeadCard({ lead, onEdit, onConverted }: { lead: Lead; onEdit: () => void; onConverted: () => Promise<void> }) {
  return <article className="p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><button type="button" onClick={onEdit} className="block truncate text-left text-sm font-semibold text-foreground hover:text-brand">{lead.salonName}</button><p className="mt-1 text-xs text-muted">{pretty(lead.source)}{lead.contactName ? ` · ${lead.contactName}` : ""}</p></div>
      <LeadStatus value={lead.status} />
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-background p-3 text-xs">
      <div><p className="text-muted">Location</p><p className="mt-1 font-medium text-foreground">{[lead.area, lead.city].filter(Boolean).join(", ") || "Not set"}</p></div>
      <div><p className="text-muted">Next action</p><p className={`mt-1 font-medium ${isOverdue(lead.nextActionAt) ? "text-danger" : "text-foreground"}`}>{lead.nextActionAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(lead.nextActionAt)) : "Not set"}</p></div>
    </div>
    <div className="mt-3 flex gap-2">
      <a href={`tel:${lead.phone}`} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border text-xs font-semibold text-foreground"><Phone size={14} />Call</a>
      {lead.whatsappNumber && <a href={`https://wa.me/${lead.whatsappNumber.replace(/\D/g, "")}`} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border text-xs font-semibold text-foreground"><MessageCircle size={14} />WhatsApp</a>}
      <div className="flex flex-1 items-center justify-center"><LeadActions lead={lead} onEdit={onEdit} onConverted={onConverted} /></div>
    </div>
  </article>;
}

function EmptyLeads({ onAdd }: { onAdd: () => void }) { return <div className="px-5 py-14 text-center"><UserPlus className="mx-auto text-subtle" size={28} /><p className="mt-3 text-sm font-semibold text-foreground">No leads yet</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">Add your first enquiry and track it through to a converted salon.</p><Button className="mt-5" onClick={onAdd}><Plus size={15} />Add lead</Button></div>; }

type FormState = { salonName: string; contactName: string; phone: string; whatsappNumber: string; city: string; area: string; source: string; status: string; notes: string; lostReason: string; nextActionAt: string };
function toFormState(lead?: Lead): FormState {
  return { salonName: lead?.salonName ?? "", contactName: lead?.contactName ?? "", phone: lead?.phone ?? "", whatsappNumber: lead?.whatsappNumber ?? "", city: lead?.city ?? "", area: lead?.area ?? "", source: lead?.source ?? "OTHER", status: lead?.status ?? "NEW", notes: lead?.notes ?? "", lostReason: lead?.lostReason ?? "", nextActionAt: lead?.nextActionAt ? lead.nextActionAt.slice(0, 10) : "" };
}

function LeadForm({ lead, onClose, onSaved }: { lead?: Lead; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<FormState>(toFormState(lead));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((value) => ({ ...value, [key]: event.target.value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const payload = { ...form, nextActionAt: form.nextActionAt ? new Date(form.nextActionAt).toISOString() : undefined };
      const response = await fetch(lead ? `/api/leads/${lead.id}` : "/api/leads", { method: lead ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to save this lead."));
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save this lead."); setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#0f172a]/40 p-0 backdrop-blur-[1px] sm:p-4" role="dialog" aria-modal="true" aria-label={lead ? "Edit lead" : "Add lead"}>
    <div className="flex min-h-full w-full flex-col bg-white sm:my-4 sm:min-h-0 sm:max-h-[calc(100dvh-32px)] sm:max-w-lg sm:rounded-xl sm:border sm:shadow-[0_20px_48px_rgba(15,23,42,0.18)]">
      <div className="flex items-center justify-between border-b px-4 py-4 sm:px-5"><div><h2 className="text-base font-semibold text-foreground">{lead ? "Edit lead" : "Add lead"}</h2><p className="mt-1 text-xs text-muted">A quick capture — you can fill in the rest later</p></div><button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-lg text-muted hover:bg-background sm:size-8" aria-label="Close"><X size={18} /></button></div>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <Field label="Salon name *"><Input value={form.salonName} onChange={update("salonName")} required minLength={2} maxLength={160} autoFocus /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Contact name"><Input value={form.contactName} onChange={update("contactName")} /></Field><Field label="Phone *"><Input value={form.phone} onChange={update("phone")} required type="tel" inputMode="tel" minLength={7} /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="WhatsApp number"><Input value={form.whatsappNumber} onChange={update("whatsappNumber")} type="tel" inputMode="tel" /></Field><Field label="Next action date"><Input value={form.nextActionAt} onChange={update("nextActionAt")} type="date" /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Area"><Input value={form.area} onChange={update("area")} /></Field><Field label="City"><Input value={form.city} onChange={update("city")} /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Source"><Select value={form.source} onChange={update("source")} options={[["WEBSITE", "Website"], ["WHATSAPP", "WhatsApp"], ["INSTAGRAM", "Instagram"], ["CALL", "Call"], ["REFERRAL", "Referral"], ["EXHIBITION", "Exhibition"], ["WALK_IN", "Walk-in"], ["OTHER", "Other"]]} /></Field>
            {lead && <Field label="Stage"><Select value={form.status} onChange={update("status")} options={[["NEW", "New"], ["CONTACTED", "Contacted"], ["QUALIFIED", "Qualified"], ["LOST", "Lost"]]} /></Field>}
          </div>
          {lead && form.status === "LOST" && <Field label="Lost reason"><Input value={form.lostReason} onChange={update("lostReason")} maxLength={300} /></Field>}
          <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">Notes</span><textarea value={form.notes} onChange={update("notes")} rows={3} maxLength={1000} className="w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" /></label>
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</p>}
        </div>
        <div className="sticky bottom-0 flex gap-2 border-t bg-white p-4 sm:justify-end sm:px-5"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save lead"}</Button></div>
      </form>
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground">{label}</span>{children}</label>; }
function Select({ value, onChange, options }: { value: string; onChange: (event: ChangeEvent<HTMLSelectElement>) => void; options: string[][] }) { return <select value={value} onChange={onChange} className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10">{options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>; }
