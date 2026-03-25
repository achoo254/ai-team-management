import { NextRequest, NextResponse } from "next/server";
import { withAuth, errorResponse } from "@/lib/api-helpers";
import { Seat } from "@/models/seat";
import { UsageLog } from "@/models/usage-log";
import { getCurrentWeekStart } from "@/services/usage-sync-service";

export async function GET(request: NextRequest) {
  try {
    await withAuth(request);

    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart") ?? getCurrentWeekStart();

    const [seats, logs] = await Promise.all([
      Seat.find().lean(),
      UsageLog.find({ week_start: weekStart }).lean(),
    ]);

    // Group logs by seat_email — keep entry with latest logged_at
    const logBySeat: Record<string, (typeof logs)[number]> = {};
    for (const log of logs) {
      const existing = logBySeat[log.seat_email];
      if (!existing || log.logged_at > existing.logged_at) {
        logBySeat[log.seat_email] = log;
      }
    }

    const data = seats.map((seat) => {
      const log = logBySeat[seat.email];
      return {
        seatId: seat._id,
        seatEmail: seat.email,
        seatLabel: seat.label,
        team: seat.team,
        weeklyAllPct: log?.weekly_all_pct ?? null,
        weeklySonnetPct: log?.weekly_sonnet_pct ?? null,
        loggedAt: log?.logged_at ?? null,
      };
    });

    return NextResponse.json({ weekStart, seats: data });
  } catch (error) {
    return errorResponse(error);
  }
}
