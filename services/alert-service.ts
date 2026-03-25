import { Alert } from "@/models/alert";
import { UsageLog } from "@/models/usage-log";
import { Seat } from "@/models/seat";
import { config } from "@/lib/config";

/** Insert alert if not already exists for same seat+type today */
async function insertIfNew(seatEmail: string, type: string, message: string): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existing = await Alert.findOne({
    seat_email: seatEmail,
    type,
    created_at: { $gte: today, $lt: tomorrow },
  }).lean();

  if (existing) return false;
  await Alert.create({ seat_email: seatEmail, type, message });
  return true;
}

/** Check alert rules based on weekly percentage data */
export async function checkAlerts() {
  let created = 0;

  // Rule 1: High usage
  const highUsage = await UsageLog.aggregate([
    { $sort: { week_start: -1 } },
    {
      $group: {
        _id: "$seat_email",
        max_week: { $first: "$week_start" },
        weekly_all_pct: { $first: "$weekly_all_pct" },
      },
    },
    { $match: { weekly_all_pct: { $gte: config.alerts.highUsagePct } } },
  ]);

  for (const row of highUsage) {
    const msg = `Seat ${row._id}: ${row.weekly_all_pct}% usage (ngưỡng: ${config.alerts.highUsagePct}%)`;
    if (await insertIfNew(row._id, "high_usage", msg)) created++;
  }

  // Rule 2: No activity
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.alerts.inactivityWeeks * 7);
  const cutoffWeek = cutoffDate.toISOString().split("T")[0];
  const allSeats = await Seat.find({}, "email").lean();

  for (const seat of allSeats) {
    const recent = await UsageLog.findOne({
      seat_email: seat.email,
      week_start: { $gte: cutoffWeek },
    }).lean();
    if (!recent) {
      const ever = await UsageLog.findOne({ seat_email: seat.email }).lean();
      if (ever) {
        const msg = `Seat ${seat.email}: không có log tuần này`;
        if (await insertIfNew(seat.email, "no_activity", msg)) created++;
      }
    }
  }

  return { alertsCreated: created };
}
