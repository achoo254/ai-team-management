import { beforeAll, afterAll, afterEach } from "vitest";

// Guard: mongoose is only available and meaningful in node environment.
// jsdom-environment tests (hooks/, ui/) import this file too but must not
// attempt a MongoDB connection — typeof window check distinguishes them.
const isNodeEnv = typeof window === "undefined";

if (isNodeEnv) {
  // Dynamically import mongoose so the jsdom bundle never touches it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mongoose = require("mongoose") as typeof import("mongoose");

  beforeAll(async () => {
    const uri =
      process.env.MONGO_URI ||
      "mongodb://localhost:27017/ai_team_management_test_db";
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }
  });

  afterEach(async () => {
    // Clean all collections after each test to avoid cross-test pollution
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      const collections = await mongoose.connection.db.collections();
      await Promise.all(collections.map((c) => c.deleteMany({})));
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
    await mongoose.disconnect();
  });
}
