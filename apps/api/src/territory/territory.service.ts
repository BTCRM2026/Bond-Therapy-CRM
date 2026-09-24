import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { BeatDto, CityDto, RegionDto, StateDto, TerritoryDto } from './dto.js';

const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);
const beatInclude = { assignedStaff: { select: { id: true, name: true } }, _count: { select: { clients: true } } } satisfies Prisma.BeatInclude;

@Injectable()
export class TerritoryService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor: SessionUser) {
    return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN');
  }

  private ensureAccess(actor: SessionUser) {
    if (this.isAdmin(actor)) return;
    if (actor.portal !== 'STAFF' || !actor.roles.some((role) => salesRoles.has(role.key))) throw new ForbiddenException('Territory data is not available to this account.');
  }

  private ensureAdminAccess(actor: SessionUser) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Managing the territory structure is restricted to Super Admin.');
  }

  private conflictOnDuplicate<T>(promise: Promise<T>, message: string) {
    return promise.catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(message);
      throw error;
    });
  }

  async hierarchy(actor: SessionUser) {
    this.ensureAccess(actor);
    const [regions, states, cities, territories, beats] = await this.prisma.$transaction([
      this.prisma.region.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.state.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.city.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.territory.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.beat.findMany({ orderBy: { name: 'asc' }, include: beatInclude }),
    ]);
    return { regions, states, cities, territories, beats };
  }

  // Regions
  async createRegion(actor: SessionUser, dto: RegionDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const region = await this.conflictOnDuplicate(
      this.prisma.region.create({ data: { name: dto.name.trim(), code: dto.code?.trim() || null } }),
      'A region with this name or code already exists.',
    );
    await recordAudit(this.prisma, { actorId: actor.id, action: 'REGION_CREATE', entity: 'REGION', entityId: region.id, details: { name: region.name }, ipAddress });
    return region;
  }

  async updateRegion(actor: SessionUser, id: string, dto: RegionDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.region.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Region not found.');
    const region = await this.conflictOnDuplicate(
      this.prisma.region.update({ where: { id }, data: { name: dto.name.trim(), code: dto.code?.trim() || null, isActive: dto.isActive ?? existing.isActive } }),
      'A region with this name or code already exists.',
    );
    await recordAudit(this.prisma, { actorId: actor.id, action: 'REGION_UPDATE', entity: 'REGION', entityId: id, details: { changes: dto }, ipAddress });
    return region;
  }

  async deleteRegion(actor: SessionUser, id: string, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.region.findUnique({ where: { id }, include: { _count: { select: { states: true, territories: true } } } });
    if (!existing) throw new NotFoundException('Region not found.');
    if (existing._count.states > 0 || existing._count.territories > 0) throw new ConflictException('Remove the states and territories under this region first.');
    await this.prisma.region.delete({ where: { id } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'REGION_DELETE', entity: 'REGION', entityId: id, details: { name: existing.name }, ipAddress });
    return { deleted: true };
  }

  // States
  async createState(actor: SessionUser, dto: StateDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    if (!(await this.prisma.region.findUnique({ where: { id: dto.regionId } }))) throw new NotFoundException('Region not found.');
    const state = await this.conflictOnDuplicate(
      this.prisma.state.create({ data: { name: dto.name.trim(), regionId: dto.regionId } }),
      'A state with this name already exists in the selected region.',
    );
    await recordAudit(this.prisma, { actorId: actor.id, action: 'STATE_CREATE', entity: 'STATE', entityId: state.id, details: { name: state.name }, ipAddress });
    return state;
  }

  async updateState(actor: SessionUser, id: string, dto: StateDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.state.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('State not found.');
    if (!(await this.prisma.region.findUnique({ where: { id: dto.regionId } }))) throw new NotFoundException('Region not found.');
    const state = await this.conflictOnDuplicate(
      this.prisma.state.update({ where: { id }, data: { name: dto.name.trim(), regionId: dto.regionId, isActive: dto.isActive ?? existing.isActive } }),
      'A state with this name already exists in the selected region.',
    );
    await recordAudit(this.prisma, { actorId: actor.id, action: 'STATE_UPDATE', entity: 'STATE', entityId: id, details: { changes: dto }, ipAddress });
    return state;
  }

  async deleteState(actor: SessionUser, id: string, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.state.findUnique({ where: { id }, include: { _count: { select: { cities: true, territories: true } } } });
    if (!existing) throw new NotFoundException('State not found.');
    if (existing._count.cities > 0 || existing._count.territories > 0) throw new ConflictException('Remove the cities and territories under this state first.');
    await this.prisma.state.delete({ where: { id } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'STATE_DELETE', entity: 'STATE', entityId: id, details: { name: existing.name }, ipAddress });
    return { deleted: true };
  }

  // Cities
  async createCity(actor: SessionUser, dto: CityDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    if (!(await this.prisma.state.findUnique({ where: { id: dto.stateId } }))) throw new NotFoundException('State not found.');
    const city = await this.conflictOnDuplicate(
      this.prisma.city.create({ data: { name: dto.name.trim(), stateId: dto.stateId } }),
      'A city with this name already exists in the selected state.',
    );
    await recordAudit(this.prisma, { actorId: actor.id, action: 'CITY_CREATE', entity: 'CITY', entityId: city.id, details: { name: city.name }, ipAddress });
    return city;
  }

  async updateCity(actor: SessionUser, id: string, dto: CityDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.city.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('City not found.');
    if (!(await this.prisma.state.findUnique({ where: { id: dto.stateId } }))) throw new NotFoundException('State not found.');
    const city = await this.conflictOnDuplicate(
      this.prisma.city.update({ where: { id }, data: { name: dto.name.trim(), stateId: dto.stateId, isActive: dto.isActive ?? existing.isActive } }),
      'A city with this name already exists in the selected state.',
    );
    await recordAudit(this.prisma, { actorId: actor.id, action: 'CITY_UPDATE', entity: 'CITY', entityId: id, details: { changes: dto }, ipAddress });
    return city;
  }

  async deleteCity(actor: SessionUser, id: string, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.city.findUnique({ where: { id }, include: { _count: { select: { territories: true } } } });
    if (!existing) throw new NotFoundException('City not found.');
    if (existing._count.territories > 0) throw new ConflictException('Remove the territories under this city first.');
    await this.prisma.city.delete({ where: { id } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'CITY_DELETE', entity: 'CITY', entityId: id, details: { name: existing.name }, ipAddress });
    return { deleted: true };
  }

  // Territories
  async createTerritory(actor: SessionUser, dto: TerritoryDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    await this.validateTerritoryRefs(dto);
    const territory = await this.conflictOnDuplicate(
      this.prisma.territory.create({ data: { name: dto.name.trim(), regionId: dto.regionId, stateId: dto.stateId, cityId: dto.cityId } }),
      'A territory with this name already exists in the selected city.',
    );
    await recordAudit(this.prisma, { actorId: actor.id, action: 'TERRITORY_CREATE', entity: 'TERRITORY', entityId: territory.id, details: { name: territory.name }, ipAddress });
    return territory;
  }

  async updateTerritory(actor: SessionUser, id: string, dto: TerritoryDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.territory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Territory not found.');
    await this.validateTerritoryRefs(dto);
    const territory = await this.conflictOnDuplicate(
      this.prisma.territory.update({ where: { id }, data: { name: dto.name.trim(), regionId: dto.regionId, stateId: dto.stateId, cityId: dto.cityId, isActive: dto.isActive ?? existing.isActive } }),
      'A territory with this name already exists in the selected city.',
    );
    await recordAudit(this.prisma, { actorId: actor.id, action: 'TERRITORY_UPDATE', entity: 'TERRITORY', entityId: id, details: { changes: dto }, ipAddress });
    return territory;
  }

  async deleteTerritory(actor: SessionUser, id: string, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.territory.findUnique({ where: { id }, include: { _count: { select: { beats: true } } } });
    if (!existing) throw new NotFoundException('Territory not found.');
    if (existing._count.beats > 0) throw new ConflictException('Remove the beats under this territory first.');
    await this.prisma.territory.delete({ where: { id } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'TERRITORY_DELETE', entity: 'TERRITORY', entityId: id, details: { name: existing.name }, ipAddress });
    return { deleted: true };
  }

  private async validateTerritoryRefs(dto: TerritoryDto) {
    const [region, state, city] = await Promise.all([
      this.prisma.region.findUnique({ where: { id: dto.regionId } }),
      this.prisma.state.findUnique({ where: { id: dto.stateId } }),
      this.prisma.city.findUnique({ where: { id: dto.cityId } }),
    ]);
    if (!region) throw new NotFoundException('Region not found.');
    if (!state || state.regionId !== dto.regionId) throw new NotFoundException('State not found in the selected region.');
    if (!city || city.stateId !== dto.stateId) throw new NotFoundException('City not found in the selected state.');
  }

  // Beats
  async createBeat(actor: SessionUser, dto: BeatDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    await this.validateBeatRefs(dto);
    const beat = await this.conflictOnDuplicate(
      this.prisma.beat.create({ data: this.beatData(dto), include: beatInclude }),
      'A beat with this name already exists in the selected territory.',
    );
    await recordAudit(this.prisma, { actorId: actor.id, action: 'BEAT_CREATE', entity: 'BEAT', entityId: beat.id, details: { name: beat.name }, ipAddress });
    return beat;
  }

  async updateBeat(actor: SessionUser, id: string, dto: BeatDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.beat.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Beat not found.');
    await this.validateBeatRefs(dto);
    const beat = await this.conflictOnDuplicate(
      this.prisma.beat.update({ where: { id }, data: { ...this.beatData(dto), isActive: dto.isActive ?? existing.isActive }, include: beatInclude }),
      'A beat with this name already exists in the selected territory.',
    );
    await recordAudit(this.prisma, { actorId: actor.id, action: 'BEAT_UPDATE', entity: 'BEAT', entityId: id, details: { changes: dto }, ipAddress });
    return beat;
  }

  async deleteBeat(actor: SessionUser, id: string, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.beat.findUnique({ where: { id }, include: { _count: { select: { clients: true } } } });
    if (!existing) throw new NotFoundException('Beat not found.');
    if (existing._count.clients > 0) throw new ConflictException('Unassign the salons on this beat before deleting it.');
    await this.prisma.beat.delete({ where: { id } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'BEAT_DELETE', entity: 'BEAT', entityId: id, details: { name: existing.name }, ipAddress });
    return { deleted: true };
  }

  private beatData(dto: BeatDto) {
    return {
      name: dto.name.trim(),
      territoryId: dto.territoryId,
      assignedStaffId: dto.assignedStaffId || null,
      visitFrequencyDays: dto.visitFrequencyDays ?? null,
      preferredVisitDays: dto.preferredVisitDays ?? Prisma.JsonNull,
    };
  }

  private async validateBeatRefs(dto: BeatDto) {
    if (!(await this.prisma.territory.findUnique({ where: { id: dto.territoryId } }))) throw new NotFoundException('Territory not found.');
    if (dto.assignedStaffId && !(await this.prisma.user.findUnique({ where: { id: dto.assignedStaffId } }))) throw new NotFoundException('Assigned staff member not found.');
  }
}
