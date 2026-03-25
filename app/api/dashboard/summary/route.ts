import { NextRequest, NextResponse } from "next/server";
import { withAuth, errorResponse } from "@/lib/api-helpers";
import { UsageLog } from "@/models/usage-log";
import { Alert } from "@/models/alert";

export async function GET(request: NextRequest) {
  try {
    await withAuth(request);

    const latestLog = await UsageLog.findOne().sort({ week_start: -1 }).lean();
    const latestWeek = latestLog?.week_start;

    let avgAll = 0, avgSonnet = 0;
    if (latestWeek) {
      const result = await UsageLog.aggregate([
        { $match: { week_start: latestWeek } },
        {
          $group: {
            _id: null,
            avgAll: { $avg: "$weekly_all_pct" },
            avgSonnet: { $avg: "$weekly_sonnet_pct" },
          },
        },
      ]);
      if (result.length > 0) {
        avgAll = Math.round(result[0].avgAll) || 0;
        avgSonnet = Math.round(result[0].avgSonnet) || 0;
      }
    }

    const activeAlerts = await Alert.countDocuments({ resolved: false });
    const totalLogs = await UsageLog.countDocuments();

    return NextResponse.json({ avgAllPct: avgAll, avgSonnetPct: avgSonnet, activeAlerts, totalLogs });
  } catch (error) {
    return errorResponse(error);
  }
}
