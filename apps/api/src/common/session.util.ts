import { createHash } from 'node:crypto';
import type { PortalType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export type SessionUser = {
  id: string;
  loginId: string;
  email: string;
  name: string;
  roles: Array<{ key: string; name: string }>;
  permissions: string[];
  portal: PortalType;
};

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function loadSessionUser(prisma: PrismaService, portal: PortalType, token?: string): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: hashSessionToken(token) },
    include: {
      user: {
        include: {
          roles: {
            where: { role: { portal, isActive: true } },
            include: { role: { include: { permissions: { include: { permission: true } } } } },
          },
        },
      },
    },
  });
  if (!session || session.portal !== portal || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') return null;
  const roles = session.user.roles.map(({ role }) => role).sort((a, b) => a.priority - b.priority);
  if (!roles.length) return null;
  return {
    id: session.user.id,
    loginId: session.user.loginId,
    email: session.user.email,
    name: session.user.name,
    roles: roles.map(({ key, name }) => ({ key, name })),
    permissions: [...new Set(roles.flatMap((role) => role.permissions.map(({ permission }) => permission.key)))],
    portal,
  };
}
