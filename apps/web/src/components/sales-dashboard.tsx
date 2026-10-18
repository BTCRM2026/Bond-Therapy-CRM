"use client";

import { ArrowRight, Navigation, RefreshCw, TrendingUp, Trophy, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";
import { isStaffModuleEnabled } from "@/lib/staff-modules";
import { cn } from "@/lib/utils";

type DashboardData = {
  period: { month: number; year: number };
  target: number | null;
  achieved: number;
  orderCount: number;
  openLeads: number;
  overdueFollowUps: number;
  leaderboard: Array<{ id: string; name: string; achieved: number; target: number | null; orderCount: number }> | null;
};
type RouteStop = { id: string; status: string; plannedTime: string | null; client: { salonName: string; city: string } };
type TodayRoute = { stops: RouteStop[] };
type Attendance = { status: string; punchInAt: string | null; visitCount: number; officeCheckedIn: boolean; workingHours: number | null; rulesApplied?: boolean; verifiedCalls?: number; fullDayCalls?: number; halfDayCalls?: number; gate?: { blocked: boolean; message: string | null } };
type ReportToday = { report: { submittedAt: string; summary: { totalCalls: number; productiveCalls: number; totalValue: number; newCalls: number } } | null; performance: { monthNewCalls: number; monthlyTarget: number | null } };
type Snapshot = { dashboard: DashboardData | null; route: TodayRoute | null; attendance: Attendance | null; report: ReportToday | null };

const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const timeOf = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : null;
const pct = (value: number, total: number) => Math.min(100, Math.round((value / total) * 100));

async function load<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    return response.ok ? await response.json() as T : null;
  } catch { return null; }
}

const DAY_STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" | "danger" }> = {
  PRESENT: { label: "Present", tone: "success" },
  LATE: { label: "Present", tone: "warning" },
  HALF_DAY: { label: "Half day", tone: "warning" },
  LEAVE: { label: "On leave", tone: "neutral" },
  WEEKLY_OFF: { label: "Weekly off", tone: "neutral" },
  HOLIDAY: { label: "Holiday", tone: "neutral" },
  NOT_PUNCHED: { label: "Not started", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "neutral" },
  ABSENT: { label: "Absent", tone: "danger" },
};

const STOP_STATUS: Record<string, { label: string; className: string }> = {
  PLANNED: { label: "Pending", className: "bg-warning-soft text-warning" },
  VISITED: { label: "Visited", className: "bg-success-soft text-success" },
  UNABLE_TO_MEET: { label: "Not met", className: "bg-background text-muted" },
  RESCHEDULED: { label: "Rescheduled", className: "bg-background text-muted" },
};

export function SalesDashboardWidgets() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [attempt, setAttempt] = useState(0);

  const refresh = useCallback(() => { setSnapshot(null); setAttempt((value) => value + 1); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [dashboard, route, attendance, report] = await Promise.all([
        load<DashboardData>("/api/sales/dashboard"),
        load<TodayRoute>(`/api/routes/${dateKey(new Date())}`),
        load<Attendance>("/api/attendance/today"),
        load<ReportToday>("/api/daily-reports/today"),
      ]);
      if (!cancelled) setSnapshot({ dashboard, route, attendance, report });
    })();
    return () => { cancelled = true; };
  }, [attempt]);

  if (!snapshot) return <DashboardSkeleton />;
  const { dashboard, route, attendance, report } = snapshot;
  const failed = !dashboard || !route || !attendance || !report;

  const stops = route?.stops.filter((stop) => stop.status !== "REMOVED") ?? [];
  const pending = stops.filter((stop) => stop.status === "PLANNED");
  const visited = stops.filter((stop) => stop.status === "VISITED").length;
  const day = attendance ? DAY_STATUS[attendance.status] ?? { label: attendance.status, tone: "neutral" as const } : null;
  const dayDetail = !attendance ? undefined
    : attendance.punchInAt ? `Started ${timeOf(attendance.punchInAt)}${attendance.visitCount ? ` · ${attendance.visitCount} visit${attendance.visitCount === 1 ? "" : "s"}` : ""}`
    : ["LEAVE", "WEEKLY_OFF", "HOLIDAY"].includes(attendance.status) ? "No work expected today" : "Starts with your first visit";
  const month = dashboard ? `${MONTHS[dashboard.period.month - 1]} ${dashboard.period.year}` : "";
  const revenuePct = dashboard?.target ? pct(dashboard.achieved, dashboard.target) : null;
  const callTarget = report?.performance.monthlyTarget ?? null;
  const showOrders = isStaffModuleEnabled("/dashboard/order-form");
  const pipelineCells = [
    ...(showOrders ? [<KpiCell key="orders" label="Verified orders" value={dashboard ? dashboard.orderCount : "–"} detail="Payment confirmed this month" />] : []),
    ...(isStaffModuleEnabled("/dashboard/leads") ? [<Link key="leads" href="/dashboard/leads" className="contents"><KpiCell label="Open leads" value={dashboard ? dashboard.openLeads : "–"} detail="Awaiting conversion" tone="warning" className="cursor-pointer hover:bg-brand-soft/45" /></Link>] : []),
    ...(isStaffModuleEnabled("/dashboard/follow-ups") ? [<Link key="follow" href="/dashboard/follow-ups" className="contents"><KpiCell label="Overdue follow-ups" value={dashboard ? dashboard.overdueFollowUps : "–"} detail={dashboard?.overdueFollowUps ? "Needs attention" : "Nothing overdue"} tone={dashboard?.overdueFollowUps ? "danger" : "neutral"} className="cursor-pointer hover:bg-brand-soft/45" /></Link>] : []),
  ];

  return <div className="space-y-6">
    {attendance?.gate?.blocked && <div role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-red-50 px-4 py-3 text-sm text-danger"><TriangleAlert size={16} className="mt-0.5 shrink-0" /><p>{attendance.gate.message}</p></div>}
    {failed && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-warning/30 bg-warning-soft/60 px-4 py-3 text-sm text-foreground">
      <span>Some figures could not be loaded. Check your connection and try again.</span>
      <Button variant="secondary" className="h-9 sm:h-9" onClick={refresh}><RefreshCw size={14} />Retry</Button>
    </div>}

    <section aria-label="Today">
      <SectionTitle title="Today" subtitle="Your day at a glance" />
      <KpiStrip columns={4}>
        <KpiCell label="Attendance" value={day?.label ?? "–"} detail={dayDetail ?? "Unavailable"} tone={day?.tone ?? "neutral"} />
        <KpiCell label="Salon visits" value={route ? `${visited}/${stops.length}` : "–"} detail={!route ? "Unavailable" : stops.length === 0 ? "No route planned" : pending.length ? `${pending.length} pending` : "All visits closed"} tone={route && stops.length > 0 && pending.length === 0 ? "success" : "neutral"} />
        <KpiCell label="Daily report" value={report ? (report.report ? "Submitted" : "Pending") : "–"} detail={report ? (report.report ? `At ${timeOf(report.report.submittedAt)}` : "Due by 11 PM") : "Unavailable"} tone={report?.report ? "success" : "warning"} />
        <KpiCell label="Verified calls" value={attendance ? `${attendance.verifiedCalls ?? 0}/${attendance.fullDayCalls ?? 8}` : "–"} detail={attendance ? ((attendance.verifiedCalls ?? 0) >= (attendance.fullDayCalls ?? 8) ? "Full day reached" : (attendance.verifiedCalls ?? 0) >= (attendance.halfDayCalls ?? 4) ? "Half day reached" : `${(attendance.halfDayCalls ?? 4) - (attendance.verifiedCalls ?? 0)} more for a half day`) : "Unavailable"} tone={attendance && (attendance.verifiedCalls ?? 0) >= (attendance.fullDayCalls ?? 8) ? "success" : "neutral"} />
      </KpiStrip>
    </section>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
      <section aria-label="Today's route" className="crm-surface">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div><h2 className="text-sm font-semibold text-foreground">Today&apos;s route</h2><p className="mt-0.5 text-xs text-muted">{stops.length ? `${visited} of ${stops.length} salons visited` : "Salons planned for today"}</p></div>
          <Link href="/dashboard/route" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-dark">Open route<ArrowRight size={14} /></Link>
        </div>
        {stops.length === 0 ? <div className="px-5 py-10 text-center">
          <span className="mx-auto grid size-10 place-items-center rounded-lg bg-background text-muted"><Navigation size={18} /></span>
          <p className="mt-3 text-sm font-medium text-foreground">{route ? "No route planned for today" : "Route unavailable"}</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted">{route ? "Add the salons you will visit. Your day starts with your first visit." : "We could not load your route. Try again in a moment."}</p>
          {route && <Link href="/dashboard/route" className="mt-4 inline-flex h-9 items-center rounded-md border bg-white px-3.5 text-[13px] font-medium text-foreground hover:bg-brand-soft">Plan today&apos;s route</Link>}
        </div> : <ul className="divide-y">{stops.slice(0, 6).map((stop, index) => {
          const state = STOP_STATUS[stop.status] ?? STOP_STATUS.PLANNED;
          return <li key={stop.id} className="flex items-center gap-3 px-5 py-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-background text-xs font-semibold text-muted">{index + 1}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{stop.client.salonName}</p><p className="truncate text-xs text-muted">{stop.client.city}{stop.plannedTime ? ` · ${timeOf(stop.plannedTime)}` : ""}</p></div>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", state.className)}>{state.label}</span>
          </li>;
        })}</ul>}
        {stops.length > 6 && <p className="border-t px-5 py-3 text-xs text-muted">+ {stops.length - 6} more on your route</p>}
      </section>

      <section aria-label="This month" className="crm-surface">
        <div className="border-b px-5 py-4"><h2 className="text-sm font-semibold text-foreground">This month</h2><p className="mt-0.5 text-xs text-muted">{month || "Progress against your targets"}</p></div>
        <div className="space-y-5 p-5">
          <Progress label="Revenue" value={dashboard ? money(dashboard.achieved) : "–"} total={dashboard?.target ? money(dashboard.target) : null} percent={revenuePct} emptyHint={dashboard ? "No revenue target set" : "Unavailable"} />
          <Progress label="New salons" value={report ? String(report.performance.monthNewCalls) : "–"} total={callTarget ? String(callTarget) : null} percent={callTarget && report ? pct(report.performance.monthNewCalls, callTarget) : null} emptyHint={report ? "No call target set" : "Unavailable"} />
          <Link href="/dashboard/my-performance" className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-dark"><TrendingUp size={14} />See full performance<ArrowRight size={14} /></Link>
        </div>
      </section>
    </div>

    {pipelineCells.length > 0 && <section aria-label="Pipeline">
      <SectionTitle title="Pipeline" subtitle={month || undefined} />
      <KpiStrip columns={pipelineCells.length >= 3 ? 3 : 2}>{pipelineCells}</KpiStrip>
    </section>}

    {dashboard?.leaderboard && <section className="crm-surface">
      <div className="flex items-center gap-3 border-b px-5 py-4"><span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand"><Trophy size={17} /></span><div><h3 className="text-sm font-semibold text-foreground">Team this month</h3><p className="mt-0.5 text-xs text-muted">Ranked by revenue booked</p></div></div>
      <div className="divide-y">{dashboard.leaderboard.map((member, index) => <div key={member.id} className="flex items-center gap-3 px-5 py-3.5">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold", index === 0 ? "bg-warning-soft text-warning" : "bg-background text-muted")}>{index + 1}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{member.name}</p><p className="text-xs text-muted">{member.orderCount} order{member.orderCount === 1 ? "" : "s"}{member.target ? ` · target ${money(member.target)}` : ""}</p></div>
        <p className="shrink-0 text-sm font-semibold text-foreground">{money(member.achieved)}</p>
      </div>)}</div>
    </section>}
  </div>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div className="mb-3"><h2 className="text-sm font-semibold text-foreground">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}</div>;
}

function Progress({ label, value, total, percent, emptyHint }: { label: string; value: string; total: string | null; percent: number | null; emptyHint: string }) {
  return <div>
    <div className="flex items-baseline justify-between gap-3"><p className="text-xs font-medium text-muted">{label}</p><p className="text-sm font-semibold text-foreground">{value}{total && <span className="font-normal text-muted"> of {total}</span>}</p></div>
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-background" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? 0}><div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${percent ?? 0}%` }} /></div>
    <p className="mt-1.5 text-xs text-subtle">{percent != null ? `${percent}% achieved` : emptyHint}</p>
  </div>;
}

function DashboardSkeleton() {
  return <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border bg-border sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-[104px] animate-pulse bg-white" />)}</div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]"><div className="h-72 animate-pulse rounded-[10px] border bg-white" /><div className="h-72 animate-pulse rounded-[10px] border bg-white" /></div>
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border bg-border lg:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-[104px] animate-pulse bg-white" />)}</div>
  </div>;
}
