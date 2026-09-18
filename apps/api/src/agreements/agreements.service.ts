import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import type { CreateAgreementDto, UpdateAgreementDto } from './dto.js';

@Injectable()
export class AgreementsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.agreement.findMany({
      include: { distributor: { select: { id: true, businessName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateAgreementDto, actor: SessionUser, ipAddress?: string) {
    const agreement = await this.prisma.agreement.create({
      data: {
        partyType: dto.partyType,
        partyName: dto.partyName.trim(),
        distributorId: dto.distributorId,
        title: dto.title.trim(),
        signedDate: dto.signedDate ? new Date(dto.signedDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        notes: dto.notes,
      },
    });
    await recordAudit(this.prisma, {
      actorId: actor.id,
      action: 'AGREEMENT_CREATE',
      entity: 'AGREEMENT',
      entityId: agreement.id,
      details: { title: agreement.title, partyType: agreement.partyType },
      ipAddress,
    });
    return agreement;
  }

  async update(id: string, dto: UpdateAgreementDto, actor: SessionUser, ipAddress?: string) {
    const existing = await this.prisma.agreement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Agreement not found.');

    const agreement = await this.prisma.agreement.update({
      where: { id },
      data: {
        partyType: dto.partyType,
        partyName: dto.partyName?.trim(),
        distributorId: dto.distributorId,
        title: dto.title?.trim(),
        signedDate: dto.signedDate ? new Date(dto.signedDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        status: dto.status,
        notes: dto.notes,
      },
    });

    await recordAudit(this.prisma, {
      actorId: actor.id,
      action: 'AGREEMENT_UPDATE',
      entity: 'AGREEMENT',
      entityId: id,
      details: { changes: dto },
      ipAddress,
    });

    return agreement;
  }
}
