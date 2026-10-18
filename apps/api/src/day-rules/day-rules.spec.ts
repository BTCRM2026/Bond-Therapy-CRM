import { describe, expect, it } from 'vitest';
import { dayReason, fieldDayStatus, reportCutoff, statusFromCalls } from './day-rules.js';

const at = (value: string) => new Date(value);
// 17 Oct 2026, 11:00 PM IST = 17:30 UTC.
const base = { dateKey: '2026-10-17', hasActivity: true, reportSubmittedAt: null as Date | null };

describe('field day rules', () => {
  it('puts the report deadline at 11 PM India time', () => {
    expect(reportCutoff('2026-10-17').toISOString()).toBe('2026-10-17T17:30:00.000Z');
  });

  it('counts 8 verified calls as a full day, 4 to 7 as a half day and fewer than 4 as absent', () => {
    expect([0, 3, 4, 7, 8, 12].map(statusFromCalls)).toEqual(['ABSENT', 'ABSENT', 'HALF_DAY', 'HALF_DAY', 'PRESENT', 'PRESENT']);
  });

  it('keeps a running day in progress and shows no activity before anything happens', () => {
    const now = at('2026-10-17T09:00:00Z');
    expect(fieldDayStatus({ ...base, now, verifiedCalls: 2 }).status).toBe('IN_PROGRESS');
    expect(fieldDayStatus({ ...base, now, verifiedCalls: 6 }).status).toBe('IN_PROGRESS');
    expect(fieldDayStatus({ ...base, now, verifiedCalls: 8 }).status).toBe('PRESENT');
    expect(fieldDayStatus({ ...base, now, verifiedCalls: 0, hasActivity: false }).status).toBe('NOT_PUNCHED');
  });

  it('finalises the day when the report is submitted, using the calls made', () => {
    const now = at('2026-10-17T14:00:00Z');
    const submitted = at('2026-10-17T13:00:00Z');
    expect(fieldDayStatus({ ...base, now, verifiedCalls: 9, reportSubmittedAt: submitted }).status).toBe('PRESENT');
    expect(fieldDayStatus({ ...base, now, verifiedCalls: 5, reportSubmittedAt: submitted }).status).toBe('HALF_DAY');
    expect(fieldDayStatus({ ...base, now, verifiedCalls: 2, reportSubmittedAt: submitted }).status).toBe('ABSENT');
  });

  it('makes a full-call day a half day when the report is missing or late', () => {
    const after = at('2026-10-18T03:00:00Z');
    const missing = fieldDayStatus({ ...base, now: after, verifiedCalls: 9 });
    expect(missing).toMatchObject({ status: 'HALF_DAY', penalisedForReport: true, reportSubmitted: false });
    const late = fieldDayStatus({ ...base, now: after, verifiedCalls: 9, reportSubmittedAt: at('2026-10-17T18:00:00Z') });
    expect(late).toMatchObject({ status: 'HALF_DAY', penalisedForReport: true, reportOnTime: false });
    expect(dayReason(late)).toContain('after 11 PM');
    expect(dayReason(missing)).toContain('not submitted');
  });

  it('never lifts a short day because of the report', () => {
    const after = at('2026-10-18T03:00:00Z');
    expect(fieldDayStatus({ ...base, now: after, verifiedCalls: 5 }).status).toBe('HALF_DAY');
    expect(fieldDayStatus({ ...base, now: after, verifiedCalls: 1 }).status).toBe('ABSENT');
  });

  it('judges office work by hours, and the better result counts', () => {
    const now = at('2026-10-18T03:00:00Z');
    const submitted = at('2026-10-17T12:00:00Z');
    expect(fieldDayStatus({ ...base, now, verifiedCalls: 0, officeStatus: 'PRESENT', reportSubmittedAt: submitted }).status).toBe('PRESENT');
    expect(fieldDayStatus({ ...base, now, verifiedCalls: 5, officeStatus: 'HALF_DAY', reportSubmittedAt: submitted }).status).toBe('HALF_DAY');
  });
});
