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

describe('appointment letter PDF layout', () => {
  it('preserves the Word clauses, changes both joining dates, and puts the salary annexure last', () => {
    const data: LetterPdfData = {
      letterNumber: 'BT-HRL-2026-0002', type: 'APPOINTMENT', recipientName: 'Asha Patel', issuedDate: new Date('2026-10-19T12:00:00'),
      details: { appointmentTemplateVersion: 'WORD_2026', recipientAddress: 'Surat, Gujarat', designation: 'Sales Executive', department: 'Sales', joiningDate: '2026-10-01', workLocation: 'Surat', employmentType: 'Permanent', probationMonths: '3', noticeDuringProbation: '30 days', noticeAfterConfirmation: '2 months', reportingManager: 'Sales Manager', basicMonthly: '20000', basicAnnual: '240000', totalAMonthly: '20000', totalAAnnual: '240000', ctcMonthly: '20000', ctcAnnual: '240000' },
      snapshot: {
        employee: { id: null, name: 'Asha Patel', employeeCode: null, designation: 'Sales Executive', department: 'Sales', employmentType: 'Permanent', workLocation: 'Surat', reportingManager: 'Sales Manager', joiningDate: '2026-10-01', email: null, mobile: null, roleKeys: [], roleTrack: 'GENERAL' },
        company: { legalName: 'Treebond Cosmetics Pvt Ltd', displayName: 'Treebond Cosmetics Pvt Ltd', address: 'Plot No-146/1, GIDC Phase-2, Rajpipla, Dist-Narmada-393145', phone: '+91 7878040050', email: 'treebondcosmetics2025@gmail.com', website: 'bondtherapy.co.in', authorisedSignatory: 'Parth Patel', authorisedSignatoryDesignation: 'Director' },
      }, verificationToken: 'test', version: 1,
    };
    const html = renderLetterHtml(data);
    expect(html.match(/01-10-2026/g)).toHaveLength(3);
    expect(html).toContain('WORKING HOURS, WEEKLY OFF, OVERTIME AND LEAVE');
    expect(html).toContain('GRIEVANCE REDRESSAL AND DISPUTE RESOLUTION');
    expect(html).toContain('EMPLOYEE ACCEPTANCE');
    expect(html).toContain('Gross Earnings (A)');
    expect(html).toContain('Net Salary (A-B)');
    expect(html).toContain('CTC (A+C)');
    expect(html.indexOf('ANNEXURE A')).toBeGreaterThan(html.indexOf('EMPLOYEE ACCEPTANCE'));
    expect(html).toContain('Director<br>Treebond Cosmetics Pvt Ltd');
    expect(html).toContain('Your principal place of work shall be Surat.');
    expect(html).toContain('Your initial place of posting shall be Surat.');
    expect(html).not.toContain('Kairamya Journeys');
    expect(html).not.toMatch(/traveller|travel itineraries|booking information|full-time basis|six months|Three Months/);
    expect(html).toContain('salon and distributor details');
    expect(html).toContain('period of 3 months');
    expect(html).toContain('30 days');
    expect(html).toContain('2 months');
    expect(html).toContain('basis stated under Employment Type');
    expect(html).not.toContain('07.09.2026');
    data.details.noticePeriod = '45 days';
    data.details.uanEpfNumber = '001234567890';
    data.details.esicNumber = '0012345678';
    const updated = renderLetterHtml(data);
    expect(updated).toContain('<th>Notice period</th>');
    expect(updated).toContain('45 days');
    expect(updated).not.toContain('During probation</td>');
    expect(updated).not.toContain('After confirmation</td>');
    expect(updated).toContain('001234567890');
    expect(updated).toContain('0012345678');
    expect(updated).not.toContain('As applicable, subject to statutory eligibility and coverage.');
    data.details.uanEpfNumber = '<script>alert(1)</script>';
    expect(renderLetterHtml(data)).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    delete data.details.noticePeriod;
    data.details.joiningDate = '2026-11-05';
    expect(renderLetterHtml(data).match(/05-11-2026/g)).toHaveLength(3);
    delete data.details.probationMonths;
    delete data.details.noticeDuringProbation;
    delete data.details.noticeAfterConfirmation;
    const previouslySaved = renderLetterHtml(data);
    expect(previouslySaved).toContain('six months');
    expect(previouslySaved).toContain('Assistant Manager &amp; above');
    expect(previouslySaved).not.toContain('{{NOTICE_');
  });
});
