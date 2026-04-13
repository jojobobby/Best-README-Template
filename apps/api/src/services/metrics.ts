import client from 'prom-client';
import { createQueue, QUEUE_NOTIFY, QUEUE_APPLY, QUEUE_SCRAPE } from '@applybot/shared';

// Default Node.js metrics
client.collectDefaultMetrics({ prefix: 'applybot_' });

// Custom counters
export const jobsNotifiedTotal = new client.Counter({
  name: 'applybot_jobs_notified_total',
  help: 'Total jobs texted to user',
});

export const jobsApprovedTotal = new client.Counter({
  name: 'applybot_jobs_approved_total',
  help: 'Total jobs user replied Y to',
});

export const jobsRejectedTotal = new client.Counter({
  name: 'applybot_jobs_rejected_total',
  help: 'Total jobs user replied N to',
});

export const jobsAppliedTotal = new client.Counter({
  name: 'applybot_jobs_applied_total',
  help: 'Total apply attempts',
  labelNames: ['platform', 'success'] as const,
});

export const jobsFailedTotal = new client.Counter({
  name: 'applybot_jobs_failed_total',
  help: 'Total failed applies',
  labelNames: ['reason'] as const,
});

export const applyDuration = new client.Histogram({
  name: 'applybot_apply_duration_seconds',
  help: 'Time to complete each apply',
  buckets: [10, 30, 60, 120, 300, 600],
});

export const queueDepth = new client.Gauge({
  name: 'applybot_queue_depth',
  help: 'Current queue sizes',
  labelNames: ['queue_name'] as const,
});

export const identityLoadErrors = new client.Counter({
  name: 'applybot_identity_load_errors_total',
  help: 'Identity decryption failures',
});

// Update queue depths every 30s
let depthInterval: ReturnType<typeof setInterval> | null = null;

export function startQueueDepthCollector(redisUrl: string) {
  if (depthInterval) return;

  depthInterval = setInterval(async () => {
    try {
      const queues = [
        { name: QUEUE_NOTIFY, queue: createQueue(QUEUE_NOTIFY, redisUrl) },
        { name: QUEUE_APPLY, queue: createQueue(QUEUE_APPLY, redisUrl) },
        { name: QUEUE_SCRAPE, queue: createQueue(QUEUE_SCRAPE, redisUrl) },
      ];

      for (const { name, queue } of queues) {
        const counts = await queue.getJobCounts();
        queueDepth.set({ queue_name: name }, counts.waiting + counts.active);
      }
    } catch {
      // Silently ignore metric collection errors
    }
  }, 30000);
}

export async function getMetrics(): Promise<string> {
  return client.register.metrics();
}

export function getContentType(): string {
  return client.register.contentType;
}
