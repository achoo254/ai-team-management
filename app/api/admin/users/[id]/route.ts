import { NextRequest, NextResponse } from "next/server";
import { withAdmin, errorResponse, ApiError } from "@/lib/api-helpers";
import { User } from "@/models/user";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await withAdmin(request);
    const { id } = await params;

    const { name, email, role, team, seatId, active } = await request.json();

    // Can't deactivate self
    if (active === false && user._id === id) {
      throw new ApiError(400, "Cannot deactivate your own account");
    }

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (email !== undefined) update.email = email;
    if (role !== undefined) update.role = role;
    if (team !== undefined) update.team = team;
    if (seatId !== undefined) update.seat_id = seatId;
    if (active !== undefined) update.active = active;

    const updated = await User.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!updated) throw new ApiError(404, "User not found");

    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await withAdmin(request);
    const { id } = await params;

    const deleted = await User.findByIdAndDelete(id).lean();
    if (!deleted) throw new ApiError(404, "User not found");

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
