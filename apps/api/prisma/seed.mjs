import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`;
}

const adminRole = await prisma.role.upsert({
  where: { key: 'SUPER_ADMIN' },
  update: { name: 'Super Admin', portal: 'ADMIN', dashboardPath: '/dashboard', priority: 1, isActive: true },
  create: {
    key: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Full CRM administration and oversight',
    portal: 'ADMIN',
    dashboardPath: '/dashboard',
    priority: 1,
  },
});

const staffRoles = [
  ['SALES_MANAGER', 'Sales Manager', 'staff.sales.access', 10],
  ['SALES_EXECUTIVE', 'Sales Executive', 'staff.sales.access', 11],
  ['ACCOUNTS_MANAGER', 'Accounts Manager', 'staff.accounts.access', 20],
  ['ACCOUNTS_EXECUTIVE', 'Accounts Executive', 'staff.accounts.access', 21],
  ['WAREHOUSE_MANAGER', 'Warehouse Manager', 'staff.warehouse.access', 30],
  ['WAREHOUSE_EXECUTIVE', 'Warehouse Executive', 'staff.warehouse.access', 31],
  ['HR_MANAGER', 'HR Manager', 'staff.hr.access', 40],
  ['HR_EXECUTIVE', 'HR Executive', 'staff.hr.access', 41],
  ['DEMO_MANAGER', 'Demo Manager', 'staff.demo.access', 50],
  ['DEMO_EXECUTIVE', 'Demo Executive', 'staff.demo.access', 51],
];

for (const [key, name, permissionKey, priority] of staffRoles) {
  const staffRole = await prisma.role.upsert({
    where: { key },
    update: { name, portal: 'STAFF', dashboardPath: '/dashboard', priority, isActive: true },
    create: { key, name, portal: 'STAFF', dashboardPath: '/dashboard', priority },
  });
  const permission = await prisma.permission.upsert({
    where: { key: permissionKey },
    update: { module: permissionKey.split('.')[1].toUpperCase(), action: 'ACCESS' },
    create: { key: permissionKey, module: permissionKey.split('.')[1].toUpperCase(), action: 'ACCESS' },
  });
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: staffRole.id, permissionId: permission.id } },
    update: {},
    create: { roleId: staffRole.id, permissionId: permission.id },
  });
}

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
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {},
    create: { userId: user.id, roleId: adminRole.id },
  });
  console.log(`Bootstrap administrator ready: ${loginId}`);
} else {
  console.log('Role seeded. Administrator skipped because ADMIN_* variables are incomplete.');
}

const staffLoginId = process.env.STAFF_LOGIN_ID?.trim().toLowerCase();
const staffEmail = process.env.STAFF_EMAIL?.trim().toLowerCase();
const staffPassword = process.env.STAFF_PASSWORD;
const staffRoleKey = process.env.STAFF_ROLE_KEY?.trim().toUpperCase() || 'SALES_EXECUTIVE';

if (staffLoginId && staffEmail && staffPassword) {
  const staffRole = await prisma.role.findUniqueOrThrow({ where: { key: staffRoleKey } });
  if (staffRole.portal !== 'STAFF') throw new Error(`${staffRoleKey} is not a Staff portal role.`);
  const user = await prisma.user.upsert({
    where: { email: staffEmail },
    update: { loginId: staffLoginId, name: 'Local Staff User', status: 'ACTIVE' },
    create: { loginId: staffLoginId, email: staffEmail, name: 'Local Staff User', passwordHash: hashPassword(staffPassword) },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: staffRole.id } },
    update: {},
    create: { userId: user.id, roleId: staffRole.id },
  });
  console.log(`Bootstrap staff user ready: ${staffLoginId} (${staffRoleKey})`);
}

await prisma.$disconnect();
