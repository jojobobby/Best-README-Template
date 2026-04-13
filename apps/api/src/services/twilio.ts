import Twilio from 'twilio';
import { Request } from 'express';
import { prisma } from '@applybot/db';
import { ApiEnv, TwilioError } from '@applybot/shared';
import { createLogger } from '../middleware/logger';

const logger = createLogger('twilio');

let client: Twilio.Twilio;
let env: ApiEnv;

export function initTwilio(config: ApiEnv) {
  env = config;
  client = Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}

async function sendSms(to: string, body: string, jobId?: string): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const message = await client.messages.create({
        body,
        from: env.TWILIO_FROM_NUMBER,
        to,
      });

      await prisma.smsMessage.create({
        data: {
          direction: 'OUTBOUND',
          twilioSid: message.sid,
          from: env.TWILIO_FROM_NUMBER,
          to,
          body,
          jobId: jobId || null,
        },
      });

      logger.info('SMS sent', { to, sid: message.sid, jobId });
      return message.sid;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(`SMS send attempt ${attempt + 1} failed`, { error: lastError.message });
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw new TwilioError('SEND_FAILED', `Failed to send SMS after 3 attempts: ${lastError?.message}`);
}

export async function sendJobNotification(job: {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  smsMessageSid: string | null;
}) {
  if (job.smsMessageSid) {
    logger.warn('Job already notified, skipping', { jobId: job.id });
    return;
  }

  const location = job.location || 'Remote';
  const salary =
    job.salaryMin && job.salaryMax
      ? `$${(job.salaryMin / 1000).toFixed(0)}k - $${(job.salaryMax / 1000).toFixed(0)}k ${job.salaryCurrency}`
      : 'Not listed';

  const body = [
    `New Job Match!`,
    `${job.title} at ${job.company}`,
    `Location: ${location}`,
    `Salary: ${salary}`,
    '',
    'Reply Y to apply or N to skip.',
  ].join('\n');

  const sid = await sendSms(env.OWNER_PHONE, body, job.id);

  await prisma.job.update({
    where: { id: job.id },
    data: {
      smsMessageSid: sid,
      notifiedAt: new Date(),
    },
  });

  logger.info('Job notification sent', { jobId: job.id, sid });
}

export async function sendApplySuccess(job: { id: string; title: string; company: string }) {
  const body = `Applied! ${job.title} at ${job.company}. Check your email for confirmation. I took a screenshot too.`;
  await sendSms(env.OWNER_PHONE, body, job.id);
}

export async function sendApplyFailure(
  job: { id: string; title: string; company: string },
  reason: string,
) {
  const body = `Apply failed for ${job.title} at ${job.company}. Reason: ${reason}. Status set to FAILED.`;
  await sendSms(env.OWNER_PHONE, body, job.id);
}

export async function sendDailySummary(stats: {
  applied: number;
  failed: number;
  pending: number;
}) {
  const body = [
    `Daily Summary:`,
    `Applied: ${stats.applied}`,
    `Failed: ${stats.failed}`,
    `Pending review: ${stats.pending}`,
  ].join('\n');
  await sendSms(env.OWNER_PHONE, body);
}

export function validateTwilioSignature(req: Request): boolean {
  const signature = req.headers['x-twilio-signature'] as string;
  if (!signature) return false;

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['host'] || '';
  const url = `${protocol}://${host}${req.originalUrl}`;

  return Twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, url, req.body);
}
