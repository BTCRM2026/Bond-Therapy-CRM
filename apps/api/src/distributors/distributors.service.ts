import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword } from '../auth/password.js';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import type { CreateDistributorDto, CreateDistributorUserDto, UpdateDistributorDto, UpdateDistributorUserStatusDto } from './dto.js';

const slugLoginId = (name: string) => name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 44) || 'distributor';

@Injectable()
export class DistributorsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.distributor.findMany({
      include: { assignedSalesperson: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateDistributorDto, actor: SessionUser, ipAddress?: string) {
    const distributor = await this.prisma.distributor.create({
      data: {
        businessName: dto.businessName.trim(),
        contactName: dto.contactName.trim(),
        phone: dto.phone,
        email: dto.email,
        territory: dto.territory,
        creditLimit: dto.creditLimit,
        assignedSalespersonId: dto.assignedSalespersonId,
        notes: dto.notes,
      },
    });
    await recordAudit(this.prisma, {
      actorId: actor.id,
      action: 'DISTRIBUTOR_CREATE',
      entity: 'DISTRIBUTOR',
      entityId: distributor.id,
      details: { businessName: distributor.businessName },
      ipAddress,
    });
    return distributor;
  }

  async update(id: string, dto: UpdateDistributorDto, actor: SessionUser, ipAddress?: string) {
    const existing = await this.prisma.distributor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Distributor not found.');

    const distributor = await this.prisma.distributor.update({
      where: { id },
      data: {
        businessName: dto.businessName?.trim(),
        contactName: dto.contactName?.trim(),
        phone: dto.phone,
        email: dto.email,
        territory: dto.territory,
        creditLimit: dto.creditLimit,
        assignedSalespersonId: dto.assignedSalespersonId,
        notes: dto.notes,
        status: dto.status,
      },
    });

    await recordAudit(this.prisma, {
      actorId: actor.id,
      action: 'DISTRIBUTOR_UPDATE',
      entity: 'DISTRIBUTOR',
      entityId: id,
      details: { changes: dto },
      ipAddress,
    });

    return distributor;
  }

  async listUsers(distributorId: string) {
    const distributor = await this.prisma.distributor.findUnique({ where: { id: distributorId }, select: { id: true } });
    if (!distributor) throw new NotFoundException('Distributor not found.');
    return this.prisma.user.findMany({
      where: { distributorId },
      select: { id: true, loginId: true, email: true, name: true, status: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUser(distributorId: string, dto: CreateDistributorUserDto, actor: SessionUser, ipAddress?: string) {
    const distributor = await this.prisma.distributor.findUnique({ where: { id: distributorId }, select: { id: true } });
    if (!distributor) throw new NotFoundException('Distributor not found.');
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({ where: { email }, select: { id: true } });
    if (existing) throw new BadRequestException('A user with that email address already exists.');
    const role = await this.prisma.role.upsert({
      where: { key: 'DISTRIBUTOR_STAFF' },
      update: { portal: 'DISTRIBUTOR', dashboardPath: '/distributor/dashboard', isActive: true },
      create: { key: 'DISTRIBUTOR_STAFF', name: 'Distributor', description: 'Regional distributor stock and fulfillment', portal: 'DISTRIBUTOR', dashboardPath: '/distributor/dashboard', priority: 60 },
    });
    const passwordHash = await hashPassword(dto.password);
    const base = slugLoginId(dto.name);
    let loginId = base;
    for (let suffix = 1; await this.prisma.user.findUnique({ where: { loginId }, select: { id: true } }); suffix += 1) {
      loginId = `${base}.${suffix}`;
    }
    const user = await this.prisma.user.create({
      data: { loginId, email, name: dto.name.trim(), passwordHash, distributorId, roles: { create: { roleId: role.id } } },
      select: { id: true, loginId: true, email: true, name: true, status: true, createdAt: true },
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'DISTRIBUTOR_USER_CREATE', entity: 'USER', entityId: user.id, details: { distributorId, loginId: user.loginId }, ipAddress });
    return user;
  }

  async updateUserStatus(distributorId: string, userId: string, dto: UpdateDistributorUserStatusDto, actor: SessionUser, ipAddress?: string) {
    const existing = await this.prisma.user.findFirst({ where: { id: userId, distributorId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Distributor user not found.');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { status: dto.status } }),
      ...(dto.status === 'INACTIVE' ? [this.prisma.session.deleteMany({ where: { userId } })] : []),
    ]);
    await recordAudit(this.prisma, { actorId: actor.id, action: 'DISTRIBUTOR_USER_STATUS_UPDATE', entity: 'USER', entityId: userId, details: { distributorId, status: dto.status }, ipAddress });
    return { ok: true };
  }
}
