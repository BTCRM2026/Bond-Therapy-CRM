import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import type { CreateDistributorDto, UpdateDistributorDto } from './dto.js';

@Injectable()
export class DistributorsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.distributor.findMany({
      include: { assignedSalesperson: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateDistributorDto, actor: SessionUser, ipAddress?: string) {
    const distributor = await this.prisma.distributor.create({
      data: {
        businessName: dto.businessName.trim(),
        contactName: dto.contactName.trim(),
        phone: dto.phone,
        email: dto.email,
        territory: dto.territory,
        creditLimit: dto.creditLimit,
        assignedSalespersonId: dto.assignedSalespersonId,
        notes: dto.notes,
      },
    });
    await recordAudit(this.prisma, {
      actorId: actor.id,
      action: 'DISTRIBUTOR_CREATE',
      entity: 'DISTRIBUTOR',
      entityId: distributor.id,
      details: { businessName: distributor.businessName },
      ipAddress,
    });
    return distributor;
  }

  async update(id: string, dto: UpdateDistributorDto, actor: SessionUser, ipAddress?: string) {
    const existing = await this.prisma.distributor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Distributor not found.');

    const distributor = await this.prisma.distributor.update({
      where: { id },
      data: {
        businessName: dto.businessName?.trim(),
        contactName: dto.contactName?.trim(),
        phone: dto.phone,
        email: dto.email,
        territory: dto.territory,
        creditLimit: dto.creditLimit,
        assignedSalespersonId: dto.assignedSalespersonId,
        notes: dto.notes,
        status: dto.status,
      },
    });

    await recordAudit(this.prisma, {
      actorId: actor.id,
      action: 'DISTRIBUTOR_UPDATE',
      entity: 'DISTRIBUTOR',
      entityId: id,
      details: { changes: dto },
      ipAddress,
    });

    return distributor;
  }
}
