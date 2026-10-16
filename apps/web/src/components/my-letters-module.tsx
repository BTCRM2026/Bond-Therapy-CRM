"use client";

import { Download, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { FormError } from "@/components/ui/field";

type MyLetter = { id: string; letterNumber: string; type: string; typeLabel: string; issuedDate: string; version: number; status: "GENERATED" | "SENT" | "ACKNOWLEDGED" };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const downloadClass = "inline-flex h-10 items-center justify-center gap-2 rounded-lg border bg-white px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:border-brand/25 hover:bg-brand-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20";

export function MyLettersModule() {
  const [letters, setLetters] = useState<MyLetter[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/my-letters", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : "Unable to load your letters.");
        setLetters(data as MyLetter[]);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load your letters."); }
    })();
  }, []);

  if (error) return <FormError message={error} />;
  if (!letters) return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-white" />)}</div>;
  if (!letters.length) return <section className="crm-surface px-5 py-14 text-center">
    <FileText className="mx-auto text-subtle" size={26} />
    <p className="mt-3 text-sm font-semibold text-foreground">No letters yet</p>
    <p className="mt-1 text-xs text-muted">Letters issued to you, such as your appointment or confirmation letter, will appear here to download.</p>
  </section>;

  const link = (letter: MyLetter) => <a href={`/api/my-letters/${letter.id}/pdf`} download className={downloadClass} aria-label={`Download ${letter.typeLabel} ${letter.letterNumber}`}><Download size={15} />Download PDF</a>;

  return <div className="space-y-3">
    <p className="text-xs text-muted">{letters.length} {letters.length === 1 ? "letter" : "letters"} issued to you. You can download them but not change them.</p>
    <section className="crm-surface hidden overflow-hidden md:block">
      <table className="w-full text-left text-[13px]">
        <thead><tr className="border-b bg-background/60 text-xs text-muted"><th className="px-4 py-3 font-medium">Letter</th><th className="px-4 py-3 font-medium">Reference</th><th className="px-4 py-3 font-medium">Issued on</th><th className="px-4 py-3 text-right font-medium">Document</th></tr></thead>
        <tbody className="divide-y">{letters.map((letter) => <tr key={letter.id}>
          <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-dark"><FileText size={17} /></span><span className="font-medium text-foreground">{letter.typeLabel}{letter.version > 1 && <span className="ml-2 text-xs font-normal text-muted">Version {letter.version}</span>}</span></div></td>
          <td className="whitespace-nowrap px-4 py-3 text-muted">{letter.letterNumber}</td>
          <td className="whitespace-nowrap px-4 py-3 text-muted">{day(letter.issuedDate)}</td>
          <td className="px-4 py-3 text-right">{link(letter)}</td>
        </tr>)}</tbody>
      </table>
    </section>
    <div className="space-y-2 md:hidden">{letters.map((letter) => <article key={letter.id} className="crm-surface p-4">
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-dark"><FileText size={18} /></span><div className="min-w-0"><p className="text-sm font-semibold text-foreground">{letter.typeLabel}</p><p className="mt-0.5 truncate text-xs text-muted">{letter.letterNumber} · {day(letter.issuedDate)}{letter.version > 1 ? ` · Version ${letter.version}` : ""}</p></div></div>
      <div className="mt-3 [&>a]:w-full">{link(letter)}</div>
    </article>)}</div>
  </div>;
}
