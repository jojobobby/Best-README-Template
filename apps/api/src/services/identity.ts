import { Identity, loadIdentity } from '@applybot/shared';
import { createLogger } from '../middleware/logger';
import * as path from 'path';

const logger = createLogger('identity');

let cachedIdentity: Identity | null = null;
let lastLoaded: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getIdentity(identityPath: string, identityKey: string): Promise<Identity> {
  const now = Date.now();

  if (cachedIdentity && now - lastLoaded < CACHE_TTL_MS) {
    return cachedIdentity;
  }

  const identityDir = path.dirname(identityPath);
  cachedIdentity = await loadIdentity(identityDir, identityKey);
  lastLoaded = now;

  logger.info('Identity loaded', {
    name: `${cachedIdentity.firstName} ${cachedIdentity.lastName}`,
    version: cachedIdentity.version,
  });

  return cachedIdentity;
}

export function isIdentityLoaded(): boolean {
  return cachedIdentity !== null;
}
