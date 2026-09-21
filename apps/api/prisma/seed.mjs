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

const staffManagementPermission = await prisma.permission.upsert({
  where: { key: 'admin.staff.manage' },
  update: { module: 'STAFF_ACCESS', action: 'MANAGE' },
  create: { key: 'admin.staff.manage', module: 'STAFF_ACCESS', action: 'MANAGE' },
});
await prisma.rolePermission.upsert({
  where: { roleId_permissionId: { roleId: adminRole.id, permissionId: staffManagementPermission.id } },
  update: {},
  create: { roleId: adminRole.id, permissionId: staffManagementPermission.id },
});

const purchaseRole = await prisma.role.upsert({
  where: { key: 'PURCHASE_MANAGER' },
  update: { name: 'Purchase Manager', portal: 'ADMIN', dashboardPath: '/dashboard', priority: 10, isActive: true },
  create: { key: 'PURCHASE_MANAGER', name: 'Purchase Manager', description: 'Purchase management workspace', portal: 'ADMIN', dashboardPath: '/dashboard', priority: 10 },
});
const purchasePermission = await prisma.permission.upsert({
  where: { key: 'purchase.access' },
  update: { module: 'PURCHASE', action: 'ACCESS' },
  create: { key: 'purchase.access', module: 'PURCHASE', action: 'ACCESS' },
});
await prisma.rolePermission.upsert({
  where: { roleId_permissionId: { roleId: purchaseRole.id, permissionId: purchasePermission.id } },
  update: {},
  create: { roleId: purchaseRole.id, permissionId: purchasePermission.id },
});

const staffRoles = [
  ['SALES_MANAGER', 'Sales Manager', 'staff.sales.access', 10],
  ['SALES_EXECUTIVE', 'Sales Executive', 'staff.sales.access', 11],
  ['ACCOUNTS_BILLING', 'Accounts & Billing', 'staff.accounts.access', 20],
  ['WAREHOUSE', 'Warehouse', 'staff.warehouse.access', 30],
  ['DEMO_TEAM', 'Trainer', 'staff.demo.access', 40],
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
    update: { status: 'ACTIVE', dataScope: 'COMPANY' },
    create: { loginId, email, name: 'Bond Therapy Administrator', passwordHash: hashPassword(password), dataScope: 'COMPANY' },
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
    update: { status: 'ACTIVE', department: 'SALES', dataScope: staffRoleKey === 'SALES_MANAGER' ? 'TEAM' : 'OWN' },
    create: { loginId: staffLoginId, email: staffEmail, name: 'Local Staff User', passwordHash: hashPassword(staffPassword), department: 'SALES', dataScope: staffRoleKey === 'SALES_MANAGER' ? 'TEAM' : 'OWN' },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: staffRole.id } },
    update: {},
    create: { userId: user.id, roleId: staffRole.id },
  });
  console.log(`Bootstrap staff user ready: ${staffLoginId} (${staffRoleKey})`);
}

const sampleProducts = [
  { sku: 'BT-SHM-001', name: 'Keratin Repair Shampoo 1L', category: 'SHAMPOO', unit: 'bottle', unitPrice: 650, stockOnHand: 120 },
  { sku: 'BT-CND-001', name: 'Keratin Repair Conditioner 1L', category: 'CONDITIONER', unit: 'bottle', unitPrice: 690, stockOnHand: 95 },
  { sku: 'BT-TRT-001', name: 'Bond Rebuild Treatment 500ml', category: 'TREATMENT', unit: 'bottle', unitPrice: 1450, stockOnHand: 40 },
  { sku: 'BT-CLR-001', name: 'Professional Color Cream 100g', category: 'COLOR', unit: 'tube', unitPrice: 380, stockOnHand: 6 },
  { sku: 'BT-STY-001', name: 'Heat Protect Styling Spray 250ml', category: 'STYLING', unit: 'bottle', unitPrice: 520, stockOnHand: 70 },
  { sku: 'BT-TL-001', name: 'Ceramic Flat Iron Pro', category: 'TOOLS', unit: 'pcs', unitPrice: 4200, stockOnHand: 0 },
];

for (const product of sampleProducts) {
  await prisma.product.upsert({ where: { sku: product.sku }, update: {}, create: product });
}
console.log(`Sample products ready: ${sampleProducts.length}`);

await prisma.$disconnect();
