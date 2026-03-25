import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { withAuth, withAdmin, errorResponse } from "@/lib/api-helpers";
import { Seat } from "@/models/seat";
import { User } from "@/models/user";

// GET (auth): List seats with assigned users
export async function GET(request: NextRequest) {
  try {
    await withAuth(request);

    const seats = await Seat.find().sort({ _id: 1 }).lean();
    const users = await User.find(
      { active: true, seat_id: { $ne: null } },
      "name email seat_id",
    ).lean();

    // Group users by seat_id string key
    const usersBySeat: Record<string, typeof users> = {};
    for (const user of users) {
      const key = String(user.seat_id);
      if (!usersBySeat[key]) usersBySeat[key] = [];
      usersBySeat[key].push(user);
    }

    const enriched = seats.map((seat) => ({
      ...seat,
      users: (usersBySeat[String(seat._id)] || []).map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
      })),
    }));

    return NextResponse.json({ seats: enriched });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST (admin): Create seat
export async function POST(request: NextRequest) {
  try {
    await withAdmin(request);

    const { email, label, team, max_users } = await request.json();

    if (!email || !label || !team) {
      return NextResponse.json(
        { error: "email, label, team are required" },
        { status: 400 },
      );
    }

    const seat = await Seat.create({ email, label, team, max_users });
    return NextResponse.json(seat, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
