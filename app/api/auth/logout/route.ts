import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { errorResponse } from "@/lib/api-helpers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("token");
    return NextResponse.json({ message: "Logged out" });
  } catch (error) {
    return errorResponse(error);
  }
}
