import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();
const productsOnly = process.env.PRODUCTS_ONLY === 'true';

if (!productsOnly) {

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

const billingSettingsPermission = await prisma.permission.upsert({
  where: { key: 'admin.billing.manage' },
  update: { module: 'BILLING_SETTINGS', action: 'MANAGE' },
  create: { key: 'admin.billing.manage', module: 'BILLING_SETTINGS', action: 'MANAGE' },
});
await prisma.rolePermission.upsert({
  where: { roleId_permissionId: { roleId: adminRole.id, permissionId: billingSettingsPermission.id } },
  update: {},
  create: { roleId: adminRole.id, permissionId: billingSettingsPermission.id },
});
await prisma.billingSettings.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });

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

const distributorRoles = [
  ['DISTRIBUTOR_OWNER', 'Owner', 60],
  ['DISTRIBUTOR_ACCOUNTS', 'Accounts', 61],
  ['DISTRIBUTOR_WAREHOUSE', 'Warehouse', 62],
];
const distributorRoleRecords = {};
for (const [key, name, priority] of distributorRoles) {
  distributorRoleRecords[key] = await prisma.role.upsert({
    where: { key },
    update: { name, portal: 'DISTRIBUTOR', dashboardPath: '/distributor/dashboard', priority, isActive: true },
    create: { key, name, description: `Distributor portal - ${name}`, portal: 'DISTRIBUTOR', dashboardPath: '/distributor/dashboard', priority },
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

const distributorLoginId = process.env.DISTRIBUTOR_LOGIN_ID?.trim().toLowerCase();
const distributorEmail = process.env.DISTRIBUTOR_EMAIL?.trim().toLowerCase();
const distributorPassword = process.env.DISTRIBUTOR_PASSWORD;

if (distributorLoginId && distributorEmail && distributorPassword) {
  const distributor = await prisma.distributor.upsert({
    where: { id: 'bootstrap-distributor' },
    update: { status: 'ACTIVE' },
    create: { id: 'bootstrap-distributor', businessName: 'Vadodara Regional Distributor', contactName: 'Local Distributor', territory: 'Vadodara', status: 'ACTIVE' },
  });
  const user = await prisma.user.upsert({
    where: { email: distributorEmail },
    update: { status: 'ACTIVE', distributorId: distributor.id },
    create: { loginId: distributorLoginId, email: distributorEmail, name: 'Local Distributor User', passwordHash: hashPassword(distributorPassword), distributorId: distributor.id },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: distributorRoleRecords.DISTRIBUTOR_OWNER.id } },
    update: {},
    create: { userId: user.id, roleId: distributorRoleRecords.DISTRIBUTOR_OWNER.id },
  });
  console.log(`Bootstrap distributor user ready: ${distributorLoginId}`);
}

}

const titleCase = (value) => value.trim().toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
const categoryFor = (name) => {
  const value = name.toLowerCase();
  if (value.includes('conditionar') || value.includes('conditioner')) return 'CONDITIONER';
  if (value.includes('shampoo')) return 'SHAMPOO';
  if (value.includes('mask')) return 'MASK';
  if (value.includes('colour')) return 'COLOR';
  if (value.includes('developer')) return 'DEVELOPER';
  if (value.includes('kit')) return 'KIT';
  if (value.includes('oil') || value.includes('syrum') || value.includes('serum')) return 'OIL_SERUM';
  if (value.includes('liquid')) return 'LIQUID';
  if (value.includes('spray')) return 'STYLING';
  if (value.includes('treatment') || value.includes('therapy') || value.includes('surgery') || value.includes('microtox') || value.includes('brazilian')) return 'TREATMENT';
  return 'OTHER';
};
const unitFor = (category) => category === 'KIT' ? 'kit' : ['SHAMPOO', 'CONDITIONER', 'MASK', 'OIL_SERUM', 'LIQUID', 'STYLING'].includes(category) ? 'bottle' : ['COLOR', 'DEVELOPER'].includes(category) ? 'tube' : 'piece';
const catalogue = [
  ['KERAFILL PRE SHAMPOO', 2500], ['HAIR KERAFILL TREATMENT', 16000], ['KERATIN POST MASK', 2500], ['KERA RECOVERY SHAMPOO', 1200], ['KERA RECOVERY CONDITIONAR', 1200],
  ['STRAIGHT THERAPY A', 1700], ['STRAIGHT THERAPY B', 300], ['HYDRA ACTIVE SHAMPOO', 950], ['HYDRA ACTIVE CONDITIONAR', 950], ['HYDRA ACTIVE SHAMPOO', 2500],
  ['HYDRA ACTIVE CONDITIONAR', 2500], ['REVITALIZING HAIR MASK', 1199], ['INJECTION REPAIR SHAMPOO', 900], ['INJECTION REPAIR MASK', 1050], ['INJECTION SMOOTHING SHAMPOO', 900],
  ['INJECTION SMOOTHING MASK', 1050], ['INJECTION NUTRI OIL SHAMPOO', 900], ['INJECTION NUTRI OIL MASK', 1050], ['ONE STEP TREATMENT', 27000], ['SURGERY B1 BOND SHAPER', 15000],
  ['SURGERY B2 BOND SMOOTHER', 15000], ['SURGERY B3 BOND PH', 15000], ['SURGERY B4 BOND LAMINIZER', 15000], ['SURGERY B PRO ACIDIC SHAMPOO', 1500], ['SURGERY B PRO ACIDIC MASK', 1500],
  ['NEW BRAZILIAN S3', 15000], ['S PRO PROTEIN SHAMPOO', 2000], ['S PRO PROTEIN MASK', 1400], ['MULTI ACTION LIVING SPARY', 800], ['D PRO SHAMPOO', 1650],
  ['D MIRACLE SCALP LIQUID', 700], ['D TREATMENT & HAIR MUD MASK', 1050], ['D MIRACLE ANTI PELLICULAIRE', 700], ['D PRO SHAMPOO', 700], ['ARGAN OIL', 1100],
  ['S PRO PROTIN SHAMPOO', 800], ['S PRO PROTIN MASK', 800], ['S PRO SYRUM', 800], ['INJECTION REPAIR SHAMPOO', 2500], ['INJECTION NUTRI OIL SHAMPOO', 2500],
  ['INJECTION NUTRI OIL MASK', 1700], ['INJECTION SMOOTHING SHAMPOO', 2500], ['INJECTION SMOOTHING MASK', 1700], ['INJECTION REPAIR MASK', 1700], ['GEN PRO HAIR COLOUR 2/0', 549],
  ['GEN PRO HAIR COLOUR 3/0', 549], ['GEN PRO HAIR COLOUR 4/0', 549], ['GEN PRO HAIR COLOUR 5/0', 549], ['GEN PRO DEVELOPER', 650], ['MICROTOX', 2000],
  ['MICROTOX SHAMPOO', 999], ['MICROTOX MASK', 999], ['BOND GOLDEN CAVIAE KIT', 9999], ['BOND PLEX KIT 100 ML', 9999], ['BOND REVIVAL LUXE 100ML X 3 NOS', 9999],
  ['BOND REVIVAL LUXE 100ML', 3999],
];

for (const sku of ['BT-SHM-001', 'BT-CND-001', 'BT-TRT-001', 'BT-CLR-001', 'BT-STY-001', 'BT-TL-001']) {
  await prisma.product.updateMany({ where: { sku }, data: { isActive: false } });
}
for (const [index, [rawName, unitPrice]] of catalogue.entries()) {
  const name = titleCase(rawName);
  const category = categoryFor(rawName);
  const sku = `BT-CATALOG-${String(index + 1).padStart(3, '0')}`;
  await prisma.product.upsert({
    where: { sku },
    update: { name, category, unit: unitFor(category), unitPrice, isActive: true },
    create: { sku, name, category, unit: unitFor(category), unitPrice, stockOnHand: 0 },
  });
}
console.log(`Product catalogue ready: ${catalogue.length}`);

await prisma.$disconnect();
