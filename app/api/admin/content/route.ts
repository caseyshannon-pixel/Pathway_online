import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { saveSessions, validateSessions } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!isAdmin(session)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  let body: { sessions?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const checked = validateSessions(body.sessions);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  try {
    await saveSessions(checked.sessions);
  } catch (err) {
    if (err instanceof Error && err.message === "STORAGE_NOT_SET_UP") {
      return NextResponse.json(
        { error: "Saving isn't set up yet. Connect a Blob store to this project in Vercel first." },
        { status: 503 },
      );
    }
    console.error("Could not save course content:", err);
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ sessions: checked.sessions });
}
