import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword } from '../auth/password.js';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import type { CreateUserDto, UpdateUserDto } from './dto.js';

function generatePassword() {
  return randomBytes(9).toString('base64url');
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private present(user: {
    id: string;
    loginId: string;
    email: string;
    name: string;
    status: string;
    lastLoginAt: Date | null;
    createdAt: Date;
    roles: Array<{ role: { key: string; name: string } }>;
  }) {
    return {
      id: user.id,
      loginId: user.loginId,
      email: user.email,
      name: user.name,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles: user.roles.map(({ role }) => ({ key: role.key, name: role.name })),
    };
  }

  async list() {
    const users = await this.prisma.user.findMany({
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user) => this.present(user));
  }

  async create(dto: CreateUserDto, actor: SessionUser, ipAddress?: string) {
    const role = await this.prisma.role.findUnique({ where: { key: dto.roleKey } });
    if (!role) throw new BadRequestException('Unknown role.');

    const loginId = dto.loginId.trim().toLowerCase();
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ loginId }, { email }] } });
    if (existing) throw new BadRequestException('A user with that login ID or email already exists.');

    const password = dto.password ?? generatePassword();
    const passwordHash = await hashPassword(password);

    const user = await this.prisma.user.create({
      data: {
        loginId,
        email,
        name: dto.name.trim(),
        passwordHash,
        roles: { create: { roleId: role.id } },
      },
      include: { roles: { include: { role: true } } },
    });

    await recordAudit(this.prisma, {
      actorId: actor.id,
      action: 'USER_CREATE',
      entity: 'USER',
      entityId: user.id,
      details: { loginId: user.loginId, roleKey: role.key },
      ipAddress,
    });

    return { user: this.present(user), temporaryPassword: dto.password ? undefined : password };
  }

  async update(id: string, dto: UpdateUserDto, actor: SessionUser, ipAddress?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: { roles: true } });
    if (!existing) throw new NotFoundException('User not found.');

    if (dto.roleKey) {
      const role = await this.prisma.role.findUnique({ where: { key: dto.roleKey } });
      if (!role) throw new BadRequestException('Unknown role.');
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      await this.prisma.userRole.create({ data: { userId: id, roleId: role.id } });
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        status: dto.status,
      },
      include: { roles: { include: { role: true } } },
    });

    await recordAudit(this.prisma, {
      actorId: actor.id,
      action: 'USER_UPDATE',
      entity: 'USER',
      entityId: user.id,
      details: { changes: dto },
      ipAddress,
    });

    return this.present(user);
  }

  async resetPassword(id: string, actor: SessionUser, ipAddress?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found.');

    const password = generatePassword();
    const passwordHash = await hashPassword(password);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });

    await recordAudit(this.prisma, {
      actorId: actor.id,
      action: 'USER_PASSWORD_RESET',
      entity: 'USER',
      entityId: id,
      ipAddress,
    });

    return { temporaryPassword: password };
  }
}
