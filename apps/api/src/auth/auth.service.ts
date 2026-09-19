import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { PortalType } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './login.dto.js';
import { hashPassword, verifyPassword } from './password.js';
import type { ChangePasswordDto, UpdateProfileDto } from './profile.dto.js';

const SESSION_HOURS = 8;
const REMEMBER_DAYS = 30;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

type RequestMeta = { ipAddress?: string; userAgent?: string };

type AuthUser = {
  id: string;
  loginId: string;
  email: string;
  name: string;
  status: string;
  roles: Array<{
    role: {
      key: string;
      name: string;
      dashboardPath: string;
      priority: number;
      portal: PortalType;
      isActive: boolean;
      permissions: Array<{ permission: { key: string } }>;
    };
  }>;
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private sessionId(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private publicUser(user: AuthUser, portal: PortalType) {
    const roles = user.roles
      .map(({ role }) => role)
      .filter((role) => role.portal === portal && role.isActive)
      .sort((a, b) => a.priority - b.priority);
    return {
      id: user.id,
      loginId: user.loginId,
      email: user.email,
      name: user.name,
      status: user.status,
      roles: roles.map(({ key, name }) => ({ key, name })),
      permissions: [...new Set(roles.flatMap((role) => role.permissions.map(({ permission }) => permission.key)))],
      portal,
      dashboardPath: roles[0]?.dashboardPath ?? '/dashboard',
    };
  }

  async login(dto: LoginDto, meta: RequestMeta, portal: PortalType) {
    const identifier = dto.identifier.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { loginId: identifier }] },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    if (!user) {
      await hashPassword(dto.password);
      throw new UnauthorizedException('Invalid login ID or password.');
    }
    if (user.status !== 'ACTIVE' || (user.lockedUntil && user.lockedUntil > new Date())) {
      throw new UnauthorizedException('This account is temporarily unavailable.');
    }

    const valid = await verifyPassword(dto.password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
      throw new UnauthorizedException('Invalid login ID or password.');
    }

    const publicUser = this.publicUser(user, portal);
    if (!publicUser.roles.length) {
      const assignedPortal = user.roles
        .map(({ role }) => role)
        .filter((role) => role.isActive)
        .sort((a, b) => a.priority - b.priority)[0]?.portal;
      throw new UnauthorizedException({ message: 'Redirecting you to your assigned portal.', assignedPortal });
    }

    const token = randomBytes(32).toString('base64url');
    const maxAgeMs = dto.remember ? REMEMBER_DAYS * 86_400_000 : SESSION_HOURS * 3_600_000;
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } }),
      this.prisma.session.create({
        data: {
          id: this.sessionId(token),
          userId: user.id,
          portal,
          expiresAt: new Date(Date.now() + maxAgeMs),
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      }),
      this.prisma.auditLog.create({ data: { actorId: user.id, action: 'LOGIN', entity: 'SESSION', ipAddress: meta.ipAddress, details: { portal } } }),
    ]);
    return { token, maxAgeMs, user: publicUser };
  }

  async session(portal: PortalType, token?: string) {
    if (!token) throw new UnauthorizedException();
    const session = await this.prisma.session.findUnique({
      where: { id: this.sessionId(token) },
      include: {
        user: {
          include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
        },
      },
    });
    if (!session || session.portal !== portal || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') {
      if (session) await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException();
    }
    const user = this.publicUser(session.user, portal);
    if (!user.roles.length) throw new UnauthorizedException();
    return user;
  }

  async logout(token?: string) {
    if (token) await this.prisma.session.deleteMany({ where: { id: this.sessionId(token) } });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto, ipAddress?: string) {
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();
    const duplicate = await this.prisma.user.findFirst({ where: { email, NOT: { id: userId } }, select: { id: true } });
    if (duplicate) throw new BadRequestException('That email address is already in use.');

    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { name, email }, select: { id: true, name: true, email: true } }),
      this.prisma.auditLog.create({
        data: { actorId: userId, action: 'PROFILE_UPDATE', entity: 'USER', entityId: userId, details: { name, email }, ipAddress },
      }),
    ]);
    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user || !(await verifyPassword(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect.');
    }
    if (await verifyPassword(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException('New password must be different from the current password.');
    }

    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      }),
      this.prisma.session.deleteMany({ where: { userId } }),
      this.prisma.auditLog.create({
        data: { actorId: userId, action: 'PASSWORD_CHANGE', entity: 'USER', entityId: userId, ipAddress },
      }),
    ]);
  }
}
