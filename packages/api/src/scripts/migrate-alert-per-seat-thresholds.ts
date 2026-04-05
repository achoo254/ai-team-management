import { connectDb, disconnectDb } from '../db.js'
import { User } from '../models/user.js'
import { Alert } from '../models/alert.js'

async function migrate() {
  await connectDb()
  console.log('[Migration] alert-per-seat-thresholds — starting')

  // 1. Users: drop old threshold fields + watched_seat_ids, init new shape
  const userRes = await User.updateMany(
    {},
    {
      $unset: {
        'alert_settings.rate_limit_pct': '',
        'alert_settings.extra_credit_pct': '',
        watched_seat_ids: '',
      },
      $set: {
        'alert_settings.telegram_enabled': true,
      },
    },
  )
  console.log(`[Migration] users updated: ${userRes.modifiedCount}`)

  // Ensure watched_seats exists as array (separate step: $set array when missing)
  const arrayRes = await User.updateMany(
    { watched_seats: { $exists: false } },
    { $set: { watched_seats: [] } },
  )
  console.log(`[Migration] users watched_seats initialized: ${arrayRes.modifiedCount}`)

  // 2. Alerts: drop extra_credit records + backfill window/user_id
  const deleted = await Alert.deleteMany({ type: 'extra_credit' as any })
  console.log(`[Migration] extra_credit alerts deleted: ${deleted.deletedCount}`)

  const backfilled = await Alert.updateMany(
    { window: { $exists: false } },
    { $set: { window: null, user_id: null } },
  )
  console.log(`[Migration] alerts backfilled (window+user_id): ${backfilled.modifiedCount}`)

  console.log('[Migration] Done')
  await disconnectDb()
}

migrate().catch((err) => {
  console.error('[Migration] Failed:', err)
  process.exit(1)
})
