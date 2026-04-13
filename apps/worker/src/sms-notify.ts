import Twilio from 'twilio';
import { WorkerEnv } from '@applybot/shared';
import { createWorkerLogger } from './logger';

const logger = createWorkerLogger('sms-notify');

let client: Twilio.Twilio | null = null;
let fromNumber: string;
let ownerPhone: string;

export function initWorkerSms(env: WorkerEnv) {
  client = Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  fromNumber = env.TWILIO_FROM_NUMBER;
  ownerPhone = env.OWNER_PHONE;
}

async function send(body: string) {
  if (!client) {
    logger.warn('SMS client not initialized, skipping notification');
    return;
  }
  try {
    await client.messages.create({ body, from: fromNumber, to: ownerPhone });
  } catch (err) {
    logger.error('Failed to send SMS notification', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function notifyApplySuccess(title: string, company: string) {
  await send(`Applied! ${title} at ${company}. Check your email for confirmation. I took a screenshot too.`);
}

export async function notifyApplyFailure(title: string, company: string, reason: string) {
  await send(`Apply failed for ${title} at ${company}. Reason: ${reason}. Status set to FAILED.`);
}

export async function notifyApplySkipped(title: string, company: string, reason: string) {
  await send(`Skipped ${title} at ${company} — ${reason}.`);
}
