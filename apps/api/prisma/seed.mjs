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
  ['SALES_MANAGER', 'Area Sales Manager', 'staff.sales.access', 10],
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
  ["Kerafill Pre Shampoo", "1000 ml", 2500],
  ["Hair Kerafill Treatment", "1000 ml", 16000],
  ["Keratin Post Mask", "1000 ml", 2500],
  ["Kera Recovery Shampoo", "250 ml", 1200],
  ["Kera Recovery Conditionar", "250 ml", 1200],
  ["Straight Therapy A", "450 ml", 1700],
  ["Straight Therapy B", "450 ml", 300],
  ["Hydra Active Shampoo", "250 ml", 950],
  ["Hydra Active Conditionar", "250 ml", 950],
  ["Hydra Active Shampoo", "1000 ml", 2500],
  ["Hydra Active Conditionar", "1000 ml", 2500],
  ["Revitalizing Hair Mask", "800 gm", 1199],
  ["Injection Repair Shampoo", "250 ml", 900],
  ["Injection Repair Mask", "200 ml", 1050],
  ["Injection Smoothing Shampoo", "250 ml", 900],
  ["Injection Smoothing Mask", "200 ml", 1050],
  ["Injection Nutri Oil Shampoo", "250 ml", 900],
  ["Injection Nutri Oil Mask", "200 ml", 1050],
  ["One Step Treatment", "1000 ml", 27000],
  ["Surgery B1 Bond Shaper", "1 ltr", 15000],
  ["Surgery B2 Bond Smoother", "500 ml", 15000],
  ["Surgery B3 Bond PH", "1 ltr", 15000],
  ["Surgery B4 Bond Laminizer", "1 ltr", 15000],
  ["Surgery B Pro Acidic Shampoo", "250 ml", 1500],
  ["Surgery B Pro Acidic Mask", "250 ml", 1500],
  ["New Brazilian S3", "1 ltr", 15000],
  ["S Pro Protein Shampoo", "1000 ml", 2000],
  ["S Pro Protein Mask", "500 gm", 1400],
  ["Multi Action Living Spary", "200 ml", 800],
  ["D Pro Shampoo", "1 ltr", 1650],
  ["D Miracle Scalp Liquid", "100 ml", 700],
  ["D Treatment & Hair Mud Mask", "200 gm", 1050],
  ["D Miracle Anti Pelliculaire", "100 ml", 700],
  ["D Pro Shampoo", "250 ml", 700],
  ["Argan Oil", "50 ml", 1100],
  ["S Pro Protin Shampoo", "250 ml", 800],
  ["S Pro Protin Mask", "250 ml", 800],
  ["S Pro Syrum", "110 ml", 800],
  ["Injection Repair Shampoo", "1000 ml", 2500],
  ["Injection Nutri Oil Shampoo", "1000 ml", 2500],
  ["Injection Nutri Oil Mask", "500 gm", 1700],
  ["Injection Smoothing Shampoo", "1000 ml", 2500],
  ["Injection Smoothing Mask", "500 gm", 1700],
  ["Injection Repair Mask", "500 gm", 1700],
  ["Gen Pro Hair Colour 2/0", "100 gm", 549],
  ["Gen Pro Hair Colour 3/0", "100 gm", 549],
  ["Gen Pro Hair Colour 4/0", "100 gm", 549],
  ["Gen Pro Hair Colour 5/0", "100 gm", 549],
  ["Gen Pro Developer", "1000 ml", 650],
  ["Microtox", "1000 ml", 20000],
  ["Microtox Shampoo", "250 ml", 999],
  ["Microtox Mask", "200 gm", 999],
  ["Bond Golden Caviae Kit", null, 9999],
  ["Bond Plex Kit", "100 ml", 9999],
  ["Bond Revival Luxe x 3 Nos", "300 ml", 9999],
  ["Bond Revival Luxe", "100 ml", 3999],
];

for (const sku of ['BT-SHM-001', 'BT-CND-001', 'BT-TRT-001', 'BT-CLR-001', 'BT-STY-001', 'BT-TL-001']) {
  await prisma.product.updateMany({ where: { sku }, data: { isActive: false } });
}
for (const [index, [name, variant, unitPrice]] of catalogue.entries()) {
  const rawName = name;
  const category = categoryFor(rawName);
  const sku = `BT-CATALOG-${String(index + 1).padStart(3, '0')}`;
  await prisma.product.upsert({
    where: { sku },
    update: { name, category, variant, unit: unitFor(category), unitPrice, isActive: true },
    create: { sku, name, category, variant, unit: unitFor(category), unitPrice, stockOnHand: 0 },
  });
}
console.log(`Product catalogue ready: ${catalogue.length}`);

await prisma.$disconnect();
