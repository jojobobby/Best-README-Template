import Bull from 'bull';

export const QUEUE_NOTIFY = 'notify';
export const QUEUE_APPLY = 'apply';
export const QUEUE_SCRAPE = 'scrape';

const queues = new Map<string, Bull.Queue>();

export function createQueue(name: string, redisUrl?: string): Bull.Queue {
  const existing = queues.get(name);
  if (existing) return existing;

  const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';

  const queue = new Bull(name, url, {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });

  queues.set(name, queue);
  return queue;
}

export function getQueue(name: string): Bull.Queue {
  const queue = queues.get(name);
  if (!queue) {
    throw new Error(`Queue "${name}" not initialized. Call createQueue() first.`);
  }
  return queue;
}

export async function closeAllQueues(): Promise<void> {
  const closes = Array.from(queues.values()).map((q) => q.close());
  await Promise.all(closes);
  queues.clear();
}
