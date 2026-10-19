import { describe, expect, it } from 'vitest';
import { buildLetterContent } from './letter-content.js';
import type { LetterSnapshot } from './letters.service.js';

const snapshot: LetterSnapshot = {
  employee: { id: 'staff-1', name: 'Asha Patel', employeeCode: 'BT-01', designation: 'Sales Executive', department: 'SALES', employmentType: 'FULL_TIME', workLocation: 'Vadodara', reportingManager: 'Sales Manager', joiningDate: '2026-10-01', email: 'asha@example.com', mobile: null, roleKeys: ['SALES_EXECUTIVE'], roleTrack: 'SALES' },
  company: { legalName: 'Bond Therapy Private Limited', displayName: 'Bond Therapy Professional', address: 'Vadodara, Gujarat', phone: '+91 78780 40050', email: 'hr@bondtherapy.co.in', website: 'bondtherapy.co.in', authorisedSignatory: 'Parth Patel', authorisedSignatoryDesignation: 'Authorised Signatory' },
};

describe('HR appointment content', () => {
  it('uses CRM company data and the sales clause library', () => {
    const content = buildLetterContent('APPOINTMENT', { name: 'Asha Patel', designation: 'Sales Executive', department: 'SALES' }, { designation: 'Sales Executive', department: 'Sales', joiningDate: '2026-10-01', employmentType: 'Full Time', workLocation: 'Vadodara', reportingManager: 'Sales Manager', probationMonths: '3', ctc: '600000', noticePeriod: 'As recorded in the employment terms' }, snapshot);
    expect(content.sections?.some((section) => section.title.includes('Sales and territory'))).toBe(true);
    expect(content.paragraphs.join(' ')).toContain('Bond Therapy Private Limited');
    expect(content.sections?.flatMap((section) => section.paragraphs).join(' ')).toContain('CRM records');
  });
});

describe('HR offer content', () => {
  it('uses employee-specific details without printing a salary breakdown', () => {
    const content = buildLetterContent('OFFER', { name: 'Asha Patel' }, { designation: 'Trainee', department: 'Export', workLocation: 'Mumbai HO', joiningDate: '2026-09-03', ctc: '600000' }, snapshot);
    expect(content.subject).toBe('Offer of Employment');
    expect(content.paragraphs.join(' ')).toContain('Trainee</strong> in <strong>Export</strong> at our <strong>Mumbai HO');
    expect(content.paragraphs.join(' ')).toContain('INR 6,00,000');
    expect(content.paragraphs.join(' ')).toContain('03 September 2026');
    expect(content.paragraphs.join(' ')).toContain('Congratulations once again!');
    expect(content.paragraphs.join(' ')).not.toContain('monthly gross');
  });
});
