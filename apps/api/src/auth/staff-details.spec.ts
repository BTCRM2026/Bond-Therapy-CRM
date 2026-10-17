import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

const dto = { mobile: '9876543210', email: 'Ali@Example.com ', dateOfBirth: '1995-04-12', residentialAddress: '12 Main Road, Surat', emergencyContactName: 'Sara', emergencyContactMobile: '9876500000' };
const staff = { id: 'u1', portal: 'STAFF' as const };

function build(profile: { detailsSubmittedAt: Date | null } | null = { detailsSubmittedAt: null }, duplicate: unknown = null) {
  const prisma = {
    staffProfile: { findUnique: vi.fn().mockResolvedValue(profile), update: vi.fn().mockResolvedValue({}) },
    user: { findFirst: vi.fn().mockResolvedValue(duplicate), update: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn().mockImplementation(async (ops: unknown[]) => Promise.all(ops)),
  };
  return { service: new AuthService(prisma as never), prisma };
}

describe('staff details one-time submission', () => {
  it('saves the details, lowercases the email and locks the profile', async () => {
    const { service, prisma } = build();
    await service.submitStaffDetails(staff, dto as never);
    expect(prisma.user.update.mock.calls[0]![0].data).toEqual({ email: 'ali@example.com' });
    expect(prisma.staffProfile.update.mock.calls[0]![0].data.detailsSubmittedAt).toBeInstanceOf(Date);
  });

  it('refuses a second submission, other portals, placeholder or duplicate emails', async () => {
    await expect(build({ detailsSubmittedAt: new Date() }).service.submitStaffDetails(staff, dto as never)).rejects.toThrow('locked');
    await expect(build().service.submitStaffDetails({ id: 'u1', portal: 'ADMIN' }, dto as never)).rejects.toThrow('staff portal');
    await expect(build().service.submitStaffDetails(staff, { ...dto, email: 'x@pending.bondtherapy.local' } as never)).rejects.toThrow('own email');
    await expect(build(undefined, { id: 'other' }).service.submitStaffDetails(staff, dto as never)).rejects.toThrow('already in use');
  });

  it('rejects a future date of birth', async () => {
    await expect(build().service.submitStaffDetails(staff, { ...dto, dateOfBirth: '2999-01-01' } as never)).rejects.toThrow('date of birth');
  });
});
