export type DailyCallSummaryInput = { customerType: 'EXISTING' | 'NEW'; result: 'ORDER' | 'NO_ORDER' | 'FOLLOW_UP'; orderValue?: number | null };

export function summarizeDailyCalls(calls: DailyCallSummaryInput[]) {
  return {
    totalCalls: calls.length,
    productiveCalls: calls.filter((call) => call.result === 'ORDER').length,
    totalValue: calls.reduce((total, call) => total + (call.result === 'ORDER' ? Number(call.orderValue ?? 0) : 0), 0),
    newCalls: calls.filter((call) => call.customerType === 'NEW').length,
  };
}

export function needsNoOrderReason(calls: DailyCallSummaryInput[], reason?: string) {
  return !calls.some((call) => call.result === 'ORDER') && !reason?.trim();
}
