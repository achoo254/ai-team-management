import { NextRequest, NextResponse } from "next/server";
import { withAdmin, errorResponse } from "@/lib/api-helpers";
import { sendWeeklyReport } from "@/services/telegram-service";

// Module-level cooldown state (60s)
let lastReportSent = 0;
const COOLDOWN_MS = 60_000;

export async function POST(request: NextRequest) {
  try {
    await withAdmin(request);

    const now = Date.now();
    const elapsed = now - lastReportSent;
    if (lastReportSent > 0 && elapsed < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json(
        { error: "Rate limited", waitSeconds: waitSec },
        { status: 429 },
      );
    }

    lastReportSent = now;
    await sendWeeklyReport();

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
