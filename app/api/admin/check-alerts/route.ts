import { NextRequest, NextResponse } from "next/server";
import { withAdmin, errorResponse } from "@/lib/api-helpers";
import { checkAlerts } from "@/services/alert-service";

export async function POST(request: NextRequest) {
  try {
    await withAdmin(request);
    const result = await checkAlerts();
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
