// The field-day rules for the sales team, kept in one place so attendance, the daily report,
// the route screen and the admin views can never disagree.
//   * 8 or more GPS-verified calls  -> full day
//   * 4 to 7 GPS-verified calls     -> half day
//   * fewer than 4                  -> absent (a full day of leave)
//   * the day's report, with tomorrow's plan, must be submitted by 11 PM; otherwise the day is at most a half day.

export const FULL_DAY_CALLS = 8;
export const HALF_DAY_CALLS = 4;
export const REPORT_CUTOFF_MINUTES = 23 * 60;
const IST_OFFSET_MS = 330 * 60 * 1000;

export type FieldDayStatus = 'PRESENT' | 'HALF_DAY' | 'ABSENT' | 'IN_PROGRESS' | 'NOT_PUNCHED';

export const istDateKey = (at: Date) => new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

// The instant when the report deadline passes (11 PM IST) for the given IST calendar day.
export const reportCutoff = (dateKey: string) => new Date(Date.parse(`${dateKey}T00:00:00.000Z`) + REPORT_CUTOFF_MINUTES * 60_000 - IST_OFFSET_MS);

const rank: Record<'PRESENT' | 'HALF_DAY' | 'ABSENT', number> = { ABSENT: 0, HALF_DAY: 1, PRESENT: 2 };

export function statusFromCalls(verifiedCalls: number): 'PRESENT' | 'HALF_DAY' | 'ABSENT' {
  return verifiedCalls >= FULL_DAY_CALLS ? 'PRESENT' : verifiedCalls >= HALF_DAY_CALLS ? 'HALF_DAY' : 'ABSENT';
}

export type FieldDayInput = {
  dateKey: string;
  now: Date;
  verifiedCalls: number;
  // When the day's report was submitted, or null if it has not been.
  reportSubmittedAt: Date | null;
  // Office work is judged by hours as before; the better of the two results counts.
  officeStatus?: 'PRESENT' | 'HALF_DAY' | null;
  hasActivity: boolean;
};

export type FieldDayResult = { status: FieldDayStatus; verifiedCalls: number; reportSubmitted: boolean; reportOnTime: boolean | null; closed: boolean; penalisedForReport: boolean };

export function fieldDayStatus(input: FieldDayInput): FieldDayResult {
  const { dateKey, now, verifiedCalls, reportSubmittedAt, officeStatus, hasActivity } = input;
  const cutoff = reportCutoff(dateKey);
  const reportSubmitted = reportSubmittedAt !== null;
  const reportOnTime = reportSubmittedAt ? reportSubmittedAt.getTime() <= cutoff.getTime() : null;
  // A day is final once the deadline has passed, or once the staff member has submitted their report and so closed it.
  const closed = reportSubmitted || now.getTime() >= cutoff.getTime();
  const fromCalls = statusFromCalls(verifiedCalls);
  const best = officeStatus && rank[officeStatus] > rank[fromCalls] ? officeStatus : fromCalls;
  const base = { verifiedCalls, reportSubmitted, reportOnTime, closed };

  if (!closed) {
    if (!hasActivity) return { ...base, status: 'NOT_PUNCHED', penalisedForReport: false };
    // Still working: only a day that has already reached the full-day mark shows as present.
    return { ...base, status: best === 'PRESENT' ? 'PRESENT' : 'IN_PROGRESS', penalisedForReport: false };
  }
  if (best === 'PRESENT' && !reportOnTime) return { ...base, status: 'HALF_DAY', penalisedForReport: true };
  return { ...base, status: best, penalisedForReport: false };
}

// A short, plain explanation of how the day was counted, shown to admins and staff.
export function dayReason(result: Pick<FieldDayResult, 'status' | 'verifiedCalls' | 'penalisedForReport' | 'reportSubmitted'>): string | null {
  if (result.penalisedForReport) return `Half day: ${result.reportSubmitted ? 'the report was submitted after 11 PM' : 'the report was not submitted by 11 PM'}.`;
  if (result.status === 'HALF_DAY') return `Half day: ${result.verifiedCalls} verified ${result.verifiedCalls === 1 ? 'call' : 'calls'} (${FULL_DAY_CALLS} needed for a full day).`;
  if (result.status === 'ABSENT') return `Absent: ${result.verifiedCalls} verified ${result.verifiedCalls === 1 ? 'call' : 'calls'} (${HALF_DAY_CALLS} needed for a half day).`;
  return null;
}
