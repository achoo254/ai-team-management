import { NextRequest, NextResponse } from "next/server";
import { withAdmin, errorResponse, ApiError } from "@/lib/api-helpers";
import { Schedule } from "@/models/schedule";

// DELETE (admin): Remove single schedule cell
// Body: { seatId, dayOfWeek, slot }
export async function DELETE(request: NextRequest) {
  try {
    await withAdmin(request);

    const { seatId, dayOfWeek, slot } = await request.json();

    if (!seatId || dayOfWeek === undefined || !slot) {
      throw new ApiError(400, "seatId, dayOfWeek, slot are required");
    }

    const result = await Schedule.findOneAndDelete({
      seat_id: seatId,
      day_of_week: dayOfWeek,
      slot,
    });

    if (!result) throw new ApiError(404, "Schedule entry not found");

    return NextResponse.json({ message: "Schedule entry removed" });
  } catch (error) {
    return errorResponse(error);
  }
}
