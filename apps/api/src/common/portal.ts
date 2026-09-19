import { BadRequestException } from '@nestjs/common';
import { PortalType } from '@prisma/client';

export const PORTAL_HEADER = 'x-bt-portal';

const COOKIE_NAMES: Record<PortalType, string> = {
  ADMIN: 'bt_admin_session',
  STAFF: 'bt_staff_session',
  DISTRIBUTOR: 'bt_distributor_session',
};

export function parsePortal(value?: string): PortalType {
  const portal = value?.trim().toUpperCase();
  if (portal === PortalType.ADMIN || portal === PortalType.STAFF || portal === PortalType.DISTRIBUTOR) return portal;
  throw new BadRequestException('A valid portal context is required.');
}

export function portalCookieName(portal: PortalType) {
  return COOKIE_NAMES[portal];
}
