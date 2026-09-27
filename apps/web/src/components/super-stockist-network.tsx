"use client";

import { MessageCircle, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";

export type NetworkDistributor = {
  id: string; businessName: string; contactName: string; phone: string | null; email: string | null; territory: string | null;
  creditLimit: string | null; status: "ONBOARDING" | "ACTIVE" | "INACTIVE"; stock: Array<{ quantityOnHand: number }>; replenishmentRequests: Array<{ id: string }>;
};

export function SuperStockistNetwork({ initial }: { initial: NetworkDistributor[] }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => { const term = search.trim().toLowerCase(); return initial.filter((item) => !term || `${item.businessName} ${item.contactName} ${item.territory ?? ""}`.toLowerCase().includes(term)); }, [initial, search]);
  const pending = initial.reduce((sum, item) => sum + item.replenishmentRequests.length, 0);
  return <div className="space-y-5">
    <KpiStrip columns={3}><KpiCell label="Assigned distributors" value={initial.length} /><KpiCell label="Active" value={initial.filter((item) => item.status === "ACTIVE").length} tone="success" /><KpiCell label="Requests awaiting action" value={pending} tone={pending ? "warning" : "neutral"} /></KpiStrip>
    <section className="crm-surface overflow-hidden">
      <div className="border-b p-4"><label className="relative block max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={16} /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search distributor or territory" /></label></div>
      {filtered.length ? <div className="divide-y">{filtered.map((item) => { const stock = item.stock.reduce((sum, row) => sum + row.quantityOnHand, 0); const phone = item.phone?.replace(/\D/g, ""); const message = encodeURIComponent(`Hello ${item.contactName}, this is regarding your Bond Therapy distribution account.`); return <article key={item.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold">{item.businessName}</h2><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.status === "ACTIVE" ? "bg-success-soft text-success" : item.status === "ONBOARDING" ? "bg-warning-soft text-warning" : "bg-gray-100 text-muted"}`}>{item.status.toLowerCase()}</span></div><p className="mt-1 text-xs text-muted">{item.contactName} · {item.territory || "Territory not assigned"}</p></div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:min-w-48"><div className="rounded-lg bg-background px-3 py-2"><p className="text-muted">Units on hand</p><p className="mt-0.5 font-semibold text-foreground">{stock.toLocaleString("en-IN")}</p></div><div className="rounded-lg bg-background px-3 py-2"><p className="text-muted">Open requests</p><p className="mt-0.5 font-semibold text-foreground">{item.replenishmentRequests.length}</p></div></div>
        {phone ? <a href={`https://wa.me/${phone}?text=${message}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-white px-3 text-xs font-semibold text-foreground hover:bg-background"><MessageCircle size={15} />WhatsApp</a> : <span className="hidden sm:block" />}
      </article>; })}</div> : <div className="px-5 py-16 text-center"><UsersRound className="mx-auto text-subtle" size={28} /><p className="mt-3 text-sm font-semibold">No assigned distributors</p><p className="mt-1 text-xs text-muted">Assign distributors to this Super Stockist from the administration portal.</p></div>}
    </section>
  </div>;
}
