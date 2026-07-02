import { connectDb, disconnectDb } from '../db.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'

/**
 * Reclaim storage from the usagesnapshots collection by removing the redundant
 * raw_response blob. Every field the app reads is already extracted into typed
 * columns, so the raw Anthropic payload was write-only dead weight bloating the
 * collection (and the co-located mongod working set) on every 5-min snapshot.
 *
 * Uses the raw driver collection because raw_response is no longer part of the
 * Mongoose schema — a model-level $unset on an unknown path would be stripped.
 */
async function migrate() {
  await connectDb()
  console.log('[Migration] drop usage-snapshot raw_response — starting')

  const res = await UsageSnapshot.collection.updateMany(
    { raw_response: { $exists: true } },
    { $unset: { raw_response: '' } },
  )
  console.log(`[Migration] snapshots stripped of raw_response: ${res.modifiedCount}`)

  console.log('[Migration] Done')
  await disconnectDb()
}

migrate().catch((err) => {
  console.error('[Migration] Failed:', err)
  process.exit(1)
})
