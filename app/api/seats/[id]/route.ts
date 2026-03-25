import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAdmin, errorResponse, ApiError } from "@/lib/api-helpers";
import { Seat } from "@/models/seat";
import { User } from "@/models/user";
import { Schedule } from "@/models/schedule";

// PUT (admin): Update seat — validate ObjectId, partial update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await withAdmin(request);
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid seat ID");
    }

    const body = await request.json();
    const allowed = ["email", "label", "team", "max_users"];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    const seat = await Seat.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });
    if (!seat) throw new ApiError(404, "Seat not found");

    return NextResponse.json(seat);
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE (admin): Delete seat — unassign users, clear schedules, delete seat
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await withAdmin(request);
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid seat ID");
    }

    const seat = await Seat.findById(id);
    if (!seat) throw new ApiError(404, "Seat not found");

    // Unassign all users from this seat
    await User.updateMany({ seat_id: id }, { $set: { seat_id: null } });

    // Clear all schedules for this seat
    await Schedule.deleteMany({ seat_id: id });

    await seat.deleteOne();

    return NextResponse.json({ message: "Seat deleted" });
  } catch (error) {
    return errorResponse(error);
  }
}
