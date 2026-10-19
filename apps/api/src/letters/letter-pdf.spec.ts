import { describe, expect, it } from 'vitest';
import { renderLetterHtml, type LetterPdfData } from './letter-pdf.js';

describe('offer letter PDF layout', () => {
  it('shows the offer content and Treebond footer without a salary table or GST', () => {
    const data: LetterPdfData = {
      letterNumber: 'BT-HRL-2026-0001', type: 'OFFER', recipientName: 'Asha Patel',
      issuedDate: new Date('2026-08-24T12:00:00'),
      details: { recipientAddress: 'Mumbai, Maharashtra', designation: 'Trainee', department: 'Export', workLocation: 'Mumbai HO', joiningDate: '2026-09-03', ctc: '600000' },
      snapshot: {
        employee: { id: null, name: 'Asha Patel', employeeCode: null, designation: null, department: null, employmentType: null, workLocation: null, reportingManager: null, joiningDate: null, email: null, mobile: null, roleKeys: [], roleTrack: 'GENERAL' },
        company: { legalName: 'Treebond Cosmetics Pvt Ltd', displayName: 'Treebond Cosmetics Pvt Ltd', address: 'Plot No-146/1, GIDC Phase-2, Rajpipla, Dist-Narmada-393145', phone: '+91 7878040050', email: 'treebondcosmetics2025@gmail.com', website: 'bondtherapy.co.in', authorisedSignatory: 'Parth Patel', authorisedSignatoryDesignation: 'Director' },
      },
      verificationToken: 'test', version: 1,
    };
    const html = renderLetterHtml(data);
    expect(html).toContain('Mumbai, Maharashtra');
    expect(html).toContain('For, Treebond Cosmetics Pvt Ltd');
    expect(html).toContain('Director<br>Treebond Cosmetics Pvt Ltd');
    expect(html).toContain('treebondcosmetics2025@gmail.com');
    expect(html).not.toContain('offer-compensation');
    expect(html).not.toContain('<table');
    expect(html.replace(/data:[^"']+/g, '')).not.toContain('GST');
  });
});
