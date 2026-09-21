"use client";

import { AlertTriangle, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type TerritoryClient = {
  id: string; salonName: string; city: string; area: string | null; territory: string | null; routeBeat: string | null;
  potential: string | null; status: string; lastVisitAt: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function coverageTone(lastVisitAt: string | null, now: number) {
  if (!lastVisitAt) return { label: "Never visited", cls: "bg-red-50 text-danger" };
  const days = Math.floor((now - new Date(lastVisitAt).getTime()) / DAY_MS);
  if (days > 14) return { label: `${days}d since visit`, cls: "bg-warning-soft text-warning" };
  return { label: `${days}d since visit`, cls: "bg-success-soft text-success" };
}

export function TerritoryModule() {
  const [clients, setClients] = useState<TerritoryClient[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/clients/territory", { cache: "no-store" });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error("Unable to load territory coverage.");
        setClients(json as TerritoryClient[]);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load territory coverage."); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="space-y-3"><div className="h-24 animate-pulse rounded-xl bg-background" /><div className="h-24 animate-pulse rounded-xl bg-background" /></div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>;
  if (!clients?.length) return <div className="rounded-xl border bg-white px-5 py-14 text-center shadow-[0_3px_12px_rgba(15,23,42,0.04)]"><MapPin className="mx-auto text-subtle" size={26} /><p className="mt-3 text-sm font-semibold text-foreground">No salons assigned yet</p></div>;

  const highPotentialUnvisited = clients.filter((client) => client.potential === "HIGH" && (!client.lastVisitAt || now - new Date(client.lastVisitAt).getTime() > 14 * DAY_MS));
  const groups = new Map<string, TerritoryClient[]>();
  for (const client of clients) {
    const key = client.territory?.trim() || "Unassigned territory";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(client);
  }

  return <div className="space-y-5">
    {highPotentialUnvisited.length > 0 && <section className="overflow-hidden rounded-xl border border-warning/30 bg-warning-soft/60">
      <div className="flex items-center gap-3 border-b border-warning/20 px-4 py-3 sm:px-5"><span className="grid size-9 place-items-center rounded-lg bg-white text-warning"><AlertTriangle size={17} /></span><div><h3 className="text-sm font-semibold text-foreground">High-potential, needs a visit</h3><p className="mt-0.5 text-xs text-muted">{highPotentialUnvisited.length} salon{highPotentialUnvisited.length === 1 ? "" : "s"} flagged</p></div></div>
      <div className="divide-y divide-warning/15">{highPotentialUnvisited.map((client) => <ClientRow key={client.id} client={client} now={now} />)}</div>
    </section>}
    {Array.from(groups.entries()).map(([territory, members]) => <section key={territory} className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
      <div className="border-b px-4 py-3 sm:px-5"><p className="text-sm font-semibold text-foreground">{territory}</p><p className="mt-0.5 text-xs text-muted">{members.length} salon{members.length === 1 ? "" : "s"}</p></div>
      <div className="divide-y">{members.map((client) => <ClientRow key={client.id} client={client} now={now} />)}</div>
    </section>)}
  </div>;
}

function ClientRow({ client, now }: { client: TerritoryClient; now: number }) {
  const coverage = coverageTone(client.lastVisitAt, now);
  return <Link href={`/dashboard/clients/${client.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-brand-soft/40 sm:px-5">
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-foreground">{client.salonName}</p>
      <p className="mt-0.5 text-xs text-muted">{[client.routeBeat, client.area, client.city].filter(Boolean).join(" · ")}</p>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {client.potential === "HIGH" && <Star size={13} className="fill-warning text-warning" />}
      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${coverage.cls}`}>{coverage.label}</span>
    </div>
  </Link>;
}
