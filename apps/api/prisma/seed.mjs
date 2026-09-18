import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`;
}

const role = await prisma.role.upsert({
  where: { key: 'SUPER_ADMIN' },
  update: { name: 'Super Admin', dashboardPath: '/dashboard', priority: 1, isActive: true },
  create: {
    key: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Full CRM administration and oversight',
    dashboardPath: '/dashboard',
    priority: 1,
  },
});

const loginId = process.env.ADMIN_LOGIN_ID?.trim().toLowerCase();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (loginId && email && password) {
  const user = await prisma.user.upsert({
    where: { email },
    update: { loginId, name: 'Bond Therapy Administrator', status: 'ACTIVE' },
    create: { loginId, email, name: 'Bond Therapy Administrator', passwordHash: hashPassword(password) },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });
  console.log(`Bootstrap administrator ready: ${loginId}`);
} else {
  console.log('Role seeded. Administrator skipped because ADMIN_* variables are incomplete.');
}

await prisma.$disconnect();

