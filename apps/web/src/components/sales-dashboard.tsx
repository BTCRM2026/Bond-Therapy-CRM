"use client";

import { Clock3, Target, TrendingUp, Trophy, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type DashboardData = {
  period: { month: number; year: number };
  target: number | null;
  achieved: number;
  orderCount: number;
  openLeads: number;
  overdueFollowUps: number;
  leaderboard: Array<{ id: string; name: string; achieved: number; target: number | null; orderCount: number }> | null;
};

const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function SalesDashboardWidgets() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/sales/dashboard", { cache: "no-store" });
        if (response.ok && !cancelled) setData(await response.json());
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="h-28 animate-pulse rounded-xl bg-background" /><div className="h-28 animate-pulse rounded-xl bg-background" /><div className="h-28 animate-pulse rounded-xl bg-background" /><div className="h-28 animate-pulse rounded-xl bg-background" /></div>;
  if (!data) return null;

  const progress = data.target ? Math.min(100, Math.round((data.achieved / data.target) * 100)) : null;

  return <div className="space-y-4">
    <section className="rounded-xl border bg-white p-5 shadow-[0_3px_12px_rgba(15,23,42,0.04)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{MONTHS[data.period.month - 1]} {data.period.year} so far</p><p className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-foreground">{money(data.achieved)}</p></div>
        {data.target != null && <div className="text-right"><p className="text-xs text-muted">Target</p><p className="text-sm font-semibold text-foreground">{money(data.target)}</p></div>}
      </div>
      {progress != null && <div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-1.5 text-xs text-muted">{progress}% of target</p></div>}
      <div className="mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-center">
        <div><p className="text-lg font-semibold text-foreground">{data.orderCount}</p><p className="text-[11px] text-muted">Orders booked</p></div>
        <Link href="/dashboard/leads" className="block"><p className="text-lg font-semibold text-foreground">{data.openLeads}</p><p className="text-[11px] text-muted">Open leads</p></Link>
        <Link href="/dashboard/follow-ups" className="block"><p className={`text-lg font-semibold ${data.overdueFollowUps > 0 ? "text-danger" : "text-foreground"}`}>{data.overdueFollowUps}</p><p className="text-[11px] text-muted">Overdue follow-ups</p></Link>
      </div>
    </section>

    {data.leaderboard && <section className="rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3 border-b px-5 py-4"><span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand"><Trophy size={17} /></span><div><h3 className="text-sm font-semibold text-foreground">Team this month</h3><p className="mt-0.5 text-xs text-muted">Ranked by revenue booked</p></div></div>
      <div className="divide-y">{data.leaderboard.map((member, index) => <div key={member.id} className="flex items-center gap-3 px-5 py-3.5">
        <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${index === 0 ? "bg-warning-soft text-warning" : "bg-background text-muted"}`}>{index + 1}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{member.name}</p><p className="text-xs text-muted">{member.orderCount} order{member.orderCount === 1 ? "" : "s"}{member.target ? ` · target ${money(member.target)}` : ""}</p></div>
        <p className="shrink-0 text-sm font-semibold text-foreground">{money(member.achieved)}</p>
      </div>)}</div>
    </section>}

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <QuickLink href="/dashboard/leads" icon={UserPlus} label="Add lead" />
      <QuickLink href="/dashboard/follow-ups" icon={Clock3} label="Follow-ups" />
      <QuickLink href="/dashboard/orders" icon={TrendingUp} label="Orders" />
      <QuickLink href="/dashboard/products" icon={Target} label="Catalogue" />
    </div>
  </div>;
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof Target; label: string }) {
  return <Link href={href} className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border bg-white text-xs font-semibold text-foreground shadow-[0_2px_8px_rgba(15,23,42,0.03)] hover:border-brand/25 hover:bg-brand-soft/40"><Icon size={18} className="text-brand" />{label}</Link>;
}
