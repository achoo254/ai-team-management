import { NextRequest, NextResponse } from "next/server";
import { withAuth, errorResponse } from "@/lib/api-helpers";
import { Seat } from "@/models/seat";
import { User } from "@/models/user";
import { UsageLog } from "@/models/usage-log";
import { Alert } from "@/models/alert";
import { Schedule } from "@/models/schedule";

export async function GET(request: NextRequest) {
  try {
    await withAuth(request);

    const dayOfWeek = new Date().getDay();

    // User/seat counts
    const [totalUsers, activeUsers, totalSeats] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ active: true }),
      Seat.countDocuments(),
    ]);

    // Today's schedules
    const schedules = await Schedule.find({ day_of_week: dayOfWeek })
      .populate("user_id", "name")
      .populate("seat_id", "label")
      .sort({ seat_id: 1, slot: 1 })
      .lean();

    const todaySchedules = schedules.map((sc) => ({
      slot: sc.slot,
      name: (sc.user_id as { name?: string } | null)?.name,
      seat_label: (sc.seat_id as { label?: string } | null)?.label,
    }));

    // Unresolved alerts count
    const unresolvedAlerts = await Alert.countDocuments({ resolved: false });

    // Latest week usage per seat
    const latestUsage = await UsageLog.aggregate([
      { $sort: { week_start: -1 } },
      {
        $group: {
          _id: "$seat_email",
          weekly_all_pct: { $first: "$weekly_all_pct" },
          weekly_sonnet_pct: { $first: "$weekly_sonnet_pct" },
        },
      },
    ]);

    const usageMap: Record<string, { weekly_all_pct: number; weekly_sonnet_pct: number }> = {};
    for (const u of latestUsage) usageMap[u._id] = u;

    const seats = await Seat.find().sort({ _id: 1 }).lean();

    const usagePerSeat = seats.map((s) => ({
      label: s.label,
      team: s.team,
      all_pct: usageMap[s.email]?.weekly_all_pct || 0,
      sonnet_pct: usageMap[s.email]?.weekly_sonnet_pct || 0,
    }));

    // 8-week usage trend
    const usageTrend = await UsageLog.aggregate([
      {
        $group: {
          _id: "$week_start",
          avg_all: { $avg: "$weekly_all_pct" },
          avg_sonnet: { $avg: "$weekly_sonnet_pct" },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 8 },
      {
        $project: {
          week_start: "$_id",
          avg_all: { $round: ["$avg_all", 0] },
          avg_sonnet: { $round: ["$avg_sonnet", 0] },
          _id: 0,
        },
      },
    ]);
    usageTrend.reverse();

    // Team usage breakdown
    const teamUsageCalc: Record<string, { total: number; count: number }> = {};
    for (const s of seats) {
      const team = s.team;
      if (!teamUsageCalc[team]) teamUsageCalc[team] = { total: 0, count: 0 };
      teamUsageCalc[team].total += usageMap[s.email]?.weekly_all_pct || 0;
      teamUsageCalc[team].count++;
    }
    const teamUsage = Object.entries(teamUsageCalc).map(([team, data]) => ({
      team,
      avg_pct: Math.round(data.total / data.count) || 0,
    }));

    return NextResponse.json({
      totalUsers,
      activeUsers,
      totalSeats,
      unresolvedAlerts,
      todaySchedules,
      usagePerSeat,
      usageTrend,
      teamUsage,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
