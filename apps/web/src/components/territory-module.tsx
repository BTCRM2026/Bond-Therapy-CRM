"use client";

import { AlertTriangle, CalendarClock, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { KpiCard } from "@/components/ui/kpi-card";

type TerritoryClient = {
  id: string; salonName: string; city: string; area: string | null; territory: string | null; routeBeat: string | null;
  beatId: string | null; visitFrequencyDays: number | null; potential: string | null; status: string; lastVisitAt: string | null;
};
type RouteStop = { clientId: string; status: string };
type RouteData = { stops: RouteStop[] };

const DAY_MS = 24 * 60 * 60 * 1000;
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function coverageTone(lastVisitAt: string | null, now: number, frequencyDays: number) {
  if (!lastVisitAt) return { label: "Never visited", cls: "bg-red-50 text-danger" };
  const days = Math.floor((now - new Date(lastVisitAt).getTime()) / DAY_MS);
  if (days > frequencyDays) return { label: `${days}d since visit`, cls: "bg-warning-soft text-warning" };
  return { label: `${days}d since visit`, cls: "bg-success-soft text-success" };
}

export function TerritoryModule() {
  const [clients, setClients] = useState<TerritoryClient[] | null>(null);
  const [todayStopClientIds, setTodayStopClientIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());
  const today = useMemo(() => dateKey(new Date()), []);

  useEffect(() => {
    (async () => {
      try {
        const [clientsRes, routeRes] = await Promise.all([fetch("/api/clients/territory", { cache: "no-store" }), fetch(`/api/routes/${today}`, { cache: "no-store" })]);
        const clientsJson = await clientsRes.json().catch(() => null);
        if (!clientsRes.ok) throw new Error("Unable to load territory coverage.");
        setClients(clientsJson as TerritoryClient[]);
        const routeJson = await routeRes.json().catch(() => null) as RouteData | null;
        if (routeRes.ok && routeJson) setTodayStopClientIds(new Set(routeJson.stops.filter((stop) => stop.status === "PLANNED").map((stop) => stop.clientId)));
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load territory coverage."); }
      finally { setLoading(false); }
    })();
  }, [today]);

  if (loading) return <div className="space-y-3"><div className="h-24 animate-pulse rounded-xl bg-background" /><div className="h-24 animate-pulse rounded-xl bg-background" /></div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>;
  if (!clients?.length) return <div className="rounded-xl border bg-white px-5 py-14 text-center shadow-[0_3px_12px_rgba(15,23,42,0.04)]"><MapPin className="mx-auto text-subtle" size={26} /><p className="mt-3 text-sm font-semibold text-foreground">No salons assigned yet</p></div>;

  const frequencyFor = (client: TerritoryClient) => client.visitFrequencyDays ?? 14;
  const daysSince = (client: TerritoryClient) => client.lastVisitAt ? Math.floor((now - new Date(client.lastVisitAt).getTime()) / DAY_MS) : null;
  const visited = clients.filter((client) => client.lastVisitAt).length;
  const coveragePercent = clients.length ? Math.round((visited / clients.length) * 1000) / 10 : 0;

  const dueToday = clients.filter((client) => todayStopClientIds.has(client.id));
  const unvisited = clients.filter((client) => !client.lastVisitAt && !todayStopClientIds.has(client.id));
  const overdue = clients.filter((client) => { const days = daysSince(client); return days !== null && days > frequencyFor(client) && !todayStopClientIds.has(client.id); });
  const needsAttention = [...unvisited, ...overdue.filter((client) => !unvisited.includes(client))]
    .sort((a, b) => (a.potential === "HIGH" ? -1 : 0) - (b.potential === "HIGH" ? -1 : 0))
    .slice(0, 20);

  const groups = new Map<string, TerritoryClient[]>();
  for (const client of clients) {
    const key = client.territory?.trim() || "Unassigned territory";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(client);
  }

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <KpiCard icon={MapPin} label="Assigned salons" value={clients.length} />
      <KpiCard icon={Star} label="Visited" value={visited} tone="success" detail={`${clients.length - visited} unvisited`} />
      <KpiCard icon={AlertTriangle} label="Coverage" value={`${coveragePercent}%`} tone={coveragePercent >= 70 ? "success" : "warning"} />
    </div>

    {dueToday.length > 0 && <section className="overflow-hidden rounded-xl border border-brand/25 bg-brand-soft/40">
      <div className="flex items-center gap-3 border-b border-brand/15 px-4 py-3 sm:px-5"><span className="grid size-9 place-items-center rounded-lg bg-white text-brand"><CalendarClock size={17} /></span><div><h3 className="text-sm font-semibold text-foreground">Due today</h3><p className="mt-0.5 text-xs text-muted">{dueToday.length} planned on today&apos;s route</p></div></div>
      <div className="divide-y divide-brand/10">{dueToday.map((client) => <ClientRow key={client.id} client={client} now={now} frequencyDays={frequencyFor(client)} />)}</div>
    </section>}

    {needsAttention.length > 0 && <section className="overflow-hidden rounded-xl border border-warning/30 bg-warning-soft/60">
      <div className="flex items-center justify-between gap-3 border-b border-warning/20 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-white text-warning"><AlertTriangle size={17} /></span><div><h3 className="text-sm font-semibold text-foreground">Needs attention</h3><p className="mt-0.5 text-xs text-muted">{needsAttention.length} salon{needsAttention.length === 1 ? "" : "s"} unvisited or overdue</p></div></div>
        <Link href="/dashboard/route" className="shrink-0 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-brand-dark hover:bg-brand-soft">Plan visit →</Link>
      </div>
      <div className="divide-y divide-warning/15">{needsAttention.map((client) => <ClientRow key={client.id} client={client} now={now} frequencyDays={frequencyFor(client)} />)}</div>
    </section>}

    {Array.from(groups.entries()).map(([territory, members]) => <section key={territory} className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
      <div className="border-b px-4 py-3 sm:px-5"><p className="text-sm font-semibold text-foreground">{territory}</p><p className="mt-0.5 text-xs text-muted">{members.length} salon{members.length === 1 ? "" : "s"}</p></div>
      <div className="divide-y">{members.map((client) => <ClientRow key={client.id} client={client} now={now} frequencyDays={frequencyFor(client)} />)}</div>
    </section>)}
  </div>;
}

function ClientRow({ client, now, frequencyDays }: { client: TerritoryClient; now: number; frequencyDays: number }) {
  const coverage = coverageTone(client.lastVisitAt, now, frequencyDays);
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
