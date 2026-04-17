import mongoose from 'mongoose'

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/ai_team_management_db'
await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })

const col = mongoose.connection.db!.collection('usage_snapshots')
const since = new Date(Date.now() - 21 * 24 * 3600 * 1000)

const agg = await col.aggregate([
  { $match: { seven_day_resets_at: { $ne: null }, fetched_at: { $gte: since } } },
  { $sort: { fetched_at: -1 as const } },
  { $group: { _id: { s: '$seat_id', r: '$seven_day_resets_at' }, n: { $sum: 1 }, p: { $first: '$seven_day_pct' } } },
  { $sort: { '_id.r': -1 as const } },
]).toArray()

const seatCol = mongoose.connection.db!.collection('seats')
const seats = await seatCol.find({}, { projection: { label: 1 } }).toArray()
const labels: Record<string, string> = {}
for (const s of seats) labels[String(s._id)] = s.label as string

for (const r of agg) {
  const sid = String(r._id.s)
  const label = labels[sid] || sid.slice(-6)
  const ra = r._id.r instanceof Date ? r._id.r.toISOString() : String(r._id.r)
  process.stderr.write(`${label.padEnd(15)} | resets_at: ${ra} | snapshots: ${String(r.n).padStart(4)} | last_pct: ${r.p}\n`)
}

await mongoose.disconnect()
process.exit(0)
