"use client";

import { CalendarDays, History, Map, MapPin, Route, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { KpiCard } from "@/components/ui/kpi-card";

type Assignment = {
  id: string; startDate: string; endDate: string | null; reason: string | null;
  assignedBy: { name: string } | null;
  territory: { id: string; name: string; code: string | null; isActive: boolean; area: { id: string; name: string; city: { id: string; name: string; state: { id: string; name: string; region: { id: string; name: string } } } } };
};
type MineResponse = { active: Assignment[]; assignments: Assignment[] };
const date = (value: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));

export function TerritoryModule() {
  const [data, setData] = useState<MineResponse | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { (async () => {
    try {
      const response = await fetch("/api/territory/me", { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.message || "Unable to load your territory.");
      setData(json as MineResponse);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load your territory."); }
  })(); }, []);

  const summary = useMemo(() => {
    const active = data?.active ?? [];
    return {
      regions: new Set(active.map((item) => item.territory.area.city.state.region.id)).size,
      states: new Set(active.map((item) => item.territory.area.city.state.id)).size,
      cities: new Set(active.map((item) => item.territory.area.city.id)).size,
      areas: new Set(active.map((item) => item.territory.area.id)).size,
    };
  }, [data]);

  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>;
  if (!data) return <div className="space-y-3"><div className="h-24 animate-pulse rounded-xl bg-white" /><div className="h-56 animate-pulse rounded-xl bg-white" /></div>;

  return <div className="space-y-5">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard icon={Map} label="Regions" value={summary.regions} detail="Active responsibility" />
      <KpiCard icon={MapPin} label="States" value={summary.states} detail="Assigned coverage" />
      <KpiCard icon={Route} label="Cities" value={summary.cities} detail="Assigned coverage" />
      <KpiCard icon={ShieldCheck} label="Areas / Territories" value={`${summary.areas} / ${data.active.length}`} detail="Current allocation" tone="brand" />
    </div>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b px-4 py-3 sm:px-5"><h2 className="text-sm font-semibold text-foreground">My geographical responsibility</h2><p className="mt-0.5 text-xs text-muted">Read-only territory allocation managed by Admin</p></div>
        {data.active.length ? <div className="divide-y">{data.active.map((item) => <article key={item.id} className="px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-foreground">{item.territory.name}</p><p className="mt-1 text-xs text-muted">{item.territory.area.name} · {item.territory.area.city.name} · {item.territory.area.city.state.name} · {item.territory.area.city.state.region.name}</p></div><span className="shrink-0 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">Active</span></div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><CalendarDays size={13} />Effective from {date(item.startDate)}</p>
        </article>)}</div> : <div className="px-5 py-14 text-center"><MapPin className="mx-auto text-subtle" size={26} /><p className="mt-3 text-sm font-semibold text-foreground">No active territory assigned</p><p className="mt-1 text-xs text-muted">Your administrator can allocate one or more territories.</p></div>}
      </section>

      <aside className="space-y-3">
        <QuickLink href="/dashboard/route" icon={Route} label="View my routes" detail="Plan and manage visits" />
        <QuickLink href="/dashboard/route" icon={CalendarDays} label="Plan tomorrow's route" detail="Use eligible salons/accounts" />
        <QuickLink href="/dashboard/performance" icon={ShieldCheck} label="View performance" detail="Revenue and activity" />
      </aside>
    </div>

    {data.assignments.length > data.active.length && <section className="overflow-hidden rounded-xl border bg-white"><div className="flex items-center gap-2 border-b px-4 py-3 sm:px-5"><History size={16} className="text-muted" /><h2 className="text-sm font-semibold text-foreground">Allocation history</h2></div><div className="divide-y">{data.assignments.filter((item) => item.endDate).map((item) => <div key={item.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><p className="text-sm font-medium text-foreground">{item.territory.name}</p><p className="text-xs text-muted">{item.territory.area.name} · {item.territory.area.city.name}</p></div><p className="text-xs text-muted">{date(item.startDate)} – {date(item.endDate!)}</p></div>)}</div></section>}
  </div>;
}

function QuickLink({ href, icon: Icon, label, detail }: { href: string; icon: typeof Route; label: string; detail: string }) {
  return <Link href={href} className="flex items-center gap-3 rounded-xl border bg-white p-4 transition-colors hover:border-brand/25 hover:bg-brand-soft/30"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Icon size={17} /></span><span><span className="block text-sm font-semibold text-foreground">{label}</span><span className="mt-0.5 block text-xs text-muted">{detail}</span></span></Link>;
}
