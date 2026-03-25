import { NextRequest, NextResponse } from "next/server";
import { withAdmin, errorResponse } from "@/lib/api-helpers";
import { User } from "@/models/user";

export async function GET(request: NextRequest) {
  try {
    await withAdmin(request);

    const users = await User.find().populate("seat_id", "label email").lean();
    const mapped = users.map((u) => {
      const seat = u.seat_id as { _id: unknown; label?: string; email?: string } | null;
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        team: u.team,
        seat_id: seat?._id ?? null,
        active: u.active,
        seat_label: seat?.label ?? null,
        seat_email: seat?.email ?? null,
      };
    });

    return NextResponse.json({ users: mapped });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await withAdmin(request);

    const { name, email, role = "user", team, seatId } = await request.json();
    const user = await User.create({
      name,
      email,
      role,
      team,
      seat_id: seatId ?? null,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
