import mongoose, { Schema, type Document } from 'mongoose'

export const AUDIT_ACTIONS = [
  'credential_export',
  'seat_transfer',
  'seat_delete',
  'token_update',
  'token_delete',
  'role_change',
] as const

export type AuditAction = typeof AUDIT_ACTIONS[number]

export interface IAuditLog extends Document {
  action: AuditAction
  actor_id: mongoose.Types.ObjectId
  actor_email: string
  target_type: 'seat' | 'user'
  target_id: mongoose.Types.ObjectId
  metadata: Record<string, unknown>
  ip: string | null
  created_at: Date
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, enum: AUDIT_ACTIONS },
    actor_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actor_email: { type: String, required: true },
    target_type: { type: String, required: true, enum: ['seat', 'user'] },
    target_id: { type: Schema.Types.ObjectId, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// Indexes for future query/filter needs
auditLogSchema.index({ created_at: -1 })
auditLogSchema.index({ action: 1 })
auditLogSchema.index({ actor_id: 1 })
auditLogSchema.index({ target_id: 1 })

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema, 'audit_logs')

/** Fire-and-forget audit log writer — never blocks the request */
export function logAudit(
  action: AuditAction,
  actor: { _id: string; email: string },
  target: { type: 'seat' | 'user'; id: string },
  metadata: Record<string, unknown> = {},
  ip?: string | null,
): void {
  AuditLog.create({
    action,
    actor_id: actor._id,
    actor_email: actor.email,
    target_type: target.type,
    target_id: target.id,
    metadata,
    ip: ip ?? null,
  }).catch((err) => console.error('[AuditLog] Failed to write:', err))
}
