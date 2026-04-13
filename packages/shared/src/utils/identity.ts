import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Identity, identitySchema } from '../types/identity';
import { IdentityNotFoundError, IdentityDecryptionError, IdentityValidationError } from '../errors';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

interface EncryptedPayload {
  iv: string;
  authTag: string;
  data: string;
  encryptedAt: string;
  version: number;
}

function deriveKey(identityKey: string): Buffer {
  return crypto.createHash('sha256').update(identityKey).digest();
}

export function encryptIdentity(identity: Identity, identityKey: string): EncryptedPayload {
  const key = deriveKey(identityKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const jsonStr = JSON.stringify(identity);
  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted.toString('hex'),
    encryptedAt: new Date().toISOString(),
    version: 1,
  };
}

export function decryptIdentity(payload: EncryptedPayload, identityKey: string): Identity {
  try {
    const key = deriveKey(identityKey);
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');
    const encrypted = Buffer.from(payload.data, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8')) as Identity;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new IdentityDecryptionError('Decrypted data is not valid JSON — key may be wrong');
    }
    throw new IdentityDecryptionError(
      `Failed to decrypt identity profile: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function loadIdentity(identityDir: string, identityKey: string): Promise<Identity> {
  const profilePath = path.join(identityDir, 'profile.enc');

  if (!fs.existsSync(profilePath)) {
    throw new IdentityNotFoundError(
      `Identity profile not found at ${profilePath}. Run 'pnpm identity encrypt' to create it.`,
    );
  }

  const raw = fs.readFileSync(profilePath, 'utf8');

  let payload: EncryptedPayload;
  try {
    payload = JSON.parse(raw) as EncryptedPayload;
  } catch {
    throw new IdentityDecryptionError(`Identity file at ${profilePath} is not valid JSON`);
  }

  if (!payload.iv || !payload.authTag || !payload.data) {
    throw new IdentityDecryptionError('Identity file is missing required fields (iv, authTag, data)');
  }

  const identity = decryptIdentity(payload, identityKey);

  const result = identitySchema.safeParse(identity);
  if (!result.success) {
    throw new IdentityValidationError(result.error.issues);
  }

  return result.data as Identity;
}

export async function saveEncryptedIdentity(
  identity: Identity,
  identityKey: string,
  outputPath: string,
): Promise<void> {
  const payload = encryptIdentity(identity, identityKey);
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
}
