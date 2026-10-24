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

describe('Appointment Letter creation', () => {
  const appointment: CreateHrLetterDto = {
    type: 'APPOINTMENT', recipientName: 'Asha Patel', recipientDesignation: 'Sales Executive', recipientDepartment: 'Sales', issuedDate: '2026-10-19',
    details: { recipientAddress: 'Surat, Gujarat', designation: 'Sales Executive', department: 'Sales', joiningDate: '2026-10-01', workLocation: 'Surat', employmentType: 'Permanent', probationMonths: '3', noticePeriod: '30 days', uanEpfNumber: '001234567890', esicNumber: '0012345678', reportingManager: 'Sales Manager', basicMonthly: '20000', employeePfMonthly: '1800', employerPfMonthly: '1800' },
  };

  it('calculates the Word annexure totals and rejects impossible deductions', () => {
    const service = new LettersService({} as PrismaService);
    expect(service['normalizeAndValidate'](appointment)).toMatchObject({ appointmentTemplateVersion: 'WORD_2026', basicAnnual: '240000', employeePfAnnual: '21600', totalAMonthly: '20000', totalBMonthly: '1800', netMonthly: '18200', totalCMonthly: '1800', ctcMonthly: '21800', ctcAnnual: '261600' });
    expect(service['normalizeAndValidate']({ ...appointment, details: { ...appointment.details, basicAnnual: '1', hraMonthly: '1234.56' } })).toMatchObject({ basicAnnual: '240000', hraAnnual: '14814.72' });
    expect(() => service['normalizeAndValidate']({ ...appointment, details: { ...appointment.details, employeePfMonthly: '21000' } })).toThrow('deductions cannot exceed');
  });

  it('requires approved employee-specific probation and notice terms', () => {
    const service = new LettersService({} as PrismaService);
    expect(() => service['normalizeAndValidate']({ ...appointment, details: { ...appointment.details, probationMonths: '' } })).toThrow('probation period');
    expect(() => service['normalizeAndValidate']({ ...appointment, details: { ...appointment.details, probationMonths: 'six' } })).toThrow('whole number');
    expect(() => service['normalizeAndValidate']({ ...appointment, details: { ...appointment.details, noticePeriod: 'one month' } })).toThrow('number and unit');
    expect(() => service['normalizeAndValidate']({ ...appointment, details: { ...appointment.details, noticePeriod: '' } })).toThrow('notice period');
  });

  it('accepts valid probation periods and rejects out-of-range or fractional values', () => {
    const service = new LettersService({} as PrismaService);
    for (const value of ['1', '3', '24', ' 6 ', '3 months', '1 month', '24 MONTHS']) {
      const result = service['normalizeAndValidate']({ ...appointment, details: { ...appointment.details, probationMonths: value } });
      expect(result.probationMonths).toBe(String(parseInt(value, 10)));
      expect(result.uanEpfNumber).toBe('001234567890');
      expect(result.esicNumber).toBe('0012345678');
    }
    for (const value of ['0', '25', '-1', '1.5', '3 days', 'six', 'NaN']) {
      expect(() => service['normalizeAndValidate']({ ...appointment, details: { ...appointment.details, probationMonths: value } })).toThrow('whole number');
    }
    for (const value of ['30 days', '1 day', '2 months', '1 month']) {
      expect(service['normalizeAndValidate']({ ...appointment, details: { ...appointment.details, noticePeriod: value } }).noticePeriod).toBe(value);
    }
  });

  it('uses edited employee details and the Treebond company identity', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'staff-1', name: 'Old Name', email: null, department: 'SALES', manager: null, staffProfile: { employeeCode: 'BT-01', jobTitle: 'Old Role', employmentType: 'FULL_TIME', workLocation: 'Vadodara', joiningDate: new Date('2026-01-01'), mobile: null }, roles: [] }) },
      billingSettings: { upsert: vi.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const snapshot = await new LettersService(prisma)['snapshot']({ ...appointment, staffUserId: 'staff-1' });
    expect(snapshot.employee).toMatchObject({ name: 'Asha Patel', designation: 'Sales Executive', department: 'Sales' });
    expect(snapshot.company).toMatchObject({ legalName: 'Treebond Cosmetics Pvt Ltd', address: 'Plot No-146/1, GIDC Phase-2, Rajpipla, Dist-Narmada-393145', authorisedSignatoryDesignation: 'Director' });
  });
});
