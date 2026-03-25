import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAdmin, errorResponse, ApiError } from "@/lib/api-helpers";
import { User } from "@/models/user";
import { Schedule } from "@/models/schedule";

// POST (admin): Assign user to specific cell
// Body: { seatId, userId, dayOfWeek, slot }
export async function POST(request: NextRequest) {
  try {
    await withAdmin(request);

    const { seatId, userId, dayOfWeek, slot } = await request.json();

    if (!seatId || !userId || dayOfWeek === undefined || !slot) {
      throw new ApiError(400, "seatId, userId, dayOfWeek, slot are required");
    }
    if (!mongoose.Types.ObjectId.isValid(seatId)) {
      throw new ApiError(400, "Invalid seat ID");
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, "Invalid user ID");
    }

    // Validate user belongs to seat
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");
    if (String(user.seat_id) !== String(seatId)) {
      throw new ApiError(400, "User does not belong to this seat");
    }

    const schedule = await Schedule.findOneAndUpdate(
      { seat_id: seatId, day_of_week: dayOfWeek, slot },
      { $set: { seat_id: seatId, user_id: userId, day_of_week: dayOfWeek, slot } },
      { upsert: true, new: true },
    );

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
