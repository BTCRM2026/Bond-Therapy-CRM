import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { loadSessionUser, sessionCookieName, type SessionUser } from './session.util.js';

export interface RequestWithUser extends Request {
  user?: SessionUser;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = request.cookies?.[sessionCookieName()] as string | undefined;
    const user = await loadSessionUser(this.prisma, token);
    if (!user) throw new UnauthorizedException('Sign in required.');
    request.user = user;
    return true;
  }
}
