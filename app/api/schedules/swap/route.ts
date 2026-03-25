import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAdmin, errorResponse, ApiError } from "@/lib/api-helpers";
import { User } from "@/models/user";
import { Schedule } from "@/models/schedule";

interface CellRef {
  seatId: string;
  dayOfWeek: number;
  slot: string;
}

// PATCH (admin): Swap/move between two cells
// Body: { from: {seatId, dayOfWeek, slot}, to: {seatId, dayOfWeek, slot} }
export async function PATCH(request: NextRequest) {
  try {
    await withAdmin(request);

    const { from, to }: { from: CellRef; to: CellRef } = await request.json();

    if (!from || !to) {
      throw new ApiError(400, "from and to cells are required");
    }

    const fromEntry = await Schedule.findOne({
      seat_id: from.seatId,
      day_of_week: from.dayOfWeek,
      slot: from.slot,
    });
    if (!fromEntry) throw new ApiError(404, "Source schedule entry not found");

    // Validate that the user being moved belongs to the target seat
    const user = await User.findById(fromEntry.user_id);
    if (!user) throw new ApiError(404, "User not found");
    if (String(user.seat_id) !== String(to.seatId)) {
      throw new ApiError(400, "User does not belong to the target seat");
    }

    const toEntry = await Schedule.findOne({
      seat_id: to.seatId,
      day_of_week: to.dayOfWeek,
      slot: to.slot,
    });

    if (toEntry) {
      // Swap: exchange user_ids between from and to
      const fromUserId = fromEntry.user_id;
      fromEntry.user_id = toEntry.user_id;
      toEntry.user_id = fromUserId;
      await Promise.all([fromEntry.save(), toEntry.save()]);
    } else {
      // Move: update from entry to target cell, delete source
      await Schedule.create({
        seat_id: to.seatId,
        user_id: fromEntry.user_id,
        day_of_week: to.dayOfWeek,
        slot: to.slot,
      });
      await fromEntry.deleteOne();
    }

    return NextResponse.json({ message: "Schedule updated" });
  } catch (error) {
    return errorResponse(error);
  }
}
