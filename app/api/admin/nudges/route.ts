import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { getNudgeSettings, saveNudgeSettings, validateNudge } from "@/lib/nudgeSettings";
import { forbidden, rateLimit, sameOrigin, tooMany } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const session = await getSession();
  if (!(await isAdmin(session))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!rateLimit(`admin-nudges:${session!.personId}`, 30, 60_000)) return tooMany();

  let body: { settings?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const checked = validateNudge(body.settings, await getNudgeSettings());
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  try {
    await saveNudgeSettings(checked.settings);
  } catch (err) {
    if (err instanceof Error && err.message === "STORAGE_NOT_SET_UP") {
      return NextResponse.json({ error: "Saving isn't set up yet. Connect a Blob store to this project in Vercel first." }, { status: 503 });
    }
    console.error("Could not save nudge settings:", err);
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
  }
  console.log(`Admin ${session!.personId} saved nudge settings (enabled: ${checked.settings.enabled}).`);
  return NextResponse.json({ settings: checked.settings });
}
