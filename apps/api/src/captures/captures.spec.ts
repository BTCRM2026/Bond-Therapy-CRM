import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CapturesService } from './captures.service.js';
import { fakeJpeg } from './jpeg.testkit.js';
import { assertLiveCameraPhoto, readJpeg } from './live-photo.js';

describe('live camera photo check', () => {
  it('accepts a plain camera-sized JPEG and returns a stable fingerprint', () => {
    const photo = fakeJpeg({ width: 1280, height: 960 });
    expect(readJpeg(photo)).toEqual({ width: 1280, height: 960, hasExif: false });
    expect(assertLiveCameraPhoto(photo)).toMatch(/^[0-9a-f]{64}$/);
    expect(assertLiveCameraPhoto(photo)).toBe(assertLiveCameraPhoto(Buffer.from(photo)));
    expect(assertLiveCameraPhoto(fakeJpeg({ tag: 1 }))).not.toBe(assertLiveCameraPhoto(fakeJpeg({ tag: 2 })));
  });

  it('rejects gallery-style photos: camera metadata, full phone resolution, or not a JPEG', () => {
    expect(() => assertLiveCameraPhoto(fakeJpeg({ exif: true }))).toThrow('in-app camera');
    expect(() => assertLiveCameraPhoto(fakeJpeg({ width: 4032, height: 3024 }))).toThrow('in-app camera');
    expect(() => assertLiveCameraPhoto(Buffer.from('\x89PNG\r\n\x1a\n not a jpeg', 'latin1'))).toThrow('in-app camera');
    expect(() => assertLiveCameraPhoto(Buffer.alloc(0))).toThrow('in-app camera');
    expect(() => assertLiveCameraPhoto(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toThrow('in-app camera');
  });
});

describe('CapturesService camera passes', () => {
  const build = (count: number) => {
    const prisma = { photoCapture: { deleteMany: vi.fn(), create: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count }) } };
    return { service: new CapturesService(prisma as unknown as PrismaService), prisma };
  };

  it('issues a long random pass for the signed-in user only', async () => {
    const { service, prisma } = build(1);
    const { token } = await service.issue({ id: 'u1' } as never, 'VISIT_CHECK_IN', 'stop-1');
    expect(token).toMatch(/^[0-9a-f]{48}$/);
    expect(prisma.photoCapture.create.mock.calls[0]![0].data).toMatchObject({ id: token, userId: 'u1', purpose: 'VISIT_CHECK_IN', scopeId: 'stop-1' });
  });

  it('uses a pass up exactly once and only for the same person, purpose and scope', async () => {
    const { service, prisma } = build(1);
    await service.consume('u1', 'a'.repeat(48), 'VISIT_CHECK_IN', 'stop-1');
    expect(prisma.photoCapture.updateMany.mock.calls[0]![0].where).toMatchObject({ id: 'a'.repeat(48), userId: 'u1', purpose: 'VISIT_CHECK_IN', scopeId: 'stop-1', usedAt: null });
    await service.consume('u1', 'b'.repeat(48), 'REPORT_CALL');
    expect(prisma.photoCapture.updateMany.mock.calls[1]![0].where.scopeId).toBeNull();
  });

  it('refuses a missing, expired, already used or foreign pass', async () => {
    await expect(build(0).service.consume('u1', 'x'.repeat(48), 'REPORT_CALL')).rejects.toThrow('in-app camera');
    await expect(build(1).service.consume('u1', undefined, 'REPORT_CALL')).rejects.toThrow('in-app camera');
  });
});
