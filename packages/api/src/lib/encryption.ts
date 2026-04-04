import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { config } from '../config.js'

const ALGORITHM = 'aes-256-gcm'

/** Encrypt plaintext using AES-256-GCM. Returns "iv:authTag:ciphertext" hex string. */
export function encrypt(text: string): string {
  const key = Buffer.from(config.encryptionKey, 'hex')
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/** Decrypt stored "iv:authTag:ciphertext" hex string back to plaintext. */
export function decrypt(stored: string): string {
  if (!stored || !isEncryptionConfigured()) {
    throw new Error('Cannot decrypt: missing data or encryption key')
  }
  const parts = stored.split(':')
  if (parts.length !== 3) {
    throw new Error('Cannot decrypt: invalid stored format')
  }
  const [ivHex, authTagHex, encryptedHex] = parts
  const key = Buffer.from(config.encryptionKey, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  return decipher.update(encryptedHex, 'hex', 'utf8') + decipher.final('utf8')
}

/** Check if encryption key is configured and valid (64-char hex = 32 bytes). */
export function isEncryptionConfigured(): boolean {
  return config.encryptionKey.length === 64 && /^[0-9a-f]+$/i.test(config.encryptionKey)
}
