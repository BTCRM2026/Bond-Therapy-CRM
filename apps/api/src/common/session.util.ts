import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

export type SessionUser = {
  id: string;
  loginId: string;
  email: string;
  name: string;
  roles: Array<{ key: string; name: string }>;
};

const COOKIE_NAME = 'bt_session';

export function sessionCookieName() {
  return COOKIE_NAME;
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function loadSessionUser(prisma: PrismaService, token?: string): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: hashSessionToken(token) },
    include: { user: { include: { roles: { include: { role: true } } } } },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') return null;
  const roles = session.user.roles.map(({ role }) => role).sort((a, b) => a.priority - b.priority);
  return {
    id: session.user.id,
    loginId: session.user.loginId,
    email: session.user.email,
    name: session.user.name,
    roles: roles.map(({ key, name }) => ({ key, name })),
  };
}
