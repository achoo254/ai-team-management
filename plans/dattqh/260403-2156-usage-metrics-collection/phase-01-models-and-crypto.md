# Phase 1: Backend Models + Crypto Service

## Context Links
- Brainstorm: `../reports/brainstorm-260403-2156-usage-metrics-collection.md`
- Plan: `./plan.md`

## Overview
- **Priority:** High (foundation for all other phases)
- **Status:** completed
- **Description:** Extend Seat model with encrypted token fields, create crypto service, create UsageSnapshot model, update config + shared types.

## Key Insights
- Seat model is simple (22 lines), safe to extend
- Config follows flat env pattern, no validation layer
- Shared types expose to frontend — token fields must NOT appear in shared Seat type
- Node.js `crypto` module has native AES-256-GCM support, no external deps needed

## Requirements

### Functional
- Seat model stores encrypted access_token + metadata fields
- Crypto service encrypts/decrypts using AES-256-GCM with env key
- UsageSnapshot model stores full API response + parsed metrics
- Config includes ENCRYPTION_KEY

### Non-functional
- Token never stored in plaintext in DB
- Encryption key from env var, never hardcoded

## Architecture

```
Seat (extended)
├── access_token: string | null (encrypted, auto-excluded from toJSON)
├── token_active: boolean
├── has_token: boolean (virtual, computed from access_token !== null)
├── last_fetched_at: Date | null
└── last_fetch_error: string | null

UsageSnapshot (new)
├── seat_id → Seat
├── raw_response: Mixed
├── five_hour_pct, five_hour_resets_at
├── seven_day_pct, seven_day_resets_at
├── seven_day_sonnet_pct, seven_day_sonnet_resets_at
├── seven_day_opus_pct, seven_day_opus_resets_at
├── extra_usage: { is_enabled, monthly_limit, used_credits, utilization }
├── fetched_at: Date (compound index with seat_id)
└── TTL index: fetched_at, expireAfterSeconds: 30 days (raw cleanup)
```

## Related Code Files

### Modify
- `packages/api/src/models/seat.ts` — Add 4 new fields to schema + interface
- `packages/api/src/config.ts` — Add `encryptionKey` field
- `packages/shared/types.ts` — Add `UsageSnapshot` type, add token metadata to `Seat` (NOT the token itself)

### Create
- `packages/api/src/services/crypto-service.ts` — AES-256-GCM encrypt/decrypt
- `packages/api/src/models/usage-snapshot.ts` — Mongoose model + interface

## Implementation Steps

### 1. Update `packages/api/src/config.ts`
Add to config object:
```typescript
encryptionKey: process.env.ENCRYPTION_KEY || '',
```

### 2. Create `packages/api/src/services/crypto-service.ts`
```typescript
import crypto from 'node:crypto'
import { config } from '../config.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

// Key derived from hex env var (32 bytes = 64 hex chars)
function getKey(): Buffer {
  const key = config.encryptionKey
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string (32 bytes)')
  }
  return Buffer.from(key, 'hex')
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv:tag:ciphertext (all base64)
  return [iv, tag, encrypted].map(b => b.toString('base64')).join(':')
}

export function decrypt(encoded: string): string {
  const [ivB64, tagB64, dataB64] = encoded.split(':')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const encrypted = Buffer.from(dataB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
```

### 3. Extend `packages/api/src/models/seat.ts`
Add to ISeat interface:
```typescript
access_token: string | null
token_active: boolean
last_fetched_at: Date | null
last_fetch_error: string | null
```

Add to schema:
```typescript
access_token: { type: String, default: null },
token_active: { type: Boolean, default: false },
last_fetched_at: { type: Date, default: null },
last_fetch_error: { type: String, default: null },
```

Add virtual `has_token` + `toJSON` transform to auto-exclude access_token:
```typescript
// Virtual: computed has_token for frontend
seatSchema.virtual('has_token').get(function () {
  return this.access_token != null
})

// Auto-exclude access_token from all JSON responses
seatSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.access_token
    return ret
  },
})
```
**Why:** Prevents access_token leak across ALL routes (dashboard, admin, etc.) at schema level — no need to `.select('-access_token')` everywhere.

### 4. Create `packages/api/src/models/usage-snapshot.ts`
```typescript
import mongoose, { Schema, type Document } from 'mongoose'

export interface IUsageSnapshot extends Document {
  seat_id: mongoose.Types.ObjectId
  raw_response: Record<string, unknown>
  five_hour_pct: number | null
  five_hour_resets_at: Date | null
  seven_day_pct: number | null
  seven_day_resets_at: Date | null
  seven_day_sonnet_pct: number | null
  seven_day_sonnet_resets_at: Date | null
  seven_day_opus_pct: number | null
  seven_day_opus_resets_at: Date | null
  extra_usage: {
    is_enabled: boolean
    monthly_limit: number | null
    used_credits: number | null
    utilization: number | null
  }
  fetched_at: Date
}

const usageSnapshotSchema = new Schema<IUsageSnapshot>({
  seat_id: { type: Schema.Types.ObjectId, ref: 'Seat', required: true },
  raw_response: { type: Schema.Types.Mixed, required: true },
  five_hour_pct: { type: Number, default: null },
  five_hour_resets_at: { type: Date, default: null },
  seven_day_pct: { type: Number, default: null },
  seven_day_resets_at: { type: Date, default: null },
  seven_day_sonnet_pct: { type: Number, default: null },
  seven_day_sonnet_resets_at: { type: Date, default: null },
  seven_day_opus_pct: { type: Number, default: null },
  seven_day_opus_resets_at: { type: Date, default: null },
  extra_usage: {
    is_enabled: { type: Boolean, default: false },
    monthly_limit: { type: Number, default: null },
    used_credits: { type: Number, default: null },
    utilization: { type: Number, default: null },
  },
  fetched_at: { type: Date, default: Date.now, required: true },
})

usageSnapshotSchema.index({ seat_id: 1, fetched_at: -1 })

// TTL: auto-delete snapshots older than 90 days (raw_response cleanup)
// Parsed metrics preserved via separate aggregation if needed
usageSnapshotSchema.index({ fetched_at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })

export const UsageSnapshot = mongoose.model<IUsageSnapshot>(
  'UsageSnapshot', usageSnapshotSchema
)
```

### 5. Update `packages/shared/types.ts`
Add `UsageSnapshot` interface. Add token metadata fields to `Seat` (NOT access_token):
```typescript
// Add to Seat interface:
has_token?: boolean            // virtual, computed from access_token
token_active?: boolean
last_fetched_at?: string | null
last_fetch_error?: string | null

// New interface:
export interface UsageSnapshot {
  _id: string
  seat_id: string
  raw_response: Record<string, unknown>
  five_hour_pct: number | null
  five_hour_resets_at: string | null
  seven_day_pct: number | null
  seven_day_resets_at: string | null
  seven_day_sonnet_pct: number | null
  seven_day_sonnet_resets_at: string | null
  seven_day_opus_pct: number | null
  seven_day_opus_resets_at: string | null
  extra_usage: {
    is_enabled: boolean
    monthly_limit: number | null
    used_credits: number | null
    utilization: number | null
  }
  fetched_at: string
}
```

## Todo List
- [x] Update config.ts with encryptionKey
- [x] Create crypto-service.ts
- [x] Extend seat.ts model + interface (fields + has_token virtual + toJSON transform)
- [x] Create usage-snapshot.ts model (with TTL index)
- [x] Update shared types.ts (has_token + UsageSnapshot)
- [x] Add ENCRYPTION_KEY to packages/api/.env.example
- [x] Verify compile passes

## Success Criteria
- `encrypt()` / `decrypt()` roundtrip works correctly
- Seat model accepts new fields without breaking existing queries
- UsageSnapshot model creates documents with compound index
- Shared types updated without exposing access_token to frontend
- `pnpm build` passes

## Risk Assessment
- **Missing ENCRYPTION_KEY**: Service throws clear error, won't silently fail
- **Existing seat queries**: New fields have defaults (null/false), backward-compatible

## Security Considerations
- access_token encrypted AES-256-GCM before storage
- ENCRYPTION_KEY env var only, never in code/git
- Shared types deliberately exclude access_token field
