/**
 * Drop and re-seed MongoDB database.
 * Run: npx tsx --env-file=.env.local scripts/db-reset.ts
 */
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI!;

async function main() {
  if (!MONGO_URI) {
    console.error("[db-reset] MONGO_URI not set");
    process.exit(1);
  }

  console.log("[db-reset] Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);

  console.log("[db-reset] Dropping database...");
  await mongoose.connection.dropDatabase();

  // Dynamic import to trigger model registration before seeding
  const { seedData } = await import("../lib/seed-data");
  await seedData();

  console.log("[db-reset] Done.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[db-reset] Error:", err);
  process.exit(1);
});
