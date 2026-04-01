/**
 * Migration: Migrate old seat_email data to seat_id, drop old indexes, create new ones.
 * Run: npx tsx --env-file .env.local src/scripts/migrate-drop-old-indexes.ts
 */
import mongoose from 'mongoose'

async function main() {
  const uri = process.env.MONGO_URI
  if (!uri) { console.error('MONGO_URI not set'); process.exit(1) }

  await mongoose.connect(uri)
  const db = mongoose.connection.db!
  const usagelogs = db.collection('usagelogs')
  const seats = db.collection('seats')

  // Step 1: Build seat email→_id lookup
  const allSeats = await seats.find({}, { projection: { email: 1 } }).toArray()
  const emailToId = new Map(allSeats.map((s) => [s.email, s._id]))
  console.log(`Found ${allSeats.length} seats`)

  // Step 2: Migrate old documents — set seat_id from seat_email
  const oldDocs = await usagelogs.find({ seat_email: { $exists: true }, seat_id: { $exists: false } }).toArray()
  console.log(`Found ${oldDocs.length} documents to migrate`)

  let migrated = 0, orphaned = 0
  for (const doc of oldDocs) {
    const seatId = emailToId.get(doc.seat_email)
    if (seatId) {
      await usagelogs.updateOne({ _id: doc._id }, { $set: { seat_id: seatId }, $unset: { seat_email: '' } })
      migrated++
    } else {
      // Orphaned document — seat email no longer exists, delete it
      await usagelogs.deleteOne({ _id: doc._id })
      orphaned++
    }
  }
  console.log(`✓ Migrated ${migrated} docs, deleted ${orphaned} orphaned docs`)

  // Step 3: Clean seat_email from docs that already have seat_id
  const cleanResult = await usagelogs.updateMany(
    { seat_email: { $exists: true }, seat_id: { $exists: true } },
    { $unset: { seat_email: '' } },
  )
  console.log(`✓ Cleaned seat_email from ${cleanResult.modifiedCount} already-migrated docs`)

  // Step 4: Check for remaining duplicates before creating unique index
  const dupes = await usagelogs.aggregate([
    { $group: { _id: { seat_id: '$seat_id', week_start: '$week_start', user_id: '$user_id' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray()

  if (dupes.length > 0) {
    console.log(`\nFound ${dupes.length} duplicate groups — keeping newest, removing rest`)
    for (const group of dupes) {
      // Keep the last one (most recent), remove the rest
      const idsToRemove = group.ids.slice(0, -1)
      await usagelogs.deleteMany({ _id: { $in: idsToRemove } })
    }
    console.log('✓ Duplicates resolved')
  }

  // Step 5: Drop old indexes (if still exist)
  for (const name of ['seat_email_1_week_start_1_user_id_1', 'seat_email_1_week_start_1']) {
    try {
      await usagelogs.dropIndex(name)
      console.log(`✓ Dropped index: ${name}`)
    } catch (e: any) {
      if (e.codeName === 'IndexNotFound') console.log(`- Already dropped: ${name}`)
      else throw e
    }
  }

  // Step 6: Create new indexes
  await usagelogs.createIndex({ seat_id: 1, week_start: 1, user_id: 1 }, { unique: true, name: 'seat_id_1_week_start_1_user_id_1' })
  console.log('✓ Created unique index: seat_id_1_week_start_1_user_id_1')

  await usagelogs.createIndex({ seat_id: 1, week_start: 1 }, { name: 'seat_id_1_week_start_1' })
  console.log('✓ Created index: seat_id_1_week_start_1')

  // Step 7: Also migrate alerts collection
  const alerts = db.collection('alerts')
  const oldAlerts = await alerts.find({ seat_email: { $exists: true }, seat_id: { $exists: false } }).toArray()
  let alertsMigrated = 0, alertsOrphaned = 0
  for (const doc of oldAlerts) {
    const seatId = emailToId.get(doc.seat_email)
    if (seatId) {
      await alerts.updateOne({ _id: doc._id }, { $set: { seat_id: seatId }, $unset: { seat_email: '' } })
      alertsMigrated++
    } else {
      await alerts.deleteOne({ _id: doc._id })
      alertsOrphaned++
    }
  }
  const alertClean = await alerts.updateMany(
    { seat_email: { $exists: true }, seat_id: { $exists: true } },
    { $unset: { seat_email: '' } },
  )
  console.log(`✓ Alerts: migrated ${alertsMigrated}, orphaned ${alertsOrphaned}, cleaned ${alertClean.modifiedCount}`)

  // Verify
  console.log('\n=== Final usagelogs indexes ===')
  const indexes = await usagelogs.indexes()
  for (const idx of indexes) console.log(idx.name, JSON.stringify(idx.key))

  await mongoose.disconnect()
  console.log('\n✅ Migration complete.')
}

main().catch((e) => { console.error(e); process.exit(1) })
