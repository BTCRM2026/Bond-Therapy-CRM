import { Body, Controller, Get, Headers, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './login.dto.js';
import { parsePortal, PORTAL_HEADER, portalCookieName } from '../common/portal.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Headers(PORTAL_HEADER) portalHeader: string | undefined, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const portal = parsePortal(portalHeader);
    const result = await this.auth.login(dto, { ipAddress: request.ip, userAgent: request.get('user-agent') }, portal);
    response.cookie(portalCookieName(portal), result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: result.maxAgeMs,
      priority: 'high',
    });
    return { user: result.user };
  }

  @Get('session')
  session(@Headers(PORTAL_HEADER) portalHeader: string | undefined, @Req() request: Request) {
    const portal = parsePortal(portalHeader);
    return this.auth.session(portal, request.cookies?.[portalCookieName(portal)] as string | undefined);
  }

  @Post('logout')
  async logout(@Headers(PORTAL_HEADER) portalHeader: string | undefined, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const portal = parsePortal(portalHeader);
    const cookieName = portalCookieName(portal);
    await this.auth.logout(request.cookies?.[cookieName] as string | undefined);
    response.clearCookie(cookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      priority: 'high',
    });
    return { ok: true };
  }
}
