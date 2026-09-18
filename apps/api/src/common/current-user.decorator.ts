import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RequestWithUser } from './session.guard.js';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  return request.user;
});
