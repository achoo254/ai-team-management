import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAdmin, errorResponse, ApiError } from "@/lib/api-helpers";
import { Seat } from "@/models/seat";
import { User } from "@/models/user";

// POST (admin): Assign user to seat — { userId } in body
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await withAdmin(request);
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid seat ID");
    }

    const { userId } = await request.json();
    if (!userId) throw new ApiError(400, "userId is required");
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, "Invalid user ID");
    }

    const seat = await Seat.findById(id);
    if (!seat) throw new ApiError(404, "Seat not found");

    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");

    // Check seat capacity
    const currentCount = await User.countDocuments({ seat_id: id, active: true });
    if (currentCount >= seat.max_users) {
      throw new ApiError(400, "Seat is at maximum capacity");
    }

    user.seat_id = new mongoose.Types.ObjectId(id);
    await user.save();

    return NextResponse.json({ message: "User assigned to seat", user });
  } catch (error) {
    return errorResponse(error);
  }
}
