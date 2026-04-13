import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Router } from 'express';
import { createQueue, QUEUE_NOTIFY, QUEUE_APPLY, QUEUE_SCRAPE, ApiEnv } from '@applybot/shared';

export function setupBullBoard(env: ApiEnv): Router {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/bull');

  createBullBoard({
    queues: [
      new BullAdapter(createQueue(QUEUE_NOTIFY, env.REDIS_URL)),
      new BullAdapter(createQueue(QUEUE_APPLY, env.REDIS_URL)),
      new BullAdapter(createQueue(QUEUE_SCRAPE, env.REDIS_URL)),
    ],
    serverAdapter,
  });

  const router = Router();

  // Basic auth protection
  router.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
      res.status(401).send('Authentication required');
      return;
    }

    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
    const [user, pass] = decoded.split(':');

    if (user !== env.BULL_BOARD_USER || pass !== env.BULL_BOARD_PASS) {
      res.status(403).send('Forbidden');
      return;
    }

    next();
  });

  router.use('/', serverAdapter.getRouter());
  return router;
}
