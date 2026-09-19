import { BadRequestException } from '@nestjs/common';
import { PortalType } from '@prisma/client';
import { parsePortal, portalCookieName } from './portal.js';

describe('portal context', () => {
  it('uses a distinct host-only cookie name for every portal', () => {
    expect(portalCookieName(PortalType.ADMIN)).toBe('bt_admin_session');
    expect(portalCookieName(PortalType.STAFF)).toBe('bt_staff_session');
    expect(portalCookieName(PortalType.DISTRIBUTOR)).toBe('bt_distributor_session');
  });

  it('accepts known portals and rejects untrusted values', () => {
    expect(parsePortal('staff')).toBe(PortalType.STAFF);
    expect(() => parsePortal('unknown')).toThrow(BadRequestException);
  });
});
