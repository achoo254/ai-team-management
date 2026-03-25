import { NextRequest, NextResponse } from "next/server";
import { withAdmin, errorResponse } from "@/lib/api-helpers";
import { User } from "@/models/user";

export async function PATCH(request: NextRequest) {
  try {
    const user = await withAdmin(request);
    const { active } = await request.json();

    // Exclude self from deactivation; if deactivating all, self stays active
    await User.updateMany({ _id: { $ne: user._id } }, { active });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
