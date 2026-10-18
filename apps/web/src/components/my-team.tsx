"use client";

import { ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AttendanceCalendar, type CalendarRecord } from "@/components/attendance-calendar";
import { DayDetailModal } from "@/components/team-activity-day";
import { AttendanceBadge, EmptyBlock, Pill, RowsSkeleton, compactMoney, money, todayKey } from "@/components/team-activity-shared";
import { FormError } from "@/components/ui/field";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type Member = { staffId: string; name: string; loginId: string; roleName: string; status: string; verifiedCalls: number; reportSubmitted: boolean; dayNote: string | null; sales: number; orders: number; target: number | null; percent: number | null };
type Team = { date: string; period: { month: number; year: number }; totals: { members: number; working: number; reportsSubmitted: number; verifiedCalls: number; sales: number; target: number | null }; items: Member[] };
type Month = { period: { month: number; year: number }; summary: Record<string, number>; records: CalendarRecord[] };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const FULL_DAY_CALLS = 8;
const messageOf = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data && typeof (data as { message: unknown }).message === "string" ? (data as { message: string }).message : fallback;

async function load<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(messageOf(data, "Unable to load your team."));
  return data as T;
}

// An Area Sales Manager's read-only view of their team. Approvals stay with the administrator.
export function MyTeam() {
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Member | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { const data = await load<Team>("/api/my-team"); if (!cancelled) setTeam(data); }
      catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load your team."); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) return <FormError message={error} />;
  if (!team) return <RowsSkeleton rows={4} />;
  if (!team.items.length) return <EmptyBlock title="No team members yet" message="Your administrator assigns sales executives to you from Staff & Access. They will appear here." />;

  const { totals } = team;
  const percent = totals.target ? Math.round((totals.sales / totals.target) * 100) : null;
  return <div className="space-y-5">
    <KpiStrip columns={4}>
      <KpiCell label="Team sales" value={compactMoney(totals.sales)} detail={totals.target ? `of ${compactMoney(totals.target)} · ${percent}%` : `${MONTHS[team.period.month - 1]} · confirmed`} tone="success" />
      <KpiCell label="Working today" value={`${totals.working}/${totals.members}`} detail="Started their day" />
      <KpiCell label="Reports submitted" value={`${totals.reportsSubmitted}/${totals.members}`} detail="Due by 11 PM" tone={totals.reportsSubmitted === totals.members ? "success" : "warning"} />
      <KpiCell label="Verified calls" value={totals.verifiedCalls} detail="Across the team today" />
    </KpiStrip>

    <section className="crm-surface overflow-hidden" aria-label="Team members">
      <div className="border-b px-4 py-3 sm:px-5"><h2 className="text-sm font-semibold text-foreground">Your team</h2><p className="mt-0.5 text-xs text-muted">Confirmed sales are for {MONTHS[team.period.month - 1]} {team.period.year}. Tap a person to see their calendar.</p></div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-left text-[13px]">
          <thead className="border-b bg-background text-[11px] uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Today</th><th className="px-4 py-3">Calls</th><th className="px-4 py-3">Report</th><th className="px-4 py-3">Sales this month</th><th className="w-10 px-2 py-3" /></tr></thead>
          <tbody className="divide-y">{team.items.map((member) => <tr key={member.staffId} onClick={() => setOpen(member)} className="cursor-pointer hover:bg-brand-soft/30">
            <td className="px-4 py-3"><button type="button" onClick={(event) => { event.stopPropagation(); setOpen(member); }} className="text-left font-medium text-foreground hover:text-brand focus-visible:underline focus-visible:outline-none">{member.name}</button><p className="text-xs text-muted">{member.roleName} · {member.loginId}</p></td>
            <td className="px-4 py-3"><AttendanceBadge status={member.status} /></td>
            <td className="px-4 py-3"><Calls value={member.verifiedCalls} /></td>
            <td className="px-4 py-3"><ReportPill submitted={member.reportSubmitted} /></td>
            <td className="min-w-[220px] px-4 py-3"><Sales member={member} /></td>
            <td className="px-2 py-3 text-subtle"><ChevronRight size={16} /></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="divide-y md:hidden">{team.items.map((member) => <button key={member.staffId} type="button" onClick={() => setOpen(member)} className="block w-full space-y-3 px-4 py-4 text-left hover:bg-brand-soft/30">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{member.name}</p><p className="text-xs text-muted">{member.roleName}</p></div><AttendanceBadge status={member.status} /></div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted"><Calls value={member.verifiedCalls} /><ReportPill submitted={member.reportSubmitted} /></div>
        <Sales member={member} />
      </button>)}</div>
    </section>

    {open && <MemberCalendar member={open} onClose={() => setOpen(null)} />}
  </div>;
}

function Calls({ value }: { value: number }) {
  return <span className="inline-flex items-baseline gap-1 text-sm"><strong className={cn("font-semibold", value >= FULL_DAY_CALLS ? "text-success" : "text-foreground")}>{value}</strong><span className="text-xs text-muted">/ {FULL_DAY_CALLS} calls</span></span>;
}

function ReportPill({ submitted }: { submitted: boolean }) {
  return submitted ? <Pill tone="success">Submitted</Pill> : <Pill>Pending</Pill>;
}

function Sales({ member }: { member: Member }) {
  const bar = member.percent == null ? 0 : Math.min(100, member.percent);
  return <div>
    <div className="flex items-baseline justify-between gap-3"><p className="text-sm font-semibold text-foreground">{money(member.sales)}</p><p className="text-xs text-muted">{member.target ? `of ${compactMoney(member.target)} · ${member.percent}%` : `${member.orders} ${member.orders === 1 ? "order" : "orders"} · no target`}</p></div>
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background" role="progressbar" aria-label={`${member.name} sales against target`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={bar}><div className={cn("h-full rounded-full transition-[width] duration-200", member.percent != null && member.percent >= 100 ? "bg-success" : "bg-brand")} style={{ width: `${bar}%` }} /></div>
  </div>;
}

// One person's month as a calendar; tapping a day opens what they did that day.
function MemberCalendar({ member, onClose }: { member: Member; onClose: () => void }) {
  const [period, setPeriod] = useState(() => { const key = todayKey(); return { month: Number(key.slice(5, 7)), year: Number(key.slice(0, 4)) }; });
  const [data, setData] = useState<Month | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [day, setDay] = useState<string | null>(null);

  const fetchMonth = useCallback(async (month: number, year: number) => {
    setBusy(true);
    try { setData(await load<Month>(`/api/my-team/${member.staffId}/month?month=${month}&year=${year}`)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load this month."); }
    finally { setBusy(false); }
  }, [member.staffId]);
  useEffect(() => { const timer = window.setTimeout(() => { void fetchMonth(period.month, period.year); }, 0); return () => window.clearTimeout(timer); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = data?.summary;
  return <>
    <Modal title={member.name} subtitle={`${member.roleName} · ${member.loginId}`} onClose={onClose} maxWidth="max-w-2xl">
      <div className="-m-4 sm:-m-5">
        {error && <div className="p-4"><FormError message={error} /></div>}
        {summary && <div className="grid grid-cols-3 gap-px overflow-hidden border-b bg-border sm:grid-cols-6">{([["Present", "present"], ["Late", "late"], ["Half day", "halfDay"], ["Absent", "absent"], ["Leave", "leave"], ["Hours", "totalHours"]] as const).map(([label, key]) => <div key={key} className="bg-white px-3 py-2.5"><p className="text-[11px] font-medium text-muted">{label}</p><p className="mt-0.5 text-base font-semibold text-foreground">{summary[key] ?? 0}</p></div>)}</div>}
        <AttendanceCalendar month={period.month} year={period.year} records={data?.records ?? []} loading={busy} onMonthChange={(month, year) => { setPeriod({ month, year }); void fetchMonth(month, year); }} onSelectDay={setDay} />
      </div>
    </Modal>
    {day && <DayDetailModal url={`/api/my-team/${member.staffId}/day?date=${day}`} photoBase="/api/my-team/calls" onClose={() => setDay(null)} />}
  </>;
}
