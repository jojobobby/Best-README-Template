#!/bin/bash
# Deploy ApplyBot to k3s cluster in correct dependency order

set -e

echo "=== Deploying ApplyBot to Kubernetes ==="
echo ""

# 1. Namespace and storage
echo "Step 1: Creating namespace and storage class..."
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/storage/storageclass.yaml

# 2. RBAC
echo "Step 2: Setting up RBAC..."
kubectl apply -f k8s/base/rbac.yaml

# 3. Secrets and config
echo "Step 3: Applying secrets and config..."
kubectl apply -f k8s/base/secrets.yaml
kubectl apply -f k8s/base/configmap.yaml

# 4. PersistentVolumes and Claims
echo "Step 4: Creating persistent volumes..."
kubectl apply -f k8s/storage/identity-pv.yaml
kubectl apply -f k8s/storage/identity-pvc.yaml
kubectl apply -f k8s/storage/postgres-pv.yaml
kubectl apply -f k8s/storage/redis-pv.yaml
kubectl apply -f k8s/storage/redis-pvc.yaml

# 5. Infrastructure: Postgres and Redis
echo "Step 5: Deploying Postgres and Redis..."
kubectl apply -f k8s/deployments/postgres-deployment.yaml
kubectl apply -f k8s/services/postgres-service.yaml
kubectl apply -f k8s/deployments/redis-deployment.yaml
kubectl apply -f k8s/services/redis-service.yaml

echo "Waiting for Postgres to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n applybot --timeout=120s

echo "Waiting for Redis to be ready..."
kubectl wait --for=condition=ready pod -l app=redis -n applybot --timeout=60s

# 6. Run database migrations
echo "Step 6: Running database migrations..."
kubectl apply -f k8s/jobs/migrate.yaml
kubectl wait --for=condition=complete job/applybot-migrate -n applybot --timeout=120s 2>/dev/null || true

# 7. Application deployments
echo "Step 7: Deploying application services..."
kubectl apply -f k8s/deployments/api-deployment.yaml
kubectl apply -f k8s/services/api-service.yaml
kubectl apply -f k8s/deployments/worker-deployment.yaml
kubectl apply -f k8s/deployments/scraper-deployment.yaml

# 8. Ingress
echo "Step 8: Setting up ingress..."
kubectl apply -f k8s/ingress/ingress.yaml

# 9. CronJobs and HPA
echo "Step 9: Setting up CronJobs and autoscaling..."
kubectl apply -f k8s/cronjobs/scraper-cron.yaml
kubectl apply -f k8s/hpa.yaml

# Wait for deployments
echo ""
echo "Waiting for deployments to be ready..."
kubectl rollout status deployment/applybot-api -n applybot --timeout=120s
kubectl rollout status deployment/applybot-worker -n applybot --timeout=120s
kubectl rollout status deployment/applybot-scraper -n applybot --timeout=120s

echo ""
echo "=== Deployment Complete ==="
echo ""
kubectl get pods -n applybot
echo ""
kubectl get svc -n applybot
