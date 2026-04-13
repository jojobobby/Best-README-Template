import Bull from 'bull';
import { prisma } from '@applybot/db';
import { createQueue, QUEUE_NOTIFY, NotifyJobPayload } from '@applybot/shared';
import { sendJobNotification } from '../services/twilio';
import { jobsNotifiedTotal } from '../services/metrics';
import { createLogger } from '../middleware/logger';

const logger = createLogger('notifier');

const NOTIFICATION_DELAY_MS = 3 * 60 * 1000; // 3 minutes between notifications
const MAX_BATCH_SIZE = 3;

export function startNotifierWorker(redisUrl: string): Bull.Queue {
  const queue = createQueue(QUEUE_NOTIFY, redisUrl);

  queue.process(MAX_BATCH_SIZE, async (job: Bull.Job<NotifyJobPayload>) => {
    const { jobId } = job.data;

    logger.info('Processing notification', { jobId });

    const dbJob = await prisma.job.findUnique({ where: { id: jobId } });

    if (!dbJob) {
      logger.warn('Job not found for notification', { jobId });
      return;
    }

    if (dbJob.status !== 'PENDING_REVIEW') {
      logger.info('Job no longer PENDING_REVIEW, skipping notification', {
        jobId,
        status: dbJob.status,
      });
      return;
    }

    if (dbJob.smsMessageSid) {
      logger.info('Job already notified, skipping', { jobId });
      return;
    }

    await sendJobNotification(dbJob);
    jobsNotifiedTotal.inc();

    logger.info('Notification sent', { jobId, title: dbJob.title });
  });

  queue.on('failed', (job, err) => {
    logger.error('Notification job failed', {
      jobId: job.data.jobId,
      error: err.message,
      attempts: job.attemptsMade,
    });
  });

  logger.info('Notifier worker started');
  return queue;
}

export async function enqueueNotificationsWithDelay(jobIds: string[], redisUrl: string) {
  const queue = createQueue(QUEUE_NOTIFY, redisUrl);

  for (let i = 0; i < jobIds.length; i++) {
    const delay = i * NOTIFICATION_DELAY_MS;
    await queue.add(
      { jobId: jobIds[i] } as NotifyJobPayload,
      {
        jobId: `notify-${jobIds[i]}`,
        delay,
      },
    );

    logger.info('Notification enqueued', {
      jobId: jobIds[i],
      delayMs: delay,
      position: i + 1,
      total: jobIds.length,
    });
  }
}
