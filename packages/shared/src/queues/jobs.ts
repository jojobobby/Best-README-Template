import { createQueue, QUEUE_NOTIFY, QUEUE_APPLY, QUEUE_SCRAPE } from './index';

export interface NotifyJobPayload {
  jobId: string;
}

export interface ApplyJobPayload {
  jobId: string;
  priority: 'normal' | 'high';
}

export interface ScrapeJobPayload {
  source: string;
  forced: boolean;
}

export async function enqueueNotify(jobId: string): Promise<void> {
  const queue = createQueue(QUEUE_NOTIFY);
  const payload: NotifyJobPayload = { jobId };
  await queue.add(payload, {
    jobId: `notify-${jobId}`,
  });
}

export async function enqueueApply(jobId: string, delayMs?: number): Promise<void> {
  const queue = createQueue(QUEUE_APPLY);
  const payload: ApplyJobPayload = { jobId, priority: 'normal' };
  await queue.add(payload, {
    jobId: `apply-${jobId}`,
    delay: delayMs,
  });
}

export async function enqueueScrape(source: string, forced = false): Promise<void> {
  const queue = createQueue(QUEUE_SCRAPE);
  const payload: ScrapeJobPayload = { source, forced };
  await queue.add(payload, {
    jobId: `scrape-${source}-${Date.now()}`,
  });
}
