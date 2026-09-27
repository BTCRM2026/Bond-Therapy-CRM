import { CheckCircle2, FileCheck2, ShieldCheck } from "lucide-react";

type Verification = { valid: true; documentNumber: string; documentType: string; recipientName: string; documentDate: string; version: number; status: string; generatedAt: string };

async function verify(token: string): Promise<Verification | null> {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/verify/${encodeURIComponent(token)}`, { cache: "no-store" });
    return response.ok ? response.json() : null;
  } catch { return null; }
}

export default async function VerifyDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const document = await verify(token);
  return <main className="grid min-h-dvh place-items-center bg-background p-4">
    <section className="w-full max-w-lg rounded-xl border bg-white p-6 shadow-[var(--card-shadow)] sm:p-8">
      <div className="flex items-center gap-3 border-b pb-5"><span className="grid size-11 place-items-center rounded-lg bg-brand-soft text-brand"><ShieldCheck size={22} /></span><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Bond Therapy Professional</p><h1 className="mt-1 text-xl font-semibold text-foreground">HR document verification</h1></div></div>
      {document ? <div className="pt-6"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 size={18} />Verified official document</div><dl className="mt-5 grid gap-4 rounded-lg border bg-background p-4 text-sm sm:grid-cols-2"><Item label="Document number" value={document.documentNumber} /><Item label="Document type" value={document.documentType} /><Item label="Employee" value={document.recipientName} /><Item label="Version" value={`v${document.version}`} /><Item label="Document date" value={new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(document.documentDate))} /><Item label="Status" value={document.status.replaceAll("_", " ")} /></dl><p className="mt-5 text-xs leading-5 text-muted">This page confirms only the official document record. It does not expose private employee or compensation data.</p></div> : <div className="py-10 text-center"><FileCheck2 className="mx-auto text-subtle" size={30} /><h2 className="mt-3 text-base font-semibold text-foreground">Document not verified</h2><p className="mt-2 text-sm text-muted">The document may be a draft, cancelled, superseded, or the verification token may be invalid.</p></div>}
    </section>
  </main>;
}

function Item({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 font-medium text-foreground">{value}</dd></div>; }
