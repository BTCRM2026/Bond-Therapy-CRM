import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { PortalType } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { PORTALS_KEY } from './portals.decorator.js';
import type { RequestWithUser } from './session.guard.js';

@Injectable()
export class PortalGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<PortalType[]>(PORTALS_KEY, [context.getHandler(), context.getClass()]);
    if (!allowed?.length) return true;
    const portal = context.switchToHttp().getRequest<RequestWithUser>().portal;
    if (!portal || !allowed.includes(portal)) throw new ForbiddenException('This resource is not available in your portal.');
    return true;
  }
}
