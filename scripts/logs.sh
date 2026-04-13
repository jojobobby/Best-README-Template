#!/bin/bash
# Tail logs from ApplyBot pods

SERVICE=${1:-"api"}
NAMESPACE="applybot"

case "$SERVICE" in
  api|--api)
    kubectl logs -n "$NAMESPACE" -l app=applybot-api --tail=100 -f
    ;;
  worker|--worker)
    kubectl logs -n "$NAMESPACE" -l app=applybot-worker --tail=100 -f
    ;;
  scraper|--scraper)
    kubectl logs -n "$NAMESPACE" -l app=applybot-scraper --tail=100 -f
    ;;
  postgres|--postgres)
    kubectl logs -n "$NAMESPACE" -l app=postgres --tail=100 -f
    ;;
  redis|--redis)
    kubectl logs -n "$NAMESPACE" -l app=redis --tail=100 -f
    ;;
  all|--all)
    kubectl logs -n "$NAMESPACE" --all-containers --tail=50 -f
    ;;
  errors|--errors)
    kubectl logs -n "$NAMESPACE" --all-containers --tail=200 | grep -i "error\|fatal\|panic"
    ;;
  *)
    echo "Usage: ./scripts/logs.sh [api|worker|scraper|postgres|redis|all|errors]"
    exit 1
    ;;
esac
