"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { FormError } from "@/components/ui/field";
import { FilterMenu } from "@/components/ui/filter-menu";
import { Input } from "@/components/ui/input";
import { Chips, EmptyBlock, type Page, Pill, RowsSkeleton, type StaffOption, dateTime, pretty, query, shortDate, teamApi } from "@/components/team-activity-shared";

const staffFilter = (staff: StaffOption[]) => [{ key: "", label: "All staff" }, ...staff.map((member) => ({ key: member.id, label: member.name }))];

type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST";
type Lead = { id: string; salonName: string; contactName: string | null; phone: string; city: string | null; area: string | null; source: string; status: LeadStatus; nextActionAt: string | null; notes: string | null; createdAt: string; assignedTo: { id: string; name: string } };
type LeadPage = Page<Lead> & { counts: Record<LeadStatus, number> };
const LEAD_TONE: Record<LeadStatus, "neutral" | "brand" | "warning" | "success" | "danger"> = { NEW: "brand", CONTACTED: "neutral", QUALIFIED: "warning", CONVERTED: "success", LOST: "danger" };

export function TeamLeads({ staff }: { staff: StaffOption[] }) {
  const [staffId, setStaffId] = useState("");
  const [status, setStatus] = useState<LeadStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<LeadPage | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setData(await teamApi<LeadPage>(`/leads${query({ staffId, status: status === "ALL" ? undefined : status, search: search.trim(), page, pageSize })}`)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load leads."); }
  }, [staffId, status, search, page, pageSize]);
  useEffect(() => { const timer = setTimeout(() => { load(); }, search ? 300 : 0); return () => clearTimeout(timer); }, [load, search]);

  const counts = data?.counts;
  const all = counts ? Object.values(counts).reduce((sum, value) => sum + value, 0) : undefined;
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <label className="relative flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search salon, contact, phone or city" aria-label="Search leads" className="pl-9" /></label>
      <FilterMenu value={staffId} options={staffFilter(staff)} onSelect={(key) => { setStaffId(key); setPage(1); }} showLabelOnMobile ariaLabel="Filter leads by staff" />
      {data && data.total > 0 && <CompactPagination page={data.page} pageSize={data.pageSize} total={data.total} hasMore={data.hasMore} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
    </div>
    <Chips label="Filter by lead status" value={status} onChange={(key) => { setStatus(key); setPage(1); }} options={[{ key: "ALL", label: "All", count: all }, ...(["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"] as const).map((key) => ({ key, label: pretty(key), count: counts?.[key] }))]} />

    {error && !data && <FormError message={error} />}
    {!data && !error && <RowsSkeleton />}
    {data && !data.items.length && <EmptyBlock title="No leads found" message="Leads added by your sales staff appear here." />}
    {data && data.items.length > 0 && <>
      <section className="crm-surface hidden overflow-hidden lg:block">
        <table className="w-full text-left text-[13px]">
          <thead><tr className="border-b bg-background/60 text-xs text-muted"><th className="px-4 py-3 font-medium">Salon</th><th className="px-4 py-3 font-medium">Phone</th><th className="px-4 py-3 font-medium">City</th><th className="px-4 py-3 font-medium">Source</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Owner</th><th className="px-4 py-3 font-medium">Next action</th><th className="px-4 py-3 font-medium">Added</th></tr></thead>
          <tbody className="divide-y">{data.items.map((lead) => <tr key={lead.id} className="align-top">
            <td className="px-4 py-3"><p className="font-medium text-foreground">{lead.salonName}</p>{lead.contactName && <p className="text-xs text-muted">{lead.contactName}</p>}</td>
            <td className="whitespace-nowrap px-4 py-3 text-muted">{lead.phone}</td>
            <td className="px-4 py-3 text-muted">{[lead.area, lead.city].filter(Boolean).join(", ") || "—"}</td>
            <td className="px-4 py-3 text-muted">{pretty(lead.source)}</td>
            <td className="px-4 py-3"><Pill tone={LEAD_TONE[lead.status]}>{pretty(lead.status)}</Pill></td>
            <td className="whitespace-nowrap px-4 py-3 text-foreground">{lead.assignedTo.name}</td>
            <td className="whitespace-nowrap px-4 py-3 text-muted">{shortDate(lead.nextActionAt)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-muted">{shortDate(lead.createdAt)}</td>
          </tr>)}</tbody>
        </table>
      </section>
      <div className="space-y-2 lg:hidden">{data.items.map((lead) => <article key={lead.id} className="crm-surface space-y-1.5 p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{lead.salonName}</p><p className="text-xs text-muted">{[lead.contactName, lead.phone].filter(Boolean).join(" · ")}</p></div><Pill tone={LEAD_TONE[lead.status]}>{pretty(lead.status)}</Pill></div>
        <p className="text-xs text-muted">{[lead.area, lead.city].filter(Boolean).join(", ") || "No city"} · {pretty(lead.source)} · Owner <span className="font-medium text-foreground">{lead.assignedTo.name}</span></p>
        {lead.nextActionAt && <p className="text-xs text-muted">Next action {shortDate(lead.nextActionAt)}</p>}
      </article>)}</div>
    </>}
  </div>;
}

type ActivityType = "FOLLOW_UP" | "DEMO" | "SAMPLE";
type Scope = "open" | "overdue" | "completed" | "all";
type Activity = { id: string; type: ActivityType; status: "OPEN" | "COMPLETED" | "CANCELLED"; purpose: string | null; note: string | null; nextAction: string | null; outcome: string | null; scheduledAt: string | null; completedAt: string | null; createdAt: string; client: { id: string; salonName: string; city: string }; createdBy: { id: string; name: string }; assignedTo: { id: string; name: string } | null };
type ActivityPage = Page<Activity> & { counts: { open: number; overdue: number; completed: number } };
const TYPE_LABEL: Record<ActivityType, string> = { FOLLOW_UP: "Follow-up", DEMO: "Demo", SAMPLE: "Sample" };

export function TeamFollowUps({ staff }: { staff: StaffOption[] }) {
  const [staffId, setStaffId] = useState("");
  const [type, setType] = useState<ActivityType | "">("");
  const [scope, setScope] = useState<Scope>("open");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<ActivityPage | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { const next = await teamApi<ActivityPage>(`/activities${query({ staffId, type, scope, search: search.trim(), page, pageSize })}`); setData(next); setLoadedAt(Date.now()); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load follow-ups."); }
  }, [staffId, type, scope, search, page, pageSize]);
  useEffect(() => { const timer = setTimeout(() => { load(); }, search ? 300 : 0); return () => clearTimeout(timer); }, [load, search]);

  const counts = data?.counts;
  const now = loadedAt;
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <label className="relative flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search by salon name" aria-label="Search follow-ups" className="pl-9" /></label>
      <FilterMenu value={type} options={[{ key: "", label: "All types" }, { key: "FOLLOW_UP", label: "Follow-ups" }, { key: "DEMO", label: "Demos" }, { key: "SAMPLE", label: "Samples" }]} onSelect={(key) => { setType(key as ActivityType | ""); setPage(1); }} showLabelOnMobile ariaLabel="Filter by type" />
      <FilterMenu value={staffId} options={staffFilter(staff)} onSelect={(key) => { setStaffId(key); setPage(1); }} showLabelOnMobile ariaLabel="Filter by staff" />
      {data && data.total > 0 && <CompactPagination page={data.page} pageSize={data.pageSize} total={data.total} hasMore={data.hasMore} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
    </div>
    <Chips label="Filter by progress" value={scope} onChange={(key) => { setScope(key); setPage(1); }} options={[{ key: "open", label: "Open", count: counts?.open }, { key: "overdue", label: "Overdue", count: counts?.overdue }, { key: "completed", label: "Completed", count: counts?.completed }, { key: "all", label: "All" }]} />

    {error && !data && <FormError message={error} />}
    {!data && !error && <RowsSkeleton />}
    {data && !data.items.length && <EmptyBlock title={scope === "overdue" ? "Nothing overdue" : "No follow-ups found"} message="Follow-ups, demos and samples set by your sales staff appear here." />}
    {data && data.items.length > 0 && <>
      <section className="crm-surface hidden overflow-hidden lg:block">
        <table className="w-full text-left text-[13px]">
          <thead><tr className="border-b bg-background/60 text-xs text-muted"><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Salon</th><th className="px-4 py-3 font-medium">Staff</th><th className="px-4 py-3 font-medium">Due</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Details</th></tr></thead>
          <tbody className="divide-y">{data.items.map((item) => {
            const overdue = item.status === "OPEN" && item.scheduledAt != null && new Date(item.scheduledAt).getTime() < now;
            return <tr key={item.id} className="align-top">
              <td className="px-4 py-3"><Pill tone={item.type === "DEMO" ? "brand" : item.type === "SAMPLE" ? "warning" : "neutral"}>{TYPE_LABEL[item.type]}</Pill></td>
              <td className="px-4 py-3"><p className="font-medium text-foreground">{item.client.salonName}</p><p className="text-xs text-muted">{item.client.city}</p></td>
              <td className="whitespace-nowrap px-4 py-3 text-foreground">{(item.assignedTo ?? item.createdBy).name}</td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">{dateTime(item.scheduledAt)}</td>
              <td className="px-4 py-3"><Pill tone={item.status === "COMPLETED" ? "success" : item.status === "CANCELLED" ? "neutral" : overdue ? "danger" : "warning"}>{item.status === "OPEN" && overdue ? "Overdue" : pretty(item.status)}</Pill></td>
              <td className="max-w-[300px] px-4 py-3 text-xs text-muted"><span className="line-clamp-2 break-words">{[item.purpose, item.nextAction, item.note].filter(Boolean).join(" · ") || "—"}</span>{item.outcome && <span className="mt-0.5 block text-foreground">Outcome: {pretty(item.outcome)}</span>}</td>
            </tr>;
          })}</tbody>
        </table>
      </section>
      <div className="space-y-2 lg:hidden">{data.items.map((item) => {
        const overdue = item.status === "OPEN" && item.scheduledAt != null && new Date(item.scheduledAt).getTime() < now;
        return <article key={item.id} className="crm-surface space-y-1.5 p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{item.client.salonName}</p><p className="text-xs text-muted">{item.client.city} · {(item.assignedTo ?? item.createdBy).name}</p></div><Pill tone={item.status === "COMPLETED" ? "success" : overdue ? "danger" : "warning"}>{overdue ? "Overdue" : pretty(item.status)}</Pill></div>
          <p className="text-xs text-muted"><span className="font-medium text-foreground">{TYPE_LABEL[item.type]}</span> · {dateTime(item.scheduledAt)}</p>
          {[item.purpose, item.nextAction, item.note].filter(Boolean).length > 0 && <p className="break-words text-xs text-muted">{[item.purpose, item.nextAction, item.note].filter(Boolean).join(" · ")}</p>}
        </article>;
      })}</div>
    </>}
  </div>;
}
