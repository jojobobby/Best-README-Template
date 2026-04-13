# Storage Setup for ApplyBot

## Host Directories

Before deploying, create the following directories on your dedicated server:

```bash
# Identity PVC (encrypted profile, resume, screenshots)
sudo mkdir -p /mnt/applybot-identity/screenshots
sudo chown 1000:1000 /mnt/applybot-identity
sudo chown 1000:1000 /mnt/applybot-identity/screenshots

# Postgres data
sudo mkdir -p /mnt/applybot-postgres
sudo chown 999:999 /mnt/applybot-postgres

# Redis data
sudo mkdir -p /mnt/applybot-redis
sudo chown 1000:1000 /mnt/applybot-redis
```

Or simply run: `./scripts/setup-k8s.sh`

## PersistentVolumes

| PV | Size | Path | Used By |
|----|------|------|---------|
| identity-pv | 1Gi | /mnt/applybot-identity | API (ro), Worker (rw) |
| postgres-pv | 10Gi | /mnt/applybot-postgres | Postgres StatefulSet |
| redis-pv | 2Gi | /mnt/applybot-redis | Redis Deployment |

## Notes

- The identity PVC uses `ReadWriteOnce` — the Worker writes screenshots to it
- Screenshots are stored at `/identity/screenshots/` (sub-path of identity PVC, no separate PVC needed)
- Postgres uses a StatefulSet with `volumeClaimTemplates` for its own PVC
- All PVs use `local-storage` StorageClass with `WaitForFirstConsumer` binding
- Reclaim policy is `Retain` — data persists even if PVCs are deleted
