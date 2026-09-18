import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const EXPIRY_WINDOW_DAYS = 30;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async refresh() {
    await Promise.all([this.refreshExpiringAgreements(), this.refreshLockedAccounts()]);
  }

  private async refreshExpiringAgreements() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const expiring = await this.prisma.agreement.findMany({
      where: {
        expiryDate: { not: null, lte: windowEnd },
        status: { not: 'TERMINATED' },
      },
      select: { id: true, title: true, partyName: true, expiryDate: true },
    });

    for (const agreement of expiring) {
      const isOverdue = agreement.expiryDate ? agreement.expiryDate <= now : false;
      await this.prisma.notification.upsert({
        where: { sourceKey: `agreement-expiry:${agreement.id}` },
        create: {
          type: 'AGREEMENT_EXPIRY',
          severity: isOverdue ? 'CRITICAL' : 'WARNING',
          title: isOverdue ? 'Agreement expired' : 'Agreement nearing expiry',
          message: `${agreement.title} (${agreement.partyName}) ${isOverdue ? 'expired' : 'expires'} on ${agreement.expiryDate?.toDateString()}.`,
          sourceKey: `agreement-expiry:${agreement.id}`,
        },
        update: {
          severity: isOverdue ? 'CRITICAL' : 'WARNING',
          title: isOverdue ? 'Agreement expired' : 'Agreement nearing expiry',
          message: `${agreement.title} (${agreement.partyName}) ${isOverdue ? 'expired' : 'expires'} on ${agreement.expiryDate?.toDateString()}.`,
        },
      });
    }
  }

  private async refreshLockedAccounts() {
    const now = new Date();
    const lockedUsers = await this.prisma.user.findMany({
      where: { lockedUntil: { gt: now } },
      select: { id: true, name: true, loginId: true, lockedUntil: true },
    });

    for (const user of lockedUsers) {
      await this.prisma.notification.upsert({
        where: { sourceKey: `account-lockout:${user.id}` },
        create: {
          type: 'ACCOUNT_LOCKOUT',
          severity: 'CRITICAL',
          title: 'Account locked',
          message: `${user.name} (${user.loginId}) is locked until ${user.lockedUntil?.toLocaleString()}.`,
          sourceKey: `account-lockout:${user.id}`,
        },
        update: {
          message: `${user.name} (${user.loginId}) is locked until ${user.lockedUntil?.toLocaleString()}.`,
        },
      });
    }
  }

  async list() {
    await this.refresh();
    return this.prisma.notification.findMany({
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async markRead(id: string) {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Notification not found.');
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }
}
