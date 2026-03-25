import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/mongoose";
import { sendLogReminder } from "@/services/telegram-service";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDb();
    await sendLogReminder();
    return NextResponse.json({ message: "Reminder sent" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
