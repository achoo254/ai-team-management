import { NextRequest, NextResponse } from "next/server";
import { withAdmin, errorResponse, ApiError } from "@/lib/api-helpers";
import { UsageLog } from "@/models/usage-log";

/** Validate that a date string is a Monday */
function isMonday(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && date.getUTCDay() === 1;
}

function clamp(val: number): number {
  return Math.max(0, Math.min(100, val));
}

export async function POST(request: NextRequest) {
  try {
    const user = await withAdmin(request);
    const { weekStart, entries } = await request.json();

    if (!weekStart || !isMonday(weekStart)) {
      throw new ApiError(400, "weekStart must be a Monday (YYYY-MM-DD)");
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new ApiError(400, "entries must be a non-empty array");
    }

    const results: unknown[] = [];
    const errors: { seatEmail: string; error: string }[] = [];

    for (const entry of entries) {
      const { seatEmail, weeklyAllPct, weeklySonnetPct } = entry;
      try {
        const doc = await UsageLog.findOneAndUpdate(
          { seat_email: seatEmail, week_start: weekStart, user_id: user._id },
          {
            weekly_all_pct: clamp(Number(weeklyAllPct ?? 0)),
            weekly_sonnet_pct: clamp(Number(weeklySonnetPct ?? 0)),
            logged_at: new Date(),
          },
          { upsert: true, new: true },
        ).lean();
        results.push(doc);
      } catch (err) {
        errors.push({
          seatEmail,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({ results, errors }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
