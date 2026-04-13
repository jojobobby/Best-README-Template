#!/bin/bash
# Build and tag all ApplyBot Docker images

set -e

REGISTRY=${1:-"ghcr.io/jojobobby"}
TAG=${2:-"latest"}

echo "Building ApplyBot images..."
echo "Registry: $REGISTRY"
echo "Tag: $TAG"
echo ""

# API
echo "Building API image..."
docker build -f apps/api/Dockerfile -t "$REGISTRY/applybot-api:$TAG" -t "$REGISTRY/applybot-api:latest" .

# Worker
echo "Building Worker image..."
docker build -f apps/worker/Dockerfile -t "$REGISTRY/applybot-worker:$TAG" -t "$REGISTRY/applybot-worker:latest" .

# Scraper
echo "Building Scraper image..."
docker build -f apps/scraper/Dockerfile -t "$REGISTRY/applybot-scraper:$TAG" -t "$REGISTRY/applybot-scraper:latest" .

echo ""
echo "All images built successfully:"
docker images | grep applybot
