import { randomBytes } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { HrLetterStatus, Prisma } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateHrLetterDto, HrLetterActionDto, ListHrLettersDto } from './dto.js';
import { COMPENSATION_LETTER_TYPES, LETTER_FIELDS, LETTER_LABELS, SALARY_COMPONENTS, type LetterType } from './letter-types.js';
import { renderLetterPdf } from './letter-pdf.js';

const letterInclude = {
  staffUser: { select: { id: true, name: true } },
  generatedBy: { select: { id: true, name: true } },
  activities: { orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.HrLetterInclude;

export type LetterSnapshot = {
  employee: { id: string | null; name: string; employeeCode: string | null; designation: string | null; department: string | null; employmentType: string | null; workLocation: string | null; reportingManager: string | null; joiningDate: string | null; email: string | null; mobile: string | null; roleKeys: string[]; roleTrack: 'SALES' | 'TECHNICAL' | 'GENERAL' };
  company: { legalName: string; displayName: string; address: string; phone: string; email: string; website: string; authorisedSignatory: string; authorisedSignatoryDesignation: string };
};

@Injectable()
export class LettersService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAdmin(actor: SessionUser) {
    if (!(actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN'))) throw new ForbiddenException('HR documents are restricted to authorised administrators.');
  }

  private normalizeAndValidate(dto: CreateHrLetterDto) {
    const normalized = Object.fromEntries(Object.entries(dto.details ?? {}).map(([key, value]) => [key, value?.toString().trim() ?? '']));
    if ((COMPENSATION_LETTER_TYPES as readonly string[]).includes(dto.type)) {
      for (const item of SALARY_COMPONENTS) for (const period of ['Monthly', 'Annual']) {
        const raw = normalized[`${item.key}${period}`];
        if (raw && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) throw new BadRequestException(`${item.label} ${period.toLowerCase()} must be a valid non-negative amount.`);
      }
      const sum = (part: 'A' | 'B' | 'C', period: 'Monthly' | 'Annual') => SALARY_COMPONENTS.filter((item) => item.part === part).reduce((total, item) => total + (Number(normalized[`${item.key}${period}`]) || 0), 0);
      const aMonthly = sum('A', 'Monthly'); const aAnnual = sum('A', 'Annual');
      const bMonthly = sum('B', 'Monthly'); const bAnnual = sum('B', 'Annual');
      const cMonthly = sum('C', 'Monthly'); const cAnnual = sum('C', 'Annual');
      const ctcMonthly = aMonthly + bMonthly + cMonthly; const ctcAnnual = aAnnual + bAnnual + cAnnual;
      Object.assign(normalized, { totalAMonthly: String(aMonthly), totalAAnnual: String(aAnnual), totalBMonthly: String(bMonthly), totalBAnnual: String(bAnnual), totalCMonthly: String(cMonthly), totalCAnnual: String(cAnnual), ctcMonthly: String(ctcMonthly), ctcAnnual: String(ctcAnnual), monthlyGross: String(aMonthly) });
      if (dto.type === 'OFFER' || dto.type === 'APPOINTMENT') normalized.ctc = String(ctcAnnual);
      if (dto.type === 'PROMOTION' || dto.type === 'SALARY_INCREMENT') normalized.newCtc = String(ctcAnnual);
      if (dto.type === 'SALARY_INCREMENT') normalized.increaseAmount = String(ctcAnnual - (Number(normalized.previousCtc) || 0));
      if (ctcAnnual <= 0) throw new BadRequestException('Required information missing. Enter the approved annual salary components before saving this document.');
      if (aMonthly <= 0) throw new BadRequestException('Required information missing. Enter the approved monthly fixed earnings before saving this document.');
    }
    for (const field of LETTER_FIELDS[dto.type]) {
      const value = normalized[field.key];
      if (field.required && !value) throw new BadRequestException(`Required information missing. Complete ${field.label.toLowerCase()} before saving this ${LETTER_LABELS[dto.type]}.`);
      if (!value) continue;
      const max = field.type === 'textarea' ? 1200 : 180;
      if (value.length > max) throw new BadRequestException(`${field.label} must be ${max} characters or fewer.`);
      if (field.type === 'date' && Number.isNaN(new Date(`${value.slice(0, 10)}T12:00:00`).getTime())) throw new BadRequestException(`${field.label} must be a valid date.`);
      if (field.type === 'money' && (!Number.isFinite(Number(value)) || Number(value) < 0)) throw new BadRequestException(`${field.label} must be a valid non-negative amount.`);
    }
    for (const [startKey, endKey, message] of [
      ['startDate', 'endDate', 'Internship end date must be on or after the start date.'],
      ['joiningDate', 'reviewDate', 'Probation review date must be on or after the joining date.'],
      ['joiningDate', 'endDate', 'Last working date must be on or after the joining date.'],
      ['resignationDate', 'lastWorkingDate', 'Last working date must be on or after the resignation date.'],
    ]) {
      const start = normalized[startKey]; const end = normalized[endKey];
      if (start && end && new Date(`${end}T12:00:00`) < new Date(`${start}T12:00:00`)) throw new BadRequestException(message);
    }
    return normalized;
  }

  private async snapshot(dto: CreateHrLetterDto): Promise<LetterSnapshot> {
    const [staff, company] = await Promise.all([
      dto.staffUserId ? this.prisma.user.findUnique({ where: { id: dto.staffUserId }, select: { id: true, name: true, email: true, department: true, manager: { select: { name: true } }, staffProfile: true, roles: { select: { role: { select: { key: true } } } } } }) : null,
      this.prisma.billingSettings.upsert({ where: { id: 'default' }, create: { id: 'default' }, update: {} }),
    ]);
    if (dto.staffUserId && !staff) throw new BadRequestException('Select a valid staff member.');
    const roleKeys = staff?.roles.map((item) => item.role.key) ?? [];
    const roleTrack = staff?.department === 'SALES' || roleKeys.some((key) => key.includes('SALES')) ? 'SALES' as const : staff?.department === 'DEMO' || roleKeys.some((key) => /TECH|DEMO|EDUCAT/.test(key)) ? 'TECHNICAL' as const : 'GENERAL' as const;
    return {
      employee: { id: staff?.id ?? null, name: staff?.name ?? dto.recipientName.trim(), employeeCode: staff?.staffProfile?.employeeCode ?? null, designation: staff?.staffProfile?.jobTitle ?? dto.recipientDesignation?.trim() ?? null, department: staff?.department ?? dto.recipientDepartment?.trim() ?? null, employmentType: staff?.staffProfile?.employmentType ?? null, workLocation: staff?.staffProfile?.workLocation ?? null, reportingManager: staff?.manager?.name ?? null, joiningDate: staff?.staffProfile?.joiningDate?.toISOString().slice(0, 10) ?? null, email: staff?.email ?? null, mobile: staff?.staffProfile?.mobile ?? null, roleKeys, roleTrack },
      company: { legalName: company.legalName, displayName: company.tradeName, address: [company.registeredAddress, company.city, company.state, company.pincode].filter(Boolean).join(', '), phone: company.phone ?? '', email: company.email ?? '', website: company.website ?? '', authorisedSignatory: company.accountManagerName ?? 'Parth Patel', authorisedSignatoryDesignation: company.accountManagerTitle ?? 'Authorised Signatory' },
    };
  }

  async options(actor: SessionUser) {
    this.ensureAdmin(actor);
    const staff = await this.prisma.user.findMany({ where: { status: 'ACTIVE', staffProfile: { isNot: null } }, select: { id: true, name: true, email: true, department: true, manager: { select: { name: true } }, staffProfile: true, roles: { select: { role: { select: { key: true } } } } }, orderBy: { name: 'asc' } });
    return staff.map((user) => ({ id: user.id, name: user.name, email: user.email, department: user.department, managerName: user.manager?.name ?? null, roleKeys: user.roles.map((item) => item.role.key), profile: user.staffProfile }));
  }

  async list(actor: SessionUser, query: ListHrLettersDto) {
    this.ensureAdmin(actor);
    const search = query.search?.trim();
    return this.prisma.hrLetter.findMany({ where: { AND: [query.type ? { type: query.type } : {}, query.status ? { status: query.status as HrLetterStatus } : {}, search ? { OR: [{ recipientName: { contains: search } }, { letterNumber: { contains: search } }] } : {}] }, include: letterInclude, orderBy: { createdAt: 'desc' } });
  }

  async create(actor: SessionUser, dto: CreateHrLetterDto, ipAddress?: string) {
    this.ensureAdmin(actor);
    const details = this.normalizeAndValidate(dto);
    const snapshot = await this.snapshot(dto);
    const issuedDate = dto.issuedDate ? new Date(`${dto.issuedDate.slice(0, 10)}T12:00:00`) : new Date();
    if (Number.isNaN(issuedDate.getTime())) throw new BadRequestException('Issued date must be valid.');
    const year = issuedDate.getFullYear();
    const letter = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.employeeCounter.upsert({ where: { key: `HRL:${year}` }, create: { key: `HRL:${year}`, nextNumber: 1 }, update: { nextNumber: { increment: 1 } } });
      const created = await tx.hrLetter.create({ data: { letterNumber: `BT-HRL-${year}-${String(counter.nextNumber).padStart(4, '0')}`, type: dto.type, recipientName: snapshot.employee.name, recipientDesignation: snapshot.employee.designation, recipientDepartment: snapshot.employee.department, staffUserId: dto.staffUserId || null, issuedDate, details, snapshot: snapshot as never, verificationToken: randomBytes(24).toString('hex'), generatedById: actor.id }, include: letterInclude });
      await tx.hrLetterActivity.create({ data: { letterId: created.id, action: 'CREATED', toStatus: 'DRAFT', actorId: actor.id, actorName: actor.name } });
      return created;
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'HR_DOCUMENT_CREATED', entity: 'HR_LETTER', entityId: letter.id, details: { letterNumber: letter.letterNumber, type: letter.type, version: letter.version }, ipAddress });
    return letter;
  }

  async update(actor: SessionUser, id: string, dto: CreateHrLetterDto, ipAddress?: string) {
    const current = await this.detail(actor, id);
    if (!['DRAFT', 'REJECTED'].includes(current.status)) throw new BadRequestException('Only a draft or rejected document can be edited.');
    const details = this.normalizeAndValidate(dto);
    const snapshot = await this.snapshot(dto);
    const issuedDate = dto.issuedDate ? new Date(`${dto.issuedDate.slice(0, 10)}T12:00:00`) : current.issuedDate;
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.hrLetter.update({ where: { id }, data: { type: dto.type, recipientName: snapshot.employee.name, recipientDesignation: snapshot.employee.designation, recipientDepartment: snapshot.employee.department, staffUserId: dto.staffUserId || null, issuedDate, details, snapshot: snapshot as never, status: 'DRAFT', rejectionReason: null }, include: letterInclude });
      await tx.hrLetterActivity.create({ data: { letterId: id, action: 'DRAFT_EDITED', fromStatus: current.status, toStatus: 'DRAFT', actorId: actor.id, actorName: actor.name } });
      return result;
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'HR_DOCUMENT_DRAFT_EDITED', entity: 'HR_LETTER', entityId: id, ipAddress });
    return updated;
  }

  async detail(actor: SessionUser, id: string) {
    this.ensureAdmin(actor);
    const letter = await this.prisma.hrLetter.findUnique({ where: { id }, include: letterInclude });
    if (!letter) throw new NotFoundException('HR document not found.');
    return letter;
  }

  private async transition(actor: SessionUser, id: string, allowed: HrLetterStatus[], toStatus: HrLetterStatus, action: string, dto: HrLetterActionDto, extra: Prisma.HrLetterUpdateInput = {}, ipAddress?: string) {
    const current = await this.detail(actor, id);
    if (!allowed.includes(current.status)) throw new BadRequestException(`This action is not available while the document is ${current.status.toLowerCase().replaceAll('_', ' ')}.`);
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.hrLetter.update({ where: { id }, data: { status: toStatus, ...extra }, include: letterInclude });
      await tx.hrLetterActivity.create({ data: { letterId: id, action, fromStatus: current.status, toStatus, actorId: actor.id, actorName: actor.name, comment: dto.comment?.trim() || null } });
      return result;
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: `HR_DOCUMENT_${action}`, entity: 'HR_LETTER', entityId: id, details: { from: current.status, to: toStatus, comment: dto.comment }, ipAddress });
    return updated;
  }

  submit(actor: SessionUser, id: string, dto: HrLetterActionDto, ip?: string) { return this.transition(actor, id, ['DRAFT', 'REJECTED'], 'PENDING_APPROVAL', 'SUBMITTED', dto, { submittedAt: new Date(), submittedById: actor.id, rejectionReason: null }, ip); }
  async approve(actor: SessionUser, id: string, dto: HrLetterActionDto, ip?: string) {
    const current = await this.detail(actor, id);
    if (current.status !== 'PENDING_APPROVAL') throw new BadRequestException('Only a pending document can be approved.');
    if (current.type === 'TERMINATION' && !current.approvedAt) return this.transition(actor, id, ['PENDING_APPROVAL'], 'PENDING_APPROVAL', 'HR_APPROVED', dto, { approvedAt: new Date(), approvedById: actor.id }, ip);
    if (current.type === 'TERMINATION' && current.approvedById === actor.id) throw new BadRequestException('Termination requires management approval by a second authorised administrator.');
    return this.transition(actor, id, ['PENDING_APPROVAL'], 'APPROVED', current.type === 'TERMINATION' ? 'MANAGEMENT_APPROVED' : 'APPROVED', dto, current.type === 'TERMINATION' ? { managementApprovedAt: new Date(), managementApprovedById: actor.id } : { approvedAt: new Date(), approvedById: actor.id }, ip);
  }
  reject(actor: SessionUser, id: string, dto: HrLetterActionDto, ip?: string) { if (!dto.comment?.trim()) throw new BadRequestException('Add a clear rejection reason.'); return this.transition(actor, id, ['PENDING_APPROVAL'], 'REJECTED', 'REJECTED', dto, { rejectionReason: dto.comment.trim() }, ip); }
  generate(actor: SessionUser, id: string, dto: HrLetterActionDto, ip?: string) { return this.transition(actor, id, ['APPROVED'], 'GENERATED', 'FINAL_PDF_GENERATED', dto, { generatedAt: new Date() }, ip); }
  markSent(actor: SessionUser, id: string, dto: HrLetterActionDto, ip?: string) { return this.transition(actor, id, ['GENERATED'], 'SENT', 'SENT', dto, { sentAt: new Date() }, ip); }
  acknowledge(actor: SessionUser, id: string, dto: HrLetterActionDto, ip?: string) { return this.transition(actor, id, ['SENT'], 'ACKNOWLEDGED', 'ACKNOWLEDGED', dto, { acknowledgedAt: new Date() }, ip); }
  cancel(actor: SessionUser, id: string, dto: HrLetterActionDto, ip?: string) { return this.transition(actor, id, ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'GENERATED', 'SENT', 'REJECTED'], 'CANCELLED', 'CANCELLED', dto, { cancelledAt: new Date() }, ip); }

  async supersede(actor: SessionUser, id: string, dto: HrLetterActionDto, ipAddress?: string) {
    const current = await this.detail(actor, id);
    if (!['GENERATED', 'SENT', 'ACKNOWLEDGED'].includes(current.status)) throw new BadRequestException('Only a final document can be superseded.');
    const year = current.issuedDate.getFullYear();
    const next = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.employeeCounter.upsert({ where: { key: `HRL:${year}` }, create: { key: `HRL:${year}`, nextNumber: 1 }, update: { nextNumber: { increment: 1 } } });
      await tx.hrLetter.update({ where: { id }, data: { status: 'SUPERSEDED' } });
      await tx.hrLetterActivity.create({ data: { letterId: id, action: 'SUPERSEDED', fromStatus: current.status, toStatus: 'SUPERSEDED', actorId: actor.id, actorName: actor.name, comment: dto.comment?.trim() || null } });
      const created = await tx.hrLetter.create({ data: { letterNumber: `BT-HRL-${year}-${String(counter.nextNumber).padStart(4, '0')}`, type: current.type, recipientName: current.recipientName, recipientDesignation: current.recipientDesignation, recipientDepartment: current.recipientDepartment, staffUserId: current.staffUserId, issuedDate: current.issuedDate, details: current.details as never, snapshot: current.snapshot as never, status: 'DRAFT', version: current.version + 1, supersedesId: current.id, verificationToken: randomBytes(24).toString('hex'), generatedById: actor.id }, include: letterInclude });
      await tx.hrLetterActivity.create({ data: { letterId: created.id, action: 'VERSION_CREATED', toStatus: 'DRAFT', actorId: actor.id, actorName: actor.name, metadata: { supersedesId: current.id, priorDocumentNumber: current.letterNumber } } });
      return created;
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'HR_DOCUMENT_SUPERSEDED', entity: 'HR_LETTER', entityId: id, details: { replacementId: next.id, replacementNumber: next.letterNumber }, ipAddress });
    return next;
  }

  async remove(actor: SessionUser, id: string, ipAddress?: string) {
    const letter = await this.detail(actor, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.hrLetter.updateMany({ where: { supersedesId: id }, data: { supersedesId: null } });
      await tx.hrLetter.delete({ where: { id } });
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'HR_DOCUMENT_DELETED', entity: 'HR_LETTER', entityId: id, details: { letterNumber: letter.letterNumber, type: letter.type, recipientName: letter.recipientName, status: letter.status, version: letter.version }, ipAddress });
    return { deleted: true };
  }

  async pdf(actor: SessionUser, id: string, preview = false) {
    const letter = await this.detail(actor, id);
    if (!preview && !['GENERATED', 'SENT', 'ACKNOWLEDGED'].includes(letter.status)) throw new BadRequestException('Approve and generate the final document before downloading it.');
    const buffer = await renderLetterPdf({ letterNumber: letter.letterNumber, type: letter.type as LetterType, recipientName: letter.recipientName, recipientDesignation: letter.recipientDesignation, recipientDepartment: letter.recipientDepartment, issuedDate: letter.issuedDate, details: letter.details as Record<string, string>, snapshot: letter.snapshot as LetterSnapshot, verificationToken: letter.verificationToken, version: letter.version, preview: preview && !['GENERATED', 'SENT', 'ACKNOWLEDGED'].includes(letter.status) });
    await recordAudit(this.prisma, { actorId: actor.id, action: preview ? 'HR_DOCUMENT_PREVIEWED' : 'HR_DOCUMENT_DOWNLOADED', entity: 'HR_LETTER', entityId: id, details: { letterNumber: letter.letterNumber, version: letter.version } });
    return { filename: `${letter.letterNumber.replaceAll('/', '-')}-v${letter.version}.pdf`, buffer };
  }

  async verify(token: string) {
    const letter = await this.prisma.hrLetter.findUnique({ where: { verificationToken: token }, select: { letterNumber: true, type: true, recipientName: true, issuedDate: true, version: true, status: true, generatedAt: true } });
    if (!letter || !['GENERATED', 'SENT', 'ACKNOWLEDGED'].includes(letter.status)) throw new NotFoundException('This document could not be verified.');
    return { valid: true, documentNumber: letter.letterNumber, documentType: LETTER_LABELS[letter.type as LetterType], recipientName: letter.recipientName, documentDate: letter.issuedDate, version: letter.version, status: letter.status, generatedAt: letter.generatedAt };
  }
}
