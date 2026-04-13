import { ZodIssue } from 'zod';

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
    };
  }

  toUserMessage(): string {
    return this.message;
  }
}

export class IdentityNotFoundError extends AppError {
  constructor(message = 'Identity profile not found') {
    super(message, 'IDENTITY_NOT_FOUND', 500);
  }

  toUserMessage(): string {
    return 'Identity profile is missing. Please set up your profile first.';
  }
}

export class IdentityDecryptionError extends AppError {
  constructor(message = 'Failed to decrypt identity profile') {
    super(message, 'IDENTITY_DECRYPTION_FAILED', 500);
  }

  toUserMessage(): string {
    return 'Could not decrypt your profile. Check that the identity key is correct.';
  }
}

export class IdentityValidationError extends AppError {
  public readonly issues: ZodIssue[];

  constructor(issues: ZodIssue[]) {
    const fields = issues.map((i) => i.path.join('.')).join(', ');
    super(
      `Identity validation failed on fields: ${fields}`,
      'IDENTITY_VALIDATION_FAILED',
      500,
      { issues },
    );
    this.issues = issues;
  }

  toUserMessage(): string {
    return 'Your profile has missing or invalid fields. Please update it.';
  }
}

export class JobNotFoundError extends AppError {
  constructor(jobId: string) {
    super(`Job not found: ${jobId}`, 'JOB_NOT_FOUND', 404, { jobId });
  }
}

export class JobStatusError extends AppError {
  constructor(jobId: string, currentStatus: string, attemptedStatus: string) {
    super(
      `Cannot transition job ${jobId} from ${currentStatus} to ${attemptedStatus}`,
      'JOB_STATUS_INVALID',
      400,
      { jobId, currentStatus, attemptedStatus },
    );
  }
}

export class TwilioError extends AppError {
  constructor(twilioCode: string, message: string) {
    super(message, 'TWILIO_ERROR', 502, { twilioCode });
  }

  toUserMessage(): string {
    return 'SMS service encountered an error. Will retry shortly.';
  }
}

export class BrowserError extends AppError {
  public readonly screenshotPath?: string;

  constructor(message: string, screenshotPath?: string) {
    super(message, 'BROWSER_ERROR', 500, { screenshotPath });
    this.screenshotPath = screenshotPath;
  }

  toUserMessage(): string {
    return 'Browser automation failed. The job will be retried.';
  }
}

export class FormDetectionError extends AppError {
  constructor(url: string, message: string) {
    super(message, 'FORM_DETECTION_ERROR', 500, { url });
  }

  toUserMessage(): string {
    return 'Could not detect form fields on the application page.';
  }
}

export class CaptchaDetectedError extends AppError {
  constructor(url: string) {
    super(`CAPTCHA detected at ${url}`, 'CAPTCHA_DETECTED', 500, { url });
  }

  toUserMessage(): string {
    return 'CAPTCHA detected — this application needs to be completed manually.';
  }
}

export class LoginRequiredError extends AppError {
  constructor(url: string) {
    super(`Login required at ${url}`, 'LOGIN_REQUIRED', 500, { url });
  }

  toUserMessage(): string {
    return 'This application requires login credentials that are not configured.';
  }
}

export class SubmissionError extends AppError {
  constructor(url: string, message: string) {
    super(message, 'SUBMISSION_ERROR', 500, { url });
  }

  toUserMessage(): string {
    return 'Form submission could not be confirmed.';
  }
}

export class QueueError extends AppError {
  constructor(queueName: string, message: string) {
    super(message, 'QUEUE_ERROR', 500, { queueName });
  }
}

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING_REVIEW: ['APPROVED', 'REJECTED', 'SKIPPED'],
  APPROVED: ['APPLYING', 'SKIPPED'],
  REJECTED: ['PENDING_REVIEW'],
  APPLYING: ['APPLIED', 'FAILED', 'SKIPPED'],
  APPLIED: [],
  FAILED: ['APPROVED', 'SKIPPED'],
  SKIPPED: ['PENDING_REVIEW'],
};

export function validateStatusTransition(
  currentStatus: string,
  newStatus: string,
  jobId: string,
): void {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new JobStatusError(jobId, currentStatus, newStatus);
  }
}
