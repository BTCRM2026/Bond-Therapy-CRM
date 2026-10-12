import { describe, expect, it } from 'vitest';
import { needsNoOrderReason, summarizeDailyCalls } from './daily-reports.logic.js';

describe('summarizeDailyCalls', () => {
  it('counts calls, orders, value and new customers without treating follow-ups as orders', () => {
    expect(summarizeDailyCalls([
      { customerType: 'NEW', result: 'ORDER', orderValue: 12500 },
      { customerType: 'EXISTING', result: 'FOLLOW_UP' },
      { customerType: 'NEW', result: 'NO_ORDER', orderValue: 999 },
    ])).toEqual({ totalCalls: 3, productiveCalls: 1, totalValue: 12500, newCalls: 2 });
  });

  it('requires an explanation only when the day has no orders', () => {
    expect(needsNoOrderReason([{ customerType: 'NEW', result: 'NO_ORDER' }], '  ')).toBe(true);
    expect(needsNoOrderReason([{ customerType: 'NEW', result: 'NO_ORDER' }], 'Customer requested a follow-up.')).toBe(false);
    expect(needsNoOrderReason([{ customerType: 'EXISTING', result: 'ORDER', orderValue: 5000 }])).toBe(false);
  });
});
