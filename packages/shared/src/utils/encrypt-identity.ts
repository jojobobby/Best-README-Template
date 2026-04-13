#!/usr/bin/env ts-node

/**
 * CLI script to encrypt a plain JSON identity file into profile.enc
 *
 * Usage:
 *   IDENTITY_KEY=your-key ts-node encrypt-identity.ts <input.json> <output.enc>
 */

import * as fs from 'fs';
import * as path from 'path';
import { identitySchema, Identity } from '../types/identity';
import { encryptIdentity, decryptIdentity } from './identity';

function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: encrypt-identity.ts <input.json> [output.enc]');
    console.error('  IDENTITY_KEY env var must be set');
    process.exit(1);
  }

  const identityKey = process.env.IDENTITY_KEY;
  if (!identityKey || identityKey.length < 32) {
    console.error('Error: IDENTITY_KEY environment variable must be set (min 32 characters)');
    console.error('Generate one with: openssl rand -hex 32');
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]!);
  const outputPath = args[1] ? path.resolve(args[1]) : path.join(path.dirname(inputPath), 'profile.enc');

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`Reading identity from: ${inputPath}`);
  const raw = fs.readFileSync(inputPath, 'utf8');

  let identity: Identity;
  try {
    identity = JSON.parse(raw) as Identity;
  } catch {
    console.error('Error: Input file is not valid JSON');
    process.exit(1);
  }

  const validation = identitySchema.safeParse(identity);
  if (!validation.success) {
    console.error('Error: Identity validation failed:');
    for (const issue of validation.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  console.log(`Encrypting with AES-256-GCM...`);
  const payload = encryptIdentity(identity, identityKey);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
  const stats = fs.statSync(outputPath);

  console.log(`Encrypted identity written to: ${outputPath}`);
  console.log(`File size: ${stats.size} bytes`);
  console.log(`Encrypted at: ${payload.encryptedAt}`);

  // Verify roundtrip
  console.log('Verifying decryption roundtrip...');
  const decrypted = decryptIdentity(payload, identityKey);
  if (decrypted.firstName === identity.firstName && decrypted.email === identity.email) {
    console.log('Verification successful — roundtrip OK');
  } else {
    console.error('ERROR: Roundtrip verification failed!');
    process.exit(1);
  }
}

main();
