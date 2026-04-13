# ApplyBot Kubernetes Deployment

## Prerequisites

- k3s cluster running on your dedicated server
- `kubectl` configured to connect to your cluster
- Docker images built and pushed to `ghcr.io/jojobobby`

## Deployment Order

The manifests must be applied in dependency order. Use the automated script:

```bash
./scripts/apply-k8s.sh
```

Or manually:

1. `namespace.yaml`, `storageclass.yaml`
2. `rbac.yaml`
3. `secrets.yaml`, `configmap.yaml` (fill in actual values first!)
4. PVs and PVCs (identity, postgres, redis)
5. Postgres StatefulSet + Service, Redis Deployment + Service
6. Wait for Postgres ready: `kubectl wait --for=condition=ready pod -l app=postgres -n applybot`
7. Prisma migrate Job
8. API, Worker, Scraper Deployments + Services
9. Ingress, CronJob, HPA

## Setting Up Secrets

All secret values must be base64-encoded:

```bash
echo -n "your-actual-value" | base64
```

Edit `k8s/base/secrets.yaml` and replace all `REPLACE` values.

## Identity PVC

The `identity` PVC is mounted at `/identity` in the API and Worker pods. It must contain:

- `profile.enc` — your encrypted identity profile
- `resume.pdf` — your resume

Create the host directory on your server:

```bash
sudo mkdir -p /mnt/applybot-identity/screenshots
sudo chown 1000:1000 /mnt/applybot-identity
```

Then copy your files:

```bash
cp profile.enc /mnt/applybot-identity/
cp resume.pdf /mnt/applybot-identity/
```

## Using Kustomize

For production deployment with image tag overrides:

```bash
kubectl apply -k k8s/overlays/production
```

To update image tags:

```bash
cd k8s/overlays/production
kustomize edit set image ghcr.io/jojobobby/applybot-api:v1.2.3
kubectl apply -k .
```
