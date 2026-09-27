import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { buildLetterContent } from './letter-content.js';
import type { LetterSnapshot } from './letters.service.js';
import {
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
  return `<table class="salary"><thead><tr><th>Salary component</th><th>Monthly (INR)</th><th>Annual (INR)</th></tr></thead><tbody>${part('A', 'Total Gross (A)')}${part('B', 'Total (B)')}${part('C', 'Total (C)')}<tr class="ctc"><td>Cost to Company (A + B + C)</td><td class="num">${inr(details.ctcMonthly)}</td><td class="num">${inr(details.ctcAnnual)}</td></tr></tbody></table>`;
}

function renderAppointmentHtml(data: LetterPdfData, content: LetterContent) {
  const sections = content.sections ?? [];
  const groups = [sections.slice(0, 4), sections.slice(4, 9), sections.slice(9)];
  const totalPages = groups.length;
  const company = data.snapshot.company;
  const employee = data.snapshot.employee;
  const header = `<header class="header"><div class="brand"><img src="data:image/png;base64,${moleculeBase64}"><img class="wordmark" src="data:image/png;base64,${wordmarkBase64}"></div><div class="doc"><b>Human Resources</b><span>${escapeHtml(data.letterNumber)} · v${data.version}</span></div></header>`;
  const footer = (page: number) => `<footer><div><b>${escapeHtml(company.legalName)}</b><span>${escapeHtml(company.address)}</span><span>${[company.phone, company.email, company.website].filter(Boolean).map(escapeHtml).join(' | ')}</span></div><div class="footer-right"><b>Official HR Document</b><span>${escapeHtml(data.letterNumber)} · Page ${page} of ${totalPages}</span><span>Verify: /verify/${escapeHtml(data.verificationToken)}</span></div></footer>`;
  const sectionHtml = (items: typeof sections, page: number) => items.map((section, index) => `<section class="clause"><h2>${section.title}</h2>${section.paragraphs.map((p) => `<p>${p}</p>`).join('')}${page === 2 && index === 0 ? compensationTable(data.details) : ''}</section>`).join('');
  const pages = groups.map((group, index) => `<main class="page">${data.preview ? '<div class="draft">DRAFT</div>' : ''}${header}${index === 0 ? `<div class="title"><span>Hiring / Human Resources</span><h1>Appointment Letter &amp;<br>Staff Employment Agreement</h1><div class="rule"></div></div><div class="employee"><div><small>Employee</small><strong>${escapeHtml(data.recipientName)}</strong><span>${escapeHtml(employee.employeeCode || 'Employee ID pending')}</span></div><div><small>Designation / Department</small><strong>${escapeHtml(data.recipientDesignation || '')}</strong><span>${escapeHtml(data.recipientDepartment || '')}</span></div><div><small>Document date</small><strong>${escapeHtml(dateFmt(data.issuedDate))}</strong><span>${escapeHtml(employee.workLocation || '')}</span></div></div><div class="subject"><b>Subject:</b> ${content.subject}</div><p class="intro">Dear ${escapeHtml(data.recipientName)},</p>${content.paragraphs.map((p) => `<p class="intro">${p}</p>`).join('')}` : `<div class="continuation"><span>Appointment Letter &amp; Staff Employment Agreement</span><b>${escapeHtml(data.recipientName)}</b></div>`}${sectionHtml(group, index + 1)}${index === totalPages - 1 ? `<div class="acceptance"><div><b>Employee acceptance</b><span>Name: ${escapeHtml(data.recipientName)}</span><span>Employee ID: ${escapeHtml(employee.employeeCode || '—')}</span><span>Signature: ____________________</span><span>Date: ____________________</span></div><div><img src="data:image/png;base64,${signatureStampBase64}"><b>${escapeHtml(company.authorisedSignatory)}</b><span>${escapeHtml(company.authorisedSignatoryDesignation)}</span><span>For ${escapeHtml(company.legalName)}</span></div></div>` : ''}${footer(index + 1)}</main>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${manropeBase64}) format('woff2');font-weight:200 800}@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff;color:${COLORS.text};font-family:Manrope,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{position:relative;width:210mm;height:297mm;overflow:hidden;padding:12mm 14mm 33mm;page-break-after:always;background:#fff}.page:last-child{page-break-after:auto}.draft{position:absolute;z-index:4;left:0;right:0;top:130mm;transform:rotate(-25deg);text-align:center;font-size:44px;font-weight:800;letter-spacing:8px;color:rgba(23,25,24,.06)}.header{display:flex;align-items:center;justify-content:space-between;border-bottom:.28mm solid ${COLORS.border};padding-bottom:4mm}.brand{display:flex;align-items:center;gap:2.5mm}.brand img{width:10mm;height:10mm;object-fit:contain}.brand .wordmark{width:40mm;height:auto}.doc{text-align:right}.doc b,.doc span{display:block}.doc b{font-size:7.5px;letter-spacing:1.8px;text-transform:uppercase}.doc span{margin-top:1mm;font-size:8px;color:${COLORS.muted}}.title{margin-top:7mm}.title span{font-size:7px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase}.title h1{margin:2.5mm 0 0;font-size:22px;line-height:1.16;color:${COLORS.ink}}.rule{width:12mm;height:.7mm;margin-top:2.3mm;background:${COLORS.ink}}.employee{display:grid;grid-template-columns:1.1fr 1fr .9fr;gap:3mm;margin-top:5mm;padding:3.5mm;border:.28mm solid ${COLORS.border};border-radius:2mm;background:${COLORS.soft}}.employee small,.employee strong,.employee span{display:block}.employee small{font-size:6.5px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:${COLORS.muted}}.employee strong{margin-top:1.2mm;font-size:9.5px;color:${COLORS.ink}}.employee span{margin-top:.8mm;font-size:7.6px;color:${COLORS.muted}}.subject{margin-top:3mm;padding:2.6mm 3mm;border:.28mm solid ${COLORS.border};border-radius:1.6mm;text-align:center;font-size:9px}.intro{margin:3mm 0 0;font-size:9.1px;line-height:1.52}.continuation{display:flex;justify-content:space-between;margin:6mm 0 4mm;padding-bottom:3mm;border-bottom:.28mm solid ${COLORS.border};font-size:8px;color:${COLORS.muted}}.continuation b{color:${COLORS.ink}}.clause{margin-top:4.2mm;break-inside:avoid}.clause h2{margin:0 0 1.7mm;font-size:10px;color:${COLORS.ink}}.clause p{margin:0 0 1.8mm;font-size:8.8px;line-height:1.5}.salary{width:100%;margin-top:3mm;border-collapse:collapse;font-size:7.8px}.salary th,.salary td{border:.25mm solid ${COLORS.border};padding:1.6mm 2mm}.salary th{background:${COLORS.soft};text-align:left;font-size:7px;text-transform:uppercase;letter-spacing:.5px}.salary .num{text-align:right}.salary .total{font-weight:700;background:#fafafa}.salary .ctc{font-weight:800;color:${COLORS.ink};background:#eef0ef}.acceptance{display:grid;grid-template-columns:1fr 1fr;gap:18mm;margin-top:7mm;border-top:.28mm solid ${COLORS.border};padding-top:4mm}.acceptance div>*{display:block}.acceptance b{font-size:8.5px;color:${COLORS.ink}}.acceptance span{margin-top:1.6mm;font-size:7.6px}.acceptance img{width:24mm;height:24mm;object-fit:contain;margin-bottom:1mm}footer{position:absolute;left:14mm;right:14mm;bottom:7mm;display:flex;justify-content:space-between;border-top:.28mm solid ${COLORS.border};padding-top:2.5mm;font-size:6.6px;line-height:1.55;color:${COLORS.muted}}footer b,footer span{display:block}footer b{font-size:7px;color:${COLORS.ink}}.footer-right{text-align:right}
</style></head><body>${pages}</body></html>`;
}

export function renderLetterHtml(data: LetterPdfData): string {
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
  if (data.type === 'APPOINTMENT') return renderAppointmentHtml(data, content);
  const { subject, paragraphs } = content;
  const label = LETTER_LABELS[data.type];
  const category = LETTER_CATEGORIES[data.type];
  const recipientMeta = [data.recipientDesignation, data.recipientDepartment]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' | ');
  const salutationName = escapeHtml(data.recipientName.trim());

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
.signatory{position:relative;z-index:1;margin-top:7.5mm;min-height:30mm}.sign-copy{width:64mm}.closing{margin:0 0 1.8mm;font-size:9.2px;letter-spacing:-.005em;color:${COLORS.text}}.signature-stamp{display:block;width:25mm;height:25mm;margin-left:1mm;object-fit:contain;image-rendering:auto}.signature-line{width:62mm;border-top:.3mm solid ${COLORS.border}}.sign-name{margin-top:1.8mm;font-size:9.7px;font-weight:760;letter-spacing:-.01em;color:${COLORS.ink}}.sign-role{margin-top:.45mm;font-size:8px;line-height:1.42;letter-spacing:.005em;color:${COLORS.muted}}.digital-note{margin-top:1.2mm;font-size:6.7px;letter-spacing:.005em;color:${COLORS.faint}}
.footer{position:absolute;z-index:1;left:14mm;right:14mm;bottom:8mm}.contact-row{display:grid;grid-template-columns:1fr 1.18fr 1fr;align-items:center;border-bottom:.28mm solid ${COLORS.border};padding-bottom:3mm;font-size:8px;font-weight:590;color:${COLORS.muted}}.contact-item{display:flex;align-items:center;gap:1.7mm}.contact-row .contact-item:nth-child(2){justify-content:center}.contact-row .contact-item:nth-child(3){justify-content:flex-end}.contact-icon{display:block;width:4.1mm;height:4.1mm;flex:0 0 auto;color:${COLORS.ink}}.contact-icon svg{display:block;width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.footer-meta{display:flex;align-items:flex-start;justify-content:space-between;gap:12mm;margin-top:3.2mm}.footer-company{font-size:8.6px;font-weight:760;color:${COLORS.ink}}.footer-address{margin-top:1mm;font-size:7.3px;line-height:1.52;color:${COLORS.muted}}.footer-document{text-align:right;font-size:7.2px;line-height:1.65;color:${COLORS.muted}}.footer-document strong{display:block;margin-bottom:.75mm;font-size:7.5px;font-weight:800;letter-spacing:.7px;line-height:1.2;text-transform:uppercase;color:${COLORS.ink}}
</style></head><body><main class="sheet">
${data.preview ? '<div style="position:absolute;inset:126mm 0 auto;z-index:5;transform:rotate(-25deg);text-align:center;font-size:42px;font-weight:800;letter-spacing:8px;color:rgba(23,25,24,.06)">DRAFT</div>' : ''}<img class="watermark" src="data:image/png;base64,${moleculeBase64}" alt="">
<header class="header"><div class="brand-lockup" aria-label="Bond Therapy Professional"><img class="brand-molecule" src="data:image/png;base64,${moleculeBase64}" alt=""><img class="brand-wordmark" src="data:image/png;base64,${wordmarkBase64}" alt="Bond Therapy Professional"></div><div class="document-id"><div class="document-department">Human Resources</div><div class="document-number">${escapeHtml(data.letterNumber)}</div></div></header>
<section class="letter-head"><div class="eyebrow-row"><div class="eyebrow">${escapeHtml(category)} / Human Resources</div><div class="confidential">Private &amp; Confidential</div></div><h1>${escapeHtml(label)}</h1><div class="title-rule"></div><div class="recipient-panel"><div class="reference-row"><div>Ref:&nbsp; <strong>${escapeHtml(data.letterNumber)}</strong></div><div>Date:&nbsp; <strong>${escapeHtml(dateFmt(data.issuedDate))}</strong></div></div><div class="recipient"><div class="recipient-label">To,</div><div class="recipient-name">${escapeHtml(data.recipientName)}</div><div class="recipient-meta">${recipientMeta || 'Recipient'}<br>Bond Therapy Professional</div></div></div><div class="subject"><div class="subject-label">Subject:</div><div class="subject-value">${subject}</div></div></section>
<section class="letter-body"><p class="salutation">Dear ${salutationName},</p>${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')}</section>
<section class="signatory"><div class="sign-copy"><p class="closing">Warm regards,</p><img class="signature-stamp" src="data:image/png;base64,${signatureStampBase64}" alt="Bond Therapy stamp and authorised signature"><div class="signature-line"></div><div class="sign-name">${escapeHtml(data.snapshot.company.authorisedSignatory)}</div><div class="sign-role">${escapeHtml(data.snapshot.company.authorisedSignatoryDesignation)}<br>${escapeHtml(data.snapshot.company.displayName)}</div><div class="digital-note">Electronically generated and authorised through Bond Therapy CRM.</div></div></section>
<footer class="footer"><div class="contact-row"><span class="contact-item"><b class="contact-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92Z"/></svg></b>${escapeHtml(data.snapshot.company.phone)}</span><span class="contact-item"><b class="contact-icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></b>${escapeHtml(data.snapshot.company.email)}</span><span class="contact-item"><b class="contact-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg></b>${escapeHtml(data.snapshot.company.website)}</span></div><div class="footer-meta"><div><div class="footer-company">${escapeHtml(data.snapshot.company.legalName)}</div><div class="footer-address">${escapeHtml(data.snapshot.company.address || 'Corporate HR & Administration')}</div></div><div class="footer-document"><strong>Official HR Document</strong>${escapeHtml(data.letterNumber)} · Version ${data.version}<br>Page 1 of 1 · Verify: /verify/${escapeHtml(data.verificationToken)}</div></div></footer>
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
    await page.emulateMediaType('print');
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
