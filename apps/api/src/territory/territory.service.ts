import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AreaDto, BeatDto, CityDto, EndTerritoryAllocationDto, RegionDto, StateDto, TerritoryAllocationDto, TerritoryDto } from './dto.js';

const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);
const beatInclude = { assignedStaff: { select: { id: true, name: true } }, _count: { select: { clients: true } } } satisfies Prisma.BeatInclude;
const assignmentInclude = {
  user: { select: { id: true, name: true, status: true } },
  assignedBy: { select: { id: true, name: true } },
  territory: { include: { area: { include: { city: { include: { state: { include: { region: true } } } } } } } },
} satisfies Prisma.TerritoryAssignmentInclude;

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
    if (!this.isAdmin(actor)) return this.mine(actor);
    const [regions, states, cities, areas, territories, beats, assignments] = await this.prisma.$transaction([
      this.prisma.region.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.state.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.city.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.area.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.territory.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.beat.findMany({ orderBy: { name: 'asc' }, include: beatInclude }),
      this.prisma.territoryAssignment.findMany({ include: assignmentInclude, orderBy: [{ endDate: 'asc' }, { startDate: 'desc' }] }),
    ]);
    return {
      regions, states, cities, areas, territories, beats, assignments,
      overview: {
        regions: regions.length,
        states: states.length,
        cities: cities.length,
        areas: areas.length,
        territories: territories.length,
        assignedStaff: new Set(assignments.filter((item) => !item.endDate).map((item) => item.userId)).size,
      },
    };
  }

  async mine(actor: SessionUser) {
    this.ensureAccess(actor);
    const assignments = await this.prisma.territoryAssignment.findMany({ where: { userId: actor.id }, include: assignmentInclude, orderBy: [{ endDate: 'asc' }, { startDate: 'desc' }] });
    return { assignments, active: assignments.filter((item) => !item.endDate) };
  }

  // Regions
  async createRegion(actor: SessionUser, dto: RegionDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const region = await this.conflictOnDuplicate(
      this.prisma.region.create({ data: { name: dto.name.trim(), code: dto.code?.trim() || null, description: dto.description?.trim() || null } }),
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
      this.prisma.region.update({ where: { id }, data: { name: dto.name.trim(), code: dto.code?.trim() || null, description: dto.description?.trim() || null, isActive: dto.isActive ?? existing.isActive } }),
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
      this.prisma.state.create({ data: { name: dto.name.trim(), code: dto.code?.trim() || null, regionId: dto.regionId } }),
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
      this.prisma.state.update({ where: { id }, data: { name: dto.name.trim(), code: dto.code?.trim() || null, regionId: dto.regionId, isActive: dto.isActive ?? existing.isActive } }),
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
    const existing = await this.prisma.city.findUnique({ where: { id }, include: { _count: { select: { territories: true, areas: true } } } });
    if (!existing) throw new NotFoundException('City not found.');
    if (existing._count.territories > 0 || existing._count.areas > 0) throw new ConflictException('Remove the areas and territories under this city first.');
    await this.prisma.city.delete({ where: { id } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'CITY_DELETE', entity: 'CITY', entityId: id, details: { name: existing.name }, ipAddress });
    return { deleted: true };
  }

  // Areas
  async createArea(actor: SessionUser, dto: AreaDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    if (!(await this.prisma.city.findUnique({ where: { id: dto.cityId } }))) throw new NotFoundException('City not found.');
    const area = await this.conflictOnDuplicate(
      this.prisma.area.create({ data: { name: dto.name.trim(), cityId: dto.cityId } }),
      'An area with this name already exists in the selected city.',
    );
    await recordAudit(this.prisma, { actorId: actor.id, action: 'AREA_CREATE', entity: 'AREA', entityId: area.id, details: { current: area }, ipAddress });
    return area;
  }

  async updateArea(actor: SessionUser, id: string, dto: AreaDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.area.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Area not found.');
    if (!(await this.prisma.city.findUnique({ where: { id: dto.cityId } }))) throw new NotFoundException('City not found.');
    const area = await this.conflictOnDuplicate(
      this.prisma.area.update({ where: { id }, data: { name: dto.name.trim(), cityId: dto.cityId, isActive: dto.isActive ?? existing.isActive } }),
      'An area with this name already exists in the selected city.',
    );
    await recordAudit(this.prisma, { actorId: actor.id, action: 'AREA_UPDATE', entity: 'AREA', entityId: id, details: { previous: existing, current: area }, ipAddress });
    return area;
  }

  async deleteArea(actor: SessionUser, id: string, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.area.findUnique({ where: { id }, include: { _count: { select: { territories: true } } } });
    if (!existing) throw new NotFoundException('Area not found.');
    if (existing._count.territories > 0) throw new ConflictException('Remove or move the territories under this area first.');
    await this.prisma.area.delete({ where: { id } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'AREA_DELETE', entity: 'AREA', entityId: id, details: { previous: existing }, ipAddress });
    return { deleted: true };
  }

  // Territories
  async createTerritory(actor: SessionUser, dto: TerritoryDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const refs = await this.validateTerritoryRefs(dto);
    const territory = await this.conflictOnDuplicate(
      this.prisma.territory.create({ data: this.territoryData(dto, refs) }),
      'A territory with this name already exists in the selected area, or its code is already in use.',
    );
    await recordAudit(this.prisma, { actorId: actor.id, action: 'TERRITORY_CREATE', entity: 'TERRITORY', entityId: territory.id, details: { name: territory.name }, ipAddress });
    return territory;
  }

  async updateTerritory(actor: SessionUser, id: string, dto: TerritoryDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.territory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Territory not found.');
    const refs = await this.validateTerritoryRefs(dto);
    const territory = await this.conflictOnDuplicate(
      this.prisma.territory.update({ where: { id }, data: { ...this.territoryData(dto, refs), isActive: dto.isActive ?? existing.isActive } }),
      'A territory with this name already exists in the selected area, or its code is already in use.',
    );
    await recordAudit(this.prisma, { actorId: actor.id, action: 'TERRITORY_UPDATE', entity: 'TERRITORY', entityId: id, details: { changes: dto }, ipAddress });
    return territory;
  }

  async deleteTerritory(actor: SessionUser, id: string, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.territory.findUnique({ where: { id }, include: { _count: { select: { beats: true, assignments: true } } } });
    if (!existing) throw new NotFoundException('Territory not found.');
    if (existing._count.beats > 0 || existing._count.assignments > 0) throw new ConflictException('This territory has route or staff history and cannot be deleted. Deactivate it instead.');
    await this.prisma.territory.delete({ where: { id } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'TERRITORY_DELETE', entity: 'TERRITORY', entityId: id, details: { name: existing.name }, ipAddress });
    return { deleted: true };
  }

  private async validateTerritoryRefs(dto: TerritoryDto) {
    const area = await this.prisma.area.findUnique({ where: { id: dto.areaId }, include: { city: { include: { state: { include: { region: true } } } } } });
    if (!area) throw new NotFoundException('Area not found.');
    return { area, city: area.city, state: area.city.state, region: area.city.state.region };
  }

  private territoryData(dto: TerritoryDto, refs: Awaited<ReturnType<TerritoryService['validateTerritoryRefs']>>) {
    return {
      name: dto.name.trim(),
      code: dto.code?.trim() || null,
      description: dto.description?.trim() || null,
      effectiveFrom: dto.effectiveFrom ? new Date(`${dto.effectiveFrom}T00:00:00.000Z`) : undefined,
      areaId: refs.area.id,
      cityId: refs.city.id,
      stateId: refs.state.id,
      regionId: refs.region.id,
    };
  }

  async allocate(actor: SessionUser, dto: TerritoryAllocationDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const startDate = new Date(`${dto.effectiveFrom}T00:00:00.000Z`);
    const [staff, territory, duplicate, replacement] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: dto.userId, status: 'ACTIVE', roles: { some: { role: { key: { in: [...salesRoles] }, isActive: true } } } }, select: { id: true, name: true } }),
      this.prisma.territory.findUnique({ where: { id: dto.territoryId }, include: { area: { include: { city: { include: { state: { include: { region: true } } } } } } } }),
      this.prisma.territoryAssignment.findFirst({ where: { userId: dto.userId, territoryId: dto.territoryId, endDate: null } }),
      dto.replaceAssignmentId ? this.prisma.territoryAssignment.findUnique({ where: { id: dto.replaceAssignmentId } }) : null,
    ]);
    if (!staff) throw new NotFoundException('Select an active Sales staff member.');
    if (!territory) throw new NotFoundException('Territory not found.');
    if (!territory.isActive || !territory.area.isActive || !territory.area.city.isActive || !territory.area.city.state.isActive || !territory.area.city.state.region.isActive) throw new BadRequestException('Inactive geography cannot receive a new allocation.');
    if (duplicate) throw new ConflictException('This staff member already has an active allocation for the selected territory.');
    if (replacement && replacement.endDate) throw new BadRequestException('The allocation being replaced is already closed.');
    if (replacement && replacement.userId !== dto.userId) throw new BadRequestException('The replacement allocation must belong to the selected staff member.');
    if (replacement && startDate <= replacement.startDate) throw new BadRequestException('The new allocation must start after the previous allocation began.');

    const assignment = await this.prisma.$transaction(async (tx) => {
      if (replacement) await tx.territoryAssignment.update({ where: { id: replacement.id }, data: { endDate: new Date(startDate.getTime() - 86_400_000), reason: dto.reason?.trim() || replacement.reason } });
      return tx.territoryAssignment.create({ data: { userId: dto.userId, territoryId: dto.territoryId, startDate, assignedById: actor.id, reason: dto.reason?.trim() || null }, include: assignmentInclude });
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: replacement ? 'TERRITORY_REASSIGN' : 'TERRITORY_ALLOCATE', entity: 'TERRITORY_ASSIGNMENT', entityId: assignment.id, details: { current: assignment, replacedAssignmentId: replacement?.id }, ipAddress });
    return assignment;
  }

  async endAllocation(actor: SessionUser, id: string, dto: EndTerritoryAllocationDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.territoryAssignment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Territory allocation not found.');
    if (existing.endDate) throw new BadRequestException('This allocation is already closed.');
    const endDate = new Date(`${dto.endDate}T00:00:00.000Z`);
    if (endDate < existing.startDate) throw new BadRequestException('End date cannot be before the allocation start date.');
    const assignment = await this.prisma.territoryAssignment.update({ where: { id }, data: { endDate, reason: dto.reason?.trim() || existing.reason }, include: assignmentInclude });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'TERRITORY_ALLOCATION_END', entity: 'TERRITORY_ASSIGNMENT', entityId: id, details: { previous: existing, current: assignment }, ipAddress });
    return assignment;
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
