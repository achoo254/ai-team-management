import { NextRequest, NextResponse } from "next/server";
import { withAdmin, errorResponse } from "@/lib/api-helpers";
import { Schedule } from "@/models/schedule";

// DELETE (admin): Clear ALL schedules
export async function DELETE(request: NextRequest) {
  try {
    await withAdmin(request);

    const result = await Schedule.deleteMany({});

    return NextResponse.json({
      message: "All schedules cleared",
      deleted: result.deletedCount,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
