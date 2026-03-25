import { NextRequest, NextResponse } from "next/server";
import { withAuth, errorResponse } from "@/lib/api-helpers";
import { User } from "@/models/user";

export async function GET(request: NextRequest) {
  try {
    const authUser = await withAuth(request);
    const user = await User.findById(authUser._id)
      .select("name email role team seat_id")
      .lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({
      user: { id: user._id, ...user },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
