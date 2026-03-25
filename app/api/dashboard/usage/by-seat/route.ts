import { NextRequest, NextResponse } from "next/server";
import { withAuth, errorResponse } from "@/lib/api-helpers";
import { Seat } from "@/models/seat";
import { User } from "@/models/user";
import { UsageLog } from "@/models/usage-log";

export async function GET(request: NextRequest) {
  try {
    await withAuth(request);

    // Latest week per seat_email
    const latestUsage = await UsageLog.aggregate([
      { $sort: { week_start: -1 } },
      {
        $group: {
          _id: "$seat_email",
          weekly_all_pct: { $first: "$weekly_all_pct" },
          weekly_sonnet_pct: { $first: "$weekly_sonnet_pct" },
          last_logged: { $first: "$week_start" },
        },
      },
    ]);

    const usageMap: Record<string, { weekly_all_pct: number; weekly_sonnet_pct: number; last_logged: string }> = {};
    for (const u of latestUsage) usageMap[u._id] = u;

    const seats = await Seat.find().lean();
    const users = await User.find({ active: true, seat_id: { $ne: null } }, "name seat_id").lean();

    // Map seat _id → email
    const seatIdToEmail: Record<string, string> = {};
    for (const s of seats) seatIdToEmail[String(s._id)] = s.email;

    // Map seat email → user names
    const usersBySeatEmail: Record<string, string[]> = {};
    for (const u of users) {
      const seatEmail = seatIdToEmail[String(u.seat_id)];
      if (seatEmail) {
        if (!usersBySeatEmail[seatEmail]) usersBySeatEmail[seatEmail] = [];
        usersBySeatEmail[seatEmail].push(u.name);
      }
    }

    const enriched = seats
      .map((s) => ({
        seat_id: s._id,
        seat_email: s.email,
        label: s.label,
        team: s.team,
        weekly_all_pct: usageMap[s.email]?.weekly_all_pct || 0,
        weekly_sonnet_pct: usageMap[s.email]?.weekly_sonnet_pct || 0,
        last_logged: usageMap[s.email]?.last_logged || null,
        users: usersBySeatEmail[s.email] || [],
      }))
      .sort((a, b) => b.weekly_all_pct - a.weekly_all_pct);

    return NextResponse.json({ seats: enriched });
  } catch (error) {
    return errorResponse(error);
  }
}
