import PDFDocument from 'pdfkit';

export type OrderFormData = {
  orderNumber: string;
  createdAt: Date;
  status: string;
  notes: string | null;
  client: {
    salonName: string;
    city: string | null;
    primaryContact: string | null;
  };
  salesperson: { name: string };
  items: Array<{
    productNameSnapshot: string | null;
    packageSnapshot: string | null;
    quantity: number;
    unitPrice: unknown;
    product: { name: string; variant: string | null; unit: string };
  }>;
};

const ink = '#202326';
const muted = '#697076';
const line = '#E1E4E6';
const money = (value: number) =>
  `Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function renderOrderForm(order: OrderFormData, logo?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 42,
      bufferPages: true,
      info: {
        Title: `Order Form ${order.orderNumber}`,
        Author: 'Bond Therapy CRM',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    const left = 42;
    const right = 553;
    const width = right - left;
    const columns = {
      product: left + 12,
      volume: 280,
      mrp: 350,
      qty: 436,
      total: 473,
    };
    const header = () => {
      let titleX = left;
      if (logo) {
        try {
          doc.image(logo, left, 40, { fit: [34, 34] });
          titleX = left + 44;
        } catch { /* A malformed logo must not block the order form. */ }
      }
      doc
        .fillColor(ink)
        .font('Helvetica-Bold')
        .fontSize(17)
        .text('BOND THERAPY', titleX, 42);
      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(8)
        .text('PROFESSIONAL  /  SALES ORDER FORM', titleX, 64, {
          characterSpacing: 1.1,
        });
      doc
        .fillColor(ink)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(order.orderNumber, 390, 44, {
          width: right - 390,
          align: 'right',
        });
      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(8)
        .text(
          new Date(order.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'Asia/Kolkata',
          }),
          390,
          61,
          { width: right - 390, align: 'right' },
        );
      doc
        .strokeColor(line)
        .lineWidth(1)
        .moveTo(left, 86)
        .lineTo(right, 86)
        .stroke();
    };
    const tableHeader = (y: number) => {
      doc.rect(left, y, width, 28).fill('#F5F6F6');
      doc.fillColor(ink).font('Helvetica-Bold').fontSize(8);
      doc.text('PRODUCT', columns.product, y + 9, { width: 214 });
      doc.text('PACKAGE', columns.volume, y + 9, { width: 70 });
      doc.text('MRP', columns.mrp, y + 9, { width: 80, align: 'right' });
      doc.text('QTY', columns.qty, y + 9, { width: 35, align: 'right' });
      doc.text('TOTAL', columns.total, y + 9, { width: 68, align: 'right' });
      doc.strokeColor(line).rect(left, y, width, 28).stroke();
      return y + 28;
    };
    header();
    doc
      .fillColor(muted)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('SALON', left, 106);
    doc
      .fillColor(ink)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(order.client.salonName, left, 121, { width: 300 });
    doc
      .fillColor(muted)
      .font('Helvetica')
      .fontSize(9)
      .text(
        [order.client.city, order.client.primaryContact]
          .filter(Boolean)
          .join('  ·  '),
        left,
        142,
        { width: 300 },
      );
    doc
      .fillColor(muted)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('SALES REPRESENTATIVE', 380, 106, { width: 173, align: 'right' });
    doc
      .fillColor(ink)
      .font('Helvetica')
      .fontSize(10)
      .text(order.salesperson.name, 380, 122, { width: 173, align: 'right' });
    doc
      .fillColor(muted)
      .font('Helvetica')
      .fontSize(8)
      .text('Quantity = number of bottles / packs', left, 169);
    let y = tableHeader(189);
    let total = 0;
    for (const item of order.items) {
      const name = item.productNameSnapshot || item.product.name;
      const volume =
        item.packageSnapshot ||
        item.product.variant ||
        item.product.unit ||
        '—';
      const amount = Number(item.unitPrice) * item.quantity;
      total += amount;
      doc.font('Helvetica').fontSize(9);
      const rowHeight = Math.max(
        36,
        doc.heightOfString(name, { width: 214 }) + 18,
      );
      if (y + rowHeight > 715) {
        doc.addPage();
        header();
        y = tableHeader(105);
      }
      doc
        .fillColor(ink)
        .font('Helvetica')
        .fontSize(9)
        .text(name, columns.product, y + 10, { width: 214 });
      doc.fillColor(muted).text(volume, columns.volume, y + 10, { width: 70 });
      doc
        .fillColor(ink)
        .text(money(Number(item.unitPrice)), columns.mrp, y + 10, {
          width: 80,
          align: 'right',
        });
      doc.text(String(item.quantity), columns.qty, y + 10, {
        width: 35,
        align: 'right',
      });
      doc
        .font('Helvetica-Bold')
        .text(money(amount), columns.total, y + 10, {
          width: 68,
          align: 'right',
        });
      doc
        .strokeColor(line)
        .moveTo(left, y + rowHeight)
        .lineTo(right, y + rowHeight)
        .stroke();
      y += rowHeight;
    }
    if (y + 120 > 715) {
      doc.addPage();
      header();
      y = 105;
    }
    doc
      .fillColor(muted)
      .font('Helvetica')
      .fontSize(9)
      .text('Estimated MRP total', 295, y + 19, { width: 120, align: 'right' });
    doc
      .fillColor(ink)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(money(total), 420, y + 17, { width: 121, align: 'right' });
    y += 54;
    if (order.notes?.trim()) {
      doc
        .fillColor(muted)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('CHANGES / EXCHANGE NOTE', left, y);
      doc
        .fillColor(ink)
        .font('Helvetica')
        .fontSize(9)
        .text(order.notes.trim(), left, y + 15, { width });
    }
    const pages = doc.bufferedPageRange();
    for (let index = 0; index < pages.count; index++) {
      doc.switchToPage(index);
      doc.strokeColor(line).moveTo(left, 757).lineTo(right, 757).stroke();
      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(8)
        .text(
          'Order request only · Not a tax invoice · Invoice issued separately',
          left,
          766,
          { width: 420 },
        );
      doc.text(`${index + 1} / ${pages.count}`, 493, 766, {
        width: 60,
        align: 'right',
      });
    }
    doc.end();
  });
}
