import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { loadSessionUser, type SessionUser } from './session.util.js';
import { parsePortal, PORTAL_HEADER, portalCookieName } from './portal.js';

export interface RequestWithUser extends Request {
  user?: SessionUser;
  portal?: SessionUser['portal'];
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const portal = parsePortal(request.get(PORTAL_HEADER));
    const token = request.cookies?.[portalCookieName(portal)] as string | undefined;
    const user = await loadSessionUser(this.prisma, portal, token);
    if (!user) throw new UnauthorizedException('Sign in required.');
    request.user = user;
    request.portal = portal;
    return true;
  }
}
