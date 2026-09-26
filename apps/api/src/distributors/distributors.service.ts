import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword } from '../auth/password.js';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import type { CreateDistributorDto, CreateDistributorUserDto, UpdateDistributorDto, UpdateDistributorUserStatusDto } from './dto.js';

const DISTRIBUTOR_ROLE_KEYS = ['DISTRIBUTOR_OWNER', 'DISTRIBUTOR_ACCOUNTS', 'DISTRIBUTOR_WAREHOUSE'] as const;
const DISTRIBUTOR_ROLE_NAMES: Record<(typeof DISTRIBUTOR_ROLE_KEYS)[number], string> = {
  DISTRIBUTOR_OWNER: 'Owner',
  DISTRIBUTOR_ACCOUNTS: 'Accounts',
  DISTRIBUTOR_WAREHOUSE: 'Warehouse',
};
const slugLoginId = (name: string) => name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 44) || 'distributor';

@Injectable()
export class DistributorsService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor: SessionUser) { return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN'); }
  private isOwner(actor: SessionUser) { return actor.portal === 'DISTRIBUTOR' && actor.roles.some((role) => role.key === 'DISTRIBUTOR_OWNER'); }

  private ensureTeamAccess(actor: SessionUser, distributorId: string) {
    if (this.isAdmin(actor)) return;
    if (this.isOwner(actor) && actor.distributorId === distributorId) return;
    throw new ForbiddenException('You do not have access to manage this distributor\'s team.');
  }

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

  async listUsers(distributorId: string, actor: SessionUser) {
    this.ensureTeamAccess(actor, distributorId);
    const distributor = await this.prisma.distributor.findUnique({ where: { id: distributorId }, select: { id: true } });
    if (!distributor) throw new NotFoundException('Distributor not found.');
    const users = await this.prisma.user.findMany({
      where: { distributorId },
      select: { id: true, loginId: true, email: true, name: true, status: true, lastLoginAt: true, createdAt: true, roles: { select: { role: { select: { key: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(({ roles, ...user }) => ({ ...user, roleKey: roles[0]?.role.key ?? null, roleName: roles[0]?.role.name ?? null }));
  }

  async createUser(distributorId: string, dto: CreateDistributorUserDto, actor: SessionUser, ipAddress?: string) {
    this.ensureTeamAccess(actor, distributorId);
    const distributor = await this.prisma.distributor.findUnique({ where: { id: distributorId }, select: { id: true } });
    if (!distributor) throw new NotFoundException('Distributor not found.');
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({ where: { email }, select: { id: true } });
    if (existing) throw new BadRequestException('A user with that email address already exists.');
    const roleKey = dto.roleKey ?? 'DISTRIBUTOR_OWNER';
    const role = await this.prisma.role.upsert({
      where: { key: roleKey },
      update: { portal: 'DISTRIBUTOR', dashboardPath: '/distributor/dashboard', isActive: true },
      create: { key: roleKey, name: DISTRIBUTOR_ROLE_NAMES[roleKey], description: `Distributor portal - ${DISTRIBUTOR_ROLE_NAMES[roleKey]}`, portal: 'DISTRIBUTOR', dashboardPath: '/distributor/dashboard', priority: DISTRIBUTOR_ROLE_KEYS.indexOf(roleKey) + 60 },
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
    await recordAudit(this.prisma, { actorId: actor.id, action: 'DISTRIBUTOR_USER_CREATE', entity: 'USER', entityId: user.id, details: { distributorId, loginId: user.loginId, roleKey }, ipAddress });
    return { ...user, roleKey, roleName: DISTRIBUTOR_ROLE_NAMES[roleKey] };
  }

  async updateUserStatus(distributorId: string, userId: string, dto: UpdateDistributorUserStatusDto, actor: SessionUser, ipAddress?: string) {
    this.ensureTeamAccess(actor, distributorId);
    const existing = await this.prisma.user.findFirst({ where: { id: userId, distributorId }, select: { id: true, roles: { select: { role: { select: { key: true } } } } } });
    if (!existing) throw new NotFoundException('Distributor user not found.');
    if (dto.status === 'INACTIVE' && existing.roles.some((entry) => entry.role.key === 'DISTRIBUTOR_OWNER')) {
      const activeOwners = await this.prisma.user.count({ where: { distributorId, status: 'ACTIVE', id: { not: userId }, roles: { some: { role: { key: 'DISTRIBUTOR_OWNER' } } } } });
      if (activeOwners === 0) throw new BadRequestException('This distributor needs at least one active Owner login. Create another Owner login before deactivating this one.');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { status: dto.status } }),
      ...(dto.status === 'INACTIVE' ? [this.prisma.session.deleteMany({ where: { userId } })] : []),
    ]);
    await recordAudit(this.prisma, { actorId: actor.id, action: 'DISTRIBUTOR_USER_STATUS_UPDATE', entity: 'USER', entityId: userId, details: { distributorId, status: dto.status }, ipAddress });
    return { ok: true };
  }
}
