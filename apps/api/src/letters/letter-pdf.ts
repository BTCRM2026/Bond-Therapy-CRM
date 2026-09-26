import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { buildLetterContent } from './letter-content.js';
import {
  LETTER_CATEGORIES,
  LETTER_LABELS,
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
};

export function renderLetterHtml(data: LetterPdfData): string {
  const { subject, paragraphs } = buildLetterContent(
    data.type,
    {
      name: data.recipientName,
      designation: data.recipientDesignation,
      department: data.recipientDepartment,
    },
    data.details,
  );
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
<img class="watermark" src="data:image/png;base64,${moleculeBase64}" alt="">
<header class="header"><div class="brand-lockup" aria-label="Bond Therapy Professional"><img class="brand-molecule" src="data:image/png;base64,${moleculeBase64}" alt=""><img class="brand-wordmark" src="data:image/png;base64,${wordmarkBase64}" alt="Bond Therapy Professional"></div><div class="document-id"><div class="document-department">Human Resources</div><div class="document-number">${escapeHtml(data.letterNumber)}</div></div></header>
<section class="letter-head"><div class="eyebrow-row"><div class="eyebrow">${escapeHtml(category)} / Human Resources</div><div class="confidential">Private &amp; Confidential</div></div><h1>${escapeHtml(label)}</h1><div class="title-rule"></div><div class="recipient-panel"><div class="reference-row"><div>Ref:&nbsp; <strong>${escapeHtml(data.letterNumber)}</strong></div><div>Date:&nbsp; <strong>${escapeHtml(dateFmt(data.issuedDate))}</strong></div></div><div class="recipient"><div class="recipient-label">To,</div><div class="recipient-name">${escapeHtml(data.recipientName)}</div><div class="recipient-meta">${recipientMeta || 'Recipient'}<br>Bond Therapy Professional</div></div></div><div class="subject"><div class="subject-label">Subject:</div><div class="subject-value">${subject}</div></div></section>
<section class="letter-body"><p class="salutation">Dear ${salutationName},</p>${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')}</section>
<section class="signatory"><div class="sign-copy"><p class="closing">Warm regards,</p><img class="signature-stamp" src="data:image/png;base64,${signatureStampBase64}" alt="Bond Therapy stamp and Parth Patel signature"><div class="signature-line"></div><div class="sign-name">Parth Patel</div><div class="sign-role">Authorised Signatory<br>Bond Therapy Professional</div><div class="digital-note">Electronically generated and authorised through Bond Therapy CRM.</div></div></section>
<footer class="footer"><div class="contact-row"><span class="contact-item"><b class="contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92Z"/></svg></b>+91 78780 40050</span><span class="contact-item"><b class="contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></b>hr@bondtherapy.co.in</span><span class="contact-item"><b class="contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg></b>bondtherapy.co.in</span></div><div class="footer-meta"><div><div class="footer-company">Bond Therapy Professional</div><div class="footer-address">Corporate HR &amp; Administration<br>Vadodara, Gujarat, India</div></div><div class="footer-document"><strong>Official HR Document</strong>${escapeHtml(data.letterNumber)}<br>Generated securely through Bond Therapy CRM</div></div></footer>
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
    const fits = await page.evaluate(() => {
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
