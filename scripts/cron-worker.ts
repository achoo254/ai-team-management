/**
 * Standalone cron worker — run with: npx tsx scripts/cron-worker.ts
 * PM2 manages lifecycle alongside Next.js server.
 *
 * Schedules (Asia/Ho_Chi_Minh):
 * - Friday 15:00 → Send log reminder
 * - Friday 17:00 → Send weekly report
 */
import cron from "node-cron";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET || "";

async function callCronEndpoint(path: string) {
  try {
    const res = await fetch(`${APP_URL}${path}`, {
      method: "POST",
      headers: { "x-cron-secret": CRON_SECRET },
    });
    const data = await res.json();
    console.log(`[Cron] ${path}:`, res.status, data);
  } catch (error) {
    console.error(`[Cron] ${path} failed:`, error);
  }
}

// Friday 15:00 ICT — send log reminder
cron.schedule("0 15 * * 5", () => {
  console.log("[Cron] Triggering log reminder...");
  callCronEndpoint("/api/cron/reminder");
}, { timezone: "Asia/Ho_Chi_Minh" });

// Friday 17:00 ICT — send weekly report
cron.schedule("0 17 * * 5", () => {
  console.log("[Cron] Triggering weekly report...");
  callCronEndpoint("/api/cron/report");
}, { timezone: "Asia/Ho_Chi_Minh" });

console.log("[Cron] Worker started. Waiting for scheduled jobs...");
