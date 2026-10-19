import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CreateHrLetterDto } from './dto.js';
import { LettersService } from './letters.service.js';

const offer = (ctc = '600000'): CreateHrLetterDto => ({
  type: 'OFFER', recipientName: 'Asha Patel', recipientDesignation: 'Trainee', recipientDepartment: 'Export',
  staffUserId: 'staff-1', issuedDate: '2026-10-19',
  details: { recipientAddress: 'Mumbai, Maharashtra', designation: 'Trainee', department: 'Export', workLocation: 'Mumbai HO', joiningDate: '2026-11-02', ctc },
});

describe('Offer Letter creation', () => {
  it('accepts an editable annual CTC without salary component rows', () => {
    const service = new LettersService({} as PrismaService);
    expect(service['normalizeAndValidate'](offer()).ctc).toBe('600000');
    expect(() => service['normalizeAndValidate'](offer('0'))).toThrow('annual CTC greater than zero');
    expect(service['normalizeAndValidate']({ ...offer(), details: { ...offer().details, recipientAddress: 'Mumbai,\n Maharashtra' } }).recipientAddress).toBe('Mumbai, Maharashtra');
  });

  it('keeps edited recipient details when a staff record is selected', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'staff-1', name: 'Old Staff Name', email: null, department: 'SALES', manager: null, staffProfile: { employeeCode: 'BT-01', jobTitle: 'Sales Executive', employmentType: 'FULL_TIME', workLocation: 'Vadodara', joiningDate: new Date('2026-01-01'), mobile: null }, roles: [] }) },
      billingSettings: { upsert: vi.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const snapshot = await new LettersService(prisma)['snapshot'](offer());
    expect(snapshot.employee).toMatchObject({ id: 'staff-1', name: 'Asha Patel', designation: 'Trainee', department: 'Export' });
    expect(snapshot.company).toMatchObject({ legalName: 'Treebond Cosmetics Pvt Ltd', authorisedSignatoryDesignation: 'Director' });
  });
});
