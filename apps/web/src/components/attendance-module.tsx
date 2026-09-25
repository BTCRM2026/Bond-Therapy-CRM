"use client";

import { CalendarDays, CheckCircle2, Clock3, FilePenLine, LogIn, LogOut, MapPin } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SuccessToast } from "@/components/ui/toast";

type DayStatus = "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "LEAVE" | "HOLIDAY" | "WEEKLY_OFF" | "NOT_PUNCHED";
type TodayRecord = { punchInAt: string | null; punchOutAt: string | null; punchInVerified: boolean | null; punchOutVerified: boolean | null; status: DayStatus; workingHours: number | null; isLate: boolean; isEarlyCheckout: boolean };
type MonthlyRecord = { date: string; punchInAt: string | null; punchOutAt: string | null; status: DayStatus; workingHours: number | null; isLate: boolean; isEarlyCheckout: boolean };
type Monthly = { period: { month: number; year: number }; summary: { present: number; late: number; halfDay: number; absent: number; leave: number; holiday: number; weeklyOff: number; totalHours: number }; records: MonthlyRecord[] };
type RequestItem = { id: string; status: "PENDING" | "APPROVED" | "REJECTED"; reason: string; date?: string; startDate?: string; endDate?: string };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const time = (value: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value));
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", weekday: "short", timeZone: "UTC" }).format(new Date(value));
const pretty = (value: string) => value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
const messageFrom = (data: unknown, fallback: string) => data && typeof data === "object" && "message" in data ? (Array.isArray((data as { message: unknown }).message) ? (data as { message: string[] }).message.join(" ") : String((data as { message: unknown }).message)) : fallback;
const statusTone: Record<DayStatus, string> = { PRESENT: "bg-success-soft text-success", LATE: "bg-warning-soft text-warning", HALF_DAY: "bg-warning-soft text-warning", ABSENT: "bg-red-50 text-danger", LEAVE: "bg-brand-soft text-brand-dark", HOLIDAY: "bg-info-soft text-info", WEEKLY_OFF: "bg-background text-muted", NOT_PUNCHED: "bg-background text-muted" };

function locate() {
  return new Promise<{ latitude?: number; longitude?: number; message: string }>((resolve) => {
    if (!navigator.geolocation) return resolve({ message: "Location is not available on this device." });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, message: "Location captured." }),
      () => resolve({ message: "Location permission was not available. Attendance will still be recorded." }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}

export function AttendanceModule() {
  const [today, setToday] = useState<TodayRecord | null>(null);
  const [monthly, setMonthly] = useState<Monthly | null>(null);
  const [corrections, setCorrections] = useState<RequestItem[]>([]);
  const [leaves, setLeaves] = useState<RequestItem[]>([]);
  const [modal, setModal] = useState<"correction" | "leave" | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async (cancelled?: () => boolean) => {
    try {
      const responses = await Promise.all([fetch("/api/attendance/today", { cache: "no-store" }), fetch("/api/attendance/monthly", { cache: "no-store" }), fetch("/api/attendance/corrections/mine", { cache: "no-store" }), fetch("/api/attendance/leave/mine", { cache: "no-store" })]);
      if (cancelled?.()) return;
      const data = await Promise.all(responses.map((response) => response.json().catch(() => null)));
      const failed = responses.findIndex((response) => !response.ok);
      if (failed >= 0) throw new Error(messageFrom(data[failed], "Unable to load attendance data."));
      setToday(data[0] as TodayRecord); setMonthly(data[1] as Monthly); setCorrections(data[2] as RequestItem[]); setLeaves(data[3] as RequestItem[]); setError("");
    } catch (cause) { if (!cancelled?.()) setError(cause instanceof Error ? cause.message : "Unable to load attendance data."); }
    finally { if (!cancelled?.()) setLoading(false); }
  };
  useEffect(() => { let cancelled = false; const timer = window.setTimeout(() => { void load(() => cancelled); }, 0); return () => { cancelled = true; window.clearTimeout(timer); }; }, []);

  const punch = async (action: "punch-in" | "punch-out") => {
    setBusy(true); setError(""); setLocationMessage("Locating…");
    try {
      const location = await locate(); setLocationMessage(location.message);
      const response = await fetch(`/api/attendance/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ latitude: location.latitude, longitude: location.longitude }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(data, "Unable to record attendance."));
      await load(); setNotice(action === "punch-in" ? "Punch-in recorded." : "Punch-out recorded.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to record attendance."); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="space-y-3"><div className="h-36 animate-pulse rounded-xl bg-background" /><div className="h-64 animate-pulse rounded-xl bg-background" /></div>;

  return <div className="space-y-5">
    {notice && <SuccessToast message={notice} onClose={() => setNotice("")} />}
    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}
    <section className="crm-surface p-5 sm:p-6">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand"><Clock3 size={22} /></span>
        <span className={`mt-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone[today?.status ?? "NOT_PUNCHED"]}`}>{pretty(today?.status ?? "NOT_PUNCHED")}</span>
        {today?.punchInAt && !today.punchOutAt && <p className="mt-2 text-sm text-muted">Punched in at <strong className="text-foreground">{time(today.punchInAt)}</strong></p>}
        {today?.punchInAt && today.punchOutAt && <p className="mt-2 text-sm text-muted">Worked <strong className="text-foreground">{today.workingHours?.toFixed(2)} hours</strong> ({time(today.punchInAt)} – {time(today.punchOutAt)})</p>}
        {!today?.punchInAt && <p className="mt-2 text-sm text-muted">You have not punched in today.</p>}
        {locationMessage && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><MapPin size={13} />{locationMessage}</p>}
        <div className="mt-4 flex justify-center gap-2">
          {!today?.punchInAt && <Button disabled={busy} onClick={() => punch("punch-in")}><LogIn size={16} />{busy ? "Recording…" : "Punch in"}</Button>}
          {today?.punchInAt && !today.punchOutAt && <Button variant="secondary" disabled={busy} onClick={() => punch("punch-out")}><LogOut size={16} />{busy ? "Recording…" : "Punch out"}</Button>}
          {today?.punchInAt && today.punchOutAt && <span className="inline-flex items-center gap-1.5 rounded-lg bg-success-soft px-3 py-2 text-xs font-semibold text-success"><CheckCircle2 size={14} />Day complete</span>}
        </div>
      </div>
      <div className="mt-5 grid gap-2 border-t pt-4 sm:grid-cols-2"><Button variant="secondary" onClick={() => setModal("correction")}><FilePenLine size={15} />Request correction</Button><Button variant="secondary" onClick={() => setModal("leave")}><CalendarDays size={15} />Request leave</Button></div>
    </section>

    {monthly && <section className="crm-surface overflow-hidden">
      <div className="border-b px-4 py-3 sm:px-5"><p className="text-sm font-semibold text-foreground">{MONTHS[monthly.period.month - 1]} {monthly.period.year}</p><p className="mt-0.5 text-xs text-muted">{monthly.summary.present} present · {monthly.summary.totalHours} hours · {monthly.summary.absent} absent</p></div>
      {monthly.records.length ? <div className="divide-y">{monthly.records.map((record) => <div key={record.date} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="flex items-center gap-2"><p className="text-sm text-foreground">{dateLabel(record.date)}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone[record.status]}`}>{pretty(record.status)}</span></div><p className="text-xs text-muted">{record.punchInAt ? time(record.punchInAt) : "—"} – {record.punchOutAt ? time(record.punchOutAt) : "—"}{record.workingHours != null ? ` · ${record.workingHours.toFixed(2)}h` : ""}</p></div>)}</div> : <div className="px-5 py-8 text-center text-xs text-muted">No attendance entries yet this month.</div>}
    </section>}

    <section className="grid gap-4 lg:grid-cols-2"><RequestList title="Correction requests" items={corrections} /><RequestList title="Leave requests" items={leaves} /></section>
    {modal === "correction" && <CorrectionModal onClose={() => setModal(null)} onDone={async () => { setModal(null); await load(); setNotice("Correction request submitted."); }} />}
    {modal === "leave" && <LeaveModal onClose={() => setModal(null)} onDone={async () => { setModal(null); await load(); setNotice("Leave request submitted."); }} />}
  </div>;
}

function RequestList({ title, items }: { title: string; items: RequestItem[] }) { return <section className="crm-surface overflow-hidden"><div className="border-b px-4 py-3"><h2 className="text-sm font-semibold text-foreground">{title}</h2></div>{items.length ? <div className="divide-y">{items.slice(0, 5).map((item) => <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3"><div><p className="text-xs font-medium text-foreground">{item.date ? dateLabel(item.date) : `${dateLabel(item.startDate!)} – ${dateLabel(item.endDate!)}`}</p><p className="mt-1 line-clamp-2 text-xs text-muted">{item.reason}</p></div><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.status === "APPROVED" ? "bg-success-soft text-success" : item.status === "REJECTED" ? "bg-red-50 text-danger" : "bg-warning-soft text-warning"}`}>{pretty(item.status)}</span></div>)}</div> : <p className="px-4 py-6 text-center text-xs text-muted">No requests yet.</p>}</section>; }

function CorrectionModal({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const [date, setDate] = useState(""); const [punchIn, setPunchIn] = useState(""); const [punchOut, setPunchOut] = useState(""); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { const response = await fetch("/api/attendance/corrections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, requestedPunchIn: punchIn ? `${date}T${punchIn}:00+05:30` : undefined, requestedPunchOut: punchOut ? `${date}T${punchOut}:00+05:30` : undefined, reason }) }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(messageFrom(data, "Unable to submit correction.")); await onDone(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit correction."); setBusy(false); } };
  return <Modal title="Request attendance correction" onClose={onClose} maxWidth="max-w-lg"><form onSubmit={submit} className="space-y-4"><Field label="Date"><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Requested punch-in"><Input type="time" value={punchIn} onChange={(event) => setPunchIn(event.target.value)} /></Field><Field label="Requested punch-out"><Input type="time" value={punchOut} onChange={(event) => setPunchOut(event.target.value)} /></Field></div><Field label="Reason"><textarea value={reason} onChange={(event) => setReason(event.target.value)} required minLength={2} maxLength={500} rows={3} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" /></Field>{error && <p className="text-xs text-danger">{error}</p>}<FormActions saving={busy} onClose={onClose} label="Submit" /></form></Modal>;
}

function LeaveModal({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState(""); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { const response = await fetch("/api/attendance/leave", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ startDate, endDate, reason }) }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(messageFrom(data, "Unable to submit leave request.")); await onDone(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit leave request."); setBusy(false); } };
  return <Modal title="Request leave" onClose={onClose} maxWidth="max-w-lg"><form onSubmit={submit} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><Field label="From"><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></Field><Field label="To"><Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} min={startDate} required /></Field></div><Field label="Reason"><textarea value={reason} onChange={(event) => setReason(event.target.value)} required minLength={2} maxLength={500} rows={3} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" /></Field>{error && <p className="text-xs text-danger">{error}</p>}<FormActions saving={busy} onClose={onClose} label="Submit" /></form></Modal>;
}
