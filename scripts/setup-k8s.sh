#!/bin/bash
# Setup script for k3s dedicated server
# Run this ONCE on your server before deploying ApplyBot

set -e

echo "=== ApplyBot K8s Setup ==="
echo ""

# Create host directories for PersistentVolumes
echo "Creating host directories..."
sudo mkdir -p /mnt/applybot-identity/screenshots
sudo mkdir -p /mnt/applybot-postgres
sudo mkdir -p /mnt/applybot-redis

# Set permissions (UID 1000 for app containers, 999 for postgres)
sudo chmod 755 /mnt/applybot-identity
sudo chmod 755 /mnt/applybot-postgres
sudo chmod 755 /mnt/applybot-redis

sudo chown 1000:1000 /mnt/applybot-identity
sudo chown 1000:1000 /mnt/applybot-identity/screenshots
sudo chown 999:999 /mnt/applybot-postgres
sudo chown 1000:1000 /mnt/applybot-redis

echo "Host directories created:"
echo "  /mnt/applybot-identity    (identity PVC: profile.enc, resume.pdf, screenshots/)"
echo "  /mnt/applybot-postgres    (postgres data)"
echo "  /mnt/applybot-redis       (redis data)"

# Label the node (for PV node affinity)
NODE_NAME=$(hostname)
echo ""
echo "Labeling node: $NODE_NAME"
kubectl label node "$NODE_NAME" kubernetes.io/hostname="$NODE_NAME" --overwrite 2>/dev/null || true

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Copy your encrypted identity profile:"
echo "     cp identity-setup/profile.enc /mnt/applybot-identity/"
echo "     cp your-resume.pdf /mnt/applybot-identity/resume.pdf"
echo ""
echo "  2. Fill in k8s/base/secrets.yaml with your actual values"
echo ""
echo "  3. Deploy: ./scripts/apply-k8s.sh"
