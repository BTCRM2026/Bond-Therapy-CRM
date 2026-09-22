"use client";

import { CalendarClock, Clock3, IndianRupee, ListChecks, LogIn, MapPin, ShoppingBag, Target, TrendingUp, Trophy, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { KpiCard } from "@/components/ui/kpi-card";

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

  if (loading) return <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><div className="h-[108px] animate-pulse rounded-xl bg-white" /><div className="h-[108px] animate-pulse rounded-xl bg-white" /><div className="h-[108px] animate-pulse rounded-xl bg-white" /><div className="h-[108px] animate-pulse rounded-xl bg-white" /></div>;
  if (!data) return null;

  const progress = data.target ? Math.min(100, Math.round((data.achieved / data.target) * 100)) : null;

  return <div className="space-y-5">
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Sales overview">
      <KpiCard icon={IndianRupee} label="Revenue achieved" value={money(data.achieved)} detail={`${MONTHS[data.period.month - 1]} ${data.period.year}`} tone="success" />
      <Link href="/dashboard/orders" className="group"><KpiCard icon={ShoppingBag} label="Orders booked" value={data.orderCount} detail="Confirmed this month" className="h-full group-hover:-translate-y-0.5 group-hover:border-brand/30" /></Link>
      <Link href="/dashboard/leads" className="group"><KpiCard icon={UserPlus} label="Open leads" value={data.openLeads} detail="Awaiting conversion" tone="warning" className="h-full group-hover:-translate-y-0.5 group-hover:border-brand/30" /></Link>
      <Link href="/dashboard/follow-ups" className="group"><KpiCard icon={ListChecks} label="Overdue follow-ups" value={data.overdueFollowUps} detail={data.overdueFollowUps ? "Needs attention" : "Nothing overdue"} tone={data.overdueFollowUps ? "danger" : "neutral"} className="h-full group-hover:-translate-y-0.5 group-hover:border-brand/30" /></Link>
    </section>

    {progress != null && <section className="crm-surface p-5">
      <div className="flex items-center justify-between gap-4"><div><h2 className="text-sm font-semibold text-foreground">Monthly target</h2><p className="mt-1 text-xs text-muted">{money(data.achieved)} of {money(data.target ?? 0)}</p></div><span className="text-lg font-semibold text-brand-dark">{progress}%</span></div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div>
    </section>}

    {data.leaderboard && <section className="rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3 border-b px-5 py-4"><span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand"><Trophy size={17} /></span><div><h3 className="text-sm font-semibold text-foreground">Team this month</h3><p className="mt-0.5 text-xs text-muted">Ranked by revenue booked</p></div></div>
      <div className="divide-y">{data.leaderboard.map((member, index) => <div key={member.id} className="flex items-center gap-3 px-5 py-3.5">
        <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${index === 0 ? "bg-warning-soft text-warning" : "bg-background text-muted"}`}>{index + 1}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{member.name}</p><p className="text-xs text-muted">{member.orderCount} order{member.orderCount === 1 ? "" : "s"}{member.target ? ` · target ${money(member.target)}` : ""}</p></div>
        <p className="shrink-0 text-sm font-semibold text-foreground">{money(member.achieved)}</p>
      </div>)}</div>
    </section>}

    <section><div className="mb-3"><h2 className="text-sm font-semibold text-foreground">Quick actions</h2><p className="mt-0.5 text-xs text-muted">Common sales workflows</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <QuickLink href="/dashboard/leads" icon={UserPlus} label="Add lead" />
      <QuickLink href="/dashboard/follow-ups" icon={Clock3} label="Follow-ups" />
      <QuickLink href="/dashboard/orders" icon={TrendingUp} label="Orders" />
      <QuickLink href="/dashboard/products" icon={Target} label="Catalogue" />
      <QuickLink href="/dashboard/demos" icon={CalendarClock} label="Book demo" />
      <QuickLink href="/dashboard/territory" icon={MapPin} label="Territory" />
      <QuickLink href="/dashboard/attendance" icon={LogIn} label="Attendance" />
      <QuickLink href="/dashboard/incentives" icon={IndianRupee} label="Incentives" />
    </div></section>
  </div>;
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof Target; label: string }) {
  return <Link href={href} className="crm-surface flex h-[72px] items-center gap-3 px-4 text-xs font-semibold text-foreground transition hover:-translate-y-0.5 hover:border-brand/30"><span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand"><Icon size={17} /></span>{label}</Link>;
}
