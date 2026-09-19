import { SetMetadata } from '@nestjs/common';
import type { PortalType } from '@prisma/client';

export const PORTALS_KEY = 'portals';
export const Portals = (...portals: PortalType[]) => SetMetadata(PORTALS_KEY, portals);
