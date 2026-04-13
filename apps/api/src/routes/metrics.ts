import { Router } from 'express';
import { ApiEnv } from '@applybot/shared';
import { getMetrics, getContentType } from '../services/metrics';

export function metricsRouter(env: ApiEnv): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    // Optional token protection
    if (env.METRICS_TOKEN) {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${env.METRICS_TOKEN}`) {
        res.status(401).send('Unauthorized');
        return;
      }
    }

    res.set('Content-Type', getContentType());
    res.send(await getMetrics());
  });

  return router;
}
