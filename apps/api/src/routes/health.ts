import { Router } from 'express';
import { prisma } from '@applybot/db';
import { createQueue, QUEUE_APPLY } from '@applybot/shared';
import { isIdentityLoaded } from '../services/identity';

export function healthRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    let dbOk = false;
    let queueOk = false;

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      // DB unreachable
    }

    try {
      const queue = createQueue(QUEUE_APPLY);
      await queue.isReady();
      queueOk = true;
    } catch {
      // Redis unreachable
    }

    const identityOk = isIdentityLoaded();

    const healthy = dbOk && queueOk;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      db: dbOk,
      queue: queueOk,
      identity: identityOk,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
