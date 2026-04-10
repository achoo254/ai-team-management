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
  api_key_encrypted: string // AES-256-GCM — NEVER log
  api_key_prefix: string // first 12 chars of plaintext for display
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
      os_name: { type: String, default: '' },
      os_version: { type: String, default: '' },
      cpu_name: { type: String, default: '' },
      cpu_cores: { type: Number, default: 0 },
      ram_total_mb: { type: Number, default: 0 },
      arch: { type: String, default: '' },
    },
    // select:false — must explicitly `.select('+api_key_encrypted')`
    api_key_encrypted: { type: String, required: true, select: false },
    api_key_prefix: { type: String, required: true, index: true },
    app_version: { type: String, default: null },
    last_seen_at: { type: Date, default: null },
    last_ram_used_mb: { type: Number, default: null },
    revoked_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// Strip encrypted key from JSON output defensively (select:false already hides it,
// but this protects against explicit selects leaking through res.json).
deviceSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as { api_key_encrypted?: string }).api_key_encrypted
    return ret
  },
})

export const Device = mongoose.model<IDevice>('Device', deviceSchema)
