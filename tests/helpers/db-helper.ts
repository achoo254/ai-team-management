/**
 * Ephemeral MongoDB for tests.
 *
 * SAFETY: this helper deliberately ignores MONGO_URI. The suite wipes every
 * collection between tests and drops the database at the end, so it must never
 * be able to point at a real deployment — an exported production MONGO_URI
 * would otherwise destroy live data on a plain `pnpm test`.
 */

import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let server: MongoMemoryServer | null = null

/** Boot an in-memory mongod and connect mongoose to it. Idempotent. */
export async function connectTestDb(): Promise<string> {
  if (server) return server.getUri()
  server = await MongoMemoryServer.create()
  const uri = server.getUri()
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
  await mongoose.connect(uri)
  return uri
}

/** Remove all documents, keeping indexes — cheaper than recreating the server. */
export async function clearTestDb(): Promise<void> {
  const db = mongoose.connection.db
  if (mongoose.connection.readyState !== 1 || !db) return
  const collections = await db.collections()
  await Promise.all(collections.map(c => c.deleteMany({})))
}

/** Drop the database and shut the in-memory server down. */
export async function disconnectTestDb(): Promise<void> {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase()
  }
  await mongoose.disconnect()
  await server?.stop()
  server = null
}
