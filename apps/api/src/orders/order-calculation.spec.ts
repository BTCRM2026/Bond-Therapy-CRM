import { describe, expect, it } from 'vitest';
import { calculateOrder } from './order-calculation.js';

describe('calculateOrder', () => {
  it('distributes discount and calculates intra-state GST without losing paise', () => {
    const result = calculateOrder([{ productId: 'a', quantity: 2 }, { productId: 'b', quantity: 1 }], [{ id: 'a', unitPrice: 100, gstRate: 18 }, { id: 'b', unitPrice: 50, gstRate: null }], 25, 12, false);
    expect(result).toMatchObject({ subtotal: 250, discountAmount: 25, taxableAmount: 225, taxAmount: 37.8, cgstAmount: 18.9, sgstAmount: 18.9, igstAmount: 0, totalAmount: 262.8 });
    expect(result.items.reduce((sum, item) => sum + item.discountAmount, 0)).toBe(25);
  });

  it('uses IGST for interstate orders', () => {
    const result = calculateOrder([{ productId: 'a', quantity: 1 }], [{ id: 'a', unitPrice: 1000, gstRate: 18 }], 0, 18, true);
    expect(result).toMatchObject({ cgstAmount: 0, sgstAmount: 0, igstAmount: 180, totalAmount: 1180 });
  });

  it('keeps the product name and package size on the saved order item', () => {
    const result = calculateOrder([{ productId: 'a', quantity: 3 }], [{ id: 'a', name: 'Hydra Active Shampoo', variant: '250 ml', unit: 'bottle', unitPrice: 950, gstRate: null }], 0, 0, false);
    expect(result.items[0]).toMatchObject({ productNameSnapshot: 'Hydra Active Shampoo', packageSnapshot: '250 ml', quantity: 3, unitPrice: 950 });
    expect(result.subtotal).toBe(2850);
  });
});
