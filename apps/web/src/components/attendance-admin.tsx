"use client";

import { Check, LoaderCircle, Search, Settings2, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { AttendanceCalendar, type CalendarRecord } from "@/components/attendance-calendar";
import { DayDetailModal } from "@/components/team-activity-day";
import { Button } from "@/components/ui/button";
import { FilterMenu } from "@/components/ui/filter-menu";
import { Input } from "@/components/ui/input";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";
import { Modal } from "@/components/ui/modal";
import { SuccessToast } from "@/components/ui/toast";

type Summary = { total: number; present: number; late: number; onLeave: number; notPunched: number };
type Row = { id: string; name: string; loginId: string; department: string; punchInAt: string | null; punchOutAt: string | null; status: string; workingHours: number | null; verifiedCalls?: number | null; dayNote?: string | null };
type Blocked = { id: string; name: string; loginId: string; missingReportDate: string | null };
type RequestItem = { id: string; user: { name: string }; status: string; reason: string; date?: string; startDate?: string; endDate?: string };
type Settings = { officeLatitude: number | null; officeLongitude: number | null; officeRadiusMeters: number | null; visitRadiusMeters: number; lateThresholdMinutes: number; halfDayThresholdHours: number; weeklyOffDays: number[] };
type Holiday = { id: string; date: string; name: string };

const todayKey = () => { const value = new Date(); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; };
const time = (value: string | null) => value ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value)) : "—";
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : fallback;

export function AttendanceAdmin() {
  const [date, setDate] = useState(todayKey()); const [search, setSearch] = useState(""); const [status, setStatus] = useState(""); const [department, setDepartment] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null); const [rows, setRows] = useState<Row[]>([]); const [corrections, setCorrections] = useState<RequestItem[]>([]); const [leaves, setLeaves] = useState<RequestItem[]>([]); const [settings, setSettings] = useState<Settings | null>(null); const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [profile, setProfile] = useState<{ user: { id: string; name: string; loginId: string; staffProfile: { employeeCode: string; jobTitle: string } | null }; period: { month: number; year: number }; summary: Record<string, number>; records: CalendarRecord[] } | null>(null);
  const [profileBusy, setProfileBusy] = useState(false); const [openDay, setOpenDay] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<Blocked[]>([]); const [approving, setApproving] = useState("");
  const [notice, setNotice] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const params = new URLSearchParams({ date, pageSize: "100" }); if (search) params.set("search", search); if (status) params.set("status", status); if (department) params.set("department", department);
      const urls = [`/api/attendance/admin/today`, `/api/attendance/admin/list?${params}`, "/api/attendance/corrections?status=PENDING", "/api/attendance/leave?status=PENDING", "/api/attendance/settings", "/api/attendance/holidays", "/api/attendance/admin/blocked"];
      const responses = await Promise.all(urls.map((url) => fetch(url, { cache: "no-store" }))); const data = await Promise.all(responses.map((response) => response.json().catch(() => null)));
      const failed = responses.findIndex((response) => !response.ok); if (failed >= 0) throw new Error(messageFrom(data[failed], "Unable to load attendance management."));
      setSummary(data[0]); setRows(data[1].items); setCorrections(data[2]); setLeaves(data[3]); setSettings(data[4]); setHolidays(data[5]); setBlocked(data[6] ?? []); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load attendance management."); }
    finally { setLoading(false); }
  };
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 200); return () => window.clearTimeout(timer); }, [date, search, status, department]); // eslint-disable-line react-hooks/exhaustive-deps

  const review = async (kind: "corrections" | "leave", id: string, decision: "APPROVED" | "REJECTED") => {
    const response = await fetch(`/api/attendance/${kind}/${id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: decision }) }); const data = await response.json().catch(() => null); if (!response.ok) return setError(messageFrom(data, "Unable to review request.")); await load(); setNotice(`Request ${decision.toLowerCase()}.`);
  };
  const approveStart = async (member: Blocked) => {
    setApproving(member.id);
    try {
      const response = await fetch("/api/attendance/admin/day-approvals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: member.id }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) return setError(messageFrom(data, "Unable to approve this start."));
      await load(); setNotice(`${member.name} can start today.`);
    } finally { setApproving(""); }
  };
  const openProfile = async (id: string, month?: number, year?: number) => { setProfileBusy(true); const params = month && year ? `?month=${month}&year=${year}` : ""; const response = await fetch(`/api/attendance/admin/employees/${id}${params}`, { cache: "no-store" }); const data = await response.json().catch(() => null); setProfileBusy(false); if (!response.ok) return setError(messageFrom(data, "Unable to load employee attendance.")); setProfile(data); };

  if (loading) return <div className="space-y-3"><div className="h-24 animate-pulse rounded-xl bg-white" /><div className="h-80 animate-pulse rounded-xl bg-white" /></div>;
  return <div className="space-y-5">
    {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}{error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}
    {blocked.length > 0 && <section className="crm-surface overflow-hidden border-warning/30" aria-label="Staff who cannot start today">
      <div className="border-b bg-warning-soft/50 px-4 py-3 sm:px-5"><h2 className="text-sm font-semibold text-foreground">Cannot start today · {blocked.length}</h2><p className="mt-0.5 text-xs text-muted">Their last working day&apos;s daily report was not submitted. They stay blocked until you approve.</p></div>
      <div className="divide-y">{blocked.map((member) => <div key={member.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><p className="text-sm font-medium text-foreground">{member.name} <span className="text-xs font-normal text-muted">{member.loginId}</span></p><p className="text-xs text-muted">Report missing for {member.missingReportDate}</p></div><Button className="h-9 sm:h-9" disabled={approving === member.id} onClick={() => approveStart(member)}><Check size={14} />{approving === member.id ? "Approving…" : "Approve today’s start"}</Button></div>)}</div>
    </section>}
    <KpiStrip columns={5}><KpiCell label="Present" value={summary?.present ?? 0} /><KpiCell label="Late" value={summary?.late ?? 0} tone="warning" /><KpiCell label="On leave" value={summary?.onLeave ?? 0} tone="brand" /><KpiCell label="Not punched" value={summary?.notPunched ?? 0} tone="danger" /><KpiCell label="Active staff" value={summary?.total ?? 0} /></KpiStrip>
    <section className="crm-surface overflow-hidden"><div className="grid gap-3 border-b p-4 sm:grid-cols-2 xl:grid-cols-4"><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /><label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={15} /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff" /></label><FilterMenu value={department} fullWidth showLabelOnMobile ariaLabel="Filter attendance by department" onSelect={setDepartment} options={[{ key: "", label: "All departments" }, { key: "SALES", label: "Sales" }, { key: "PURCHASE", label: "Purchase" }, { key: "ACCOUNTS_BILLING", label: "Accounts & Billing" }, { key: "WAREHOUSE", label: "Warehouse" }, { key: "DEMO", label: "Demo" }]} /><FilterMenu value={status} fullWidth showLabelOnMobile ariaLabel="Filter attendance by status" onSelect={setStatus} options={[{ key: "", label: "All statuses" }, ...["PRESENT", "LATE", "HALF_DAY", "ABSENT", "LEAVE", "HOLIDAY", "WEEKLY_OFF", "NOT_PUNCHED", "IN_PROGRESS"].map((value) => ({ key: value, label: value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) }))]} /></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[13px]"><thead className="border-b bg-background text-[11px] uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Punch in</th><th className="px-4 py-3">Punch out</th><th className="px-4 py-3">Hours</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.id} className="cursor-pointer hover:bg-brand-soft/30" onClick={() => openProfile(row.id)}><td className="px-4 py-3"><p className="font-medium text-foreground">{row.name}</p><p className="text-xs text-muted">{row.loginId}</p></td><td className="px-4 py-3 text-muted">{row.department}</td><td className="px-4 py-3">{time(row.punchInAt)}</td><td className="px-4 py-3">{time(row.punchOutAt)}</td><td className="px-4 py-3">{row.workingHours?.toFixed(2) ?? "—"}</td><td className="px-4 py-3"><span className="rounded-full bg-brand-soft px-2 py-1 text-[10px] font-semibold text-brand-dark">{row.status.replaceAll("_", " ")}</span>{row.verifiedCalls != null && <p className="mt-1 text-[11px] text-muted">{row.verifiedCalls} verified {row.verifiedCalls === 1 ? "call" : "calls"}</p>}{row.dayNote && <p className="mt-0.5 max-w-[260px] text-[11px] leading-4 text-warning">{row.dayNote}</p>}</td></tr>)}</tbody></table></div>
    </section>
    <div className="grid gap-5 xl:grid-cols-2"><RequestQueue title="Correction approvals" items={corrections} onReview={(id, value) => review("corrections", id, value)} /><RequestQueue title="Leave approvals" items={leaves} onReview={(id, value) => review("leave", id, value)} /></div>
    {settings && <SettingsPanel settings={settings} holidays={holidays} onSaved={async (message) => { await load(); setNotice(message); }} onError={setError} />}
    {profile && <Modal title={profile.user.name} subtitle={[profile.user.staffProfile?.employeeCode, profile.user.staffProfile?.jobTitle].filter(Boolean).join(" · ") || profile.user.loginId} onClose={() => { setProfile(null); setOpenDay(null); }} maxWidth="max-w-2xl">
      <div className="-m-4 sm:-m-5">
        <div className="grid grid-cols-3 gap-px overflow-hidden border-b bg-border sm:grid-cols-6">{([["Present", "present"], ["Late", "late"], ["Half day", "halfDay"], ["Absent", "absent"], ["Leave", "leave"], ["Hours", "totalHours"]] as const).map(([label, key]) => <div key={key} className="bg-white px-3 py-2.5"><p className="text-[11px] font-medium text-muted">{label}</p><p className="mt-0.5 text-base font-semibold text-foreground">{profile.summary[key] ?? 0}</p></div>)}</div>
        <AttendanceCalendar month={profile.period.month} year={profile.period.year} records={profile.records} loading={profileBusy} onMonthChange={(month, year) => void openProfile(profile.user.id, month, year)} onSelectDay={setOpenDay} />
      </div>
    </Modal>}
    {profile && openDay && <DayDetailModal url={`/api/team-activity/day/${profile.user.id}?date=${openDay}`} photoBase="/api/team-activity/calls" onClose={() => setOpenDay(null)} />}
  </div>;
}

function RequestQueue({ title, items, onReview }: { title: string; items: RequestItem[]; onReview: (id: string, value: "APPROVED" | "REJECTED") => void }) { return <section className="crm-surface overflow-hidden"><div className="border-b px-4 py-3"><h2 className="text-sm font-semibold">{title}</h2></div>{items.length ? <div className="divide-y">{items.map((item) => <div key={item.id} className="p-4"><p className="text-sm font-medium">{item.user.name}</p><p className="mt-1 text-xs text-muted">{item.reason}</p><div className="mt-3 flex gap-2"><Button className="h-8 px-3 text-xs" onClick={() => onReview(item.id, "APPROVED")}><Check size={13} />Approve</Button><Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => onReview(item.id, "REJECTED")}><X size={13} />Reject</Button></div></div>)}</div> : <p className="p-6 text-center text-xs text-muted">Nothing pending.</p>}</section>; }

function SettingsPanel({ settings, holidays, onSaved, onError }: { settings: Settings; holidays: Holiday[]; onSaved: (message: string) => Promise<void>; onError: (message: string) => void }) {
  const [form, setForm] = useState({ officeLatitude: settings.officeLatitude?.toString() ?? "", officeLongitude: settings.officeLongitude?.toString() ?? "", officeRadiusMeters: settings.officeRadiusMeters?.toString() ?? "", visitRadiusMeters: settings.visitRadiusMeters.toString(), lateThresholdMinutes: settings.lateThresholdMinutes.toString(), halfDayThresholdHours: settings.halfDayThresholdHours.toString(), weeklyOffDays: settings.weeklyOffDays });
  const [holidayDate, setHolidayDate] = useState(""); const [holidayName, setHolidayName] = useState(""); const [busy, setBusy] = useState(false);
  const save = async (event: FormEvent) => { event.preventDefault(); setBusy(true); const payload = { officeLatitude: form.officeLatitude ? Number(form.officeLatitude) : null, officeLongitude: form.officeLongitude ? Number(form.officeLongitude) : null, officeRadiusMeters: form.officeRadiusMeters ? Number(form.officeRadiusMeters) : null, visitRadiusMeters: Number(form.visitRadiusMeters), lateThresholdMinutes: Number(form.lateThresholdMinutes), halfDayThresholdHours: Number(form.halfDayThresholdHours), weeklyOffDays: form.weeklyOffDays }; const response = await fetch("/api/attendance/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json().catch(() => null); setBusy(false); if (!response.ok) return onError(messageFrom(data, "Unable to save settings.")); await onSaved("Attendance settings saved."); };
  const addHoliday = async () => { const response = await fetch("/api/attendance/holidays", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: holidayDate, name: holidayName }) }); const data = await response.json().catch(() => null); if (!response.ok) return onError(messageFrom(data, "Unable to add holiday.")); setHolidayDate(""); setHolidayName(""); await onSaved("Holiday saved."); };
  const removeHoliday = async (id: string) => { if (!window.confirm("Remove this holiday?")) return; const response = await fetch(`/api/attendance/holidays/${id}`, { method: "DELETE" }); if (!response.ok) return onError("Unable to remove holiday."); await onSaved("Holiday removed."); };
  return <section className="crm-surface p-4 sm:p-5"><div className="flex items-center gap-2"><Settings2 size={17} className="text-brand" /><h2 className="text-sm font-semibold">Attendance settings</h2></div><form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(["officeLatitude", "officeLongitude", "officeRadiusMeters", "visitRadiusMeters", "lateThresholdMinutes", "halfDayThresholdHours"] as const).map((key) => <label key={key} className="space-y-1"><span className="text-xs font-medium text-muted">{key.replaceAll(/([A-Z])/g, " $1")}</span><Input type="number" step={key.includes("Latitude") || key.includes("Longitude") || key === "halfDayThresholdHours" ? "any" : "1"} value={form[key]} onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.value }))} /></label>)}<div className="sm:col-span-2 xl:col-span-3"><p className="mb-2 text-xs font-medium text-muted">Weekly off</p><div className="flex flex-wrap gap-2">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, day) => <label key={label} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs"><input type="checkbox" checked={form.weeklyOffDays.includes(day)} onChange={(event) => setForm((value) => ({ ...value, weeklyOffDays: event.target.checked ? [...value.weeklyOffDays, day] : value.weeklyOffDays.filter((item) => item !== day) }))} />{label}</label>)}</div></div><div className="sm:col-span-2 xl:col-span-3"><Button disabled={busy}>{busy && <LoaderCircle className="animate-spin" size={14} />}Save settings</Button></div></form><div className="mt-6 border-t pt-4"><h3 className="text-sm font-semibold">Holidays</h3><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input type="date" value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} /><Input value={holidayName} onChange={(event) => setHolidayName(event.target.value)} placeholder="Holiday name" /><Button type="button" disabled={!holidayDate || !holidayName} onClick={addHoliday}>Add</Button></div><div className="mt-3 divide-y rounded-lg border">{holidays.map((holiday) => <div key={holiday.id} className="flex items-center justify-between gap-3 px-3 py-2.5"><p className="text-xs"><strong>{holiday.name}</strong> · {holiday.date.slice(0, 10)}</p><button onClick={() => removeHoliday(holiday.id)} className="text-xs text-danger">Remove</button></div>)}</div></div></section>;
}
