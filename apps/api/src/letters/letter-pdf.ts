import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { buildLetterContent } from './letter-content.js';
import type { LetterSnapshot } from './letters.service.js';
import {
  APPOINTMENT_SALARY_COMPONENTS,
  LETTER_CATEGORIES,
  LETTER_LABELS,
  SALARY_COMPONENTS,
  type LetterType,
} from './letter-types.js';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const moleculeBase64 = readFileSync(
  join(moduleDir, 'assets', 'bond-therapy-molecule.png'),
).toString('base64');
const wordmarkBase64 = readFileSync(
  join(moduleDir, 'assets', 'bond-therapy-wordmark.png'),
).toString('base64');
const signatureStampBase64 = readFileSync(
  join(moduleDir, 'assets', 'bond-therapy-signature-stamp.png'),
).toString('base64');
const manropeBase64 = readFileSync(
  join(
    process.cwd(),
    'node_modules',
    '@fontsource-variable',
    'manrope',
    'files',
    'manrope-latin-wght-normal.woff2',
  ),
).toString('base64');
const appointmentReference = JSON.parse(readFileSync(join(moduleDir, 'assets', 'appointment-reference.json'), 'utf8')) as Array<
  { kind: 'paragraph'; text: string } | { kind: 'table'; rows: string[][] }
>;

const COLORS = {
  ink: '#171918',
  text: '#363A38',
  muted: '#5F6965',
  faint: '#7E8783',
  border: '#D8DEDB',
  soft: '#F7F7F6',
  accent: '#171918',
};

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const dateFmt = (value: Date) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(value);

export type LetterPdfData = {
  letterNumber: string;
  type: LetterType;
  recipientName: string;
  recipientDesignation?: string | null;
  recipientDepartment?: string | null;
  issuedDate: Date;
  details: Record<string, string | undefined>;
  snapshot: LetterSnapshot;
  verificationToken: string;
  version: number;
  preview?: boolean;
};

type LetterContent = ReturnType<typeof buildLetterContent>;

const inr = (value?: string) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function compensationTable(details: LetterPdfData['details']) {
  const rows = SALARY_COMPONENTS.filter((item) => Number(details[`${item.key}Monthly`] || 0) > 0 || Number(details[`${item.key}Annual`] || 0) > 0);
  const part = (key: 'A' | 'B' | 'C', label: string) => `${rows.filter((item) => item.part === key).map((item) => `<tr><td>${escapeHtml(item.label)}</td><td class="num">${inr(details[`${item.key}Monthly`])}</td><td class="num">${inr(details[`${item.key}Annual`])}</td></tr>`).join('')}<tr class="total"><td>${label}</td><td class="num">${inr(details[`total${key}Monthly`])}</td><td class="num">${inr(details[`total${key}Annual`])}</td></tr>`;
  return `<table class="salary"><thead><tr><th>Salary component</th><th class="num">Monthly (INR)</th><th class="num">Annual (INR)</th></tr></thead><tbody>${part('A', 'Total Gross (A)')}${part('B', 'Total (B)')}${part('C', 'Total (C)')}<tr class="ctc"><td>Cost to Company (A + B + C)</td><td class="num">${inr(details.ctcMonthly)}</td><td class="num">${inr(details.ctcAnnual)}</td></tr></tbody></table>`;
}

function renderAppointmentHtml(data: LetterPdfData, content: LetterContent) {
  const sections = content.sections ?? [];
  const groups = [sections.slice(0, 4), sections.slice(4, 9), sections.slice(9)];
  const totalPages = groups.length;
  const company = data.snapshot.company;
  const phone = company.phone || '+91 78780 40050';
  const email = company.email || 'hr@bondtherapy.co.in';
  const website = company.website || 'bondtherapy.co.in';
  const employee = data.snapshot.employee;
  const header = `<header class="header"><div class="brand"><img src="data:image/png;base64,${moleculeBase64}"><img class="wordmark" src="data:image/png;base64,${wordmarkBase64}"></div><div class="doc"><b>Human Resources</b><span>${escapeHtml(data.letterNumber)}</span></div></header>`;
  const footer = (_page: number) => `<footer><div><b>${escapeHtml(company.legalName)}</b><span>${escapeHtml(company.address || 'Corporate HR & Administration')}</span><span>${escapeHtml(phone)} &nbsp;|&nbsp; ${escapeHtml(email)} &nbsp;|&nbsp; ${escapeHtml(website)}</span></div><div class="footer-right"><b>Official HR Document</b><span>${escapeHtml(data.letterNumber)}</span><span>Generated securely through Bond Therapy CRM</span></div></footer>`;
  const sectionHtml = (items: typeof sections, page: number) => items.map((section, index) => `<section class="clause"><h2>${section.title}</h2>${section.paragraphs.map((p) => `<p>${p}</p>`).join('')}${page === 2 && index === 0 ? compensationTable(data.details) : ''}</section>`).join('');
  const pages = groups.map((group, index) => `<main class="page">${data.preview ? '<div class="draft">DRAFT</div>' : ''}${header}${index === 0 ? `<div class="title"><span>Hiring / Human Resources</span><h1>Appointment Letter &amp;<br>Staff Employment Agreement</h1><div class="rule"></div></div><div class="employee"><div><small>Employee</small><strong>${escapeHtml(data.recipientName)}</strong><span>${escapeHtml(employee.employeeCode || 'Employee ID pending')}</span></div><div><small>Designation / Department</small><strong>${escapeHtml(data.recipientDesignation || '')}</strong><span>${escapeHtml(data.recipientDepartment || '')}</span></div><div><small>Document date</small><strong>${escapeHtml(dateFmt(data.issuedDate))}</strong><span>${escapeHtml(employee.workLocation || '')}</span></div></div><div class="subject"><b>Subject:</b> ${content.subject}</div><p class="intro">Dear ${escapeHtml(data.recipientName)},</p>${content.paragraphs.map((p) => `<p class="intro">${p}</p>`).join('')}` : `<div class="continuation"><span>Appointment Letter &amp; Staff Employment Agreement</span><b>${escapeHtml(data.recipientName)}</b></div>`}${sectionHtml(group, index + 1)}${index === totalPages - 1 ? `<div class="acceptance"><div><b>Employee acceptance</b><span>Name: ${escapeHtml(data.recipientName)}</span><span>Employee ID: ${escapeHtml(employee.employeeCode || '—')}</span><span>Signature: ____________________</span><span>Date: ____________________</span></div><div><img src="data:image/png;base64,${signatureStampBase64}"><b>${escapeHtml(company.authorisedSignatory)}</b><span>${escapeHtml(company.authorisedSignatoryDesignation)}</span><span>For ${escapeHtml(company.legalName)}</span></div></div>` : ''}${footer(index + 1)}</main>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${manropeBase64}) format('woff2');font-weight:200 800}@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff;color:${COLORS.text};font-family:Manrope,Arial,sans-serif;-webkit-font-smoothing:antialiased;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{position:relative;width:210mm;height:297mm;overflow:hidden;padding:12mm 14mm 33mm;page-break-after:always;background:#fff}.page:last-child{page-break-after:auto}.draft{position:absolute;z-index:4;left:0;right:0;top:130mm;transform:rotate(-25deg);text-align:center;font-size:44px;font-weight:800;letter-spacing:8px;color:rgba(23,25,24,.06)}.header{display:flex;align-items:center;justify-content:space-between;border-bottom:.28mm solid ${COLORS.border};padding-bottom:4mm}.brand{display:flex;align-items:center;gap:2.5mm}.brand img{width:10mm;height:10mm;object-fit:contain}.brand .wordmark{width:40mm;height:auto}.doc{text-align:right}.doc b,.doc span{display:block}.doc b{font-size:7.5px;letter-spacing:1.8px;text-transform:uppercase}.doc span{margin-top:1mm;font-size:8px;color:${COLORS.muted}}.title{margin-top:7mm}.title span{font-size:7px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase}.title h1{margin:2.5mm 0 0;font-size:22px;line-height:1.16;color:${COLORS.ink}}.rule{width:12mm;height:.7mm;margin-top:2.3mm;background:${COLORS.ink}}.employee{display:grid;grid-template-columns:1.1fr 1fr .9fr;gap:3mm;margin-top:5mm;padding:3.5mm;border:.28mm solid ${COLORS.border};border-radius:2mm;background:${COLORS.soft}}.employee small,.employee strong,.employee span{display:block}.employee small{font-size:6.5px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:${COLORS.muted}}.employee strong{margin-top:1.2mm;font-size:9.5px;color:${COLORS.ink}}.employee span{margin-top:.8mm;font-size:7.6px;color:${COLORS.muted}}.subject{margin-top:3mm;padding:2.6mm 3mm;border:.28mm solid ${COLORS.border};border-radius:1.6mm;text-align:center;font-size:9px}.intro{margin:3mm 0 0;font-size:9.1px;line-height:1.52}.continuation{display:flex;justify-content:space-between;margin:6mm 0 4mm;padding-bottom:3mm;border-bottom:.28mm solid ${COLORS.border};font-size:8px;color:${COLORS.muted}}.continuation b{color:${COLORS.ink}}.clause{margin-top:4.2mm;break-inside:avoid}.clause h2{margin:0 0 1.7mm;font-size:10px;color:${COLORS.ink}}.clause p{margin:0 0 1.8mm;font-size:8.8px;line-height:1.5}.salary{width:100%;margin-top:3mm;border:.32mm solid #979E9A;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:7.8px}.salary th,.salary td{border:0;border-right:.28mm solid #AAB0AD;border-bottom:.28mm solid #AAB0AD;padding:1.6mm 2mm}.salary th:last-child,.salary td:last-child{border-right:0}.salary tbody tr:last-child td{border-bottom:0}.salary th{background:#F1F3F2;text-align:left;font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}.salary th:first-child{width:46%}.salary .num{text-align:right;font-variant-numeric:tabular-nums}.salary .total{font-weight:750;background:#F8F9F8}.salary .ctc{font-weight:800;color:${COLORS.ink};background:#E9ECEA}.acceptance{display:grid;grid-template-columns:1fr 1fr;gap:18mm;margin-top:7mm;border-top:.28mm solid ${COLORS.border};padding-top:4mm}.acceptance div>*{display:block}.acceptance b{font-size:8.5px;color:${COLORS.ink}}.acceptance span{margin-top:1.6mm;font-size:7.6px}.acceptance img{width:24mm;height:24mm;object-fit:contain;margin-bottom:1mm}footer{position:absolute;left:14mm;right:14mm;bottom:7mm;display:flex;justify-content:space-between;gap:12mm;border-top:.28mm solid ${COLORS.border};padding-top:2.5mm;font-size:7px;line-height:1.6;color:${COLORS.muted}}footer b,footer span{display:block}footer b{font-size:7.4px;color:${COLORS.ink}}.footer-right{text-align:right}
</style></head><body>${pages}</body></html>`;
}

function renderAppointmentReferenceHtml(data: LetterPdfData) {
  const d = data.details;
  const company = data.snapshot.company;
  const employee = data.snapshot.employee;
  const date = (value?: string) => value ? `${value.slice(8, 10)}-${value.slice(5, 7)}-${value.slice(0, 4)}` : '';
  const text = (value: string) => escapeHtml(value
    .replaceAll('TREEBOND COSMETIC PVT LTD', company.legalName)
    .replaceAll('Kairamya Journeys LLP', company.legalName)
    .replaceAll('(Designation & Department)', `${d.designation} in the ${d.department} department`)
    .replaceAll('07.09.2026', date(d.joiningDate))
    .replaceAll("the Company's Office", d.workLocation || 'the Company office')
    .replaceAll("the Company's Head Office", d.workLocation || 'the Company head office')
    .replace(', address,', `, ${company.address},`));
  const values: Record<string, string> = {
    'Employee Name': data.recipientName,
    "Father's / Mother's Name": d.parentName || '—',
    'Employee Code': d.employeeCode || employee.employeeCode || 'To be assigned',
    'Designation': d.designation || '',
    'Department / Function': d.department || '',
    'Employment Type': d.employmentType || '',
    'Date of Joining': date(d.joiningDate),
    'Place of Posting': d.workLocation || '',
    'Reporting To': d.reportingManager || '',
    'Date of Birth': d.dateOfBirth ? date(d.dateOfBirth) : 'As maintained in HR records',
  };
  const salarySum = (part: 'A' | 'B' | 'C', period: 'Monthly' | 'Annual') => APPOINTMENT_SALARY_COMPONENTS.filter((item) => item.part === part).reduce((sum, item) => sum + (Number(d[`${item.key}${period}`]) || 0), 0);
  const moneyCell = (value: number) => `₹ ${inr(String(value))}`;
  const salaryRow = (label: string, monthly: number, annual: number, className = '') => `<tr class="${className}"><td>${escapeHtml(label)}</td><td class="num">${moneyCell(monthly)}</td><td class="num">${moneyCell(annual)}</td></tr>`;
  const salary = `<table class="document-table salary-table"><thead><tr><th>Particulars</th><th class="num">Per Month (₹)</th><th class="num">Annual (₹)</th></tr></thead><tbody>${(['A', 'B', 'C'] as const).map((part) => `<tr class="group"><td colspan="3">${part === 'A' ? 'A. Earnings' : part === 'B' ? 'B. Employee Deductions' : 'C. Employer Contributions / Benefits'}</td></tr>${APPOINTMENT_SALARY_COMPONENTS.filter((item) => item.part === part && (Number(d[`${item.key}Monthly`]) > 0 || Number(d[`${item.key}Annual`]) > 0)).map((item) => salaryRow(item.label, Number(d[`${item.key}Monthly`]) || 0, Number(d[`${item.key}Annual`]) || 0)).join('')}${salaryRow(part === 'A' ? 'Gross Earnings (A)' : part === 'B' ? 'Total Deductions (B)' : 'Employer Contributions / Benefits (C)', salarySum(part, 'Monthly'), salarySum(part, 'Annual'), 'total')}${part === 'B' ? salaryRow('Net Salary (A-B)', salarySum('A', 'Monthly') - salarySum('B', 'Monthly'), salarySum('A', 'Annual') - salarySum('B', 'Annual'), 'total') : ''}`).join('')}${salaryRow('CTC (A+C)', salarySum('A', 'Monthly') + salarySum('C', 'Monthly'), salarySum('A', 'Annual') + salarySum('C', 'Annual'), 'ctc')}</tbody></table>`;
  const stamp = `<div class="signatory"><p>For, ${escapeHtml(company.legalName)}</p><img src="data:image/png;base64,${signatureStampBase64}" alt="Bond Therapy stamp and authorised signature"><div class="signature-line"></div><strong>${escapeHtml(company.authorisedSignatory)}</strong><span>${escapeHtml(company.authorisedSignatoryDesignation)}<br>${escapeHtml(company.displayName)}</span><small>Electronically generated and authorised through Bond Therapy CRM.</small></div>`;
  const blocks = appointmentReference.slice(4).map((block) => {
    if (block.kind === 'table') {
      if (block.rows[0]?.[0] === 'Particulars') return salary;
      const rows = block.rows.map((row, index) => `<tr>${row.map((cell, column) => {
        const value = block.rows[0]?.[0] === 'Particular' && column === 1 && index > 0 ? (values[row[0]] || cell) : cell;
        return index === 0 ? `<th>${text(value)}</th>` : `<td>${text(value)}</td>`;
      }).join('')}</tr>`).join('');
      return `<table class="document-table"><tbody>${rows}</tbody></table>`;
    }
    const line = block.text;
    if (line === 'For TREEBOND COSMETIC PVT LTD') return stamp;
    if (line === 'For Kairamya Journeys LLP' || line === 'Authorised Signatory') return '';
    if (line === 'EMPLOYEE ACCEPTANCE') return `<h2>${text(line)}</h2>`;
    if (line.startsWith('I, (Name),')) return `<p>${text(line.replace('(Name)', data.recipientName))}</p>`;
    if (line === 'Employee Name:') return `<p>Employee Name: ${escapeHtml(data.recipientName)}</p>`;
    if (line === 'ANNEXURE A – SALARY BREAK-UP') return `<h2 class="annexure-title">${text(line)}</h2>`;
    if (line === 'Note: Statutory contributions, deductions and benefits shall be calculated and applied as per prevailing law and the employee\'s eligibility.') return `<p class="annexure-note">${text(line)}</p>${stamp}`;
    if (line === line.toUpperCase() && /[A-Z]/.test(line)) return `<h2>${text(line)}</h2>`;
    if (line.startsWith('Termination for Misconduct\t') || line.startsWith('Suspension Pending Inquiry\t') || line.startsWith('Termination for Business Reasons\t') || line.startsWith('Exit Formalities and Final Settlement\t') || line.startsWith('Recovery of Loss or Damage\t') || line.startsWith('Retirement / Superannuation\t')) {
      const [heading, ...rest] = line.split('\t');
      return `<p><strong>${text(heading)}</strong><br>${text(rest.join('\t'))}</p>`;
    }
    return `<p>${text(line)}</p>`;
  }).join('');
  const icons = {
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  };
  const contact = (icon: string, value: string) => `<span class="contact-item"><b class="contact-icon"><svg viewBox="0 0 24 24">${icon}</svg></b>${escapeHtml(value)}</span>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${manropeBase64}) format('woff2');font-weight:200 800;font-display:block}
body{font-size:11px!important;line-height:1.5!important}.print-page{position:relative}.document-table{font-size:9.5px!important}.document-table th,.document-table td{padding:1.35mm 2mm!important}.signatory small{font-size:7.6px!important}.annexure{break-inside:avoid}
@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Manrope,Arial,sans-serif;color:${COLORS.text};font-size:10.1px;line-height:1.52;-webkit-print-color-adjust:exact;print-color-adjust:exact}header,footer{display:none}.print-page{width:210mm;height:297mm;padding:12mm 14mm 8mm;display:flex;flex-direction:column;overflow:hidden;page-break-after:always}.print-page:last-child{page-break-after:auto}.print-page>header{display:flex;position:static;flex:0 0 13mm;margin-bottom:5mm;align-items:center;justify-content:space-between;border-bottom:.28mm solid ${COLORS.border};padding-bottom:3mm}.print-page>footer{display:block;position:static;flex:0 0 22mm;margin-top:5mm}.print-content{min-height:0;flex:1;overflow:hidden}.brand-lockup{display:flex;align-items:center;gap:2.6mm}.brand-molecule{width:10.2mm;height:10.7mm;object-fit:contain}.brand-wordmark{width:40mm;height:auto;object-fit:contain}.document-id{text-align:right}.document-department{font-size:7.8px;font-weight:720;letter-spacing:2.15px;text-transform:uppercase;color:${COLORS.faint}}.document-number{margin-top:1.7mm;font-size:10px;font-weight:750;color:${COLORS.ink}}
footer{position:fixed;bottom:-27mm;left:0;right:0;height:24mm}.contact-row{display:grid;grid-template-columns:1fr 1.18fr 1fr;align-items:center;border-bottom:.28mm solid ${COLORS.border};padding-bottom:2.5mm;font-size:8px;font-weight:590;color:${COLORS.muted}}.contact-item{display:flex;align-items:center;gap:1.7mm}.contact-item:nth-child(2){justify-content:center}.contact-item:nth-child(3){justify-content:flex-end}.contact-icon{display:block;width:4.1mm;height:4.1mm;flex:0 0 auto;color:${COLORS.ink}}.contact-icon svg{display:block;width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.footer-meta{display:flex;align-items:flex-start;justify-content:space-between;gap:12mm;margin-top:2.8mm}.footer-company{font-size:8.6px;font-weight:760;color:${COLORS.ink}}.footer-address{margin-top:1mm;font-size:7.3px;line-height:1.45;color:${COLORS.muted}}.footer-document{text-align:right;font-size:7.2px;line-height:1.55;color:${COLORS.muted}}.footer-document strong{display:block;font-size:7.5px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:${COLORS.ink}}
h1{margin:0 0 3mm;color:${COLORS.ink};font-size:22px;line-height:1.2}h2{margin:5mm 0 2mm;color:${COLORS.ink};font-size:10.3px;line-height:1.3;break-after:avoid}p{margin:0 0 2.5mm;orphans:2;widows:2}p strong{font-weight:750;color:${COLORS.ink}}.eyebrow{font-size:7.1px;font-weight:760;letter-spacing:1.9px;text-transform:uppercase;color:${COLORS.ink}}.rule{width:11mm;height:.7mm;margin:2mm 0 4mm;background:${COLORS.ink}}.recipient-panel{border:.28mm solid ${COLORS.border};border-radius:2mm;padding:3mm 4mm;background:#F5F7F6;break-inside:avoid}.reference-row{display:flex;justify-content:space-between;color:${COLORS.muted}}.reference-row strong{color:${COLORS.ink}}.recipient{margin-top:2.5mm;padding-top:2mm;border-top:.28mm solid ${COLORS.border}}.recipient strong{display:block;font-size:11px;color:${COLORS.ink}}.subject{margin:3mm 0;padding:2.5mm;border:.28mm solid ${COLORS.border};border-radius:2mm;background:${COLORS.soft};text-align:center;font-weight:700;color:${COLORS.ink}}.document-table{width:100%;margin:2mm 0 3mm;border:.28mm solid ${COLORS.border};border-collapse:collapse;table-layout:fixed;font-size:8.2px;break-inside:auto}.document-table tr{break-inside:avoid}.document-table th,.document-table td{border:.28mm solid ${COLORS.border};padding:1.3mm 2mm;text-align:left;vertical-align:middle}.document-table th{background:#F1F3F2;color:${COLORS.ink};font-weight:750}.document-table .num{text-align:right;font-variant-numeric:tabular-nums}.document-table .group td{background:#F5F7F6;font-weight:750;color:${COLORS.ink}}.document-table .total td{background:#F8F9F8;font-weight:700}.document-table .ctc td{background:#E9ECEA;font-weight:800;color:${COLORS.ink}}.salary-table th:first-child{width:53%}.annexure-title{margin-top:5mm}.annexure-note{margin-top:2mm}.signatory{width:65mm;margin:5mm 0 6mm;break-inside:avoid}.signatory p{margin:0 0 1.8mm}.signatory img{display:block;width:22mm;height:22mm;object-fit:contain;margin-left:1mm}.signature-line{width:62mm;border-top:.3mm solid ${COLORS.border}}.signatory strong,.signatory span,.signatory small{display:block}.signatory strong{margin-top:1.8mm;color:${COLORS.ink}}.signatory span{margin-top:.5mm;font-size:8px;color:${COLORS.muted}}.signatory small{margin-top:1.2mm;font-size:6.7px;color:${COLORS.faint}}.draft{position:absolute;top:45%;left:0;right:0;transform:rotate(-25deg);text-align:center;font-size:42px;font-weight:800;letter-spacing:8px;color:rgba(23,25,24,.06)}
</style></head><body>${data.preview ? '<div class="draft">DRAFT</div>' : ''}<header><div class="brand-lockup"><img class="brand-molecule" src="data:image/png;base64,${moleculeBase64}"><img class="brand-wordmark" src="data:image/png;base64,${wordmarkBase64}"></div><div class="document-id"><div class="document-department">Human Resources</div><div class="document-number">${escapeHtml(data.letterNumber)}</div></div></header><footer><div class="contact-row">${contact(icons.phone, company.phone)}${contact(icons.mail, company.email)}${contact(icons.globe, company.website)}</div><div class="footer-meta"><div><div class="footer-company">${escapeHtml(company.legalName)}</div><div class="footer-address">${escapeHtml(company.address)}</div></div><div class="footer-document"><strong>Official HR Document</strong>${escapeHtml(data.letterNumber)}<br>Generated securely through Bond Therapy CRM</div></div></footer><main><div class="eyebrow">Hiring / Human Resources</div><h1>Appointment Letter</h1><div class="rule"></div><div class="recipient-panel"><div class="reference-row"><span>Ref: <strong>${escapeHtml(data.letterNumber)}</strong></span><span>Date: <strong>${escapeHtml(dateFmt(data.issuedDate))}</strong></span></div><div class="recipient"><small>To,</small><strong>${escapeHtml(data.recipientName)}</strong>${escapeHtml(d.recipientAddress || '').replaceAll('\n', '<br>')}</div></div><div class="subject">Subject: Appointment Letter for the Position of ${escapeHtml(d.designation)}</div><p>Dear ${escapeHtml(data.recipientName)},</p>${blocks}</main></body></html>`;
}


export function renderLetterHtml(data: LetterPdfData): string {
  data.snapshot.company.phone ||= '+91 78780 40050';
  data.snapshot.company.email ||= 'hr@bondtherapy.co.in';
  data.snapshot.company.website ||= 'bondtherapy.co.in';
  const content = buildLetterContent(
    data.type,
    {
      name: data.recipientName,
      designation: data.recipientDesignation,
      department: data.recipientDepartment,
    },
    data.details,
    data.snapshot,
  );
  if (data.type === 'APPOINTMENT') return data.details.appointmentTemplateVersion === 'WORD_2026' ? renderAppointmentReferenceHtml(data) : renderAppointmentHtml(data, content);
  const { subject, paragraphs } = content;
  const label = LETTER_LABELS[data.type];
  const category = LETTER_CATEGORIES[data.type];
  const recipientMeta = [data.recipientDesignation, data.recipientDepartment]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' | ');
  const salutationName = escapeHtml(data.recipientName.trim());
  const recipientDetails = data.type === 'OFFER'
    ? escapeHtml(data.details.recipientAddress?.trim() || '').replaceAll('\n', '<br>')
    : `${recipientMeta || 'Recipient'}<br>Bond Therapy Professional`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${manropeBase64}) format('woff2');font-weight:200 800;font-style:normal;font-display:block}
@page{size:A4;margin:0}*{box-sizing:border-box}html,body{width:210mm;min-height:297mm;margin:0;padding:0;background:#fff}
body{color:${COLORS.text};font-family:Manrope,Arial,sans-serif;text-rendering:geometricPrecision;-webkit-font-smoothing:antialiased;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{position:relative;width:210mm;height:297mm;overflow:hidden;padding:12mm 14mm 38mm;background:#fff}
.watermark{position:absolute;z-index:0;left:77mm;top:122mm;width:56mm;height:58mm;object-fit:contain;opacity:.025;filter:grayscale(1)}
.header,.letter-head,.letter-body{position:relative;z-index:1}.header{display:flex;min-height:18mm;align-items:center;justify-content:space-between;gap:10mm;border-bottom:.28mm solid ${COLORS.border};padding:0 0 4.5mm}
.brand-lockup{display:flex;align-items:center;gap:2.6mm}.brand-molecule{display:block;width:10.2mm;height:10.7mm;object-fit:contain;image-rendering:auto}.brand-wordmark{display:block;width:40mm;height:auto;object-fit:contain;image-rendering:auto}
.document-id{min-width:53mm;text-align:right}.document-department{font-size:7.8px;font-weight:720;letter-spacing:2.15px;text-transform:uppercase;color:${COLORS.faint}}.document-number{margin-top:1.7mm;font-size:10px;font-weight:750;letter-spacing:.2px;color:${COLORS.ink}}
.letter-head{margin-top:8mm}.eyebrow-row{display:flex;align-items:center;justify-content:space-between;gap:8mm}.eyebrow{font-size:7.1px;font-weight:760;letter-spacing:1.9px;text-transform:uppercase;color:${COLORS.accent}}.confidential{font-size:6.8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${COLORS.faint}}
h1{margin:3.2mm 0 0;color:${COLORS.ink};font-size:23px;font-weight:700;line-height:1.14;letter-spacing:-.65px}.title-rule{width:11mm;height:.7mm;margin-top:2.3mm;border-radius:9px;background:${COLORS.accent}}
.recipient-panel{margin-top:5.8mm;border:.28mm solid ${COLORS.border};border-radius:2.2mm;padding:3.6mm 4mm 3.8mm;background:#F5F7F6}.reference-row{display:grid;grid-template-columns:1fr auto;align-items:center;font-size:9.5px;line-height:1.35;color:${COLORS.muted}}.reference-row strong{color:${COLORS.ink};font-weight:730}.recipient{margin-top:3.4mm;border-top:.28mm solid ${COLORS.border};padding-top:3.2mm}.recipient-label{margin-bottom:1.3mm;font-size:7.8px;font-weight:740;letter-spacing:1.35px;text-transform:uppercase;color:${COLORS.muted}}.recipient-name{font-size:12.8px;font-weight:760;line-height:1.25;letter-spacing:-.015em;color:${COLORS.ink}}.recipient-meta{min-height:3.8mm;margin-top:.9mm;font-size:9.4px;line-height:1.48;color:${COLORS.muted}}
.subject{display:flex;align-items:center;justify-content:center;gap:2.3mm;margin-top:4.6mm;border:.28mm solid ${COLORS.border};border-radius:2.4mm;padding:3mm 4mm;background:${COLORS.soft};font-size:10.2px;line-height:1.35;letter-spacing:-.008em;text-align:center}.subject-label{font-size:8px;font-weight:800;letter-spacing:.9px;text-transform:uppercase;color:${COLORS.accent}}.subject-value{font-weight:700;color:${COLORS.ink}}
.letter-body{margin-top:5.2mm;font-size:10.15px;font-weight:450;line-height:1.6;letter-spacing:-.008em;word-spacing:.035em;color:#292E2C}.letter-body p{margin:0 0 3.2mm;orphans:3;widows:3}.letter-body strong{font-weight:740;letter-spacing:-.012em;color:${COLORS.ink}}.letter-body .salutation{margin-bottom:3.8mm;font-weight:620;color:${COLORS.ink}}
.offer-letter .letter-body{margin-top:4.5mm;font-size:10.15px;line-height:1.6}.offer-letter .letter-body p{margin-bottom:2.8mm}.offer-letter .letter-body .salutation{margin-bottom:3mm}.offer-letter .signatory{margin-top:4mm}.offer-letter .signature-stamp{width:22mm;height:22mm}
.signatory{position:relative;z-index:1;margin-top:7.5mm;min-height:30mm}.sign-copy{width:64mm}.closing{margin:0 0 1.8mm;font-size:9.2px;letter-spacing:-.005em;color:${COLORS.text}}.signature-stamp{display:block;width:25mm;height:25mm;margin-left:1mm;object-fit:contain;image-rendering:auto}.signature-line{width:62mm;border-top:.3mm solid ${COLORS.border}}.sign-name{margin-top:1.8mm;font-size:9.7px;font-weight:760;letter-spacing:-.01em;color:${COLORS.ink}}.sign-role{margin-top:.45mm;font-size:8px;line-height:1.42;letter-spacing:.005em;color:${COLORS.muted}}.digital-note{margin-top:1.2mm;font-size:6.7px;letter-spacing:.005em;color:${COLORS.faint}}
.footer{position:absolute;z-index:1;left:14mm;right:14mm;bottom:8mm}.contact-row{display:grid;grid-template-columns:1fr 1.18fr 1fr;align-items:center;border-bottom:.28mm solid ${COLORS.border};padding-bottom:3mm;font-size:8px;font-weight:590;color:${COLORS.muted}}.contact-item{display:flex;align-items:center;gap:1.7mm}.contact-row .contact-item:nth-child(2){justify-content:center}.contact-row .contact-item:nth-child(3){justify-content:flex-end}.contact-icon{display:block;width:4.1mm;height:4.1mm;flex:0 0 auto;color:${COLORS.ink}}.contact-icon svg{display:block;width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.footer-meta{display:flex;align-items:flex-start;justify-content:space-between;gap:12mm;margin-top:3.2mm}.footer-company{font-size:8.6px;font-weight:760;color:${COLORS.ink}}.footer-address{margin-top:1mm;font-size:7.3px;line-height:1.52;color:${COLORS.muted}}.footer-document{text-align:right;font-size:7.2px;line-height:1.65;color:${COLORS.muted}}.footer-document strong{display:block;margin-bottom:.75mm;font-size:7.5px;font-weight:800;letter-spacing:.7px;line-height:1.2;text-transform:uppercase;color:${COLORS.ink}}
</style></head><body><main class="sheet${data.type === 'OFFER' ? ' offer-letter' : ''}">
${data.preview ? '<div style="position:absolute;inset:126mm 0 auto;z-index:5;transform:rotate(-25deg);text-align:center;font-size:42px;font-weight:800;letter-spacing:8px;color:rgba(23,25,24,.06)">DRAFT</div>' : ''}<img class="watermark" src="data:image/png;base64,${moleculeBase64}" alt="">
<header class="header"><div class="brand-lockup" aria-label="Bond Therapy Professional"><img class="brand-molecule" src="data:image/png;base64,${moleculeBase64}" alt=""><img class="brand-wordmark" src="data:image/png;base64,${wordmarkBase64}" alt="Bond Therapy Professional"></div><div class="document-id"><div class="document-department">Human Resources</div><div class="document-number">${escapeHtml(data.letterNumber)}</div></div></header>
<section class="letter-head"><div class="eyebrow-row"><div class="eyebrow">${escapeHtml(category)} / Human Resources</div><div class="confidential">Private &amp; Confidential</div></div><h1>${escapeHtml(label)}</h1><div class="title-rule"></div><div class="recipient-panel"><div class="reference-row"><div>Ref:&nbsp; <strong>${escapeHtml(data.letterNumber)}</strong></div><div>Date:&nbsp; <strong>${escapeHtml(dateFmt(data.issuedDate))}</strong></div></div><div class="recipient"><div class="recipient-label">To,</div><div class="recipient-name">${escapeHtml(data.recipientName)}</div>${recipientDetails ? `<div class="recipient-meta">${recipientDetails}</div>` : ''}</div></div><div class="subject"><div class="subject-label">Subject:</div><div class="subject-value">${subject}</div></div></section>
<section class="letter-body"><p class="salutation">Dear ${salutationName},</p>${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')}</section>
<section class="signatory"><div class="sign-copy"><p class="closing">${data.type === 'OFFER' ? `For, ${escapeHtml(data.snapshot.company.legalName)}` : 'Warm regards,'}</p><img class="signature-stamp" src="data:image/png;base64,${signatureStampBase64}" alt="Bond Therapy stamp and authorised signature"><div class="signature-line"></div><div class="sign-name">${escapeHtml(data.snapshot.company.authorisedSignatory)}</div><div class="sign-role">${escapeHtml(data.snapshot.company.authorisedSignatoryDesignation)}<br>${escapeHtml(data.snapshot.company.displayName)}</div><div class="digital-note">Electronically generated and authorised through Bond Therapy CRM.</div></div></section>
<footer class="footer"><div class="contact-row"><span class="contact-item"><b class="contact-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92Z"/></svg></b>${escapeHtml(data.snapshot.company.phone)}</span><span class="contact-item"><b class="contact-icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></b>${escapeHtml(data.snapshot.company.email)}</span><span class="contact-item"><b class="contact-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg></b>${escapeHtml(data.snapshot.company.website)}</span></div><div class="footer-meta"><div><div class="footer-company">${escapeHtml(data.snapshot.company.legalName)}</div><div class="footer-address">${escapeHtml(data.snapshot.company.address || 'Corporate HR & Administration')}</div></div><div class="footer-document"><strong>Official HR Document</strong>${escapeHtml(data.letterNumber)}<br>Generated securely through Bond Therapy CRM</div></div></footer>
</main></body></html>`;
}

let browserPromise: ReturnType<typeof puppeteer.launch> | null = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--font-render-hinting=none',
      ],
      timeout: 60_000,
    });
    browserPromise.catch(() => {
      browserPromise = null;
    });
  }
  return browserPromise;
}

export async function renderLetterPdf(data: LetterPdfData): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(renderLetterHtml(data), {
      waitUntil: 'domcontentloaded',
    });
    await page.evaluateHandle('document.fonts.ready');
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images).map((image) =>
          image.complete
            ? Promise.resolve()
            : new Promise<void>((resolve, reject) => {
                image.addEventListener('load', () => resolve(), { once: true });
                image.addEventListener('error', () => reject(), { once: true });
              }),
        ),
      ),
    );
    const appointment = data.type === 'APPOINTMENT' && data.details.appointmentTemplateVersion === 'WORD_2026';
    if (appointment) await page.evaluate(() => {
      const source = document.querySelector('main');
      const header = document.querySelector('header');
      const footer = document.querySelector('footer');
      if (!source || !header || !footer) throw new Error('Appointment letter layout is incomplete.');
      const annexureTitle = source.querySelector('.annexure-title');
      if (annexureTitle) {
        const annexure = document.createElement('section');
        annexure.className = 'annexure';
        source.insertBefore(annexure, annexureTitle);
        while (annexure.nextSibling) annexure.append(annexure.nextSibling);
      }
      const blocks = Array.from(source.children);
      const draft = document.querySelector('.draft');
      document.body.replaceChildren();
      let content: HTMLElement;
      const newPage = () => {
        const sheet = document.createElement('section');
        sheet.className = 'print-page';
        if (draft) sheet.append(draft.cloneNode(true));
        sheet.append(header.cloneNode(true));
        content = document.createElement('div');
        content.className = 'print-content';
        sheet.append(content, footer.cloneNode(true));
        document.body.append(sheet);
      };
      newPage();
      for (const block of blocks) {
        content!.append(block);
        if (content!.scrollHeight <= content!.clientHeight + 1) continue;
        content!.removeChild(block);
        const heading = content!.lastElementChild?.tagName === 'H2' ? content!.lastElementChild : null;
        if (heading) content!.removeChild(heading);
        newPage();
        if (heading) content!.append(heading);
        content!.append(block);
        if (content!.scrollHeight > content!.clientHeight + 1) throw new Error('Appointment letter content cannot fit on a page.');
      }
    });
    await page.emulateMediaType('print');
    const fits = data.type === 'APPOINTMENT' || await page.evaluate(() => {
      const signatory = document
        .querySelector('.signatory')
        ?.getBoundingClientRect();
      const footer = document.querySelector('.footer')?.getBoundingClientRect();
      return Boolean(
        signatory && footer && signatory.bottom <= footer.top - 10,
      );
    });
    if (!fits)
      throw new Error(
        'Letter content exceeds the one-page layout. Shorten the free-text fields and try again.',
      );
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
