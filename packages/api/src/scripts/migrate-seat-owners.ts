/**
 * One-time migration: assign owner_id to existing seats.
 * All seats with null owner_id get assigned to the first admin user.
 * Idempotent — safe to run multiple times.
 *
 * Usage: pnpm db:migrate-owners
 */
import { connectDb, disconnectDb } from '../db.js'
import { Seat } from '../models/seat.js'
import { User } from '../models/user.js'

async function migrate() {
  await connectDb()

  const admin = await User.findOne({ role: 'admin' })
  if (!admin) {
    console.error('[Migration] No admin user found — cannot assign owners')
    process.exit(1)
  }

  const result = await Seat.updateMany(
    { owner_id: null },
    { $set: { owner_id: admin._id } },
  )

  console.log(`[Migration] Assigned ${result.modifiedCount} seats to admin "${admin.name}" (${admin.email})`)

  await disconnectDb()
}

migrate().catch((err) => {
  console.error('[Migration] Failed:', err)
  process.exit(1)
})
