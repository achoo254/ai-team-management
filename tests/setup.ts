import { beforeAll, afterAll, afterEach } from "vitest";

// Only DB-backed suites load this file (see vitest.db.config.ts). It always
// talks to an ephemeral in-memory mongod — never MONGO_URI — because the hooks
// below wipe collections and drop the database.
beforeAll(async () => {
  const { connectTestDb } = await import("./helpers/db-helper.js");
  await connectTestDb();
}, 120_000); // first run downloads the mongod binary

afterEach(async () => {
  const { clearTestDb } = await import("./helpers/db-helper.js");
  await clearTestDb();
});

afterAll(async () => {
  const { disconnectTestDb } = await import("./helpers/db-helper.js");
  await disconnectTestDb();
});
