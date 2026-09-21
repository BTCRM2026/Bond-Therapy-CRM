"use client";

import { Clock3, LogIn, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type TodayRecord = { punchInAt: string | null; punchOutAt: string | null } | null;
type MonthlyRecord = { date: string; punchInAt: string | null; punchOutAt: string | null };
type Monthly = { period: { month: number; year: number }; daysPresent: number; records: MonthlyRecord[] };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const time = (value: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", weekday: "short" }).format(new Date(value));
const hoursBetween = (inAt: string, outAt: string) => {
  const ms = new Date(outAt).getTime() - new Date(inAt).getTime();
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.round((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
};

export function AttendanceModule() {
  const [today, setToday] = useState<TodayRecord>(null);
  const [monthly, setMonthly] = useState<Monthly | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [todayResponse, monthlyResponse] = await Promise.all([fetch("/api/attendance/today", { cache: "no-store" }), fetch("/api/attendance/monthly", { cache: "no-store" })]);
      if (todayResponse.ok) setToday(await todayResponse.json());
      if (monthlyResponse.ok) setMonthly(await monthlyResponse.json());
      setError("");
    } catch { setError("Unable to load attendance data."); }
    finally { setLoading(false); }
  };
  useEffect(() => { (async () => { await load(); })(); }, []);

  const punch = async (action: "punch-in" | "punch-out") => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/attendance/${action}`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error((data && typeof data === "object" && "message" in data) ? String(data.message) : "Unable to record attendance.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to record attendance."); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="space-y-3"><div className="h-32 animate-pulse rounded-xl bg-background" /></div>;

  return <div className="space-y-5">
    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{error}</div>}
    <section className="rounded-xl border bg-white p-5 text-center shadow-[0_3px_12px_rgba(15,23,42,0.04)] sm:p-6">
      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-brand-soft text-brand"><Clock3 size={22} /></span>
      {today?.punchInAt && !today?.punchOutAt && <p className="mt-3 text-sm text-muted">Punched in at <span className="font-semibold text-foreground">{time(today.punchInAt)}</span></p>}
      {today?.punchInAt && today?.punchOutAt && <p className="mt-3 text-sm text-muted">Worked <span className="font-semibold text-foreground">{hoursBetween(today.punchInAt, today.punchOutAt)}</span> today ({time(today.punchInAt)} – {time(today.punchOutAt)})</p>}
      {!today?.punchInAt && <p className="mt-3 text-sm text-muted">You have not punched in today.</p>}
      <div className="mt-4 flex justify-center gap-2">
        {!today?.punchInAt && <Button disabled={busy} onClick={() => punch("punch-in")}><LogIn size={16} />{busy ? "Punching in…" : "Punch in"}</Button>}
        {today?.punchInAt && !today?.punchOutAt && <Button variant="secondary" disabled={busy} onClick={() => punch("punch-out")}><LogOut size={16} />{busy ? "Punching out…" : "Punch out"}</Button>}
        {today?.punchInAt && today?.punchOutAt && <span className="inline-flex items-center gap-1.5 rounded-lg bg-success-soft px-3 py-2 text-xs font-semibold text-success">Day complete</span>}
      </div>
    </section>

    {monthly && <section className="overflow-hidden rounded-xl border bg-white shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
      <div className="border-b px-4 py-3 sm:px-5"><p className="text-sm font-semibold text-foreground">{MONTHS[monthly.period.month - 1]} {monthly.period.year}</p><p className="mt-0.5 text-xs text-muted">{monthly.daysPresent} day{monthly.daysPresent === 1 ? "" : "s"} present</p></div>
      {monthly.records.length ? <div className="divide-y">{monthly.records.map((record) => <div key={record.date} className="flex items-center justify-between px-4 py-3 sm:px-5">
        <p className="text-sm text-foreground">{dateLabel(record.date)}</p>
        <p className="text-xs text-muted">{record.punchInAt ? time(record.punchInAt) : "—"} – {record.punchOutAt ? time(record.punchOutAt) : "—"}{record.punchInAt && record.punchOutAt ? ` · ${hoursBetween(record.punchInAt, record.punchOutAt)}` : ""}</p>
      </div>)}</div> : <div className="px-5 py-8 text-center text-xs text-muted">No attendance recorded yet this month.</div>}
    </section>}
  </div>;
}
