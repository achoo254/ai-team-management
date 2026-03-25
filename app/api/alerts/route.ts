import { NextRequest, NextResponse } from "next/server";
import { withAuth, errorResponse } from "@/lib/api-helpers";
import { Alert } from "@/models/alert";

export async function GET(request: NextRequest) {
  try {
    await withAuth(request);

    const { searchParams } = new URL(request.url);
    const resolvedParam = searchParams.get("resolved");

    const filter: Record<string, unknown> = {};
    if (resolvedParam === "0") filter.resolved = false;
    else if (resolvedParam === "1") filter.resolved = true;

    const alerts = await Alert.find(filter).sort({ created_at: -1 }).lean();
    return NextResponse.json({ alerts });
  } catch (error) {
    return errorResponse(error);
  }
}
