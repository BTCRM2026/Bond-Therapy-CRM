import { describe, expect, it } from 'vitest';
import { renderOrderForm } from './order-form-pdf.js';

describe('renderOrderForm', () => {
  it('creates a PDF using saved item values without requiring a logo', async () => {
    const pdf = await renderOrderForm({
      orderNumber: 'ORD-1025',
      createdAt: new Date('2026-10-13T00:00:00.000Z'),
      status: 'DRAFT',
      notes: 'Exchange requested next visit',
      client: { salonName: 'Style Studio', city: 'Surat', primaryContact: '0000000000' },
      salesperson: { name: 'Sales Representative' },
      items: [{ productNameSnapshot: 'Hydra Active Shampoo', packageSnapshot: '250 ml', quantity: 3, unitPrice: 950, product: { name: 'Renamed Product', variant: '1000 ml', unit: 'bottle' } }],
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });
});
