// Test helper: builds the smallest byte sequences that look like a JPEG to the live-camera check.
const segment = (marker: number, payload: Buffer) => Buffer.concat([Buffer.from([0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff]), payload]);

export function fakeJpeg({ width = 640, height = 480, exif = false, tag = 0 }: { width?: number; height?: number; exif?: boolean; tag?: number } = {}) {
  const jfif = segment(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1'));
  const exifSegment = exif ? segment(0xe1, Buffer.from('Exif\0\0MM\0*\0\0\0\b', 'latin1')) : Buffer.alloc(0);
  const frame = segment(0xc0, Buffer.from([8, height >> 8, height & 0xff, width >> 8, width & 0xff, 1, 1, 0x11, 0]));
  // `tag` makes otherwise identical photos different, so they get different fingerprints.
  return Buffer.concat([Buffer.from([0xff, 0xd8]), jfif, exifSegment, frame, Buffer.from([0xff, 0xfe, 0, 3, tag & 0xff]), Buffer.from([0xff, 0xd9])]);
}
