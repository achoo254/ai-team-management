import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { config } from '../config.js'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const key = config.encryptionKey
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string (32 bytes)')
  }
  return Buffer.from(key, 'hex')
}

/** Check if encryption key is configured and valid (64-char hex = 32 bytes). */
export function isEncryptionConfigured(): boolean {
  return config.encryptionKey.length === 64 && /^[0-9a-f]+$/i.test(config.encryptionKey)
}

/** Encrypt plaintext using AES-256-GCM. Returns "iv:authTag:ciphertext" hex string. */
export function encrypt(text: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/** Detect if a part is hex-only (all chars are 0-9a-f). */
function isHex(s: string): boolean {
  return /^[0-9a-f]+$/i.test(s)
}

/** Decrypt stored string. Auto-detects hex vs base64 encoding for backward compat. */
export function decrypt(stored: string): string {
  if (!stored || !isEncryptionConfigured()) {
    throw new Error('Cannot decrypt: missing data or encryption key')
  }
  const parts = stored.split(':')
  if (parts.length !== 3) {
    throw new Error('Cannot decrypt: invalid stored format')
  }
  const [p1, p2, p3] = parts
  const key = getKey()

  // Auto-detect: hex parts contain only hex chars, base64 may have +, /, =
  const encoding: BufferEncoding = isHex(p1) && isHex(p2) && isHex(p3) ? 'hex' : 'base64'
  const iv = Buffer.from(p1, encoding)
  const authTag = Buffer.from(p2, encoding)
  const encrypted = Buffer.from(p3, encoding)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8')
}
