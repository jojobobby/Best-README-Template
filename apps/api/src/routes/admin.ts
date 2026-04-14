import { Router } from 'express';
import { prisma } from '@applybot/db';
import { ApiEnv, createQueue, QUEUE_NOTIFY, QUEUE_APPLY, QUEUE_SCRAPE } from '@applybot/shared';
import { apiKeyAuth } from '../middleware/auth';
import { getQueueStats } from '../services/queue';
import { createLogger } from '../middleware/logger';

const logger = createLogger('admin');

export function adminRouter(env: ApiEnv): Router {
  const router = Router();
  router.use(apiKeyAuth(env.API_KEY));

  // GET /admin/queues/stats
  router.get('/queues/stats', async (_req, res, next) => {
    try {
      const stats = await getQueueStats(env.REDIS_URL);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  });

  // POST /admin/queues/retry-failed
  router.post('/queues/retry-failed', async (_req, res, next) => {
    try {
      const applyQueue = createQueue(QUEUE_APPLY, env.REDIS_URL);
      const failed = await applyQueue.getFailed();
      let retried = 0;

      for (const job of failed) {
        await job.retry();
        retried++;
      }

      logger.info('Retried failed jobs', { count: retried });
      res.json({ retried });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /admin/queues/clear/:queueName
  router.delete('/queues/clear/:queueName', async (req, res, next) => {
    try {
      const queueName = req.params.queueName as string;
      const confirm = req.body?.CONFIRM;

      if (confirm !== true) {
        res.status(400).json({
          error: 'Must send { "CONFIRM": true } in body to clear a queue',
        });
        return;
      }

      const validQueues: string[] = [QUEUE_NOTIFY, QUEUE_APPLY, QUEUE_SCRAPE];
      if (!validQueues.includes(queueName)) {
        res.status(404).json({ error: `Unknown queue: ${queueName}` });
        return;
      }

      const queue = createQueue(queueName, env.REDIS_URL);
      await queue.empty();

      logger.warn('Queue cleared', { queueName });
      res.json({ cleared: queueName });
    } catch (err) {
      next(err);
    }
  });

  // GET /admin/jobs/failed
  router.get('/jobs/failed', async (_req, res, next) => {
    try {
      const failedJobs = await prisma.job.findMany({
        where: { status: 'FAILED' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          applicationLogs: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      });

      res.json(failedJobs);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
