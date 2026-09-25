"use client";

import { Building2, CheckCircle2, ImageUp, Landmark, LoaderCircle, PenLine, ReceiptText, Save, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type BillingSettingsData = {
  legalName: string; tradeName: string; gstin: string | null; pan: string | null; registeredAddress: string | null; city: string | null; state: string | null; stateCode: string | null; pincode: string | null; phone: string | null; email: string | null; website: string | null;
  bankName: string | null; accountName: string | null; accountNumber: string | null; ifsc: string | null; branch: string | null; upiId: string | null;
  invoicePrefix: string; defaultGstRate: string; defaultPaymentTermsDays: number; allowSalesDiscount: boolean; maxSalesDiscountPercent: string; invoiceTerms: string | null; footerNote: string | null;
  accountManagerName: string | null; accountManagerTitle: string | null; logoMime: string | null; signatureMime: string | null;
};

const empty: BillingSettingsData = { legalName: "Bond Therapy", tradeName: "Bond Therapy Professional", gstin: null, pan: null, registeredAddress: null, city: null, state: null, stateCode: null, pincode: null, phone: null, email: null, website: null, bankName: null, accountName: null, accountNumber: null, ifsc: null, branch: null, upiId: null, invoicePrefix: "BT", defaultGstRate: "18", defaultPaymentTermsDays: 30, allowSalesDiscount: false, maxSalesDiscountPercent: "0", invoiceTerms: null, footerNote: null, accountManagerName: null, accountManagerTitle: "Account Manager", logoMime: null, signatureMime: null };

export function BillingSettings({ initial }: { initial: BillingSettingsData | null }) {
  const [form, setForm] = useState(initial ?? empty); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const set = (key: keyof BillingSettingsData, value: string | boolean | number) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => { setSaving(true); setMessage(""); setError(""); try { const response = await fetch("/api/billing/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, defaultGstRate: Number(form.defaultGstRate), maxSalesDiscountPercent: Number(form.maxSalesDiscountPercent), defaultPaymentTermsDays: Number(form.defaultPaymentTermsDays) }) }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.message ?? "Unable to save billing settings."); setForm(data); setMessage("Company-wide billing settings saved."); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save billing settings."); } finally { setSaving(false); } };
  return <section className="crm-surface overflow-hidden">
    <div className="flex items-center gap-3 border-b px-5 py-4"><span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand"><ReceiptText size={18} /></span><div><h2 className="text-sm font-semibold text-foreground">Company & billing</h2><p className="mt-0.5 text-xs text-muted">Used across new order drafts, taxes, invoices, PDFs, and payment terms</p></div></div>
    <div className="space-y-6 p-5">
      <div>
        <div className="mb-3 flex items-center gap-2"><ImageUp size={16} className="text-brand" /><h3 className="text-sm font-semibold text-foreground">Invoice branding</h3></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageUploadField label="Company logo" hint="PNG or JPG, square works best" endpoint="/api/billing/settings/logo" hasImage={Boolean(form.logoMime)} onUploaded={(mime) => set("logoMime", mime)} />
          <ImageUploadField label="Signature" hint="PNG or JPG of a scanned/photographed signature (optional)" endpoint="/api/billing/settings/signature" hasImage={Boolean(form.signatureMime)} onUploaded={(mime) => set("signatureMime", mime)} />
          <Field label="Account manager name" value={form.accountManagerName ?? ""} onChange={(v) => set("accountManagerName", v)} />
          <Field label="Account manager title" value={form.accountManagerTitle ?? ""} onChange={(v) => set("accountManagerTitle", v)} />
        </div>
        <p className="mt-3 rounded-lg border border-brand/15 bg-brand-soft/40 px-3 py-2.5 text-xs leading-5 text-muted">If no signature image is uploaded, the account manager&apos;s name is printed in its place on the invoice.</p>
      </div>
      <Section icon={Building2} title="Business identity"><Field label="Legal business name" value={form.legalName} onChange={(v) => set("legalName", v)} /><Field label="Invoice display name" value={form.tradeName} onChange={(v) => set("tradeName", v)} /><Field label="GSTIN" value={form.gstin ?? ""} onChange={(v) => set("gstin", v)} /><Field label="PAN" value={form.pan ?? ""} onChange={(v) => set("pan", v)} /><Field wide label="Registered address" value={form.registeredAddress ?? ""} onChange={(v) => set("registeredAddress", v)} /><Field label="City" value={form.city ?? ""} onChange={(v) => set("city", v)} /><Field label="State" value={form.state ?? ""} onChange={(v) => set("state", v)} /><Field label="GST state code" value={form.stateCode ?? ""} onChange={(v) => set("stateCode", v)} /><Field label="Pincode" value={form.pincode ?? ""} onChange={(v) => set("pincode", v)} /><Field label="Phone" value={form.phone ?? ""} onChange={(v) => set("phone", v)} /><Field label="Billing email" value={form.email ?? ""} onChange={(v) => set("email", v)} /><Field label="Website" value={form.website ?? ""} onChange={(v) => set("website", v)} /></Section>
      <Section icon={ReceiptText} title="Tax & controls"><Field label="Invoice prefix" value={form.invoicePrefix} onChange={(v) => set("invoicePrefix", v.toUpperCase())} /><Field label="Default GST rate (%)" type="number" value={form.defaultGstRate} onChange={(v) => set("defaultGstRate", v)} /><Field label="Payment terms (days)" type="number" value={String(form.defaultPaymentTermsDays)} onChange={(v) => set("defaultPaymentTermsDays", Number(v))} /><Field label="Maximum sales discount (%)" type="number" value={form.maxSalesDiscountPercent} onChange={(v) => set("maxSalesDiscountPercent", v)} /><label className="flex items-center gap-3 rounded-lg border bg-background px-3 py-3 sm:col-span-2"><input type="checkbox" checked={form.allowSalesDiscount} onChange={(event) => set("allowSalesDiscount", event.target.checked)} className="size-4 accent-[var(--brand)]" /><span><span className="block text-xs font-semibold text-foreground">Allow Sales to add discounts</span><span className="text-xs text-muted">Accounts and Admin retain review control.</span></span></label><Field wide label="Invoice terms" value={form.invoiceTerms ?? ""} onChange={(v) => set("invoiceTerms", v)} /><Field wide label="Invoice footer note" value={form.footerNote ?? ""} onChange={(v) => set("footerNote", v)} /></Section>
      <Section icon={Landmark} title="Payment details"><Field label="Bank name" value={form.bankName ?? ""} onChange={(v) => set("bankName", v)} /><Field label="Account name" value={form.accountName ?? ""} onChange={(v) => set("accountName", v)} /><Field label="Account number" value={form.accountNumber ?? ""} onChange={(v) => set("accountNumber", v)} /><Field label="IFSC" value={form.ifsc ?? ""} onChange={(v) => set("ifsc", v.toUpperCase())} /><Field label="Branch" value={form.branch ?? ""} onChange={(v) => set("branch", v)} /><Field label="UPI ID" value={form.upiId ?? ""} onChange={(v) => set("upiId", v)} /></Section>
      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-h-5 text-xs" aria-live="polite">{message && <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 size={14} />{message}</span>}{error && <span className="text-danger">{error}</span>}</div><Button onClick={save} disabled={saving}>{saving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}{saving ? "Saving…" : "Save billing settings"}</Button></div>
    </div>
  </section>;
}

function ImageUploadField({ label, hint, endpoint, hasImage, onUploaded }: { label: string; hint: string; endpoint: string; hasImage: boolean; onUploaded: (mime: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => hasImage ? `${endpoint}?t=${Date.now()}` : null);
  const field = endpoint.endsWith("logo") ? "logo" : "signature";

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true); setError("");
    try {
      const form = new FormData(); form.set(field, file);
      const response = await fetch(endpoint, { method: "POST", body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message ?? "Unable to upload this image.");
      onUploaded(file.type);
      setPreviewUrl(`${endpoint}?t=${Date.now()}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to upload this image."); }
    finally { setUploading(false); }
  };

  return <div className="space-y-1.5">
    <span className="text-xs font-medium text-foreground">{label}</span>
    <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
      {previewUrl ? <img src={previewUrl} alt={label} className="h-12 w-12 rounded-md border bg-white object-contain" /> : <span className="grid size-12 shrink-0 place-items-center rounded-md border bg-white text-subtle"><PenLine size={16} /></span>}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] leading-4 text-muted">{hint}</p>
        <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} className="mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-md border bg-white px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-brand/25 hover:bg-brand-soft disabled:opacity-50">{uploading ? <LoaderCircle className="animate-spin" size={13} /> : <Upload size={13} />}{uploading ? "Uploading…" : previewUrl ? "Replace" : "Upload"}</button>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(event) => upload(event.target.files?.[0])} />
        {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
      </div>
    </div>
  </div>;
}

function Section({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) { return <div><div className="mb-3 flex items-center gap-2"><Icon size={16} className="text-brand" /><h3 className="text-sm font-semibold text-foreground">{title}</h3></div><div className="grid gap-4 sm:grid-cols-2">{children}</div></div>; }
function Field({ label, value, onChange, type = "text", wide = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; wide?: boolean }) { return <label className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}><span className="text-xs font-medium text-foreground">{label}</span><Input type={type} min={type === "number" ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
