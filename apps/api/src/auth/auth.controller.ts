import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './login.dto.js';

const COOKIE_NAME = 'bt_session';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(dto, { ipAddress: request.ip, userAgent: request.get('user-agent') });
    response.cookie(COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: result.maxAgeMs,
      ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    });
    return { user: result.user };
  }

  @Get('session')
  session(@Req() request: Request) {
    return this.auth.session(request.cookies?.[COOKIE_NAME] as string | undefined);
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request.cookies?.[COOKIE_NAME] as string | undefined);
    response.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    });
    return { ok: true };
  }
}

