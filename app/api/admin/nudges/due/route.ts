import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { previewDue } from "@/lib/nudge";
import { rateLimit, tooMany } from "@/lib/security";

export const dynamic = "force-dynamic";

// Who would be nudged right now. Sends nothing.
export async function GET() {
  const session = await getSession();
  if (!(await isAdmin(session))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!rateLimit(`admin-nudge-due:${session!.personId}`, 20, 60_000)) return tooMany();
  try {
    return NextResponse.json(await previewDue());
  } catch (err) {
    console.error("Nudge preview failed:", err);
    return NextResponse.json({ error: "Could not load. Please try again." }, { status: 500 });
  }
}
