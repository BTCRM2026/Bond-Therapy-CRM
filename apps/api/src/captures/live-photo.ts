import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

// The in-app camera never produces a photo larger than this on its longest side.
export const LIVE_PHOTO_MAX_SIDE = 1300;
const REJECTED = 'Only photos taken live with the in-app camera are accepted. Gallery photos and photos from the phone’s camera app cannot be used.';

type JpegInfo = { width: number; height: number; hasExif: boolean };

// Reads just enough of a JPEG to find its size and whether it carries camera metadata (EXIF).
export function readJpeg(buffer: Buffer): JpegInfo | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  let hasExif = false;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1]!;
    if (marker === 0xff) { offset += 1; continue; }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { offset += 2; continue; }
    if (marker === 0xd9) return null;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if (marker === 0xe1 && buffer.toString('latin1', offset + 4, offset + 10) === 'Exif\0\0') hasExif = true;
    const startOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (startOfFrame) {
      if (offset + 9 > buffer.length) return null;
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7), hasExif };
    }
    offset += 2 + length;
  }
  return null;
}

// A photo captured through the app's camera screen is a plain JPEG drawn from a video frame: no camera metadata and at most
// 1280 px. Anything else (a gallery original, a phone-camera file, a PNG) is refused. Returns the photo's SHA-256 fingerprint.
export function assertLiveCameraPhoto(buffer: Buffer) {
  const info = readJpeg(buffer);
  if (!info || info.hasExif || info.width < 1 || info.height < 1 || Math.max(info.width, info.height) > LIVE_PHOTO_MAX_SIDE) throw new BadRequestException(REJECTED);
  return createHash('sha256').update(buffer).digest('hex');
}
