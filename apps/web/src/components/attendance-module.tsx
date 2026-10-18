"use client";

import { Building2, CalendarDays, Camera, CheckCircle2, ClipboardList, Clock3, FilePenLine, LogOut, MapPin, TriangleAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { AttendanceCalendar } from "@/components/attendance-calendar";
import { DayDetailModal } from "@/components/team-activity-day";
import { todayKey } from "@/components/team-activity-shared";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SuccessToast } from "@/components/ui/toast";

type DayStatus = "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "LEAVE" | "HOLIDAY" | "WEEKLY_OFF" | "NOT_PUNCHED" | "IN_PROGRESS";
type TodayRecord = { punchInAt: string | null; punchOutAt: string | null; punchInVerified: boolean | null; punchOutVerified: boolean | null; officeCheckedIn: boolean; officeCheckedOut: boolean; visitCount: number; halfDayThresholdHours: number; status: DayStatus; workingHours: number | null; isLate: boolean; isEarlyCheckout: boolean; rulesApplied?: boolean; verifiedCalls?: number; fullDayCalls?: number; halfDayCalls?: number; reportSubmitted?: boolean; reportDeadlineAt?: string; dayNote?: string | null; gate?: { blocked: boolean; approved: boolean; requiredDate: string | null; message: string | null } };
type MonthlyRecord = { date: string; punchInAt: string | null; punchOutAt: string | null; status: DayStatus; workingHours: number | null; isLate: boolean; isEarlyCheckout: boolean };
type Monthly = { period: { month: number; year: number }; summary: { present: number; late: number; halfDay: number; absent: number; leave: number; holiday: number; weeklyOff: number; totalHours: number }; records: MonthlyRecord[] };
type RequestItem = { id: string; status: "PENDING" | "APPROVED" | "REJECTED"; reason: string; date?: string; startDate?: string; endDate?: string };
type DailyCallProof = { id: string; customerName: string; customerType: "EXISTING" | "NEW"; result: "ORDER" | "NO_ORDER" | "FOLLOW_UP"; orderValue: number | null; remark: string | null };
type DailyActivity = { summary: { totalCalls: number; productiveCalls: number; totalValue: number; newCalls: number }; calls: DailyCallProof[] };

const time = (value: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value));
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", weekday: "short", timeZone: "UTC" }).format(new Date(value));
const pretty = (value: string) => value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? (Array.isArray((data as { message: unknown }).message) ? (data as { message: string[] }).message.join(" ") : String((data as { message: unknown }).message)) : fallback;
const statusTone: Record<DayStatus, string> = { PRESENT: "bg-success-soft text-success", LATE: "bg-warning-soft text-warning", HALF_DAY: "bg-warning-soft text-warning", ABSENT: "bg-red-50 text-danger", LEAVE: "bg-brand-soft text-brand-dark", HOLIDAY: "bg-info-soft text-info", WEEKLY_OFF: "bg-background text-muted", NOT_PUNCHED: "bg-background text-muted", IN_PROGRESS: "bg-brand-soft text-brand-dark" };

function locate() {
  return new Promise<{ latitude?: number; longitude?: number; accuracy?: number; message: string }>((resolve) => {
    if (!navigator.geolocation) return resolve({ message: "Location is not available on this device." });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, message: "Location captured." }),
      () => resolve({ message: "Allow location access to record office work." }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export function AttendanceModule() {
  const [today, setToday] = useState<TodayRecord | null>(null);
  const [monthly, setMonthly] = useState<Monthly | null>(null);
  const [period, setPeriod] = useState(() => { const key = todayKey(); return { month: Number(key.slice(5, 7)), year: Number(key.slice(0, 4)) }; });
  const [monthBusy, setMonthBusy] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<RequestItem[]>([]);
  const [leaves, setLeaves] = useState<RequestItem[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity | null>(null);
  const [dailyReportAvailable, setDailyReportAvailable] = useState(false);
  const [modal, setModal] = useState<"correction" | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async (cancelled?: () => boolean) => {
    try {
      const responses = await Promise.all([fetch("/api/attendance/today", { cache: "no-store" }), fetch("/api/attendance/corrections/mine", { cache: "no-store" }), fetch("/api/attendance/leave/mine", { cache: "no-store" }), fetch("/api/daily-reports/today", { cache: "no-store" })]);
      if (cancelled?.()) return;
      const data = await Promise.all(responses.map((response) => response.json().catch(() => null)));
      const failed = responses.slice(0, 3).findIndex((response) => !response.ok);
      if (failed >= 0) throw new Error(messageFrom(data[failed], "Unable to load attendance data."));
      setToday(data[0] as TodayRecord); setCorrections(data[1] as RequestItem[]); setLeaves(data[2] as RequestItem[]); setError("");
      if (responses[3].ok) { const reportData = data[3] as { report?: DailyActivity | null }; setDailyReportAvailable(true); setDailyActivity(reportData.report ?? null); }
    } catch (cause) { if (!cancelled?.()) setError(cause instanceof Error ? cause.message : "Unable to load attendance data."); }
    finally { if (!cancelled?.()) setLoading(false); }
  };
  // The calendar loads one month at a time, so it stays quick as the history grows.
  const loadMonth = async (next = period, cancelled?: () => boolean) => {
    setMonthBusy(true);
    try {
      const response = await fetch(`/api/attendance/monthly?month=${next.month}&year=${next.year}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to load this month."));
      if (!cancelled?.()) { setMonthly(data as Monthly); setError(""); }
    } catch (cause) { if (!cancelled?.()) setError(cause instanceof Error ? cause.message : "Unable to load this month."); }
    finally { if (!cancelled?.()) setMonthBusy(false); }
  };
  const changeMonth = (month: number, year: number) => { setPeriod({ month, year }); void loadMonth({ month, year }); };
  useEffect(() => { let cancelled = false; const timer = window.setTimeout(() => { void load(() => cancelled); void loadMonth(undefined, () => cancelled); }, 0); return () => { cancelled = true; window.clearTimeout(timer); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const punch = async (action: "punch-in" | "punch-out") => {
    setBusy(true); setError(""); setLocationMessage("Locating…");
    try {
      const location = await locate(); setLocationMessage(location.message);
      const response = await fetch(`/api/attendance/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to record office work."));
      await Promise.all([load(), loadMonth()]); setNotice(action === "punch-in" ? "Office check-in recorded." : "Office check-out recorded.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to record attendance."); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="space-y-3"><div className="h-36 animate-pulse rounded-xl bg-background" /><div className="h-64 animate-pulse rounded-xl bg-background" /></div>;

  return <div className="space-y-5">
    {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}
    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}
    {today?.gate?.blocked && <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-danger/20 bg-red-50 px-4 py-3 text-xs text-danger"><TriangleAlert size={15} className="mt-0.5 shrink-0" /><p>{today.gate.message}</p></div>}
    <section className="crm-surface overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Clock3 size={19} /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold text-foreground">Today&apos;s attendance</h2><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone[today?.status ?? "NOT_PUNCHED"]}`}>{today?.status === "NOT_PUNCHED" || !today ? "No activity yet" : today.status === "IN_PROGRESS" ? "In progress" : pretty(today.status)}</span></div>
            {today?.punchInAt
              ? <p className="mt-1 text-sm text-muted">Day started <strong className="text-foreground">{time(today.punchInAt)}</strong>{today.punchOutAt && today.punchOutAt !== today.punchInAt && <> · last activity <strong className="text-foreground">{time(today.punchOutAt)}</strong>{today.workingHours != null && <> · <strong className="text-foreground">{today.workingHours.toFixed(2)} h</strong></>}</>}</p>
              : <p className="mt-1 text-sm text-muted">Your day starts when you check in at your first salon or at the office.</p>}
            <p className="mt-1 text-xs text-muted">{today?.visitCount ?? 0} salon {today?.visitCount === 1 ? "visit" : "visits"} today{today?.officeCheckedIn ? " · office work recorded" : ""}</p>
            {today?.rulesApplied
              ? <>
                <p className="mt-1.5 text-xs text-muted"><strong className="text-foreground">{today.verifiedCalls ?? 0}</strong> of {today.fullDayCalls} GPS-verified calls · {today.fullDayCalls} make a full day, {today.halfDayCalls} a half day.</p>
                {today.dayNote && <p className="mt-1 text-xs text-warning">{today.dayNote}</p>}
                {!today.reportSubmitted && today.status !== "WEEKLY_OFF" && today.status !== "HOLIDAY" && today.status !== "LEAVE" && <p className="mt-1 text-xs text-muted">Submit your daily report and tomorrow’s plan by 11 PM, or today counts as a half day.</p>}
              </>
              : today?.status === "HALF_DAY" && <p className="mt-1 text-xs text-warning">Counts as a half day until you have worked {today.halfDayThresholdHours} hours between your first and last activity.</p>}
            {locationMessage && <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-4 text-muted"><MapPin size={13} className="mt-0.5 shrink-0" />{locationMessage}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
          {!today?.officeCheckedIn && <Button variant="secondary" disabled={busy} onClick={() => punch("punch-in")}><Building2 size={16} />{busy ? "Recording…" : "Office check-in"}</Button>}
          {today?.officeCheckedIn && !today.officeCheckedOut && <Button variant="secondary" disabled={busy} onClick={() => punch("punch-out")}><LogOut size={16} />{busy ? "Recording…" : "Office check-out"}</Button>}
          {today?.officeCheckedOut && <span className="inline-flex items-center gap-1.5 rounded-lg bg-success-soft px-3 py-2 text-xs font-semibold text-success"><CheckCircle2 size={14} />Office work recorded</span>}
          <p className="max-w-[240px] text-[11px] leading-4 text-muted sm:text-right">Salon visits are recorded automatically from My Route. Use office work only on days you work from the office.</p>
        </div>
      </div>
      <div className="grid gap-2 border-t bg-background/50 p-3 sm:grid-cols-2 sm:px-5"><Button variant="secondary" onClick={() => setModal("correction")}><FilePenLine size={15} />Request correction</Button><Link href="/dashboard/leave" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border bg-white px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-background sm:h-10"><CalendarDays size={15} />Apply for leave</Link></div>
    </section>

    {dailyReportAvailable && <section className="crm-surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><ClipboardList size={17} /></span><div><h2 className="text-sm font-semibold text-foreground">Today&apos;s field activity</h2><p className="mt-0.5 text-xs text-muted">Call records and visit proofs from your daily report</p></div></div>
        <Link href="/dashboard/daily-report" className="inline-flex h-9 items-center justify-center rounded-lg border bg-white px-3 text-xs font-semibold text-foreground hover:bg-background">{dailyActivity ? "Open report" : "Add daily report"}</Link>
      </div>
      {dailyActivity ? <>
        <div className="grid grid-cols-3 divide-x border-b bg-background/45"><AttendanceMetric label="Calls" value={dailyActivity.summary.totalCalls} /><AttendanceMetric label="Orders" value={dailyActivity.summary.productiveCalls} /><AttendanceMetric label="Value" value={`₹${dailyActivity.summary.totalValue.toLocaleString("en-IN")}`} /></div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">{dailyActivity.calls.map((call, index) => <article key={call.id} className="overflow-hidden rounded-lg border bg-white"><div className="relative aspect-[16/10] bg-background"><Image src={`/api/daily-reports/calls/${call.id}/photo`} alt={`Call proof for ${call.customerName}`} fill sizes="(max-width: 640px) 100vw, 320px" className="object-cover" unoptimized /><span className="absolute left-2 top-2 rounded-md bg-foreground/80 px-2 py-1 text-[10px] font-semibold text-white">Call {index + 1}</span></div><div className="p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{call.customerName}</p><p className="mt-0.5 text-[11px] text-muted">{call.customerType === "NEW" ? "New customer" : "Existing customer"}</p></div><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${call.result === "ORDER" ? "bg-success-soft text-success" : call.result === "FOLLOW_UP" ? "bg-warning-soft text-warning" : "bg-background text-muted"}`}>{pretty(call.result)}</span></div>{call.remark && <p className="mt-2 line-clamp-2 text-xs leading-4 text-muted">{call.remark}</p>}</div></article>)}</div>
      </> : <div className="px-5 py-9 text-center"><Camera size={24} className="mx-auto text-subtle" /><p className="mt-2 text-sm font-semibold text-foreground">No call proofs added yet</p><p className="mt-1 text-xs text-muted">Submit today&apos;s calls to connect field work with attendance.</p></div>}
    </section>}

    <section className="crm-surface overflow-hidden" aria-label="Attendance calendar">
      <div className="border-b px-4 py-3 sm:px-5"><h2 className="text-sm font-semibold text-foreground">Attendance calendar</h2><p className="mt-0.5 text-xs text-muted">Tap a date to see your punch times, visits and calls for that day.</p></div>
      {monthly && <div className="grid grid-cols-2 divide-x border-b bg-background/45 sm:grid-cols-4"><AttendanceMetric label="Present" value={monthly.summary.present} /><AttendanceMetric label="Half days" value={monthly.summary.halfDay} /><AttendanceMetric label="Absent" value={monthly.summary.absent} /><AttendanceMetric label="Hours" value={monthly.summary.totalHours} /></div>}
      <AttendanceCalendar month={period.month} year={period.year} records={monthly?.records ?? []} loading={monthBusy || !monthly} onMonthChange={changeMonth} onSelectDay={setOpenDay} />
    </section>

    <section className="grid gap-4 lg:grid-cols-2"><RequestList title="Correction requests" items={corrections} /><RequestList title="Leave requests" items={leaves} /></section>
    {modal === "correction" && <CorrectionModal onClose={() => setModal(null)} onDone={async () => { setModal(null); await Promise.all([load(), loadMonth()]); setNotice("Correction request submitted."); }} />}
    {openDay && <DayDetailModal url={`/api/my-day/${openDay}`} photoBase="/api/daily-reports/calls" onClose={() => setOpenDay(null)} />}
  </div>;
}

function AttendanceMetric({ label, value }: { label: string; value: string | number }) { return <div className="px-3 py-3 text-center sm:px-4"><p className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</p><p className="mt-1 text-sm font-semibold text-foreground">{value}</p></div>; }

function RequestList({ title, items }: { title: string; items: RequestItem[] }) { return <section className="crm-surface overflow-hidden"><div className="border-b px-4 py-3"><h2 className="text-sm font-semibold text-foreground">{title}</h2></div>{items.length ? <div className="divide-y">{items.slice(0, 5).map((item) => <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3"><div><p className="text-xs font-medium text-foreground">{item.date ? dateLabel(item.date) : `${dateLabel(item.startDate!)} – ${dateLabel(item.endDate!)}`}</p><p className="mt-1 line-clamp-2 text-xs text-muted">{item.reason}</p></div><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.status === "APPROVED" ? "bg-success-soft text-success" : item.status === "REJECTED" ? "bg-red-50 text-danger" : "bg-warning-soft text-warning"}`}>{pretty(item.status)}</span></div>)}</div> : <p className="px-4 py-6 text-center text-xs text-muted">No requests yet.</p>}</section>; }

function CorrectionModal({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const [date, setDate] = useState(""); const [punchIn, setPunchIn] = useState(""); const [punchOut, setPunchOut] = useState(""); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { const response = await fetch("/api/attendance/corrections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, requestedPunchIn: punchIn ? `${date}T${punchIn}:00+05:30` : undefined, requestedPunchOut: punchOut ? `${date}T${punchOut}:00+05:30` : undefined, reason }) }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(messageFrom(data, "Unable to submit correction.")); await onDone(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit correction."); setBusy(false); } };
  return <Modal title="Request attendance correction" onClose={onClose} maxWidth="max-w-lg"><form onSubmit={submit} className="space-y-4"><Field label="Date"><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Requested punch-in"><Input type="time" value={punchIn} onChange={(event) => setPunchIn(event.target.value)} /></Field><Field label="Requested punch-out"><Input type="time" value={punchOut} onChange={(event) => setPunchOut(event.target.value)} /></Field></div><Field label="Reason"><textarea value={reason} onChange={(event) => setReason(event.target.value)} required minLength={2} maxLength={500} rows={3} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" /></Field>{error && <p className="text-xs text-danger">{error}</p>}<FormActions saving={busy} onClose={onClose} label="Submit" /></form></Modal>;
}
