import { NextRequest, NextResponse } from "next/server";
import { withAuth, errorResponse } from "@/lib/api-helpers";
import { Schedule } from "@/models/schedule";

// GET (auth): Today's schedules
export async function GET(request: NextRequest) {
  try {
    await withAuth(request);

    const day_of_week = new Date().getDay();

    const schedules = await Schedule.find({ day_of_week })
      .populate("user_id", "name email")
      .populate("seat_id", "label email")
      .lean();

    return NextResponse.json({ schedules });
  } catch (error) {
    return errorResponse(error);
  }
}
