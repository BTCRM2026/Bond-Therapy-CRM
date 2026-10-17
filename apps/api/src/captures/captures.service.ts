import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const CAPTURE_PURPOSES = ['VISIT_CHECK_IN', 'REPORT_CALL', 'EXCHANGE_ITEM'] as const;
export type CapturePurpose = (typeof CAPTURE_PURPOSES)[number];

const TTL_MS = 15 * 60 * 1000;
// A real camera session lasts longer than this; it stops a script from "opening the camera" and posting in the same instant.
const MIN_AGE_MS = 1000;
const NOT_LIVE = 'This photo was not taken with the in-app camera, or its camera session expired. Please retake it.';

@Injectable()
export class CapturesService {
  constructor(private readonly prisma: PrismaService) {}

  // Issued when the camera screen opens.
  async issue(actor: SessionUser, purpose: CapturePurpose, scopeId?: string) {
    await this.prisma.photoCapture.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } } });
    const id = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + TTL_MS);
    await this.prisma.photoCapture.create({ data: { id, userId: actor.id, purpose, scopeId: scopeId ?? null, expiresAt } });
    return { token: id, expiresAt };
  }

  // Single use: the photo that arrives with a valid token uses it up. Call it after every other check has passed.
  async consume(userId: string, token: string | undefined, purpose: CapturePurpose, scopeId?: string) {
    if (!token) throw new BadRequestException(NOT_LIVE);
    const now = Date.now();
    const used = await this.prisma.photoCapture.updateMany({
      where: { id: token, userId, purpose, scopeId: scopeId ?? null, usedAt: null, expiresAt: { gt: new Date(now) }, createdAt: { lte: new Date(now - MIN_AGE_MS) } },
      data: { usedAt: new Date(now) },
    });
    if (used.count !== 1) throw new BadRequestException(NOT_LIVE);
  }
}
