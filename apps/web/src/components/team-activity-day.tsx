"use client";

import { ExternalLink, MapPin } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { FormError } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { AttendanceBadge, Pill, RowsSkeleton, clock, longDay, money, pretty, shortDate } from "@/components/team-activity-shared";

type Visit = { activityId: string; stopId: string | null; client: { id: string; salonName: string; city: string; area: string | null }; checkInAt: string | null; checkOutAt: string | null; outcome: string | null; distanceMeters: number | null; gpsVerified: boolean | null; latitude: number | null; longitude: number | null };
type Call = { id: string; customerName: string; customerType: "EXISTING" | "NEW"; result: "ORDER" | "NO_ORDER" | "FOLLOW_UP"; orderValue: number | null; remark: string | null; visitActivityId: string | null };
type Detail = {
  date: string;
  staff: { id: string; name: string; loginId: string; roleName: string; workLocation: string | null };
  attendance: { status: string; onLeave: boolean; leaveReason: string | null; firstActivityAt: string | null; lastActivityAt: string | null; workingHours: number | null; fromVisits: boolean; verifiedCalls?: number | null; dayNote?: string | null; reportOnTime?: boolean | null; officeCheckedIn: boolean; officeCheckedOut: boolean };
  visits: Visit[];
  notVisited: Array<{ id: string; status: string; note: string | null; salonName: string; city: string }>;
  report: null | { id: string; submittedAt: string; workingTown: string; coworker: string | null; noOrderReason: string | null; tomorrowTown: string; tomorrowSalons: string[]; tomorrowNewSalons: string[]; summary: { calls: number; orders: number; value: number; newCalls: number }; calls: Call[] };
};

const RESULT_TONE = { ORDER: "success", NO_ORDER: "neutral", FOLLOW_UP: "warning" } as const;
const minutes = (from: string | null, to: string | null) => (from && to ? Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000)) : null);
const duration = (value: number | null) => (value == null ? "" : value < 60 ? `${value} min` : `${Math.floor(value / 60)} h ${value % 60} min`);

// One person's day: attendance, every salon visit with GPS proof, and the Daily Report with its calls.
// `url` returns the day (admin: per staff member, staff: their own) and `photoBase` serves the call photos.
export function DayDetailModal({ url, photoBase, onClose }: { url: string; photoBase: string; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data && typeof data === "object" && "message" in data && typeof (data as { message: unknown }).message === "string" ? (data as { message: string }).message : "Unable to load this day.");
        if (!cancelled) setDetail(data as Detail);
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load this day."); }
    })();
    return () => { cancelled = true; };
  }, [url]);

  return <Modal title={detail?.staff.name ?? "Staff day"} subtitle={detail ? `${detail.staff.roleName} · ${longDay(detail.date)}` : undefined} onClose={onClose} maxWidth="max-w-4xl">
    {error && <FormError message={error} />}
    {!detail && !error && <RowsSkeleton rows={4} />}
    {detail && <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-background px-4 py-3 text-xs text-muted">
        <AttendanceBadge status={detail.attendance.status} />
        {detail.attendance.firstActivityAt ? <span>Day <strong className="text-foreground">{clock(detail.attendance.firstActivityAt)} – {clock(detail.attendance.lastActivityAt)}</strong>{detail.attendance.workingHours ? ` · ${detail.attendance.workingHours.toFixed(1)} h` : ""}</span> : <span>No activity recorded</span>}
        {detail.attendance.verifiedCalls != null && <Pill tone={detail.attendance.verifiedCalls >= 8 ? "success" : detail.attendance.verifiedCalls >= 4 ? "warning" : "danger"}>{detail.attendance.verifiedCalls} verified {detail.attendance.verifiedCalls === 1 ? "call" : "calls"}</Pill>}
        {detail.attendance.fromVisits && <Pill tone="brand">From salon visits</Pill>}
        {detail.attendance.dayNote && <span className="basis-full text-foreground">{detail.attendance.dayNote}</span>}
        {detail.attendance.officeCheckedIn && <Pill tone="brand">Office work{detail.attendance.officeCheckedOut ? "" : " · still checked in"}</Pill>}
        {detail.attendance.onLeave && <span>On leave{detail.attendance.leaveReason ? `: ${detail.attendance.leaveReason}` : ""}</span>}
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Where they went · {detail.visits.length} {detail.visits.length === 1 ? "visit" : "visits"}</h3>
        {!detail.visits.length && <p className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted">No salon check-ins on this day.</p>}
        <ol className="space-y-2.5">{detail.visits.map((visit, index) => {
          const stay = minutes(visit.checkInAt, visit.checkOutAt);
          return <li key={visit.activityId} className="flex gap-3 rounded-lg border p-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-dark">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-foreground">{visit.client.salonName}</p>{visit.gpsVerified ? <Pill tone="success">GPS verified{visit.distanceMeters != null ? ` · ${visit.distanceMeters} m` : ""}</Pill> : <Pill tone="danger">Not verified</Pill>}</div>
              <p className="mt-0.5 text-xs text-muted">{[visit.client.area, visit.client.city].filter(Boolean).join(" · ")}</p>
              <p className="mt-1 text-xs text-muted">Arrived <strong className="text-foreground">{clock(visit.checkInAt)}</strong>{visit.checkOutAt ? <> · Left <strong className="text-foreground">{clock(visit.checkOutAt)}</strong>{stay != null && ` (${duration(stay)})`}</> : <span className="font-medium text-warning"> · still checked in</span>}</p>
              {visit.latitude != null && visit.longitude != null && <a href={`https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><MapPin size={12} />Open check-in location<ExternalLink size={11} /></a>}
            </div>
            {visit.stopId && <a href={`/api/routes/stops/${visit.stopId}/photo?kind=in`} target="_blank" rel="noreferrer" className="relative hidden size-16 shrink-0 overflow-hidden rounded-lg border bg-background sm:block" aria-label={`Arrival photo at ${visit.client.salonName}`}><Image src={`/api/routes/stops/${visit.stopId}/photo?kind=in`} alt="" fill sizes="64px" className="object-cover" unoptimized /></a>}
          </li>;
        })}</ol>
        {detail.notVisited.length > 0 && <div className="rounded-lg bg-background px-4 py-3"><p className="text-xs font-semibold text-foreground">Planned but not visited</p><ul className="mt-1.5 space-y-1 text-xs text-muted">{detail.notVisited.map((stop) => <li key={stop.id}>{stop.salonName}, {stop.city} · {pretty(stop.status)}{stop.note ? ` — ${stop.note}` : ""}</li>)}</ul></div>}
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Daily report</h3>
        {!detail.report ? <p className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted">No daily report submitted for this day.</p> : <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">{[["Calls", detail.report.summary.calls], ["Orders", detail.report.summary.orders], ["Order value", money(detail.report.summary.value)], ["New calls", detail.report.summary.newCalls]].map(([label, value]) => <div key={String(label)} className="bg-white px-3 py-2.5"><p className="text-[11px] text-muted">{label}</p><p className="text-sm font-semibold text-foreground">{value}</p></div>)}</div>
          <p className="text-xs text-muted">Submitted {shortDate(detail.report.submittedAt)}, {clock(detail.report.submittedAt)} · Working town <strong className="text-foreground">{detail.report.workingTown}</strong> · {detail.report.coworker ? `With ${detail.report.coworker}` : "Solo"}</p>
          {detail.report.noOrderReason && <p className="rounded-lg bg-warning-soft/50 px-3 py-2 text-xs text-foreground">No orders today: {detail.report.noOrderReason}</p>}
          <ul className="space-y-2">{detail.report.calls.map((call) => <li key={call.id} className="flex gap-3 rounded-lg border p-3">
            <a href={`${photoBase}/${call.id}/photo`} target="_blank" rel="noreferrer" className="relative size-14 shrink-0 overflow-hidden rounded-lg border bg-background" aria-label={`Photo for ${call.customerName}`}><Image src={`${photoBase}/${call.id}/photo`} alt="" fill sizes="56px" className="object-cover" unoptimized /></a>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-foreground">{call.customerName}</p><Pill tone={RESULT_TONE[call.result]}>{pretty(call.result)}{call.result === "ORDER" && call.orderValue ? ` · ${money(call.orderValue)}` : ""}</Pill><Pill>{call.customerType === "NEW" ? "New" : "Existing"}</Pill>{call.visitActivityId && <Pill tone="brand">Verified visit</Pill>}</div>
              {call.remark && <p className="mt-1 break-words text-xs text-muted" style={{ overflowWrap: "anywhere" }}>{call.remark}</p>}
            </div>
          </li>)}</ul>
          <div className="rounded-lg bg-background px-4 py-3 text-xs"><p className="font-semibold text-foreground">Tomorrow’s plan · {detail.report.tomorrowTown}</p><div className="mt-2 flex flex-wrap gap-1.5">{detail.report.tomorrowSalons.map((name) => <Pill key={name}>{name}</Pill>)}{detail.report.tomorrowNewSalons.map((name) => <Pill key={name} tone="warning">{name} · no profile yet</Pill>)}{!detail.report.tomorrowSalons.length && !detail.report.tomorrowNewSalons.length && <span className="text-muted">No salons planned.</span>}</div></div>
        </>}
      </section>
    </div>}
  </Modal>;
}
