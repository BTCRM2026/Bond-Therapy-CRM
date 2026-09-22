import PDFDocument from 'pdfkit';

type InvoicePdfData = {
  invoiceNumber: string; issuedAt: Date; dueDate: Date; status: string;
  companySnapshot: unknown; customerSnapshot: unknown;
  subtotal: unknown; discountAmount: unknown; taxableAmount: unknown; cgstAmount: unknown; sgstAmount: unknown; igstAmount: unknown; taxAmount: unknown; totalAmount: unknown; amountPaid: unknown; balanceDue: unknown; notes: string | null;
  items: Array<{ sku: string; productName: string; hsnCode: string | null; unit: string; quantity: number; unitPrice: unknown; discountAmount: unknown; taxableAmount: unknown; gstRate: unknown; taxAmount: unknown; lineTotal: unknown }>;
};

const currency = (value: unknown) => `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (value: Date) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(value);
const text = (value: unknown) => typeof value === 'string' ? value : '';

export function renderInvoicePdf(invoice: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42, info: { Title: `Tax Invoice ${invoice.invoiceNumber}`, Author: 'Bond Therapy CRM' }, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const company = invoice.companySnapshot as Record<string, unknown>;
    const customer = invoice.customerSnapshot as Record<string, unknown>;
    const green = '#0D5C52'; const ink = '#17231F'; const muted = '#64736E'; const line = '#DFE6E3'; const soft = '#F3F6F5';

    doc.rect(0, 0, 595.28, 12).fill(green);
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(22).text(text(company.tradeName) || text(company.legalName) || 'Bond Therapy', 42, 42, { width: 320 });
    doc.fillColor(muted).font('Helvetica').fontSize(8.5).text([text(company.registeredAddress), [text(company.city), text(company.state), text(company.pincode)].filter(Boolean).join(' '), text(company.gstin) ? `GSTIN: ${text(company.gstin)}` : '', [text(company.phone), text(company.email)].filter(Boolean).join('  |  ')].filter(Boolean).join('\n'), 42, 72, { width: 320, lineGap: 2 });
    doc.fillColor(green).font('Helvetica-Bold').fontSize(20).text('TAX INVOICE', 380, 42, { width: 173, align: 'right' });
    doc.fillColor(muted).font('Helvetica').fontSize(8).text('INVOICE NUMBER', 400, 73, { width: 153, align: 'right' });
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(10).text(invoice.invoiceNumber, 400, 85, { width: 153, align: 'right' });
    doc.fillColor(muted).font('Helvetica').fontSize(8).text(`Issued ${date(invoice.issuedAt)}  |  Due ${date(invoice.dueDate)}`, 350, 104, { width: 203, align: 'right' });

    doc.moveTo(42, 135).lineTo(553, 135).strokeColor(line).lineWidth(1).stroke();
    doc.fillColor(muted).font('Helvetica-Bold').fontSize(8).text('BILL TO', 42, 151);
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(12).text(text(customer.billingName) || text(customer.salonName) || 'Customer', 42, 167, { width: 320 });
    doc.fillColor(muted).font('Helvetica').fontSize(8.5).text([text(customer.fullAddress), [text(customer.city), text(customer.state), text(customer.pincode)].filter(Boolean).join(' '), text(customer.gstin) ? `GSTIN: ${text(customer.gstin)}` : '', text(customer.primaryContact) ? `Contact: ${text(customer.primaryContact)}` : ''].filter(Boolean).join('\n'), 42, 185, { width: 320, lineGap: 2 });

    let y = 246;
    const cols = [42, 68, 282, 326, 370, 425, 477];
    doc.roundedRect(42, y, 511, 28, 5).fill(green);
    const headers = ['#', 'DESCRIPTION', 'HSN', 'QTY', 'RATE', 'GST', 'AMOUNT'];
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5);
    headers.forEach((header, i) => doc.text(header, cols[i] + 5, y + 10, { width: (i === 1 ? 204 : i === 6 ? 71 : 40), align: i >= 3 ? 'right' : 'left' }));
    y += 34;
    invoice.items.forEach((item, index) => {
      const rowHeight = Math.max(34, doc.heightOfString(item.productName, { width: 190 }) + 18);
      if (y + rowHeight > 695) { doc.addPage(); y = 50; }
      if (index % 2 === 1) doc.rect(42, y - 3, 511, rowHeight).fill(soft);
      doc.fillColor(ink).font('Helvetica').fontSize(8);
      doc.text(String(index + 1), cols[0] + 5, y + 5, { width: 20 });
      doc.font('Helvetica-Bold').text(item.productName, cols[1] + 5, y + 4, { width: 195 });
      doc.fillColor(muted).font('Helvetica').fontSize(7).text(item.sku, cols[1] + 5, y + 17, { width: 195 });
      doc.fillColor(ink).fontSize(8).text(item.hsnCode || '—', cols[2] + 4, y + 5, { width: 40 });
      doc.text(`${item.quantity} ${item.unit}`, cols[3], y + 5, { width: 40, align: 'right' });
      doc.text(currency(item.unitPrice).replace('INR ', ''), cols[4], y + 5, { width: 50, align: 'right' });
      doc.text(`${Number(item.gstRate)}%`, cols[5], y + 5, { width: 45, align: 'right' });
      doc.font('Helvetica-Bold').text(currency(item.lineTotal).replace('INR ', ''), cols[6], y + 5, { width: 71, align: 'right' });
      y += rowHeight;
      doc.moveTo(42, y - 3).lineTo(553, y - 3).strokeColor(line).lineWidth(0.5).stroke();
    });

    y = Math.max(y + 14, 480);
    const summaryX = 340;
    const summary = [['Subtotal', invoice.subtotal], ['Discount', -Number(invoice.discountAmount)], ['Taxable amount', invoice.taxableAmount], ...(Number(invoice.igstAmount) > 0 ? [['IGST', invoice.igstAmount]] : [['CGST', invoice.cgstAmount], ['SGST', invoice.sgstAmount]])] as Array<[string, unknown]>;
    summary.forEach(([label, value]) => { doc.fillColor(muted).font('Helvetica').fontSize(8.5).text(label, summaryX, y, { width: 90 }); doc.fillColor(ink).text(currency(value), 440, y, { width: 113, align: 'right' }); y += 18; });
    doc.roundedRect(summaryX, y - 3, 213, 34, 5).fill(green);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10).text('GRAND TOTAL', summaryX + 10, y + 8); doc.fontSize(12).text(currency(invoice.totalAmount), 433, y + 7, { width: 110, align: 'right' });
    y += 46;
    if (Number(invoice.amountPaid) > 0) { doc.fillColor(muted).font('Helvetica').fontSize(8.5).text(`Paid: ${currency(invoice.amountPaid)}   Balance due: ${currency(invoice.balanceDue)}`, summaryX, y, { width: 213, align: 'right' }); }

    const infoY = Math.max(y + 35, 660);
    if (infoY > 720) doc.addPage();
    const finalY = infoY > 720 ? 50 : infoY;
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(8.5).text('PAYMENT DETAILS', 42, finalY);
    doc.fillColor(muted).font('Helvetica').fontSize(8).text([text(company.bankName) ? `Bank: ${text(company.bankName)}` : '', text(company.accountNumber) ? `A/C: ${text(company.accountNumber)}` : '', text(company.ifsc) ? `IFSC: ${text(company.ifsc)}` : '', text(company.upiId) ? `UPI: ${text(company.upiId)}` : ''].filter(Boolean).join('  |  '), 42, finalY + 15, { width: 500 });
    if (text(company.invoiceTerms)) doc.text(`Terms: ${text(company.invoiceTerms)}`, 42, finalY + 37, { width: 500, lineGap: 2 });
    doc.fillColor(green).font('Helvetica-Bold').fontSize(8).text(text(company.footerNote) || 'Thank you for your business.', 42, 785, { width: 511, align: 'center' });
    doc.end();
  });
}
