import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SessionUser } from '../common/session.util.js';

const EXPIRY_WINDOW_DAYS = 30;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async refresh(user: SessionUser) {
    if (user.portal !== 'ADMIN' || !user.roles.some((role) => role.key === 'SUPER_ADMIN')) return;
    await Promise.all([this.refreshExpiringAgreements(user), this.refreshLockedAccounts(user)]);
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
