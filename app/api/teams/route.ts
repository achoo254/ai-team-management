import { NextRequest, NextResponse } from "next/server";
import { withAuth, withAdmin, errorResponse } from "@/lib/api-helpers";
import { Team } from "@/models/team";
import { User } from "@/models/user";
import { Seat } from "@/models/seat";

export async function GET(request: NextRequest) {
  try {
    await withAuth(request);

    const teams = await Team.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "name",
          foreignField: "team",
          as: "users",
        },
      },
      {
        $lookup: {
          from: "seats",
          localField: "name",
          foreignField: "team",
          as: "seats",
        },
      },
      {
        $addFields: {
          user_count: { $size: "$users" },
          seat_count: { $size: "$seats" },
        },
      },
      { $project: { users: 0, seats: 0 } },
      { $sort: { name: 1 } },
    ]);

    return NextResponse.json({ teams });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await withAdmin(request);

    const { name, label, color } = await request.json();
    const team = await Team.create({ name: name?.toLowerCase(), label, color });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
