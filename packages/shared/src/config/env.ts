import { z } from 'zod';

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
});

export const apiEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().default(3000),
  API_KEY: z.string().min(32, 'API_KEY must be at least 32 characters'),
  TWILIO_ACCOUNT_SID: z.string().startsWith('AC', 'Twilio account SID must start with AC'),
  TWILIO_AUTH_TOKEN: z.string().length(32, 'Twilio auth token must be 32 characters'),
  TWILIO_FROM_NUMBER: z.string().regex(/^\+\d{10,15}$/, 'TWILIO_FROM_NUMBER must be E.164 format'),
  OWNER_PHONE: z.string().regex(/^\+\d{10,15}$/, 'OWNER_PHONE must be E.164 format'),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-', 'ANTHROPIC_API_KEY must start with sk-ant-'),
  IDENTITY_KEY: z.string().min(32, 'IDENTITY_KEY must be at least 32 characters'),
  IDENTITY_PATH: z.string().default('/identity/profile.enc'),
  BULL_BOARD_USER: z.string().optional(),
  BULL_BOARD_PASS: z.string().optional(),
  METRICS_TOKEN: z.string().optional(),
  LOG_TO_FILE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
});

export const workerEnvSchema = baseEnvSchema.extend({
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-', 'ANTHROPIC_API_KEY must start with sk-ant-'),
  IDENTITY_KEY: z.string().min(32, 'IDENTITY_KEY must be at least 32 characters'),
  IDENTITY_PATH: z.string().default('/identity/profile.enc'),
  RESUME_PATH: z.string().default('/identity/resume.pdf'),
  SCREENSHOT_DIR: z.string().default('/identity/screenshots'),
  HEADLESS: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  BROWSER_POOL_SIZE: z.coerce.number().default(2),
  MAX_RETRIES: z.coerce.number().default(3),
  PLAYWRIGHT_CHROMIUM_ARGS: z.string().default('--no-sandbox --disable-setuid-sandbox'),
  TWILIO_ACCOUNT_SID: z.string().startsWith('AC', 'Twilio account SID must start with AC'),
  TWILIO_AUTH_TOKEN: z.string().length(32, 'Twilio auth token must be 32 characters'),
  TWILIO_FROM_NUMBER: z.string().regex(/^\+\d{10,15}$/, 'TWILIO_FROM_NUMBER must be E.164 format'),
  OWNER_PHONE: z.string().regex(/^\+\d{10,15}$/, 'OWNER_PHONE must be E.164 format'),
  TWOCAPTCHA_API_KEY: z.string().optional(),
  WORKDAY_EMAIL: z.string().optional(),
  WORKDAY_PASSWORD: z.string().optional(),
  LOG_TO_FILE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
});

export const scraperEnvSchema = baseEnvSchema.extend({
  ADZUNA_APP_ID: z.string().min(1, 'ADZUNA_APP_ID is required'),
  ADZUNA_APP_KEY: z.string().min(1, 'ADZUNA_APP_KEY is required'),
  GREENHOUSE_COMPANY_SLUGS: z
    .string()
    .default('')
    .transform((v) => (v ? v.split(',').map((s) => s.trim()) : [])),
  LEVER_COMPANY_SLUGS: z
    .string()
    .default('')
    .transform((v) => (v ? v.split(',').map((s) => s.trim()) : [])),
  SEARCH_KEYWORDS: z
    .string()
    .min(1, 'SEARCH_KEYWORDS is required')
    .transform((v) => v.split(',').map((s) => s.trim())),
  SEARCH_LOCATION: z.string().default('United States'),
  EXCLUDE_KEYWORDS: z
    .string()
    .default('')
    .transform((v) => (v ? v.split(',').map((s) => s.trim()) : [])),
  SCRAPE_INTERVAL_MINUTES: z.coerce.number().default(30),
  SCRAPE_ON_START: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  LOG_TO_FILE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type ScraperEnv = z.infer<typeof scraperEnvSchema>;

export function validateEnv<T extends z.ZodSchema>(schema: T): z.infer<T> {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    console.error('\n=== ENVIRONMENT VALIDATION FAILED ===\n');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\nCheck your .env file or environment variables.\n');
    process.exit(1);
  }

  return Object.freeze(result.data) as z.infer<T>;
}
