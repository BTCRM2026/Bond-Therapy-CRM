"use client";

import { Check, Download, Eye, FileBadge2, FileText, History, Plus, Search, Send, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { Field, FormError } from "@/components/ui/field";
import { FilterMenu } from "@/components/ui/filter-menu";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";
import { Modal } from "@/components/ui/modal";
import { APPOINTMENT_SALARY_COMPONENTS, COMPENSATION_LETTER_TYPES, LETTER_CATEGORIES, LETTER_FIELDS, LETTER_LABELS, LETTER_TYPES, SALARY_COMPONENTS, type LetterType } from "@/lib/letter-types";

type LetterStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "GENERATED" | "SENT" | "ACKNOWLEDGED" | "REJECTED" | "SUPERSEDED" | "CANCELLED";

type LetterRow = {
  id: string;
  letterNumber: string;
  type: LetterType;
  recipientName: string;
  recipientDesignation: string | null;
  recipientDepartment: string | null;
  issuedDate: string;
  createdAt: string;
  status: LetterStatus;
  version: number;
  approvedAt: string | null;
  managementApprovedAt: string | null;
  activities: Array<{ id: string; action: string; actorName: string | null; comment: string | null; createdAt: string }>;
  generatedBy: { id: string; name: string };
};

type LettersPage = { items: LetterRow[]; total: number; page: number; pageSize: number; hasMore: boolean; stats: { total: number; thisMonth: number; byType: Record<string, number> } };
const EMPTY_PAGE: LettersPage = { items: [], total: 0, page: 1, pageSize: 20, hasMore: false, stats: { total: 0, thisMonth: 0, byType: {} } };
const messageFrom = (data: unknown, fallback: string) => (data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback);
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
const CATEGORY_ORDER = ["Hiring", "Compensation", "Compliance", "Exit"];
const pretty = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const finalStatuses: LetterStatus[] = ["GENERATED", "SENT", "ACKNOWLEDGED"];

export function LetterManagement({ initial }: { initial: LettersPage | null }) {
  const [data, setData] = useState<LettersPage>(initial ?? EMPTY_PAGE);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const sync = () => setHeaderSlot(document.getElementById("page-header-actions"));
    sync();
    const frame = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Every change of filter or page asks the server for just that page of letters.
  const reload = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search.trim()) params.set("search", search.trim());
    if (typeFilter) params.set("type", typeFilter);
    if (statusFilter) params.set("status", statusFilter);
    const response = await fetch(`/api/letters?${params}`, { cache: "no-store" });
    if (!response.ok) return;
    const next = await response.json() as LettersPage;
    if (!next.items.length && page > 1) { setPage(page - 1); return; }
    setData(next);
  }, [page, pageSize, search, typeFilter, statusFilter]);
  const firstLoad = useRef(Boolean(initial));
  useEffect(() => {
    if (firstLoad.current) { firstLoad.current = false; return; }
    const timer = setTimeout(() => { void reload(); }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [reload, search]);

  const letters = data.items;
  const categoryCount = (category: string) => Object.entries(data.stats.byType).filter(([type]) => LETTER_CATEGORIES[type as LetterType] === category).reduce((sum, [, count]) => sum + count, 0);
  const hiringCount = categoryCount("Hiring");
  const complianceCount = categoryCount("Compliance");

  return (
    <>
      {headerSlot && createPortal(<Button onClick={() => setCreating(true)}><Plus size={16} /><span className="hidden sm:inline">New letter</span><span className="sr-only sm:hidden">New letter</span></Button>, headerSlot)}

      <div className="space-y-4">
        <KpiStrip columns={4}>
          <KpiCell label="Total letters" value={data.stats.total} detail="Official HR records" />
          <KpiCell label="Issued this month" value={data.stats.thisMonth} detail="Current month" tone="brand" />
          <KpiCell label="Hiring letters" value={hiringCount} detail="Offer to confirmation" />
          <KpiCell label="Compliance letters" value={complianceCount} detail="Warnings and NOCs" />
        </KpiStrip>

        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={16} />
            <Input className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search recipient or letter number" aria-label="Search letters" />
          </label>
          <FilterMenu value={typeFilter} showLabelOnMobile ariaLabel="Filter by letter type" onSelect={(value) => { setTypeFilter(value); setPage(1); }} options={[{ key: "", label: "All types" }, ...LETTER_TYPES.map((type) => ({ key: type, label: LETTER_LABELS[type] }))]} />
          <FilterMenu value={statusFilter} showLabelOnMobile ariaLabel="Filter by document status" onSelect={(value) => { setStatusFilter(value); setPage(1); }} options={[{ key: "", label: "All statuses" }, ...["DRAFT", "PENDING_APPROVAL", "APPROVED", "GENERATED", "SENT", "ACKNOWLEDGED", "REJECTED", "CANCELLED"].map((status) => ({ key: status, label: pretty(status) }))]} />
          {data.total > 0 && <CompactPagination page={data.page} pageSize={data.pageSize} total={data.total} hasMore={data.hasMore} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
        </div>

        <section className="crm-surface overflow-hidden">
          {letters.length ? <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-left text-[13px]"><thead className="border-b bg-background text-[10px] font-bold uppercase tracking-[0.1em] text-muted"><tr><th className="px-5 py-3">Document</th><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Issued</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y">{letters.map((letter) => <tr key={letter.id} className="transition-colors hover:bg-brand-soft/30"><td className="px-5 py-3.5"><p className="font-semibold text-foreground">{LETTER_LABELS[letter.type]}</p><p className="mt-0.5 font-mono text-[11px] text-muted">{letter.letterNumber} · v{letter.version}</p></td><td className="px-4 py-3.5"><p className="font-medium text-foreground">{letter.recipientName}</p><p className="mt-0.5 text-xs text-muted">{letter.recipientDesignation || letter.recipientDepartment || "External recipient"}</p></td><td className="px-4 py-3.5"><StatusBadge value={letter.status} /></td><td className="px-4 py-3.5 text-xs text-muted">{dateLabel(letter.issuedDate)}</td><td className="px-5 py-3.5"><LetterActions letter={letter} onChanged={reload} /></td></tr>)}</tbody></table></div>
            <div className="divide-y md:hidden">{letters.map((letter) => <article key={letter.id} className="p-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><FileBadge2 size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{LETTER_LABELS[letter.type]}</p><p className="mt-0.5 truncate font-mono text-[11px] text-muted">{letter.letterNumber} · v{letter.version}</p></div><StatusBadge value={letter.status} /></div><div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-background p-3 text-xs"><div><p className="text-muted">Employee</p><p className="mt-1 truncate font-medium text-foreground">{letter.recipientName}</p></div><div><p className="text-muted">Issued</p><p className="mt-1 font-medium text-foreground">{dateLabel(letter.issuedDate)}</p></div></div><div className="mt-3"><LetterActions letter={letter} onChanged={reload} /></div></article>)}</div>
          </> : <div className="px-5 py-14 text-center"><FileText className="mx-auto text-subtle" size={28} /><p className="mt-3 text-sm font-semibold">No matching letters</p><p className="mt-1 text-xs text-muted">Create a letter or adjust the current search and filter.</p></div>}
        </section>
      </div>

      {creating && <LetterCreateModal onClose={() => setCreating(false)} onCreated={reload} />}
    </>
  );
}

function StatusBadge({ value }: { value: LetterStatus }) {
  const tone = value === "ACKNOWLEDGED" || value === "GENERATED" ? "bg-emerald-50 text-emerald-700" : value === "REJECTED" || value === "CANCELLED" ? "bg-red-50 text-red-700" : value === "PENDING_APPROVAL" ? "bg-amber-50 text-amber-700" : "bg-background text-muted";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ${tone}`}>{pretty(value)}</span>;
}

function LetterActions({ letter, onChanged }: { letter: LetterRow; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const act = async (action: string, comment?: string) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/letters/${letter.id}/${action}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ comment }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to update this document."));
      await onChanged();
    } catch (error) { window.alert(error instanceof Error ? error.message : "Unable to update this document."); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${letter.letterNumber} for ${letter.recipientName}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/letters/${letter.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to delete this document."));
      await onChanged();
    } catch (error) { window.alert(error instanceof Error ? error.message : "Unable to delete this document."); }
    finally { setBusy(false); }
  };
  const workflow = letter.status === "DRAFT" || letter.status === "REJECTED" ? { key: "submit", label: "Submit", icon: Send }
    : letter.status === "PENDING_APPROVAL" ? { key: "approve", label: letter.type === "TERMINATION" && letter.approvedAt ? "Management approve" : "Approve", icon: Check }
      : letter.status === "APPROVED" ? { key: "generate", label: "Generate final", icon: ShieldCheck }
        : letter.status === "GENERATED" ? { key: "sent", label: "Mark sent", icon: Send }
          : letter.status === "SENT" ? { key: "acknowledge", label: "Acknowledge", icon: Check } : null;
  return <div className="flex flex-wrap justify-end gap-2">
    <a href={`/api/letters/${letter.id}/pdf?preview=1`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-white px-3 text-xs font-semibold text-foreground transition-colors hover:bg-background"><Eye size={14} />Preview</a>
    {workflow && <Button disabled={busy} className="h-9 px-3" onClick={() => act(workflow.key)}><workflow.icon size={14} />{workflow.label}</Button>}
    {letter.status === "PENDING_APPROVAL" && <Button disabled={busy} className="h-9 px-3" variant="secondary" onClick={() => { const reason = window.prompt("Reason for rejection"); if (reason?.trim()) void act("reject", reason); }}>Reject</Button>}
    {finalStatuses.includes(letter.status) && <a href={`/api/letters/${letter.id}/pdf?download=1`} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-white px-3 text-xs font-semibold text-foreground"><Download size={14} />PDF</a>}
    {finalStatuses.includes(letter.status) && <button disabled={busy} onClick={() => { const reason = window.prompt("Reason for creating a new version"); if (reason?.trim()) void act("supersede", reason); }} className="inline-flex h-9 items-center rounded-lg border bg-white px-3 text-xs font-semibold text-foreground hover:bg-background">New version</button>}
    <button disabled={busy} onClick={() => void remove()} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"><Trash2 size={14} />Delete</button>
    <span className="inline-flex h-9 items-center gap-1.5 px-2 text-[11px] text-muted" title={letter.activities.map((item) => `${dateLabel(item.createdAt)} · ${pretty(item.action)} · ${item.actorName ?? "System"}`).join("\n")}><History size={13} />{letter.activities.length}</span>
  </div>;
}

function LetterCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [type, setType] = useState<LetterType>("OFFER");
  const [recipientName, setRecipientName] = useState("");
  const [issuedDate, setIssuedDate] = useState(new Date().toISOString().slice(0, 10));
  const [details, setDetails] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [staffUserId, setStaffUserId] = useState("");
  const [staff, setStaff] = useState<Array<{ id: string; name: string; email: string | null; department: string | null; managerName: string | null; profile: { employeeCode: string; jobTitle: string; employmentType: string; joiningDate: string; dateOfBirth: string | null; workLocation: string | null; residentialAddress: string | null } | null }>>([]);

  useEffect(() => { void fetch("/api/letters/options", { cache: "no-store" }).then((response) => response.ok ? response.json() : []).then(setStaff); }, []);

  const fields = LETTER_FIELDS[type];
  const hasCompensation = (COMPENSATION_LETTER_TYPES as readonly string[]).includes(type);
  const total = (part: "A" | "B" | "C", period: "Monthly" | "Annual") => SALARY_COMPONENTS.filter((item) => item.part === part).reduce((sum, item) => sum + (Number(details[`${item.key}${period}`]) || 0), 0);
  const ctcMonthly = total("A", "Monthly") + total("B", "Monthly") + total("C", "Monthly");
  const ctcAnnual = total("A", "Annual") + total("B", "Annual") + total("C", "Annual");
  const setField = (key: string) => (value: string) => setDetails((current) => ({ ...current, [key]: value }));
  const selectStaff = (id: string, selectedType = type) => {
    setStaffUserId(id);
    const person = staff.find((item) => item.id === id);
    if (!person) return;
    setRecipientName(person.name);
    setDetails((current) => ({ ...current, recipientAddress: person.profile?.residentialAddress ?? "", employeeCode: person.profile?.employeeCode ?? "", designation: person.profile?.jobTitle ?? "", department: person.department ? pretty(person.department) : "", employmentType: person.profile?.employmentType ? pretty(person.profile.employmentType) : "", joiningDate: selectedType === "APPOINTMENT" ? current.joiningDate || "2026-10-01" : person.profile?.joiningDate?.slice(0, 10) ?? current.joiningDate ?? "", dateOfBirth: person.profile?.dateOfBirth?.slice(0, 10) ?? "", workLocation: person.profile?.workLocation ?? "", reportingManager: person.managerName ?? "" }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const recipientDesignation = details.designation || details.newDesignation || details.previousDesignation || undefined;
      const recipientDepartment = details.department || undefined;
      const response = await fetch("/api/letters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, recipientName, recipientDesignation, recipientDepartment, staffUserId: staffUserId || undefined, issuedDate, details }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to generate this letter."));
      setDownloadUrl(`/api/letters/${data.id}/pdf?preview=1`);
      await onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to generate this letter.");
    } finally {
      setSaving(false);
    }
  };

  if (downloadUrl) {
    return (
      <Modal title="Draft created" subtitle="Review the document, then submit it for approval." onClose={onClose}>
        <div className="space-y-4">
          <div className="rounded-lg border border-brand/15 bg-brand-soft/40 px-4 py-3 text-sm text-foreground">{LETTER_LABELS[type]} for <strong>{recipientName}</strong> was saved as a controlled draft.</div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <a href={downloadUrl} target="_blank" rel="noreferrer"><Button type="button" variant="secondary"><Eye size={16} />Preview</Button></a>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Create HR document" subtitle={type === "OFFER" || type === "APPOINTMENT" ? "Pre-fill from a staff record, then review and edit the employee details." : "Employee data is loaded from the CRM and locked into the document snapshot"} onClose={onClose} maxWidth={type === "OFFER" ? "max-w-2xl" : "max-w-4xl"}>
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label="Letter type">
          <FilterMenu value={type} fullWidth showLabelOnMobile ariaLabel="Select letter type" onSelect={(value) => { setType(value); setDetails(value === "APPOINTMENT" ? { joiningDate: "2026-10-01" } : {}); if (staffUserId) selectStaff(staffUserId, value); }} options={CATEGORY_ORDER.flatMap((category) => LETTER_TYPES.filter((item) => LETTER_CATEGORIES[item] === category).map((item) => ({ key: item, label: `${LETTER_LABELS[item]} · ${category}` })))} />
        </Field>

        {type !== "OFFER" && <div className="rounded-lg border bg-background px-4 py-3"><p className="text-xs font-semibold text-foreground">Official document controls</p><p className="mt-1 text-xs leading-5 text-muted">The reference number is generated automatically. Review every employee detail before saving the letter.</p></div>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={type === "OFFER" ? "Pre-fill from staff (optional)" : "Employee record"}><select value={staffUserId} onChange={(event) => selectStaff(event.target.value)} className="h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:border-brand"><option value="">External / pre-employment recipient</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.profile?.employeeCode ?? person.email}</option>)}</select></Field>
          <Field label="Recipient name *"><Input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} required minLength={2} readOnly={Boolean(staffUserId) && type !== "OFFER" && type !== "APPOINTMENT"} /></Field>
          <Field label="Issued date"><Input type="date" value={issuedDate} onChange={(event) => setIssuedDate(event.target.value)} required /></Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {fields.filter((field) => !((hasCompensation || type === "APPOINTMENT") && (field.key === "ctc" || field.key === "newCtc"))).map((field) => (
            <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
              <Field label={`${field.label}${field.required ? " *" : ""}`}>
                {field.type === "textarea" ? (
                  <textarea value={details[field.key] ?? ""} onChange={(event) => setField(field.key)(event.target.value)} required={field.required} maxLength={field.key === "recipientAddress" ? 240 : undefined} rows={field.key === "recipientAddress" ? 2 : 3} placeholder={field.placeholder} className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
                ) : (
                  <Input type={field.type === "date" ? "date" : field.type === "money" ? "number" : "text"} min={field.type === "money" ? 0 : undefined} value={details[field.key] ?? ""} onChange={(event) => setField(field.key)(event.target.value)} required={field.required} placeholder={field.placeholder} />
                )}
              </Field>
            </div>
          ))}
        </div>

        {hasCompensation && <CompensationEditor details={details} setField={setField} total={total} ctcMonthly={ctcMonthly} ctcAnnual={ctcAnnual} showInPdf={type === "APPOINTMENT"} />}
        {type === "APPOINTMENT" && <AppointmentSalaryEditor details={details} setField={setField} />}

        {error && <FormError message={error} />}
        <FormActions saving={saving} onClose={onClose} label="Save draft" />
      </form>
    </Modal>
  );
}

function CompensationEditor({ details, setField, total, ctcMonthly, ctcAnnual, showInPdf }: { details: Record<string, string>; setField: (key: string) => (value: string) => void; total: (part: "A" | "B" | "C", period: "Monthly" | "Annual") => number; ctcMonthly: number; ctcAnnual: number; showInPdf: boolean }) {
  const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  return <section className="overflow-hidden rounded-xl border bg-white">
    <div className="border-b bg-background px-4 py-3"><h3 className="text-sm font-semibold text-foreground">Compensation structure</h3><p className="mt-1 text-xs text-muted">{showInPdf ? "Enter the approved monthly and annual figures. Blank or zero components will not appear in the final PDF." : "Enter the approved figures to calculate annual CTC. The salary table will not appear in this letter."}</p></div>
    <div className="overflow-x-auto"><div className="min-w-[620px]">
      <div className="grid grid-cols-[1fr_180px_180px] border-b px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted"><span>Salary component</span><span>Monthly (INR)</span><span>Annual (INR)</span></div>
      {(["A", "B", "C"] as const).map((part) => <div key={part}>
        <div className="bg-background/70 px-4 py-2 text-xs font-semibold text-foreground">{part === "A" ? "Part A · Fixed earnings" : part === "B" ? "Part B · Variable / bonus" : "Part C · Employer contributions"}</div>
        {SALARY_COMPONENTS.filter((item) => item.part === part).map((item) => <div key={item.key} className="grid grid-cols-[1fr_180px_180px] items-center gap-3 border-t px-4 py-2"><label className="text-sm text-foreground">{item.label}</label><Input type="number" min={0} value={details[`${item.key}Monthly`] ?? ""} onChange={(event) => setField(`${item.key}Monthly`)(event.target.value)} placeholder="0" /><Input type="number" min={0} value={details[`${item.key}Annual`] ?? ""} onChange={(event) => setField(`${item.key}Annual`)(event.target.value)} placeholder="0" /></div>)}
        <div className="grid grid-cols-[1fr_180px_180px] border-t bg-background px-4 py-2 text-sm font-semibold"><span>{part === "A" ? "Total Gross (A)" : `Total (${part})`}</span><span>{money(total(part, "Monthly"))}</span><span>{money(total(part, "Annual"))}</span></div>
      </div>)}
      <div className="grid grid-cols-[1fr_180px_180px] border-t-2 border-foreground/20 bg-brand-soft px-4 py-3 text-sm font-bold text-foreground"><span>Cost to Company (A + B + C)</span><span>{money(ctcMonthly)}</span><span>{money(ctcAnnual)}</span></div>
    </div></div>
  </section>;
}

function AppointmentSalaryEditor({ details, setField }: { details: Record<string, string>; setField: (key: string) => (value: string) => void }) {
  const annual = (monthly: string) => monthly && Number.isFinite(Number(monthly)) ? String(Number((Number(monthly) * 12).toFixed(2))) : "";
  const sum = (part: "A" | "B" | "C", period: "Monthly" | "Annual") => APPOINTMENT_SALARY_COMPONENTS.filter((item) => item.part === part).reduce((total, item) => total + (Number(period === "Annual" ? annual(details[`${item.key}Monthly`] ?? "") : details[`${item.key}Monthly`]) || 0), 0);
  const amount = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const summary = (label: string, monthly: number, annual: number) => <div className="grid grid-cols-[minmax(0,1fr)_1fr_1fr] gap-2 border-t bg-background px-4 py-2 text-xs font-semibold text-foreground sm:grid-cols-[minmax(0,1fr)_150px_150px] sm:text-sm" key={label}><span>{label}</span><span className="text-right">{amount(monthly)}</span><span className="text-right">{amount(annual)}</span></div>;
  return <section className="overflow-hidden rounded-xl border bg-white" aria-label="Annexure A salary break-up">
    <div className="border-b bg-background px-4 py-3"><h3 className="text-sm font-semibold text-foreground">Annexure A · Salary break-up</h3><p className="mt-1 text-xs text-muted">Enter approved monthly amounts. Annual figures are calculated as monthly × 12; blank or zero rows are omitted from the PDF.</p></div>
    <div className="grid grid-cols-[minmax(0,1fr)_1fr_1fr] gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted sm:grid-cols-[minmax(0,1fr)_150px_150px]"><span>Particulars</span><span className="text-right">Per month</span><span className="text-right">Annual</span></div>
    {(["A", "B", "C"] as const).map((part) => <div key={part}>
      <div className="border-t bg-background/70 px-4 py-2 text-xs font-semibold text-foreground">{part === "A" ? "A. Earnings" : part === "B" ? "B. Employee deductions" : "C. Employer contributions / benefits"}</div>
      {APPOINTMENT_SALARY_COMPONENTS.filter((item) => item.part === part).map((item) => <div key={item.key} className="grid grid-cols-2 items-center gap-2 border-t px-4 py-2 sm:grid-cols-[minmax(0,1fr)_150px_150px]"><label className="col-span-2 text-xs text-foreground sm:col-span-1" htmlFor={`${item.key}Monthly`}>{item.label}</label><Input id={`${item.key}Monthly`} type="number" min={0} step="0.01" value={details[`${item.key}Monthly`] ?? ""} onChange={(event) => setField(`${item.key}Monthly`)(event.target.value)} placeholder="Monthly" /><Input type="text" aria-label={`${item.label} annual, calculated`} value={annual(details[`${item.key}Monthly`] ?? "")} placeholder="Auto × 12" className="bg-background text-muted" readOnly /></div>)}
      {summary(part === "A" ? "Gross Earnings (A)" : part === "B" ? "Total Deductions (B)" : "Employer Contributions / Benefits (C)", sum(part, "Monthly"), sum(part, "Annual"))}
      {part === "B" && summary("Net Salary (A-B)", sum("A", "Monthly") - sum("B", "Monthly"), sum("A", "Annual") - sum("B", "Annual"))}
    </div>)}
    {summary("CTC (A+C)", sum("A", "Monthly") + sum("C", "Monthly"), sum("A", "Annual") + sum("C", "Annual"))}
  </section>;
}
