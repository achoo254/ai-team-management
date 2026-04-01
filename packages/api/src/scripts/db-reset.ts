import mongoose from 'mongoose'
import { connectDb, disconnectDb } from '../db.js'

async function main() {
  console.log('[DB Reset] Connecting...')
  await connectDb()

  console.log('[DB Reset] Dropping database...')
  await mongoose.connection.dropDatabase()
  console.log('[DB Reset] Database dropped.')

  console.log('[DB Reset] Re-seeding...')
  const { seedData } = await import('../seed-data.js')
  await seedData()

  console.log('[DB Reset] Done.')
  await disconnectDb()
}

main().catch((err) => {
  console.error('[DB Reset] Failed:', err)
  process.exit(1)
})
