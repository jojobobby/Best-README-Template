import { createQueue, QUEUE_NOTIFY, QUEUE_APPLY, QUEUE_SCRAPE } from '@applybot/shared';
import { createLogger } from '../middleware/logger';

const logger = createLogger('queue');

export function initQueues(redisUrl: string) {
  const notifyQueue = createQueue(QUEUE_NOTIFY, redisUrl);
  const applyQueue = createQueue(QUEUE_APPLY, redisUrl);
  const scrapeQueue = createQueue(QUEUE_SCRAPE, redisUrl);

  notifyQueue.on('error', (err) => logger.error('Notify queue error', { error: err.message }));
  applyQueue.on('error', (err) => logger.error('Apply queue error', { error: err.message }));
  scrapeQueue.on('error', (err) => logger.error('Scrape queue error', { error: err.message }));

  logger.info('Queues initialized', {
    queues: [QUEUE_NOTIFY, QUEUE_APPLY, QUEUE_SCRAPE],
  });

  return { notifyQueue, applyQueue, scrapeQueue };
}

export async function getQueueStats(redisUrl: string) {
  const notifyQueue = createQueue(QUEUE_NOTIFY, redisUrl);
  const applyQueue = createQueue(QUEUE_APPLY, redisUrl);
  const scrapeQueue = createQueue(QUEUE_SCRAPE, redisUrl);

  const [notifyCounts, applyCounts, scrapeCounts] = await Promise.all([
    notifyQueue.getJobCounts(),
    applyQueue.getJobCounts(),
    scrapeQueue.getJobCounts(),
  ]);

  return {
    notify: notifyCounts,
    apply: applyCounts,
    scrape: scrapeCounts,
  };
}
