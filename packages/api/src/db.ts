import mongoose from 'mongoose'
import { config } from './config.js'

export async function connectDb() {
  await mongoose.connect(config.mongoUri)
  console.log('[DB] Connected to MongoDB')
}

export async function disconnectDb() {
  await mongoose.disconnect()
}
