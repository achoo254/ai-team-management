import { NextRequest, NextResponse } from "next/server";
import { withAuth, errorResponse } from "@/lib/api-helpers";
import { Schedule } from "@/models/schedule";

// GET (auth): List schedules with optional ?seatId= filter
export async function GET(request: NextRequest) {
  try {
    await withAuth(request);

    const { searchParams } = new URL(request.url);
    const seatId = searchParams.get("seatId");

    const filter: Record<string, unknown> = {};
    if (seatId) filter.seat_id = seatId;

    const schedules = await Schedule.find(filter)
      .populate("user_id", "name")
      .populate("seat_id", "label")
      .lean();

    return NextResponse.json({ schedules });
  } catch (error) {
    return errorResponse(error);
  }
}
