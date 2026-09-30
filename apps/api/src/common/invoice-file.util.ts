import { ConflictException } from '@nestjs/common';

export const MAX_INVOICE_FILE_SIZE = 12 * 1024 * 1024;

export function validateInvoiceFile(file: { buffer: Buffer; size: number }) {
  if (file.size > MAX_INVOICE_FILE_SIZE) throw new ConflictException('Invoice attachment must be 12 MB or smaller.');
  const bytes = file.buffer;
  const brand = bytes.subarray(8, 12).toString('ascii');
  const mime = bytes.subarray(0, 5).toString('ascii') === '%PDF-' ? 'application/pdf'
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'image/jpeg'
    : bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? 'image/png'
    : bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP' ? 'image/webp'
    : bytes.subarray(4, 8).toString('ascii') === 'ftyp' && ['heic', 'heif', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand) ? 'image/heic'
    : null;
  if (!mime) throw new ConflictException('Upload a genuine PDF, JPG, PNG, WebP, or HEIC invoice.');
  return mime;
}
