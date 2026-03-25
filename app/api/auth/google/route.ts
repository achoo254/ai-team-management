import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { signToken, setTokenCookie } from "@/lib/auth";
import { User } from "@/models/user";
import { connectDb } from "@/lib/mongoose";
import { errorResponse, ApiError } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken) throw new ApiError(400, "idToken is required");

    // Verify Firebase token
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/id-token-expired") {
        throw new ApiError(401, "Token expired");
      }
      throw new ApiError(401, "Invalid token");
    }

    const email = decoded.email;
    if (!email) throw new ApiError(401, "No email in token");

    await connectDb();
    const user = await User.findOne({ email }).lean();
    if (!user) throw new ApiError(401, "User not found");

    const payload = {
      _id: String(user._id),
      name: user.name,
      email: user.email ?? email,
      role: user.role,
      team: user.team,
    };

    const token = signToken(payload);
    await setTokenCookie(token);

    return NextResponse.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        team: user.team,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
