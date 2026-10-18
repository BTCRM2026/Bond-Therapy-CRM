import type { Prisma } from '@prisma/client';

// A sale counts towards targets, incentives and My Performance only once an administrator has confirmed
// that the payment arrived, and it counts in the month of that confirmation. Use this everywhere sales are totalled.
export const countedOrders = (from: Date, to: Date): Prisma.OrderWhereInput => ({ paymentVerifiedAt: { gte: from, lt: to } });
