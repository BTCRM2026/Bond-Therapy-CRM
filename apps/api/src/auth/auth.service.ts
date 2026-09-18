import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './login.dto.js';
import { hashPassword, verifyPassword } from './password.js';

const SESSION_HOURS = 8;
const REMEMBER_DAYS = 30;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

type RequestMeta = { ipAddress?: string; userAgent?: string };

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private sessionId(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private publicUser(user: {
    id: string;
    loginId: string;
    email: string;
    name: string;
    roles: Array<{ role: { key: string; name: string; dashboardPath: string; priority: number } }>;
  }) {
    const roles = user.roles.map(({ role }) => role).sort((a, b) => a.priority - b.priority);
    return {
      id: user.id,
      loginId: user.loginId,
      email: user.email,
      name: user.name,
      roles: roles.map(({ key, name }) => ({ key, name })),
      dashboardPath: roles[0]?.dashboardPath ?? '/dashboard',
    };
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const identifier = dto.identifier.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { loginId: identifier }] },
      include: { roles: { include: { role: true } } },
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

    const token = randomBytes(32).toString('base64url');
    const maxAgeMs = dto.remember ? REMEMBER_DAYS * 86_400_000 : SESSION_HOURS * 3_600_000;
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } }),
      this.prisma.session.create({
        data: {
          id: this.sessionId(token),
          userId: user.id,
          expiresAt: new Date(Date.now() + maxAgeMs),
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      }),
      this.prisma.auditLog.create({ data: { actorId: user.id, action: 'LOGIN', entity: 'SESSION', ipAddress: meta.ipAddress } }),
    ]);
    return { token, maxAgeMs, user: this.publicUser(user) };
  }

  async session(token?: string) {
    if (!token) throw new UnauthorizedException();
    const session = await this.prisma.session.findUnique({
      where: { id: this.sessionId(token) },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });
    if (!session || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') {
      if (session) await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException();
    }
    return this.publicUser(session.user);
  }

  async logout(token?: string) {
    if (token) await this.prisma.session.deleteMany({ where: { id: this.sessionId(token) } });
  }
}

