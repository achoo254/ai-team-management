import { NextRequest, NextResponse } from "next/server";
import { withAdmin, errorResponse, ApiError } from "@/lib/api-helpers";
import { Alert } from "@/models/alert";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await withAdmin(request);
    const { id } = await params;

    const alert = await Alert.findOneAndUpdate(
      { _id: id, resolved: false },
      { resolved: true, resolved_by: user.name, resolved_at: new Date() },
      { new: true },
    ).lean();

    if (!alert) throw new ApiError(404, "Alert not found or already resolved");

    return NextResponse.json(alert);
  } catch (error) {
    return errorResponse(error);
  }
}
