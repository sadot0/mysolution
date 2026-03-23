import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = 'enc::';
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_SALT = 'recrutor-ai-encryption-salt-v1';
const KEY_LENGTH = 32;

let _cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (_cachedKey) return _cachedKey;

  const envKey = process.env.ENCRYPTION_KEY;

  if (envKey) {
    if (!/^[0-9a-fA-F]{64}$/.test(envKey)) {
      throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
    }
    _cachedKey = Buffer.from(envKey, 'hex');
    return _cachedKey;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('Neither ENCRYPTION_KEY nor JWT_SECRET is set. Cannot derive encryption key.');
  }

  _cachedKey = crypto.pbkdf2Sync(
    jwtSecret,
    PBKDF2_SALT,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha512'
  );

  return _cachedKey;
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format. Expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

export function encryptObject(
  obj: Record<string, any>,
  fields: string[]
): Record<string, any> {
  const result = { ...obj };

  for (const field of fields) {
    const value = result[field];
    if (value !== undefined && value !== null && typeof value === 'string' && value !== '') {
      result[field] = ENCRYPTED_PREFIX + encrypt(value);
    }
  }

  return result;
}

export function decryptObject(
  obj: Record<string, any>,
  fields: string[]
): Record<string, any> {
  const result = { ...obj };

  for (const field of fields) {
    const value = result[field];
    if (typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX)) {
      try {
        result[field] = decrypt(value.slice(ENCRYPTED_PREFIX.length));
      } catch (err) {
        console.warn(
          `Failed to decrypt field "${field}". Key may have changed. Returning raw value.`,
          err instanceof Error ? err.message : err
        );
        result[field] = value;
      }
    }
  }

  return result;
}

export function hashPII(value: string): string {
  return crypto
    .createHash('sha256')
    .update(value.toLowerCase().trim())
    .digest('hex');
}

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}
