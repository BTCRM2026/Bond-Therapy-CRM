"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { todayKey } from "@/components/team-activity-shared";
import { cn } from "@/lib/utils";

export type CalendarRecord = { date: string; status: string; workingHours?: number | null };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATUS: Record<string, { label: string; short?: string; cell: string }> = {
  PRESENT: { label: "Present", cell: "bg-success-soft text-success" },
  LATE: { label: "Late", cell: "bg-warning-soft text-warning" },
  HALF_DAY: { label: "Half day", short: "Half", cell: "bg-warning-soft text-warning" },
  ABSENT: { label: "Absent", cell: "bg-red-50 text-danger" },
  LEAVE: { label: "Leave", cell: "bg-brand-soft text-brand-dark" },
  HOLIDAY: { label: "Holiday", cell: "bg-info-soft text-info" },
  WEEKLY_OFF: { label: "Off", cell: "bg-background text-subtle" },
  NOT_PUNCHED: { label: "No activity", short: "None", cell: "bg-white text-muted" },
  IN_PROGRESS: { label: "In progress", short: "Today", cell: "bg-brand-soft text-brand-dark" },
};
const LEGEND = ["PRESENT", "HALF_DAY", "ABSENT", "LEAVE", "HOLIDAY", "WEEKLY_OFF"];
const pad = (value: number) => String(value).padStart(2, "0");

// A month grid (Monday first). Tap a day to open what happened on it. Days that are not in `records` are weekly offs.
export function AttendanceCalendar({ month, year, records, loading = false, onMonthChange, onSelectDay }: { month: number; year: number; records: CalendarRecord[]; loading?: boolean; onMonthChange: (month: number, year: number) => void; onSelectDay: (dateKey: string) => void }) {
  const [today] = useState(todayKey);
  const byDate = new Map(records.map((record) => [record.date.slice(0, 10), record]));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const isCurrentMonth = today.slice(0, 7) >= `${year}-${pad(month)}`;
  const move = (by: number) => { const next = new Date(Date.UTC(year, month - 1 + by, 1)); onMonthChange(next.getUTCMonth() + 1, next.getUTCFullYear()); };

  return <div>
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
      <h3 className="text-sm font-semibold text-foreground" aria-live="polite">{MONTHS[month - 1]} {year}</h3>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => move(-1)} className="grid size-9 place-items-center rounded-md border bg-white text-muted transition-colors hover:bg-brand-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30" aria-label="Previous month"><ChevronLeft size={16} /></button>
        <button type="button" onClick={() => move(1)} disabled={isCurrentMonth} className="grid size-9 place-items-center rounded-md border bg-white text-muted transition-colors hover:bg-brand-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:pointer-events-none disabled:opacity-40" aria-label="Next month"><ChevronRight size={16} /></button>
      </div>
    </div>
    <div className={cn("p-3 transition-opacity sm:p-5", loading && "opacity-60")} aria-busy={loading}>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAYS.map((day) => <p key={day} className="pb-1 text-center text-[11px] font-medium text-muted">{day}</p>)}
        {Array.from({ length: leading }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const key = `${year}-${pad(month)}-${pad(index + 1)}`;
          const future = key > today;
          const record = byDate.get(key);
          const status = future ? null : STATUS[record?.status ?? "WEEKLY_OFF"] ?? STATUS.NOT_PUNCHED;
          const label = `${index + 1} ${MONTHS[month - 1]}${status ? `, ${status.label}` : ""}`;
          return <button key={key} type="button" disabled={future} onClick={() => onSelectDay(key)} aria-label={label} aria-current={key === today ? "date" : undefined}
            className={cn("flex h-[52px] min-w-0 flex-col items-start justify-between rounded-md border p-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 sm:h-16 sm:p-2",
              future ? "cursor-default border-transparent bg-transparent text-subtle/70" : cn(status?.cell, "hover:border-brand/40"),
              key === today && "border-brand ring-1 ring-brand/40")}>
            <span className="pl-0.5 text-xs font-semibold leading-none sm:pl-0 sm:text-[13px]">{index + 1}</span>
            {status && <span className="w-full whitespace-nowrap text-[9px] font-medium leading-none tracking-tight sm:text-[10px]">{status.short ?? status.label}</span>}
          </button>;
        })}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted" aria-label="Legend">
        {LEGEND.map((key) => <li key={key} className="flex items-center gap-1.5"><span className={cn("size-3 rounded-sm border", STATUS[key].cell)} />{STATUS[key].label}</li>)}
      </ul>
    </div>
  </div>;
}
