import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { validateInvoiceFile } from './invoice-file.util.js';

describe('invoice file validation', () => {
  it('detects content instead of trusting the uploaded MIME label', () => {
    const pdf = Buffer.from('%PDF-1.7 invoice');
    expect(validateInvoiceFile({ buffer: pdf, size: pdf.length })).toBe('application/pdf');
    expect(() => validateInvoiceFile({ buffer: Buffer.from('not an invoice'), size: 14 })).toThrow(ConflictException);
  });
});
