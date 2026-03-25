import { NextRequest, NextResponse } from "next/server";
import { withAdmin, errorResponse, ApiError } from "@/lib/api-helpers";
import { Team } from "@/models/team";
import { User } from "@/models/user";
import { Seat } from "@/models/seat";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await withAdmin(request);
    const { id } = await params;

    const { label, color } = await request.json();

    const update: Record<string, unknown> = {};
    if (label !== undefined) update.label = label;
    if (color !== undefined) update.color = color;

    const team = await Team.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!team) throw new ApiError(404, "Team not found");

    return NextResponse.json(team);
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

    const team = await Team.findById(id).lean();
    if (!team) throw new ApiError(404, "Team not found");

    const [userCount, seatCount] = await Promise.all([
      User.countDocuments({ team: team.name }),
      Seat.countDocuments({ team: team.name }),
    ]);

    if (userCount > 0 || seatCount > 0) {
      throw new ApiError(400, "Cannot delete team with existing users or seats");
    }

    await Team.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
