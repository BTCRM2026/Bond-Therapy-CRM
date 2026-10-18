"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";
import { DayDetailModal } from "@/components/team-activity-day";
import { AttendanceBadge, Chips, EmptyBlock, type Page, Pill, RowsSkeleton, clock, compactMoney, money, query, shiftDay, teamApi, todayKey } from "@/components/team-activity-shared";

type Show = "all" | "missing-report" | "not-working";
type BoardRow = { staffId: string; name: string; loginId: string; roleName: string; status: string; onLeave: boolean; firstActivityAt: string | null; lastActivityAt: string | null; workingHours: number | null; fromVisits: boolean; visits: number; openVisits: number; report: { id: string; submittedAt: string; calls: number; orders: number; value: number } | null };
type Board = Page<BoardRow> & { date: string; totals: { staff: number; working: number; onLeave: number; reportsSubmitted: number; reportsMissing: number; visits: number; orderValue: number } };
export function TeamBoard() {
  const [date, setDate] = useState(todayKey);
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await teamApi<Board>(`/board${query({ date, search: search.trim(), show: show === "all" ? undefined : show, page, pageSize })}`)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load the team board."); }
  }, [date, search, show, page, pageSize]);
  useEffect(() => { const timer = setTimeout(() => { load(); }, search ? 300 : 0); return () => clearTimeout(timer); }, [load, search]);

  const totals = data?.totals;
  const changeShow = (next: Show) => { setShow(next); setPage(1); };
  const goTo = (next: string) => { if (next) { setDate(next > todayKey() ? todayKey() : next); setPage(1); } };

  return <div className="space-y-4">
    <KpiStrip columns={5}>
      <KpiCell label="Working" value={totals ? `${totals.working}/${totals.staff}` : "–"} detail="Staff with activity" />
      <KpiCell label="On leave" value={totals ? totals.onLeave : "–"} detail="Approved leave" />
      <KpiCell label="Reports submitted" value={totals ? totals.reportsSubmitted : "–"} detail={totals && totals.reportsMissing ? `${totals.reportsMissing} missing` : "None missing"} tone={totals && totals.reportsMissing ? "warning" : "success"} active={show === "missing-report"} onClick={() => changeShow(show === "missing-report" ? "all" : "missing-report")} />
      <KpiCell label="Salon visits" value={totals ? totals.visits : "–"} detail="GPS-verified check-ins" />
      <KpiCell label="Order value" value={totals ? compactMoney(totals.orderValue) : "–"} detail="From daily reports" tone="success" />
    </KpiStrip>

    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="flex items-center gap-1 rounded-lg border bg-white p-1">
        <button type="button" onClick={() => goTo(shiftDay(date, -1))} className="grid size-9 place-items-center rounded-md text-muted hover:bg-background" aria-label="Previous day"><ChevronLeft size={16} /></button>
        <input type="date" value={date} max={todayKey()} onChange={(event) => goTo(event.target.value)} aria-label="Choose a date" className="h-9 min-w-0 flex-1 bg-transparent px-1 text-center text-[13px] font-semibold text-foreground outline-none" />
        <button type="button" onClick={() => goTo(shiftDay(date, 1))} disabled={date >= todayKey()} className="grid size-9 place-items-center rounded-md text-muted hover:bg-background disabled:opacity-35" aria-label="Next day"><ChevronRight size={16} /></button>
      </div>
      <label className="relative flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search staff by name or login ID" aria-label="Search staff" className="pl-9" /></label>
      {data && data.total > 0 && <CompactPagination page={data.page} pageSize={data.pageSize} total={data.total} hasMore={data.hasMore} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
    </div>
    <Chips label="Filter staff" value={show} onChange={changeShow} options={[{ key: "all", label: "All staff" }, { key: "missing-report", label: "Report missing", count: totals?.reportsMissing }, { key: "not-working", label: "Not working", count: totals ? totals.staff - totals.working : undefined }]} />

    {error && !data && <FormError message={error} />}
    {!data && !error && <RowsSkeleton />}
    {data && !data.items.length && <EmptyBlock title={show === "missing-report" ? "No missing reports" : "No staff match"} message={show === "missing-report" ? "Everyone who worked on this day has submitted a report." : "Try another date, filter or search."} />}

    {data && data.items.length > 0 && <>
      <section className="crm-surface hidden overflow-hidden md:block">
        <table className="w-full text-left text-[13px]">
          <thead><tr className="border-b bg-background/60 text-xs text-muted"><th className="px-4 py-3 font-medium">Staff</th><th className="px-4 py-3 font-medium">Attendance</th><th className="px-4 py-3 font-medium">Salon visits</th><th className="px-4 py-3 font-medium">Daily report</th><th className="w-10 px-2" /></tr></thead>
          <tbody className="divide-y">{data.items.map((row) => <tr key={row.staffId} onClick={() => setOpenId(row.staffId)} className="cursor-pointer align-top transition-colors hover:bg-background/70">
            <td className="px-4 py-3"><button type="button" onClick={(event) => { event.stopPropagation(); setOpenId(row.staffId); }} className="text-left font-medium text-foreground hover:text-brand focus-visible:underline focus-visible:outline-none">{row.name}</button><p className="text-xs text-muted">{row.roleName}</p></td>
            <td className="px-4 py-3"><AttendanceBadge status={row.status} /><p className="mt-1 text-xs text-muted">{row.firstActivityAt ? `${clock(row.firstActivityAt)} – ${clock(row.lastActivityAt)}${row.workingHours ? ` · ${row.workingHours.toFixed(1)} h` : ""}` : "—"}</p></td>
            <td className="px-4 py-3"><span className="font-semibold text-foreground">{row.visits}</span>{row.openVisits > 0 && <span className="ml-2 text-xs font-medium text-warning">{row.openVisits} still checked in</span>}</td>
            <td className="px-4 py-3">{row.report ? <><Pill tone="success">Submitted {clock(row.report.submittedAt)}</Pill><p className="mt-1 text-xs text-muted">{row.report.calls} calls · {row.report.orders} orders · {money(row.report.value)}</p></> : ["PRESENT", "LATE", "HALF_DAY"].includes(row.status) ? <Pill tone="warning">Missing</Pill> : <span className="text-xs text-subtle">—</span>}</td>
            <td className="px-2 py-3 text-subtle"><ChevronRight size={16} /></td>
          </tr>)}</tbody>
        </table>
      </section>
      <div className="space-y-2 md:hidden">{data.items.map((row) => <button key={row.staffId} type="button" onClick={() => setOpenId(row.staffId)} className="crm-surface block w-full space-y-2 p-4 text-left transition-colors hover:bg-background/70">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{row.name}</p><p className="text-xs text-muted">{row.roleName}</p></div><AttendanceBadge status={row.status} /></div>
        <p className="text-xs text-muted">{row.firstActivityAt ? `${clock(row.firstActivityAt)} – ${clock(row.lastActivityAt)}` : "No activity"} · {row.visits} {row.visits === 1 ? "visit" : "visits"}{row.openVisits > 0 ? ` (${row.openVisits} open)` : ""}</p>
        {row.report ? <Pill tone="success">Report {clock(row.report.submittedAt)} · {money(row.report.value)}</Pill> : ["PRESENT", "LATE", "HALF_DAY"].includes(row.status) ? <Pill tone="warning">Report missing</Pill> : null}
      </button>)}</div>
    </>}

    {openId && <DayDetailModal url={`/api/team-activity/day/${openId}${query({ date })}`} photoBase="/api/team-activity/calls" onClose={() => setOpenId(null)} />}
  </div>;
}
