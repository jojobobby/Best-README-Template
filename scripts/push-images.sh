#!/bin/bash
# Push all ApplyBot Docker images to registry

set -e

REGISTRY=${1:-"ghcr.io/jojobobby"}
TAG=${2:-"latest"}

echo "Pushing ApplyBot images to $REGISTRY..."

docker push "$REGISTRY/applybot-api:$TAG"
docker push "$REGISTRY/applybot-api:latest"

docker push "$REGISTRY/applybot-worker:$TAG"
docker push "$REGISTRY/applybot-worker:latest"

docker push "$REGISTRY/applybot-scraper:$TAG"
docker push "$REGISTRY/applybot-scraper:latest"

echo "All images pushed successfully!"
