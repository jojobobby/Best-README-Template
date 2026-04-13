# ApplyBot Operations Runbook

## 1. Updating Your Identity Profile

```bash
# Decrypt current profile
IDENTITY_KEY=<key> pnpm identity decrypt

# Edit identity-setup/identity.json.decrypted
# Make changes...

# Re-encrypt
cp identity-setup/identity.json.decrypted identity-setup/identity.json
IDENTITY_KEY=<key> pnpm identity encrypt

# Copy to PVC
cp identity-setup/profile.enc /mnt/applybot-identity/

# Restart worker to reload identity (cached for 5 min)
kubectl rollout restart deployment/applybot-worker -n applybot

# Clean up decrypted file
rm identity-setup/identity.json.decrypted
```

## 2. Adding a New Job Source

1. Create a new scraper at `apps/scraper/src/scrapers/<source>.ts`
2. Export a function that returns `JobCreateInput[]`
3. Add the source to the `JobSource` Prisma enum
4. Call it from `apps/scraper/src/scheduler.ts` in `runAllScrapers()`
5. Add any new env vars to `.env.example` and `packages/shared/src/config/env.ts`

## 3. Manually Triggering a Job Application

```bash
# Add a job by URL
curl -X POST http://localhost:3000/jobs/manual \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://boards.greenhouse.io/company/jobs/12345", "title": "Engineer", "company": "Company"}'
```

## 4. Retrying Failed Applications

```bash
# Retry all failed jobs in the apply queue
curl -X POST http://localhost:3000/admin/queues/retry-failed \
  -H "X-API-Key: <your-key>"

# Check queue stats
curl http://localhost:3000/admin/queues/stats \
  -H "X-API-Key: <your-key>"
```

## 5. Checking Queue Health

```bash
curl http://localhost:3000/admin/queues/stats -H "X-API-Key: <key>"
# Returns: { notify: {...}, apply: {...}, scrape: {...} }

# Bull Board dashboard (if configured)
# Visit https://your-domain/admin/bull
```

## 6. Viewing Application Screenshots

```bash
# Screenshots are stored in the identity PVC
ls /mnt/applybot-identity/screenshots/

# Copy from K8s pod
kubectl cp applybot/applybot-worker-xxx:/identity/screenshots/ ./screenshots/
```

## 7. Rotating the Identity Key

```bash
# 1. Generate new key
./scripts/generate-identity-key.sh
# Save the new key

# 2. Decrypt with old key
IDENTITY_KEY=<old-key> pnpm identity decrypt

# 3. Re-encrypt with new key
cp identity-setup/identity.json.decrypted identity-setup/identity.json
IDENTITY_KEY=<new-key> pnpm identity encrypt
cp identity-setup/profile.enc /mnt/applybot-identity/

# 4. Update K8s secret
echo -n "<new-key>" | base64
# Edit k8s/base/secrets.yaml → identitykey → IDENTITY_KEY
kubectl apply -f k8s/base/secrets.yaml

# 5. Restart services
kubectl rollout restart deployment -n applybot
```

## 8. Scaling

- **API**: Handled by HPA (2-5 replicas at 70% CPU)
- **Worker**: Keep at 1 replica (Playwright is memory-heavy, 3Gi limit)
- **Scraper**: 1 replica is sufficient

To manually scale:
```bash
kubectl scale deployment/applybot-api --replicas=3 -n applybot
```

## 9. Backing Up the Database

```bash
# Backup
kubectl exec -n applybot postgres-0 -- pg_dump -U applybot applybot > backup.sql

# Restore
kubectl exec -n applybot -i postgres-0 -- psql -U applybot applybot < backup.sql
```

## 10. Disaster Recovery

```bash
# 1. Ensure identity files are backed up locally
# 2. Restore database from backup (see above)
# 3. Re-deploy
./scripts/apply-k8s.sh

# 4. Verify
kubectl get pods -n applybot
curl http://your-domain/health
```

## Viewing Logs

```bash
./scripts/logs.sh api       # API logs
./scripts/logs.sh worker    # Worker logs
./scripts/logs.sh scraper   # Scraper logs
./scripts/logs.sh errors    # All error logs
./scripts/logs.sh all       # Everything
```
