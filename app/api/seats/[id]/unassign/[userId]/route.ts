import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAdmin, errorResponse, ApiError } from "@/lib/api-helpers";
import { User } from "@/models/user";
import { Schedule } from "@/models/schedule";

// DELETE (admin): Unassign user + clear their schedules for this seat
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    await withAdmin(request);
    const { id, userId } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid seat ID");
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, "Invalid user ID");
    }

    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");
    if (String(user.seat_id) !== id) {
      throw new ApiError(400, "User is not assigned to this seat");
    }

    // Clear user's schedules for this seat
    await Schedule.deleteMany({ seat_id: id, user_id: userId });

    // Unassign from seat
    user.seat_id = null;
    await user.save();

    return NextResponse.json({ message: "User unassigned from seat" });
  } catch (error) {
    return errorResponse(error);
  }
}
