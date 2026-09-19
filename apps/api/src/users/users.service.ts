import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { BloodGroup, DataScope, Department, EmploymentType, PortalType, StaffProfile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword } from '../auth/password.js';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import type { CreateUserDto, UpdateStaffPasswordDto, UpdateUserDto } from './dto.js';

const ROLE_CONFIG: Record<string, { department: Department; dataScope: DataScope; portal: PortalType }> = {
  PURCHASE_MANAGER: { department: 'PURCHASE', dataScope: 'DEPARTMENT', portal: 'ADMIN' },
  SALES_MANAGER: { department: 'SALES', dataScope: 'TEAM', portal: 'STAFF' },
  SALES_EXECUTIVE: { department: 'SALES', dataScope: 'OWN', portal: 'STAFF' },
  ACCOUNTS_BILLING: { department: 'ACCOUNTS_BILLING', dataScope: 'OWN', portal: 'STAFF' },
  WAREHOUSE: { department: 'WAREHOUSE', dataScope: 'OWN', portal: 'STAFF' },
  DEMO_TEAM: { department: 'DEMO', dataScope: 'OWN', portal: 'STAFF' },
};
const MANAGED_ROLE_KEYS = Object.keys(ROLE_CONFIG);

type PresentedUser = {
  id: string;
  loginId: string;
  email: string;
  name: string;
  status: string;
  department: Department | null;
  dataScope: DataScope;
  managerId: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  manager: { id: string; name: string } | null;
  roles: Array<{ role: { key: string; name: string; portal: PortalType } }>;
  staffProfile: StaffProfile | null;
};

const optionalText = (value?: string | null) => value?.trim() || null;
const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);
const generatedLoginId = (name: string, employeeCode: string) => {
  const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 44) || 'staff';
  return `${slug}.${employeeCode.toLowerCase().replace('-', '')}`;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private present(user: PresentedUser) {
    return {
      id: user.id,
      loginId: user.loginId,
      email: user.email,
      name: user.name,
      status: user.status,
      department: user.department,
      dataScope: user.dataScope,
      managerId: user.managerId,
      manager: user.manager,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles: user.roles.map(({ role }) => ({ key: role.key, name: role.name, portal: role.portal })),
      profile: user.staffProfile,
    };
  }

  async directory() {
    const [users, roles] = await Promise.all([
      this.prisma.user.findMany({
        where: { roles: { some: { role: { key: { in: MANAGED_ROLE_KEYS } } } } },
        include: { manager: { select: { id: true, name: true } }, roles: { include: { role: true } }, staffProfile: true },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.role.findMany({ where: { key: { in: MANAGED_ROLE_KEYS }, isActive: true }, orderBy: { priority: 'asc' } }),
    ]);
    return {
      users: users.map((user) => this.present(user)),
      roles: roles.map((role) => ({ ...role, ...ROLE_CONFIG[role.key] })),
    };
  }

  private async assignment(roleKey: string, managerId?: string | null, userId?: string) {
    const config = ROLE_CONFIG[roleKey];
    if (!config) throw new BadRequestException('Select an approved staff role.');
    const role = await this.prisma.role.findFirst({ where: { key: roleKey, isActive: true } });
    if (!role) throw new BadRequestException('That role is not available.');

    if (roleKey !== 'SALES_EXECUTIVE') return { role, config, managerId: null };
    if (!managerId) return { role, config, managerId: null };
    if (managerId === userId) throw new BadRequestException('A staff member cannot manage their own account.');
    const manager = await this.prisma.user.findFirst({
      where: { id: managerId, status: 'ACTIVE', roles: { some: { role: { key: 'SALES_MANAGER', isActive: true } } } },
      select: { id: true },
    });
    if (!manager) throw new BadRequestException('Select an active Sales Manager.');
    return { role, config, managerId: manager.id };
  }

  async create(dto: CreateUserDto, actor: SessionUser, ipAddress?: string) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({ where: { email }, select: { id: true } });
    if (existing) throw new BadRequestException('A user with that email address already exists.');
    const { role, config, managerId } = await this.assignment(dto.roleKey, dto.managerId);
    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.employeeCounter.upsert({
        where: { key: 'PMB' },
        create: { key: 'PMB', nextNumber: 12 },
        update: { nextNumber: { increment: 1 } },
      });
      const employeeCode = `PMB-${String(counter.nextNumber).padStart(3, '0')}`;
      const loginId = generatedLoginId(dto.name, employeeCode);
      return tx.user.create({
        data: {
          loginId,
          email,
          name: dto.name.trim(),
          passwordHash,
          department: config.department,
          dataScope: config.dataScope,
          managerId,
          roles: { create: { roleId: role.id } },
          staffProfile: {
            create: {
              employeeCode,
              mobile: dto.mobile.trim(),
              jobTitle: dto.jobTitle.trim(),
              employmentType: dto.employmentType as EmploymentType,
              joiningDate: dateOnly(dto.joiningDate),
              dateOfBirth: dto.dateOfBirth ? dateOnly(dto.dateOfBirth) : null,
              shiftStart: optionalText(dto.shiftStart),
              shiftEnd: optionalText(dto.shiftEnd),
              bloodGroup: (dto.bloodGroup as BloodGroup | undefined) ?? null,
              workLocation: optionalText(dto.workLocation),
              residentialAddress: optionalText(dto.residentialAddress),
              emergencyContactName: optionalText(dto.emergencyContactName),
              emergencyContactMobile: optionalText(dto.emergencyContactMobile),
            },
          },
        },
        include: { manager: { select: { id: true, name: true } }, roles: { include: { role: true } }, staffProfile: true },
      });
    });
    await recordAudit(this.prisma, {
      actorId: actor.id,
      action: 'STAFF_CREATE',
      entity: 'USER',
      entityId: user.id,
      details: { loginId: user.loginId, employeeCode: user.staffProfile?.employeeCode, roleKey: role.key, department: config.department, dataScope: config.dataScope },
      ipAddress,
    });
    return this.present(user);
  }

  async update(id: string, dto: UpdateUserDto, actor: SessionUser, ipAddress?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: { roles: { include: { role: true } }, staffProfile: true } });
    if (!existing || existing.roles.some(({ role }) => role.key === 'SUPER_ADMIN')) throw new NotFoundException('Staff member not found.');
    const roleKey = dto.roleKey ?? existing.roles.find(({ role }) => MANAGED_ROLE_KEYS.includes(role.key))?.role.key;
    if (!roleKey) throw new BadRequestException('This account does not have a manageable role.');
    const { role, config, managerId } = await this.assignment(roleKey, dto.managerId === undefined ? existing.managerId : dto.managerId, id);
    const email = dto.email?.trim().toLowerCase();
    if (email) {
      const duplicate = await this.prisma.user.findFirst({
        where: { id: { not: id }, email },
        select: { id: true },
      });
      if (duplicate) throw new BadRequestException('That email address is already in use.');
    }

    const profileFields = ['mobile', 'jobTitle', 'employmentType', 'joiningDate', 'dateOfBirth', 'shiftStart', 'shiftEnd', 'bloodGroup', 'workLocation', 'residentialAddress', 'emergencyContactName', 'emergencyContactMobile'] as const;
    const hasProfileUpdate = profileFields.some((field) => dto[field] !== undefined);

    const user = await this.prisma.$transaction(async (tx) => {
      if (dto.roleKey) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.create({ data: { userId: id, roleId: role.id } });
      }
      if (hasProfileUpdate) {
        const profileData = {
          mobile: dto.mobile?.trim(),
          jobTitle: dto.jobTitle?.trim(),
          employmentType: dto.employmentType as EmploymentType | undefined,
          joiningDate: dto.joiningDate ? dateOnly(dto.joiningDate) : undefined,
          dateOfBirth: dto.dateOfBirth ? dateOnly(dto.dateOfBirth) : dto.dateOfBirth,
          shiftStart: dto.shiftStart === undefined ? undefined : optionalText(dto.shiftStart),
          shiftEnd: dto.shiftEnd === undefined ? undefined : optionalText(dto.shiftEnd),
          bloodGroup: dto.bloodGroup as BloodGroup | null | undefined,
          workLocation: dto.workLocation === undefined ? undefined : optionalText(dto.workLocation),
          residentialAddress: dto.residentialAddress === undefined ? undefined : optionalText(dto.residentialAddress),
          emergencyContactName: dto.emergencyContactName === undefined ? undefined : optionalText(dto.emergencyContactName),
          emergencyContactMobile: dto.emergencyContactMobile === undefined ? undefined : optionalText(dto.emergencyContactMobile),
        };
        if (existing.staffProfile) {
          await tx.staffProfile.update({ where: { userId: id }, data: profileData });
        } else {
          if (!dto.mobile || !dto.jobTitle || !dto.employmentType || !dto.joiningDate) throw new BadRequestException('Complete the required employment details.');
          const counter = await tx.employeeCounter.upsert({ where: { key: 'PMB' }, create: { key: 'PMB', nextNumber: 12 }, update: { nextNumber: { increment: 1 } } });
          await tx.staffProfile.create({ data: { ...profileData, userId: id, employeeCode: `PMB-${String(counter.nextNumber).padStart(3, '0')}`, mobile: dto.mobile.trim(), jobTitle: dto.jobTitle.trim(), employmentType: dto.employmentType as EmploymentType, joiningDate: dateOnly(dto.joiningDate) } });
        }
      }
      const updated = await tx.user.update({
        where: { id },
        data: { name: dto.name?.trim(), email, status: dto.status, department: config.department, dataScope: config.dataScope, managerId },
        include: { manager: { select: { id: true, name: true } }, roles: { include: { role: true } }, staffProfile: true },
      });
      if (dto.status && dto.status !== 'ACTIVE') await tx.session.deleteMany({ where: { userId: id } });
      return updated;
    });
    await recordAudit(this.prisma, {
      actorId: actor.id,
      action: 'STAFF_UPDATE',
      entity: 'USER',
      entityId: id,
      details: { roleKey, status: dto.status, department: config.department, dataScope: config.dataScope },
      ipAddress,
    });
    return this.present(user);
  }

  async updatePassword(id: string, dto: UpdateStaffPasswordDto, actor: SessionUser, ipAddress?: string) {
    const existing = await this.prisma.user.findFirst({
      where: { id, roles: { some: { role: { key: { in: MANAGED_ROLE_KEYS } } } } },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Staff member not found.');
    const passwordHash = await hashPassword(dto.password);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null } }),
      this.prisma.session.deleteMany({ where: { userId: id } }),
      this.prisma.auditLog.create({ data: { actorId: actor.id, action: 'STAFF_PASSWORD_UPDATE', entity: 'USER', entityId: id, ipAddress } }),
    ]);
    return { ok: true };
  }

  async remove(id: string, actor: SessionUser, ipAddress?: string) {
    const existing = await this.prisma.user.findFirst({
      where: { id, roles: { some: { role: { key: { in: MANAGED_ROLE_KEYS } } } } },
      select: { id: true, loginId: true },
    });
    if (!existing) throw new NotFoundException('Staff member not found.');
    await this.prisma.$transaction([
      this.prisma.auditLog.create({
        data: { actorId: actor.id, action: 'STAFF_DELETE', entity: 'USER', entityId: id, details: { loginId: existing.loginId }, ipAddress },
      }),
      this.prisma.user.delete({ where: { id } }),
    ]);
    return { ok: true };
  }
}
