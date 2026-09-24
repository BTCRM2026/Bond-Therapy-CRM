import { Injectable, NotFoundException } from '@nestjs/common';
import type { IncentiveCalcStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SessionUser } from '../common/session.util.js';

const EXPIRY_WINDOW_DAYS = 30;
const DEFAULT_VISIT_FREQUENCY_DAYS = 14;
const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async refresh(user: SessionUser) {
    const isAdmin = user.portal === 'ADMIN' && user.roles.some((role) => role.key === 'SUPER_ADMIN');
    const isManager = user.portal === 'STAFF' && user.roles.some((role) => role.key === 'SALES_MANAGER');
    const isSales = user.portal === 'STAFF' && user.roles.some((role) => salesRoles.has(role.key));
    if (isAdmin) {
      await Promise.all([this.refreshExpiringAgreements(user), this.refreshLockedAccounts(user), this.refreshIncentivePendingApproval(user), this.refreshAttendanceRequests(user)]);
    } else if (isSales) {
      const tasks = [this.refreshOverdueVisits(user)];
      if (isManager) tasks.push(this.refreshIncentivePendingApproval(user), this.refreshAttendanceRequests(user));
      await Promise.all(tasks);
    }
  }

  private async refreshAttendanceRequests(user: SessionUser) {
    const isAdmin = user.portal === 'ADMIN' && user.roles.some((role) => role.key === 'SUPER_ADMIN');
    const team = isAdmin ? {} : { user: { managerId: user.id } };
    const [corrections, leaves] = await Promise.all([
      this.prisma.attendanceCorrectionRequest.count({ where: { status: 'PENDING', ...team } }),
      this.prisma.leaveRequest.count({ where: { status: 'PENDING', ...team } }),
    ]);
    for (const item of [
      { count: corrections, type: 'ATTENDANCE_CORRECTION_PENDING', title: 'Correction requests pending', label: 'attendance correction request' },
      { count: leaves, type: 'LEAVE_REQUEST_PENDING', title: 'Leave requests pending', label: 'leave request' },
    ]) {
      if (!item.count) {
        await this.prisma.notification.deleteMany({
          where: { sourceKey: `${item.type.toLowerCase()}:${user.id}` },
        });
        continue;
      }
      const message = `${item.count} ${item.label}${item.count === 1 ? '' : 's'} waiting for review.`;
      await this.prisma.notification.upsert({
        where: { sourceKey: `${item.type.toLowerCase()}:${user.id}` },
        create: { type: item.type, severity: 'INFO', title: item.title, message, sourceKey: `${item.type.toLowerCase()}:${user.id}`, portal: user.portal, recipientId: user.id },
        update: { message, isRead: false },
      });
    }
  }

  private async refreshOverdueVisits(user: SessionUser) {
    const clients = await this.prisma.client.findMany({
      where: { assignedSalespersonId: user.id, status: { not: 'INACTIVE' } },
      select: {
        id: true, salonName: true, beat: { select: { visitFrequencyDays: true } },
        activities: { where: { type: 'VISIT', status: 'COMPLETED' }, orderBy: { checkOutAt: 'desc' }, take: 1, select: { checkOutAt: true } },
      },
    });
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const overdue = clients
      .map((client) => {
        const frequency = client.beat?.visitFrequencyDays ?? DEFAULT_VISIT_FREQUENCY_DAYS;
        const lastVisit = client.activities[0]?.checkOutAt ?? null;
        const daysSince = lastVisit ? Math.floor((now - lastVisit.getTime()) / dayMs) : null;
        return { id: client.id, salonName: client.salonName, daysSince, isOverdue: daysSince === null || daysSince > frequency };
      })
      .filter((client) => client.isOverdue)
      .sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999))
      .slice(0, 10);

    for (const client of overdue) {
      const message = client.daysSince == null ? `${client.salonName} has never been visited.` : `${client.salonName} is overdue for a visit — ${client.daysSince} days since last visit.`;
      await this.prisma.notification.upsert({
        where: { sourceKey: `overdue-visit:${client.id}:${user.id}` },
        create: { type: 'OVERDUE_VISIT', severity: 'WARNING', title: 'Salon visit overdue', message, sourceKey: `overdue-visit:${client.id}:${user.id}`, portal: user.portal, recipientId: user.id },
        update: { message },
      });
    }
  }

  private async refreshIncentivePendingApproval(user: SessionUser) {
    const isAdmin = user.portal === 'ADMIN' && user.roles.some((role) => role.key === 'SUPER_ADMIN');
    const pendingStatuses: IncentiveCalcStatus[] = ['CALCULATED', 'PENDING_APPROVAL'];
    const where = isAdmin ? { status: { in: pendingStatuses } } : { status: { in: pendingStatuses }, user: { managerId: user.id } };
    const count = await this.prisma.incentiveCalculation.count({ where });
    if (count === 0) return;
    const message = `${count} incentive calculation${count === 1 ? '' : 's'} waiting on your approval.`;
    await this.prisma.notification.upsert({
      where: { sourceKey: `incentive-pending:${user.id}` },
      create: { type: 'INCENTIVE_PENDING_APPROVAL', severity: 'INFO', title: 'Incentives pending approval', message, sourceKey: `incentive-pending:${user.id}`, portal: user.portal, recipientId: user.id },
      update: { message },
    });
  }

  private async refreshExpiringAgreements(user: SessionUser) {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const expiring = await this.prisma.agreement.findMany({
      where: { expiryDate: { not: null, lte: windowEnd }, status: { not: 'TERMINATED' } },
      select: { id: true, title: true, partyName: true, expiryDate: true },
    });

    for (const agreement of expiring) {
      const isOverdue = agreement.expiryDate ? agreement.expiryDate <= now : false;
      await this.prisma.notification.upsert({
        where: { sourceKey: `agreement-expiry:${agreement.id}:${user.id}` },
        create: {
          type: 'AGREEMENT_EXPIRY', severity: isOverdue ? 'CRITICAL' : 'WARNING',
          title: isOverdue ? 'Agreement expired' : 'Agreement nearing expiry',
          message: `${agreement.title} (${agreement.partyName}) ${isOverdue ? 'expired' : 'expires'} on ${agreement.expiryDate?.toDateString()}.`,
          sourceKey: `agreement-expiry:${agreement.id}:${user.id}`, portal: user.portal, recipientId: user.id,
        },
        update: {
          severity: isOverdue ? 'CRITICAL' : 'WARNING',
          title: isOverdue ? 'Agreement expired' : 'Agreement nearing expiry',
          message: `${agreement.title} (${agreement.partyName}) ${isOverdue ? 'expired' : 'expires'} on ${agreement.expiryDate?.toDateString()}.`,
        },
      });
    }
  }

  private async refreshLockedAccounts(user: SessionUser) {
    const lockedUsers = await this.prisma.user.findMany({
      where: { lockedUntil: { gt: new Date() } },
      select: { id: true, name: true, loginId: true, lockedUntil: true },
    });
    for (const locked of lockedUsers) {
      await this.prisma.notification.upsert({
        where: { sourceKey: `account-lockout:${locked.id}:${user.id}` },
        create: {
          type: 'ACCOUNT_LOCKOUT', severity: 'CRITICAL', title: 'Account locked',
          message: `${locked.name} (${locked.loginId}) is locked until ${locked.lockedUntil?.toLocaleString()}.`,
          sourceKey: `account-lockout:${locked.id}:${user.id}`, portal: user.portal, recipientId: user.id,
        },
        update: { message: `${locked.name} (${locked.loginId}) is locked until ${locked.lockedUntil?.toLocaleString()}.` },
      });
    }
  }

  async list(user: SessionUser) {
    await this.refresh(user);
    return this.prisma.notification.findMany({
      where: { recipientId: user.id, portal: user.portal },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    });
  }

  async markRead(id: string, user: SessionUser) {
    const existing = await this.prisma.notification.findFirst({
      where: { id, recipientId: user.id, portal: user.portal }, select: { id: true },
    });
    if (!existing) throw new NotFoundException('Notification not found.');
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }
}
