export interface TwilioWebhookPayload {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia: string;
  NumSegments: string;
  SmsStatus: string;
  ApiVersion: string;
}

export interface SmsMessageDto {
  id: string;
  direction: 'OUTBOUND' | 'INBOUND';
  twilioSid: string;
  from: string;
  to: string;
  body: string;
  jobId: string | null;
  createdAt: string;
}

export type SmsReplyAction = 'APPROVE' | 'REJECT' | 'AMBIGUOUS';

export function parseSmsReply(body: string): SmsReplyAction {
  const normalized = body.trim().toUpperCase();
  if (normalized === 'Y' || normalized === 'YES' || normalized === 'APPLY') {
    return 'APPROVE';
  }
  if (normalized === 'N' || normalized === 'NO' || normalized === 'SKIP') {
    return 'REJECT';
  }
  return 'AMBIGUOUS';
}
