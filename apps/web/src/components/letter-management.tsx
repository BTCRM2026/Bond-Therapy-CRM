"use client";

import { Download, Eye, FileBadge2, FileText, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { FilterMenu } from "@/components/ui/filter-menu";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";
import { Modal } from "@/components/ui/modal";
import { LETTER_CATEGORIES, LETTER_FIELDS, LETTER_LABELS, LETTER_TYPES, type LetterType } from "@/lib/letter-types";

type LetterRow = {
  id: string;
  letterNumber: string;
  type: LetterType;
  recipientName: string;
  recipientDesignation: string | null;
  recipientDepartment: string | null;
  issuedDate: string;
  createdAt: string;
  generatedBy: { id: string; name: string };
};

const messageFrom = (data: unknown, fallback: string) => (data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback);
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
const CATEGORY_ORDER = ["Hiring", "Compensation", "Compliance", "Exit"];

export function LetterManagement({ initial }: { initial: LetterRow[] }) {
  const [letters, setLetters] = useState(initial);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const sync = () => setHeaderSlot(document.getElementById("page-header-actions"));
    sync();
    const frame = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(frame);
  }, []);

  const reload = async () => {
    const response = await fetch("/api/letters", { cache: "no-store" });
    if (response.ok) setLetters(await response.json());
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return letters.filter((letter) => (!typeFilter || letter.type === typeFilter) && (!term || `${letter.recipientName} ${letter.letterNumber}`.toLowerCase().includes(term)));
  }, [letters, search, typeFilter]);

  const thisMonth = useMemo(() => {
    const now = new Date();
    return letters.filter((letter) => { const d = new Date(letter.createdAt ?? letter.issuedDate); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); }).length;
  }, [letters]);
  const hiringCount = useMemo(() => letters.filter((letter) => LETTER_CATEGORIES[letter.type] === "Hiring").length, [letters]);
  const complianceCount = useMemo(() => letters.filter((letter) => LETTER_CATEGORIES[letter.type] === "Compliance").length, [letters]);

  return (
    <>
      {headerSlot && createPortal(<Button onClick={() => setCreating(true)}><Plus size={16} /><span className="hidden sm:inline">New letter</span><span className="sr-only sm:hidden">New letter</span></Button>, headerSlot)}

      <div className="space-y-4">
        <KpiStrip columns={4}>
          <KpiCell label="Total letters" value={letters.length} detail="Official HR records" />
          <KpiCell label="Issued this month" value={thisMonth} detail="Current month" tone="brand" />
          <KpiCell label="Hiring letters" value={hiringCount} detail="Offer to confirmation" />
          <KpiCell label="Compliance letters" value={complianceCount} detail="Warnings and NOCs" />
        </KpiStrip>

        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={16} />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search recipient or letter number" aria-label="Search letters" />
          </label>
          <FilterMenu value={typeFilter} showLabelOnMobile ariaLabel="Filter by letter type" onSelect={setTypeFilter} options={[{ key: "", label: "All types" }, ...LETTER_TYPES.map((type) => ({ key: type, label: LETTER_LABELS[type] }))]} />
        </div>

        <section className="crm-surface overflow-hidden">
          {filtered.length ? <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left text-[13px]"><thead className="border-b bg-background text-[10px] font-bold uppercase tracking-[0.1em] text-muted"><tr><th className="px-5 py-3">Letter</th><th className="px-4 py-3">Recipient</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Issued</th><th className="px-5 py-3 text-right">Document</th></tr></thead><tbody className="divide-y">{filtered.map((letter) => <tr key={letter.id} className="transition-colors hover:bg-brand-soft/30"><td className="px-5 py-3.5"><p className="font-semibold text-foreground">{LETTER_LABELS[letter.type]}</p><p className="mt-0.5 font-mono text-[11px] text-muted">{letter.letterNumber}</p></td><td className="px-4 py-3.5"><p className="font-medium text-foreground">{letter.recipientName}</p><p className="mt-0.5 text-xs text-muted">{letter.recipientDesignation || letter.recipientDepartment || "External recipient"}</p></td><td className="px-4 py-3.5"><span className="inline-flex rounded-full bg-brand-soft px-2 py-1 text-[10px] font-semibold text-brand-dark">{LETTER_CATEGORIES[letter.type]}</span></td><td className="px-4 py-3.5 text-xs text-muted">{dateLabel(letter.issuedDate)}</td><td className="px-5 py-3.5"><LetterActions letter={letter} /></td></tr>)}</tbody></table></div>
            <div className="divide-y md:hidden">{filtered.map((letter) => <article key={letter.id} className="p-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><FileBadge2 size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{LETTER_LABELS[letter.type]}</p><p className="mt-0.5 truncate font-mono text-[11px] text-muted">{letter.letterNumber}</p></div><span className="rounded-full bg-background px-2 py-1 text-[10px] font-semibold text-muted">{LETTER_CATEGORIES[letter.type]}</span></div><div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-background p-3 text-xs"><div><p className="text-muted">Recipient</p><p className="mt-1 truncate font-medium text-foreground">{letter.recipientName}</p></div><div><p className="text-muted">Issued</p><p className="mt-1 font-medium text-foreground">{dateLabel(letter.issuedDate)}</p></div></div><div className="mt-3"><LetterActions letter={letter} /></div></article>)}</div>
          </> : <div className="px-5 py-14 text-center"><FileText className="mx-auto text-subtle" size={28} /><p className="mt-3 text-sm font-semibold">No matching letters</p><p className="mt-1 text-xs text-muted">Create a letter or adjust the current search and filter.</p></div>}
        </section>
      </div>

      {creating && <LetterCreateModal onClose={() => setCreating(false)} onCreated={reload} />}
    </>
  );
}

function LetterActions({ letter }: { letter: LetterRow }) {
  return <div className="flex justify-end gap-2"><a href={`/api/letters/${letter.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-white px-3 text-xs font-semibold text-foreground transition-colors hover:border-brand/25 hover:bg-brand-soft/40"><Eye size={14} />Preview</a><a href={`/api/letters/${letter.id}/pdf?download=1`} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-dark"><Download size={14} />Download</a></div>;
}

function LetterCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [type, setType] = useState<LetterType>("OFFER");
  const [recipientName, setRecipientName] = useState("");
  const [issuedDate, setIssuedDate] = useState(new Date().toISOString().slice(0, 10));
  const [details, setDetails] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  const fields = LETTER_FIELDS[type];
  const setField = (key: string) => (value: string) => setDetails((current) => ({ ...current, [key]: value }));

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
        body: JSON.stringify({ type, recipientName, recipientDesignation, recipientDepartment, issuedDate, details }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to generate this letter."));
      setDownloadUrl(`/api/letters/${data.id}/pdf`);
      await onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to generate this letter.");
    } finally {
      setSaving(false);
    }
  };

  if (downloadUrl) {
    return (
      <Modal title="Letter generated" subtitle="The official one-page PDF is ready." onClose={onClose}>
        <div className="space-y-4">
          <div className="rounded-lg border border-brand/15 bg-brand-soft/40 px-4 py-3 text-sm text-foreground">{LETTER_LABELS[type]} for <strong>{recipientName}</strong> was generated successfully.</div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <a href={downloadUrl} target="_blank" rel="noreferrer"><Button type="button" variant="secondary"><Eye size={16} />Preview</Button></a>
            <a href={`${downloadUrl}?download=1`}><Button type="button"><Download size={16} />Download PDF</Button></a>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Create official letter" subtitle="Generate a numbered, one-page Bond Therapy document" onClose={onClose} maxWidth="max-w-2xl">
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label="Letter type">
          <FilterMenu value={type} fullWidth showLabelOnMobile ariaLabel="Select letter type" onSelect={(value) => { setType(value); setDetails({}); }} options={CATEGORY_ORDER.flatMap((category) => LETTER_TYPES.filter((item) => LETTER_CATEGORIES[item] === category).map((item) => ({ key: item, label: `${LETTER_LABELS[item]} · ${category}` })))} />
        </Field>

        <div className="rounded-lg border bg-background px-4 py-3"><p className="text-xs font-semibold text-foreground">Official document controls</p><p className="mt-1 text-xs leading-5 text-muted">The reference number is generated automatically as BT-HRL-YYYY-0001. Content length and date ranges are validated to protect the one-page layout.</p></div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Recipient name"><Input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} required minLength={2} /></Field>
          <Field label="Issued date"><Input type="date" value={issuedDate} onChange={(event) => setIssuedDate(event.target.value)} required /></Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
              <Field label={`${field.label}${field.required ? " *" : ""}`}>
                {field.type === "textarea" ? (
                  <textarea value={details[field.key] ?? ""} onChange={(event) => setField(field.key)(event.target.value)} required={field.required} rows={3} placeholder={field.placeholder} className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
                ) : (
                  <Input type={field.type === "date" ? "date" : field.type === "money" ? "number" : "text"} min={field.type === "money" ? 0 : undefined} value={details[field.key] ?? ""} onChange={(event) => setField(field.key)(event.target.value)} required={field.required} placeholder={field.placeholder} />
                )}
              </Field>
            </div>
          ))}
        </div>

        {error && <FormError message={error} />}
        <FormActions saving={saving} onClose={onClose} label="Generate letter" />
      </form>
    </Modal>
  );
}
