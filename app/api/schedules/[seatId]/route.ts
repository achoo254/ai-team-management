import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAdmin, errorResponse, ApiError } from "@/lib/api-helpers";
import { Schedule } from "@/models/schedule";

// PUT (admin): Bulk replace schedules for a seat
// Body: array of { userId, dayOfWeek, slot }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ seatId: string }> },
) {
  try {
    await withAdmin(request);
    const { seatId } = await params;

    if (!mongoose.Types.ObjectId.isValid(seatId)) {
      throw new ApiError(400, "Invalid seat ID");
    }

    const entries: { userId: string; dayOfWeek: number; slot: string }[] =
      await request.json();

    if (!Array.isArray(entries)) {
      throw new ApiError(400, "Body must be an array");
    }

    const ops = entries.map((entry) => ({
      updateOne: {
        filter: {
          seat_id: seatId,
          day_of_week: entry.dayOfWeek,
          slot: entry.slot,
        },
        update: {
          $set: {
            seat_id: seatId,
            user_id: entry.userId,
            day_of_week: entry.dayOfWeek,
            slot: entry.slot,
          },
        },
        upsert: true,
      },
    }));

    await Schedule.bulkWrite(ops);

    const schedules = await Schedule.find({ seat_id: seatId })
      .populate("user_id", "name")
      .lean();

    return NextResponse.json(schedules);
  } catch (error) {
    return errorResponse(error);
  }
}
