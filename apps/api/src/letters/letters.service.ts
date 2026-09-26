import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateHrLetterDto, ListHrLettersDto } from './dto.js';
import {
  LETTER_FIELDS,
  LETTER_LABELS,
  type LetterType,
} from './letter-types.js';
import { renderLetterPdf } from './letter-pdf.js';

const letterInclude = {
  staffUser: { select: { id: true, name: true } },
  generatedBy: { select: { id: true, name: true } },
} satisfies Prisma.HrLetterInclude;

@Injectable()
export class LettersService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAdmin(actor: SessionUser) {
    if (!(
      actor.portal === 'ADMIN' &&
      actor.roles.some((role) => role.key === 'SUPER_ADMIN')
    ))
      throw new ForbiddenException(
        'Letters are restricted to the administrator.',
      );
  }

  async list(actor: SessionUser, query: ListHrLettersDto) {
    this.ensureAdmin(actor);
    const search = query.search?.trim();
    const where = {
      AND: [
        query.type ? { type: query.type } : {},
        search
          ? {
              OR: [
                { recipientName: { contains: search } },
                { letterNumber: { contains: search } },
              ],
            }
          : {},
      ],
    } satisfies Prisma.HrLetterWhereInput;
    return this.prisma.hrLetter.findMany({
      where,
      include: letterInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(actor: SessionUser, dto: CreateHrLetterDto, ipAddress?: string) {
    this.ensureAdmin(actor);
    const fields = LETTER_FIELDS[dto.type];
    const normalizedDetails = Object.fromEntries(
      Object.entries(dto.details ?? {}).map(([key, value]) => [
        key,
        value?.toString().trim() ?? '',
      ]),
    );
    for (const field of fields) {
      const value = normalizedDetails[field.key];
      if (field.required && !value)
        throw new BadRequestException(
          `${field.label} is required for a ${LETTER_LABELS[dto.type]}.`,
        );
      if (!value) continue;
      const maxLength = field.type === 'textarea' ? 600 : 160;
      if (value.length > maxLength)
        throw new BadRequestException(
          `${field.label} must be ${maxLength} characters or fewer so the letter remains on one page.`,
        );
      if (
        field.type === 'date' &&
        Number.isNaN(new Date(`${value.slice(0, 10)}T12:00:00`).getTime())
      )
        throw new BadRequestException(`${field.label} must be a valid date.`);
      if (
        field.type === 'money' &&
        (!Number.isFinite(Number(value)) || Number(value) < 0)
      )
        throw new BadRequestException(
          `${field.label} must be a valid non-negative amount.`,
        );
    }
    const ensureDateOrder = (
      startKey: string,
      endKey: string,
      message: string,
    ) => {
      const start = normalizedDetails[startKey];
      const end = normalizedDetails[endKey];
      if (
        start &&
        end &&
        new Date(`${end}T12:00:00`) < new Date(`${start}T12:00:00`)
      )
        throw new BadRequestException(message);
    };
    ensureDateOrder(
      'startDate',
      'endDate',
      'Internship end date must be on or after the start date.',
    );
    ensureDateOrder(
      'joiningDate',
      'reviewDate',
      'Probation review date must be on or after the joining date.',
    );
    ensureDateOrder(
      'joiningDate',
      'endDate',
      'Last working date must be on or after the joining date.',
    );
    ensureDateOrder(
      'resignationDate',
      'lastWorkingDate',
      'Last working date must be on or after the resignation date.',
    );
    if (dto.recipientName.trim().length > 160)
      throw new BadRequestException(
        'Recipient name must be 160 characters or fewer.',
      );
    if (dto.staffUserId) {
      const staff = await this.prisma.user.findUnique({
        where: { id: dto.staffUserId },
        select: { id: true },
      });
      if (!staff) throw new BadRequestException('Select a valid staff member.');
    }
    const issuedDate = dto.issuedDate
      ? new Date(`${dto.issuedDate.slice(0, 10)}T12:00:00`)
      : new Date();
    if (Number.isNaN(issuedDate.getTime()))
      throw new BadRequestException('Issued date must be valid.');
    const year = issuedDate.getFullYear();
    const letter = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.employeeCounter.upsert({
        where: { key: `HRL:${year}` },
        create: { key: `HRL:${year}`, nextNumber: 1 },
        update: { nextNumber: { increment: 1 } },
      });
      const letterNumber = `BT-HRL-${year}-${String(counter.nextNumber).padStart(4, '0')}`;
      return tx.hrLetter.create({
        data: {
          letterNumber,
          type: dto.type,
          recipientName: dto.recipientName.trim(),
          recipientDesignation: dto.recipientDesignation?.trim() || null,
          recipientDepartment: dto.recipientDepartment?.trim() || null,
          staffUserId: dto.staffUserId || null,
          issuedDate,
          details: normalizedDetails,
          generatedById: actor.id,
        },
        include: letterInclude,
      });
    });
    await recordAudit(this.prisma, {
      actorId: actor.id,
      action: 'HR_LETTER_CREATED',
      entity: 'HR_LETTER',
      entityId: letter.id,
      details: {
        letterNumber: letter.letterNumber,
        type: letter.type,
        recipientName: letter.recipientName,
      },
      ipAddress,
    });
    return letter;
  }

  async detail(actor: SessionUser, id: string) {
    this.ensureAdmin(actor);
    const letter = await this.prisma.hrLetter.findUnique({
      where: { id },
      include: letterInclude,
    });
    if (!letter) throw new NotFoundException('Letter not found.');
    return letter;
  }

  async pdf(actor: SessionUser, id: string) {
    const letter = await this.detail(actor, id);
    const buffer = await renderLetterPdf({
      letterNumber: letter.letterNumber,
      type: letter.type as LetterType,
      recipientName: letter.recipientName,
      recipientDesignation: letter.recipientDesignation,
      recipientDepartment: letter.recipientDepartment,
      issuedDate: letter.issuedDate,
      details: letter.details as Record<string, string>,
    });
    return {
      filename: `${letter.letterNumber.replaceAll('/', '-')}.pdf`,
      buffer,
    };
  }
}
