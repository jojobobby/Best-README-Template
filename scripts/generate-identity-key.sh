#!/bin/bash
# Generate a random 256-bit key for identity encryption

set -e

KEY=$(openssl rand -hex 32)

echo "Generated Identity Key:"
echo "  $KEY"
echo ""
echo "Add to your .env file:"
echo "  IDENTITY_KEY=$KEY"
echo ""
echo "Add to k8s/base/secrets.yaml under identitykey:"
echo "  IDENTITY_KEY: $(echo -n "$KEY" | base64)"
echo ""
echo "IMPORTANT: Store this key securely. If you lose it, you cannot decrypt your identity profile."
