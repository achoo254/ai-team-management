# Phase 2: Mongoose Models

## Overview
- Priority: HIGH
- Status: completed
- Depends on: Phase 1

## Files to Create

### 2.1 `packages/api/src/models/device.ts` (<150 LOC)

```ts
import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface IDevice extends Document {
  device_id: string
  user_id: Types.ObjectId
  device_name: string
  hostname: string
  system_info: {
    os_name: string
    os_version: string
    cpu_name: string
    cpu_cores: number
    ram_total_mb: number
    arch: string
  }
  api_key_encrypted: string   // AES-256-GCM — NEVER log
  api_key_prefix: string      // first 8 chars of plaintext for display
  app_version: string | null
  last_seen_at: Date | null
  last_ram_used_mb: number | null
  revoked_at: Date | null
  created_at: Date
}

const deviceSchema = new Schema<IDevice>(
  {
    device_id: { type: String, required: true, unique: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    device_name: { type: String, required: true },
    hostname: { type: String, required: true },
    system_info: {
      os_name: String,
      os_version: String,
      cpu_name: String,
      cpu_cores: Number,
      ram_total_mb: Number,
      arch: String,
    },
    api_key_encrypted: { type: String, required: true, select: false },
    api_key_prefix: { type: String, required: true, index: true },
    app_version: { type: String, default: null },
    last_seen_at: { type: Date, default: null },
    last_ram_used_mb: { type: Number, default: null },
    revoked_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// Strip encrypted key from JSON output
deviceSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.api_key_encrypted
    return ret
  },
})

export const Device = mongoose.model<IDevice>('Device', deviceSchema)
```

**Key decisions:**
- `api_key_encrypted` `select: false` — must explicit `.select('+api_key_encrypted')`
- `device_id` là UUID string (từ desktop), không phải ObjectId
- No soft-delete pattern — dùng `revoked_at` (khác semantic với seats)
- Hooks để auto-filter revoked: KHÔNG. Caller tự filter (vì webhook cần check revoked explicitly).

### 2.2 `packages/api/src/models/claude-session.ts` (<150 LOC)

```ts
import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface IClaudeSession extends Document {
  session_id: string
  device_id: Types.ObjectId
  user_id: Types.ObjectId
  seat_id: Types.ObjectId | null
  profile_email: string
  subscription_type: string | null
  rate_limit_tier: string | null
  model: string
  started_at: Date
  ended_at: Date
  total_input_tokens: number
  total_output_tokens: number
  total_cache_read: number
  total_cache_write: number
  message_count: number
  usage_five_hour_pct: number | null
  usage_seven_day_pct: number | null
  usage_seven_day_sonnet_pct: number | null
  received_at: Date
}

const claudeSessionSchema = new Schema<IClaudeSession>({
  session_id: { type: String, required: true, unique: true },
  device_id: { type: Schema.Types.ObjectId, ref: 'Device', required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  seat_id: { type: Schema.Types.ObjectId, ref: 'Seat', default: null },
  profile_email: { type: String, required: true },
  subscription_type: { type: String, default: null },
  rate_limit_tier: { type: String, default: null },
  model: { type: String, required: true },
  started_at: { type: Date, required: true },
  ended_at: { type: Date, required: true },
  total_input_tokens: { type: Number, default: 0 },
  total_output_tokens: { type: Number, default: 0 },
  total_cache_read: { type: Number, default: 0 },
  total_cache_write: { type: Number, default: 0 },
  message_count: { type: Number, default: 0 },
  usage_five_hour_pct: { type: Number, default: null },
  usage_seven_day_pct: { type: Number, default: null },
  usage_seven_day_sonnet_pct: { type: Number, default: null },
  received_at: { type: Date, default: Date.now },
})

// Query indexes
claudeSessionSchema.index({ device_id: 1, started_at: -1 })
claudeSessionSchema.index({ user_id: 1, started_at: -1 })
claudeSessionSchema.index({ seat_id: 1, started_at: -1 })
claudeSessionSchema.index({ started_at: -1 })

export const ClaudeSession = mongoose.model<IClaudeSession>('ClaudeSession', claudeSessionSchema)
```

## Acceptance
- `pnpm -F @repo/api build` passes
- Indexes defined đầy đủ per spec
- `api_key_encrypted` excluded default
- Không có hooks unintended

## Todo
- [x] Create `device.ts` model
- [x] Create `claude-session.ts` model
- [x] Verify typecheck pass
- [x] Verify JSON serialization strips encrypted key
