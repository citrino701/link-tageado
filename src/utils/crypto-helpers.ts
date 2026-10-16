import crypto from 'node:crypto';

/**
 * Derives a 32-byte key from any arbitrary secret string using SHA-256.
 */
function deriveKey(secretKey: string): Buffer {
  if (!secretKey) {
    throw new Error('TOKEN_ENCRYPTION_KEY não configurada.');
  }
  return crypto.createHash('sha256').update(secretKey).digest();
}

/**
 * Encrypts a plaintext string (e.g. refresh token) using AES-256-GCM.
 * Output format: <iv-hex>:<authTag-hex>:<ciphertext-hex>
 */
export function encryptToken(plaintext: string, secretKey: string): string {
  if (!plaintext) return '';
  const key = deriveKey(secretKey);
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a token encrypted with encryptToken.
 */
export function decryptToken(encryptedPayload: string, secretKey: string): string {
  if (!encryptedPayload) return '';
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Payload criptografado em formato inválido');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = deriveKey(secretKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
