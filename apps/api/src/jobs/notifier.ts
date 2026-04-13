import Bull from 'bull';
import { prisma } from '@applybot/db';
import { createQueue, QUEUE_NOTIFY, NotifyJobPayload } from '@applybot/shared';
import { sendJobNotification, sendDailySummary } from '../services/twilio';
import { jobsNotifiedTotal } from '../services/metrics';
import { createLogger } from '../middleware/logger';

const logger = createLogger('notifier');

const CONCURRENCY = 3;

export function startNotifierWorker(redisUrl: string): Bull.Queue {
  const queue = createQueue(QUEUE_NOTIFY, redisUrl);

  queue.process(CONCURRENCY, async (job: Bull.Job<NotifyJobPayload>) => {
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

export async function runDailySummary(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [applied, failed, pending] = await Promise.all([
    prisma.job.count({ where: { status: 'APPLIED', appliedAt: { gte: today } } }),
    prisma.job.count({ where: { status: 'FAILED', updatedAt: { gte: today } } }),
    prisma.job.count({ where: { status: 'PENDING_REVIEW' } }),
  ]);

  await sendDailySummary({ applied, failed, pending });
  logger.info('Daily summary sent', { applied, failed, pending });
}
