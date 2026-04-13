# ApplyBot

AI-powered job auto-apply system with SMS control. Get texted job matches, reply Y or N, and an AI agent automatically fills out and submits the application for you.

## Architecture

```
Job Sources (Adzuna, Greenhouse, Lever APIs)
         |
         v
   +-----------+     +---------+     +--------+
   |  Scraper  | --> | Postgres | <-- |  API   |
   +-----------+     +---------+     +--------+
         |                               |    ^
         v                               v    |
   +-----------+                    +---------+|
   |   Redis   | <-- Bull Queue -- | Twilio  ||
   |  (Queue)  |                   |   SMS   ||
   +-----------+                    +---------+|
         |                               |    |
         v                               v    |
   +-----------+                    +---------+
   |  Worker   | -- Playwright -->  | You     |
   | (Claude   |    + Claude AI     | (Phone) |
   |  Agent)   |                    +---------+
   +-----------+
         |
         v
   Job Application
   Submitted + Screenshot
```

## How It Works

1. **Scraper** fetches jobs from Adzuna, Greenhouse, and Lever APIs every 30 minutes
2. New jobs are filtered by keywords and deduplicated
3. **API** sends you an SMS via Twilio with job details
4. You reply **Y** to apply or **N** to skip
5. **Worker** launches a headless browser (Playwright)
6. **Claude AI** reads the application form, fills in your info from your encrypted identity profile
7. Claude generates a personalized cover letter
8. Form is submitted, screenshot taken, and you get a confirmation SMS

## Prerequisites

- Node.js 20+, pnpm 9+
- Docker (for local development)
- k3s cluster (for production deployment)
- Twilio account ($1/month phone number)
- Anthropic API key (Claude)
- Adzuna API key (free)

## Quick Start (Local)

```bash
# 1. Clone and install
git clone <repo-url> && cd applybot
cp .env.example .env  # Fill in your API keys

pnpm install

# 2. Create your identity profile
pnpm identity init        # Interactive wizard
pnpm identity encrypt     # Encrypt with IDENTITY_KEY

# 3. Start infrastructure
docker-compose up -d postgres redis

# 4. Run migrations and seed
pnpm db:migrate
pnpm db:seed

# 5. Start all services
pnpm dev
```

## Identity Profile

Your identity is the core of ApplyBot. It contains all your personal info, work history, skills, and application preferences. It's stored **encrypted** using AES-256-GCM.

### Setup

```bash
# Generate encryption key
./scripts/generate-identity-key.sh

# Add to .env
IDENTITY_KEY=<your-64-char-hex-key>

# Create profile interactively
pnpm identity init

# Encrypt it
IDENTITY_KEY=<key> pnpm identity encrypt

# Verify
pnpm identity status
```

### Storage

In Kubernetes, the encrypted profile lives in the **identity PVC** mounted at `/identity/`:
- `/identity/profile.enc` — your encrypted profile (decrypted using the `identitykey` K8s secret)
- `/identity/resume.pdf` — your resume PDF
- `/identity/screenshots/` — application confirmation screenshots

## Kubernetes Deployment (k3s)

```bash
# 1. Prepare your server
./scripts/setup-k8s.sh

# 2. Copy identity files to the PV
cp identity-setup/profile.enc /mnt/applybot-identity/
cp your-resume.pdf /mnt/applybot-identity/resume.pdf

# 3. Fill in secrets
# Edit k8s/base/secrets.yaml with base64-encoded values

# 4. Deploy
./scripts/apply-k8s.sh
```

## Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | Yes |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | Yes |
| `TWILIO_FROM_NUMBER` | Your Twilio phone (E.164) | Yes |
| `OWNER_PHONE` | Your personal phone (E.164) | Yes |
| `ANTHROPIC_API_KEY` | Claude API key | Yes |
| `IDENTITY_KEY` | AES-256-GCM encryption key | Yes |
| `ADZUNA_APP_ID` | Adzuna API app ID | Yes |
| `ADZUNA_APP_KEY` | Adzuna API key | Yes |
| `SEARCH_KEYWORDS` | Comma-separated job keywords | Yes |
| `GREENHOUSE_COMPANY_SLUGS` | Companies to monitor on Greenhouse | Optional |
| `LEVER_COMPANY_SLUGS` | Companies to monitor on Lever | Optional |
| `EXCLUDE_KEYWORDS` | Keywords to filter out | Optional |
| `TWOCAPTCHA_API_KEY` | 2Captcha API key | Optional |

See `.env.example` for the complete list.

## Supported Platforms

| Platform | Support | Notes |
|----------|---------|-------|
| Greenhouse | Full | Multi-step form handling |
| Lever | Full | Single-page form |
| Workday | Partial | Claude vision for JS-heavy forms, requires login |
| Generic ATS | Basic | CAPTCHA detection, login wall detection |
| Indeed | Blocked | Bot protection too aggressive |
| LinkedIn | Blocked | Requires login + bot protection |

## SMS Flow Example

```
ApplyBot: New Job Match!
         Software Engineer at Acme Corp
         Location: San Francisco, CA
         Salary: $120k - $180k USD

         Reply Y to apply or N to skip.

You:     Y

ApplyBot: Got it! Applying to Software Engineer at Acme Corp now.
         I'll text you when it's done.

ApplyBot: Applied! Software Engineer at Acme Corp.
         Check your email for confirmation. I took a screenshot too.
```

## Project Structure

```
/apps
  /api        Express.js API + Twilio webhooks
  /worker     Playwright + Claude AI apply agent
  /scraper    Job scraper (Adzuna, Greenhouse, Lever)
/packages
  /shared     Types, Identity, queues, errors, env validation
  /db         Prisma schema + client
/k8s          Kubernetes manifests (k3s)
/scripts      Setup, deploy, and identity management scripts
```

## License

MIT
