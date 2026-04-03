import crypto from 'node:crypto'
import { config } from '../config.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

/** Derive 32-byte key from hex env var */
function getKey(): Buffer {
  const key = config.encryptionKey
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string (32 bytes)')
  }
  return Buffer.from(key, 'hex')
}

/** Encrypt plaintext using AES-256-GCM. Returns iv:tag:ciphertext (base64) */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, encrypted].map(b => b.toString('base64')).join(':')
}

/** Decrypt AES-256-GCM encoded string (iv:tag:ciphertext in base64) */
export function decrypt(encoded: string): string {
  const [ivB64, tagB64, dataB64] = encoded.split(':')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const encrypted = Buffer.from(dataB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8')
}
