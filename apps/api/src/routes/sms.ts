import { Router } from 'express';
import { prisma } from '@applybot/db';
import { ApiEnv, parseSmsReply, enqueueApply } from '@applybot/shared';
import { validateTwilioSignature } from '../services/twilio';
import { jobsApprovedTotal, jobsRejectedTotal } from '../services/metrics';
import { createLogger } from '../middleware/logger';

const logger = createLogger('sms-webhook');

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function twiml(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
}

export function smsRouter(env: ApiEnv): Router {
  const router = Router();
  initTwilio(env);

  router.post('/', async (req, res) => {
    try {
      // Validate Twilio signature
      if (env.NODE_ENV === 'production' && !validateTwilioSignature(req)) {
        logger.warn('Invalid Twilio signature', { ip: req.ip });
        res.status(403).send('Forbidden');
        return;
      }

      const { MessageSid, From, Body } = req.body;

      if (!MessageSid || !Body) {
        res.status(400).send('Missing required fields');
        return;
      }

      // Log inbound message
      await prisma.smsMessage.create({
        data: {
          direction: 'INBOUND',
          twilioSid: MessageSid,
          from: From,
          to: env.TWILIO_FROM_NUMBER,
          body: Body,
        },
      });

      // Find the most recent pending job that was notified
      const pendingJob = await prisma.job.findFirst({
        where: {
          status: 'PENDING_REVIEW',
          smsMessageSid: { not: null },
          smsReplyReceived: false,
        },
        orderBy: { notifiedAt: 'desc' },
      });

      if (!pendingJob) {
        logger.info('No pending job found for SMS reply', { from: From });
        res.type('text/xml').send(twiml('No pending jobs to respond to right now.'));
        return;
      }

      const action = parseSmsReply(Body);

      if (action === 'APPROVE') {
        await prisma.job.update({
          where: { id: pendingJob.id },
          data: {
            status: 'APPROVED',
            smsReplyReceived: true,
            repliedAt: new Date(),
          },
        });

        // Update SMS message with job reference
        await prisma.smsMessage.update({
          where: { twilioSid: MessageSid },
          data: { jobId: pendingJob.id },
        });

        await enqueueApply(pendingJob.id);
        jobsApprovedTotal.inc();

        logger.info('Job approved via SMS', { jobId: pendingJob.id, title: pendingJob.title });
        res
          .type('text/xml')
          .send(
            twiml(
              `Got it! Applying to ${pendingJob.title} at ${pendingJob.company} now. I'll text you when it's done.`,
            ),
          );
      } else if (action === 'REJECT') {
        await prisma.job.update({
          where: { id: pendingJob.id },
          data: {
            status: 'REJECTED',
            smsReplyReceived: true,
            repliedAt: new Date(),
          },
        });

        await prisma.smsMessage.update({
          where: { twilioSid: MessageSid },
          data: { jobId: pendingJob.id },
        });

        jobsRejectedTotal.inc();

        logger.info('Job rejected via SMS', { jobId: pendingJob.id, title: pendingJob.title });
        res
          .type('text/xml')
          .send(twiml(`Skipped ${pendingJob.title} at ${pendingJob.company}. On to the next one!`));
      } else {
        logger.info('Ambiguous SMS reply', { body: Body });
        res.type('text/xml').send(twiml('Reply Y to apply or N to skip.'));
      }
    } catch (err) {
      logger.error('SMS webhook error', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.type('text/xml').send(twiml('Something went wrong. Please try again.'));
    }
  });

  return router;
}
