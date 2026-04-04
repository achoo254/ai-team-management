/**
 * Migration: Convert team enum (string) → ObjectId refs
 *
 * Usage:
 *   tsx --env-file .env.local src/scripts/migrate-user-teams.ts --dry-run
 *   tsx --env-file .env.local src/scripts/migrate-user-teams.ts --execute
 *
 * Steps:
 *  1. Backup current teams, users (team field), seats (team field) to JSON
 *  2. Find first admin → default created_by
 *  3. Upsert 3 default teams: dev, mkt, personal
 *  4. Convert User.team (string) → User.team_ids (ObjectId[])
 *  5. Convert Seat.team (string) → Seat.team_id (ObjectId)
 */
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { config } from '../config.js'

const isDryRun = process.argv.includes('--dry-run')
const isExecute = process.argv.includes('--execute')

if (!isDryRun && !isExecute) {
  console.log('Usage: --dry-run or --execute')
  process.exit(1)
}

async function main() {
  await mongoose.connect(config.mongoUri)
  console.log('[Migration] Connected to MongoDB')

  const db = mongoose.connection.db!

  // 1. Backup
  const backupDir = path.resolve('backups')
  if (isExecute) {
    fs.mkdirSync(backupDir, { recursive: true })
    const teams = await db.collection('teams').find().toArray()
    const users = await db.collection('users').find({}, { projection: { _id: 1, name: 1, team: 1 } }).toArray()
    const seats = await db.collection('seats').find({}, { projection: { _id: 1, email: 1, team: 1 } }).toArray()
    fs.writeFileSync(path.join(backupDir, 'teams-backup.json'), JSON.stringify(teams, null, 2))
    fs.writeFileSync(path.join(backupDir, 'users-team-backup.json'), JSON.stringify(users, null, 2))
    fs.writeFileSync(path.join(backupDir, 'seats-team-backup.json'), JSON.stringify(seats, null, 2))
    console.log(`[Backup] Saved to ${backupDir}`)
  }

  // 2. Find first admin for default created_by
  const admin = await db.collection('users').findOne({ role: 'admin' })
  if (!admin) {
    console.error('[Migration] No admin user found! Cannot set created_by.')
    process.exit(1)
  }
  console.log(`[Migration] Default created_by: ${admin.name} (${admin._id})`)

  // 3. Upsert 3 default teams (old enum key → new display name)
  const defaults = [
    { oldKey: 'dev', name: 'Development', color: '#3b82f6' },
    { oldKey: 'mkt', name: 'Marketing', color: '#f59e0b' },
    { oldKey: 'personal', name: 'Personal', color: '#10b981' },
  ]
  // Maps old enum value → new team ObjectId
  const teamMap = new Map<string, mongoose.Types.ObjectId>()

  for (const def of defaults) {
    // Try finding by old name first, then new name
    const existing = await db.collection('teams').findOne({ name: { $in: [def.oldKey, def.name] } })
    if (existing) {
      teamMap.set(def.oldKey, existing._id as mongoose.Types.ObjectId)
      if (isExecute) {
        // Rename old slug name to display name + ensure created_by
        const updates: Record<string, unknown> = {}
        if (existing.name === def.oldKey) updates.name = def.name
        if (!existing.created_by) updates.created_by = admin._id
        if (Object.keys(updates).length > 0) {
          await db.collection('teams').updateOne({ _id: existing._id }, { $set: updates })
        }
      }
      console.log(`[Team] "${def.oldKey}" exists → ${existing._id}`)
    } else if (isExecute) {
      const result = await db.collection('teams').insertOne({
        name: def.name,
        color: def.color,
        created_by: admin._id,
        created_at: new Date(),
      })
      teamMap.set(def.oldKey, result.insertedId as mongoose.Types.ObjectId)
      console.log(`[Team] Created "${def.name}" → ${result.insertedId}`)
    } else {
      console.log(`[Team] Would create "${def.name}"`)
    }
  }

  // 4. Convert User.team → User.team_ids
  const usersWithTeam = await db.collection('users').find({ team: { $exists: true, $ne: null } }).toArray()
  console.log(`[Users] Found ${usersWithTeam.length} users with old team field`)

  let usersUpdated = 0
  for (const user of usersWithTeam) {
    const teamName = user.team as string
    const teamId = teamMap.get(teamName)
    if (teamId) {
      if (isExecute) {
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { team_ids: [teamId] }, $unset: { team: '' } },
        )
      }
      usersUpdated++
      console.log(`  User "${user.name}": team="${teamName}" → team_ids=[${teamId}]`)
    } else {
      console.log(`  User "${user.name}": team="${teamName}" → no matching team, skipping`)
    }
  }

  // Also ensure users without team field get team_ids: []
  if (isExecute) {
    await db.collection('users').updateMany(
      { team_ids: { $exists: false } },
      { $set: { team_ids: [] } },
    )
  }

  // 5. Convert Seat.team → Seat.team_id
  const seatsWithTeam = await db.collection('seats').find({ team: { $exists: true } }).toArray()
  console.log(`[Seats] Found ${seatsWithTeam.length} seats with old team field`)

  let seatsUpdated = 0
  for (const seat of seatsWithTeam) {
    const teamName = seat.team as string
    const teamId = teamMap.get(teamName)
    if (teamId) {
      if (isExecute) {
        await db.collection('seats').updateOne(
          { _id: seat._id },
          { $set: { team_id: teamId }, $unset: { team: '' } },
        )
      }
      seatsUpdated++
      console.log(`  Seat "${seat.email}": team="${teamName}" → team_id=${teamId}`)
    } else {
      console.log(`  Seat "${seat.email}": team="${teamName}" → no matching team, skipping`)
    }
  }

  // 6. Drop old unique index on team.name if it exists
  if (isExecute) {
    try {
      await db.collection('teams').dropIndex('name_1')
      console.log('[Index] Dropped unique index name_1 on teams')
    } catch {
      console.log('[Index] No name_1 index to drop (already removed)')
    }
  }

  console.log('\n--- Summary ---')
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'EXECUTE'}`)
  console.log(`Users updated: ${usersUpdated}`)
  console.log(`Seats updated: ${seatsUpdated}`)

  await mongoose.disconnect()
  console.log('[Migration] Done')
}

main().catch((err) => {
  console.error('[Migration] Fatal:', err)
  process.exit(1)
})
